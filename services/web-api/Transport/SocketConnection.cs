using System.Net.WebSockets;
using System.Text.Json;

namespace ChatBridge;

// Exactly one reader (owner loop) and one serialized writer per socket.
public sealed class SocketConnection(WebSocket socket, ILogger logger) : IDisposable
{
    private readonly SemaphoreSlim sendLock = new(1, 1);
    public WebSocket Socket { get; } = socket;
    public bool Open => Socket.State == WebSocketState.Open;

    public async Task SendAsync(object value, CancellationToken ct)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(2));
        await sendLock.WaitAsync(timeout.Token);
        try
        {
            var bytes = JsonSerializer.SerializeToUtf8Bytes(value, Protocol.Json);
            await Socket.SendAsync(bytes.AsMemory(), WebSocketMessageType.Text, true, timeout.Token);
        }
        finally { sendLock.Release(); }
    }

    public async Task<JsonDocument?> ReceiveAsync(CancellationToken ct)
    {
        var buffer = new byte[4096];
        using var data = new MemoryStream();
        while (true)
        {
            var result = await Socket.ReceiveAsync(buffer.AsMemory(), ct);
            if (result.MessageType == WebSocketMessageType.Close) return null;
            if (result.MessageType != WebSocketMessageType.Text)
            {
                await CloseAsync(WebSocketCloseStatus.InvalidMessageType, "Text only", ct);
                return null;
            }
            if (data.Length + result.Count > 16384)
            {
                await CloseAsync(WebSocketCloseStatus.MessageTooBig, "Message too large", ct);
                return null;
            }
            data.Write(buffer, 0, result.Count);
            if (result.EndOfMessage) break;
        }
        return JsonDocument.Parse(data.ToArray(), new JsonDocumentOptions { MaxDepth = 16 });
    }

    public async Task CloseAsync(WebSocketCloseStatus status, string reason, CancellationToken ct)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(2));
        var acquired = false;
        try
        {
            await sendLock.WaitAsync(timeout.Token);
            acquired = true;
            if (Socket.State is WebSocketState.Open or WebSocketState.CloseReceived)
                await Socket.CloseOutputAsync(status, reason, timeout.Token);
        }
        catch (Exception ex) when (ex is WebSocketException or OperationCanceledException)
        { logger.LogDebug("Socket close interrupted: {Reason}", ex.GetType().Name); }
        finally { if (acquired) sendLock.Release(); }
    }

    public void Dispose() { Socket.Abort(); Socket.Dispose(); }
}
