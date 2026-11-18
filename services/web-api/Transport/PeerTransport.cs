using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text.Json;

namespace ChatBridge;

public sealed class PeerTransport(ChatOptions options, ClientHub hub, MessageCache cache,
    ILogger<PeerTransport> logger) : BackgroundService
{
    private sealed record Pending(SocketConnection Connection, TaskCompletionSource<object> Result);
    private readonly ConcurrentDictionary<Guid, Pending> pending = new();
    private readonly SemaphoreSlim pendingSlots = new(100, 100);
    private readonly object connectionLock = new();
    private SocketConnection? current;
    private string status = "disconnected";
    public string Status => Volatile.Read(ref status);

    private void SetStatus(string value)
    {
        Volatile.Write(ref status, value);
        hub.Publish(new { type = "connection.status", interbackend = value });
        logger.LogInformation("Interbackend {Status}", value);
    }
    public bool TryAttach(SocketConnection connection)
    {
        lock (connectionLock)
        {
            if (current is not null) return false;
            current = connection;
            SetStatus("connected");
            return true;
        }
    }

    public async Task<object> ForwardAsync(ChatMessage message, CancellationToken ct)
    {
        SocketConnection? connection;
        lock (connectionLock) connection = current;
        if (connection is null || !connection.Open)
            return Protocol.Error(message.MessageId, "remote_unavailable");
        if (!await pendingSlots.WaitAsync(0, ct)) return Protocol.Error(message.MessageId, "busy");
        var item = new Pending(connection,
            new TaskCompletionSource<object>(TaskCreationOptions.RunContinuationsAsynchronously));
        if (!pending.TryAdd(message.MessageId, item))
        {
            pendingSlots.Release();
            return Protocol.Error(message.MessageId, "busy");
        }
        try
        {
            await connection.SendAsync(message, ct);
            return await item.Result.Task.WaitAsync(TimeSpan.FromSeconds(options.AckSeconds), ct);
        }
        catch (TimeoutException) { return Protocol.Error(message.MessageId, "ack_timeout"); }
        catch (Exception ex) when (ex is WebSocketException or OperationCanceledException or ObjectDisposedException)
        {
            logger.LogDebug("Peer send interrupted for {MessageId}: {Reason}", message.MessageId, ex.GetType().Name);
            return Protocol.Error(message.MessageId, "connection_lost");
        }
        finally { pending.TryRemove(message.MessageId, out _); pendingSlots.Release(); }
    }

    public async Task RunConnectionAsync(SocketConnection connection, CancellationToken ct)
    {
        using var lifetime = CancellationTokenSource.CreateLinkedTokenSource(ct);
        var heartbeat = new HeartbeatState();
        var monitor = MonitorAsync(connection, heartbeat, lifetime);
        try
        {
            while (!lifetime.IsCancellationRequested && connection.Open)
            {
                JsonDocument? document;
                try { document = await connection.ReceiveAsync(lifetime.Token); }
                catch (JsonException)
                {
                    await connection.SendAsync(Protocol.Error(null, "invalid_json"), lifetime.Token);
                    continue;
                }
                using (document)
                {
                    if (document is null) break;
                    await HandleAsync(connection, document.RootElement, heartbeat, lifetime.Token);
                }
            }
        }
        catch (Exception ex) when (ex is WebSocketException or OperationCanceledException or ObjectDisposedException)
        { logger.LogInformation("Peer disconnected: {Reason}", ex.GetType().Name); }
        finally
        {
            lifetime.Cancel();
            await monitor;
            lock (connectionLock)
            {
                if (ReferenceEquals(current, connection)) { current = null; SetStatus("disconnected"); }
            }
            foreach (var item in pending.Where(p => ReferenceEquals(p.Value.Connection, connection)))
                item.Value.Result.TrySetResult(Protocol.Error(item.Key, "connection_lost"));
            await connection.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
        }
    }

    private sealed class HeartbeatState
    {
        public string? Nonce;
        public readonly object Gate = new();
    }
    private async Task MonitorAsync(SocketConnection connection, HeartbeatState state,
        CancellationTokenSource lifetime)
    {
        try
        {
            while (!lifetime.IsCancellationRequested)
            {
                await Task.Delay(TimeSpan.FromSeconds(options.HeartbeatSeconds), lifetime.Token);
                lock (state.Gate)
                {
                    if (state.Nonce is not null)
                    {
                        logger.LogWarning("Peer heartbeat timed out");
                        lifetime.Cancel();
                        connection.Socket.Abort();
                        return;
                    }
                    state.Nonce = Guid.NewGuid().ToString();
                }
                await connection.SendAsync(new { type = "connection.ping", nonce = state.Nonce }, lifetime.Token);
            }
        }
        catch (Exception ex) when (ex is OperationCanceledException or WebSocketException or ObjectDisposedException)
        {
            logger.LogDebug("Heartbeat stopped: {Reason}", ex.GetType().Name);
            lifetime.Cancel();
        }
    }

    private async Task HandleAsync(SocketConnection connection, JsonElement input,
        HeartbeatState heartbeat, CancellationToken ct)
    {
        var id = Protocol.Id(input);
        if (input.ValueKind != JsonValueKind.Object || Protocol.HasDuplicateProperties(input))
        {
            await connection.SendAsync(Protocol.Error(id, "invalid_payload"), ct);
            return;
        }
        var type = Protocol.Text(input, "type");
        if (type is "connection.ping" or "connection.pong")
        {
            var nonce = Protocol.Text(input, "nonce");
            if (!Guid.TryParse(nonce, out _)) return;
            if (type == "connection.ping")
                await connection.SendAsync(new { type = "connection.pong", nonce }, ct);
            else lock (heartbeat.Gate) { if (heartbeat.Nonce == nonce) heartbeat.Nonce = null; }
            return;
        }
        if (type is "chat.ack" or "chat.error")
        {
            if (id is not null && pending.TryGetValue(id.Value, out var item) &&
                ReferenceEquals(item.Connection, connection))
            {
                if (type == "chat.ack" && Protocol.Text(input, "status") == "remote_received")
                    item.Result.TrySetResult(new ChatAck(id.Value));
                else if (type == "chat.error")
                {
                    var code = Protocol.Text(input, "code");
                    if (code is "invalid_payload" or "duplicate_conflict" or "busy")
                        item.Result.TrySetResult(Protocol.Error(id, code));
                }
            }
            else logger.LogDebug("Ignored late/unknown peer response {MessageId}", id);
            return;
        }
        if (type != "chat.message")
        {
            await connection.SendAsync(Protocol.Error(id, "unsupported_type"), ct);
            return;
        }
        ChatMessage? message = null;
        try { message = input.Deserialize<ChatMessage>(Protocol.Json); }
        catch (JsonException) { /* Explicit invalid_payload response below. */ }
        if (message is null || id is null || message.Origin != options.RemoteOrigin ||
            message.RoomId != "general" || message.SenderId != options.RemoteOrigin + "-demo" ||
            string.IsNullOrWhiteSpace(message.SenderName) || message.SenderName.Length > 100 ||
            string.IsNullOrWhiteSpace(message.Content) || message.Content.Length > 2000 ||
            message.Content != message.Content.Trim() || message.Timestamp.Kind != DateTimeKind.Utc ||
            message.Timestamp == default || !((Protocol.Text(input, "timestamp") ?? "").EndsWith('Z')))
        {
            await connection.SendAsync(Protocol.Error(id, "invalid_payload"), ct);
            return;
        }
        var reservation = cache.Reserve($"{message.Origin}:{message.SenderId}:{id}", message.Content, id.Value);
        if (reservation.Owner is not null)
        {
            // Acceptance is independent from actual device delivery.
            reservation.Owner.TrySetResult(new ChatAck(id.Value));
            hub.Publish(message);
            logger.LogInformation("Remote message accepted {MessageId} from {Origin}", id, message.Origin);
        }
        await connection.SendAsync(await reservation.Result, ct);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (options.Origin != "web") return;
        var delay = 1;
        while (!stoppingToken.IsCancellationRequested)
        {
            SetStatus("connecting");
            var connectedAt = DateTime.UtcNow;
            try
            {
                using var socket = new ClientWebSocket();
                socket.Options.SetRequestHeader("Authorization", "Bearer " + options.ServiceKey);
                using var connectTimeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                connectTimeout.CancelAfter(TimeSpan.FromSeconds(5));
                await socket.ConnectAsync(new Uri(options.PeerUrl), connectTimeout.Token);
                using var connection = new SocketConnection(socket, logger);
                connectedAt = DateTime.UtcNow;
                if (TryAttach(connection)) await RunConnectionAsync(connection, stoppingToken);
            }
            catch (Exception ex) when (ex is WebSocketException or OperationCanceledException or HttpRequestException)
            { logger.LogInformation("Peer connection attempt failed: {Reason}", ex.GetType().Name); }
            if (stoppingToken.IsCancellationRequested) break;
            SetStatus("disconnected");
            if (DateTime.UtcNow - connectedAt >= TimeSpan.FromSeconds(30)) delay = 1;
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(Math.Min(30, delay * (1 + Random.Shared.NextDouble() * .2))),
                    stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            delay = Math.Min(30, delay * 2);
        }
    }
}
