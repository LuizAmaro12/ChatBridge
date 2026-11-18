using System.Collections.Concurrent;
using System.Threading.Channels;
using System.Net.WebSockets;

namespace ChatBridge;

public sealed class ClientHub(ChatOptions options, ILogger<ClientHub> logger)
{
    private readonly ConcurrentDictionary<Guid, ClientSession> clients = new();
    private readonly object registrationLock = new();
    public ClientSession? Register(SocketConnection connection, CancellationToken ct)
    {
        lock (registrationLock)
        {
            if (clients.Count >= options.MaxClients) return null;
            var session = new ClientSession(connection, logger, ct);
            clients[session.Id] = session;
            return session;
        }
    }
    public void Remove(ClientSession session)
    {
        clients.TryRemove(session.Id, out _);
        session.Stop();
    }
    // Enqueue only: a slow device never holds up the peer reader or its ACK.
    public void Publish(object value)
    {
        foreach (var session in clients.Values)
            if (!session.Enqueue(value)) Remove(session);
    }
}

public sealed class ClientSession
{
    private readonly Channel<object> outgoing = Channel.CreateBounded<object>(
        new BoundedChannelOptions(100) { SingleReader = true, FullMode = BoundedChannelFullMode.Wait });
    private readonly CancellationTokenSource lifetime;
    private readonly ILogger logger;
    public Guid Id { get; } = Guid.NewGuid();
    public SocketConnection Connection { get; }
    public CancellationToken Token => lifetime.Token;
    public ClientSession(SocketConnection connection, ILogger logger, CancellationToken ct)
    {
        Connection = connection;
        this.logger = logger;
        lifetime = CancellationTokenSource.CreateLinkedTokenSource(ct);
    }
    public bool Enqueue(object value)
    {
        if (outgoing.Writer.TryWrite(value)) return true;
        logger.LogWarning("Disconnecting slow client {ClientId}: outgoing queue full", Id);
        Stop();
        return false;
    }
    public async Task RunWriterAsync()
    {
        try
        {
            await foreach (var value in outgoing.Reader.ReadAllAsync(Token))
                await Connection.SendAsync(value, Token);
        }
        catch (Exception ex) when (ex is OperationCanceledException or WebSocketException)
        { logger.LogDebug("Client writer stopped: {Reason}", ex.GetType().Name); }
        finally { Stop(); }
    }
    public void Stop()
    {
        outgoing.Writer.TryComplete();
        lifetime.Cancel();
    }
    public void Dispose() => lifetime.Dispose();
}
