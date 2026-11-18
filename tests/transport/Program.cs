using System.Diagnostics;
using System.Net.WebSockets;
using System.Security.Cryptography;
using ChatBridge;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

static void Check(bool result, string message) { if (!result) throw new Exception(message); }
var options = ChatOptions.Load(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
{
    ["Auth:SigningKey"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)),
    ["Interbackend:ServiceKey"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)),
    ["Auth:Issuer"] = "test", ["Auth:Audience"] = "test-client",
    ["DemoUser:Username"] = "web-demo", ["DemoUser:Name"] = "Web",
    ["DemoUser:Password"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
}).Build(), "web");

using (var socket = new ControlledSocket(10))
using (var connection = new SocketConnection(socket, NullLogger.Instance))
{
    await Task.WhenAll(Enumerable.Range(0, 20).Select(i => connection.SendAsync(new { i }, CancellationToken.None)));
    Check(socket.MaxWriters == 1, "Concurrent sends overlapped");
    Console.WriteLine("PASS serialized sends: 20 sends, max active writers=1");
}
using (var socket = new ControlledSocket(Timeout.Infinite))
using (var connection = new SocketConnection(socket, NullLogger.Instance))
{
    var timer = Stopwatch.StartNew();
    try { await connection.SendAsync(new { type = "test" }, CancellationToken.None); throw new Exception("Missing timeout"); }
    catch (OperationCanceledException) { Check(timer.Elapsed.TotalSeconds < 4, "Timeout too slow"); }
    Console.WriteLine("PASS slow writer: cancelled within configured 2-second timeout");
}
using (var socket = new ControlledSocket(Timeout.Infinite))
using (var connection = new SocketConnection(socket, NullLogger.Instance))
{
    var hub = new ClientHub(options, NullLogger<ClientHub>.Instance);
    var session = hub.Register(connection, CancellationToken.None)!;
    var timer = Stopwatch.StartNew();
    for (var i = 0; i < 101; i++) hub.Publish(new { i });
    Check(session.Token.IsCancellationRequested, "Queue overflow did not disconnect slow client");
    Check(timer.Elapsed < TimeSpan.FromSeconds(1), "Local publication blocked caller");
    hub.Remove(session); session.Dispose();
    Console.WriteLine("PASS slow client queue: bounded at 100, publish nonblocking, overflow cancels session");
}
using (var socket = new ControlledSocket(0))
using (var connection = new SocketConnection(socket, NullLogger.Instance))
using (var lifetime = new CancellationTokenSource())
{
    var hub = new ClientHub(options, NullLogger<ClientHub>.Instance);
    using var peer = new PeerTransport(options, hub, new MessageCache(options), NullLogger<PeerTransport>.Instance);
    Check(peer.TryAttach(connection), "Attach failed");
    var loop = peer.RunConnectionAsync(connection, lifetime.Token);
    lifetime.Cancel();
    await loop.WaitAsync(TimeSpan.FromSeconds(3));
    Check(peer.Status == "disconnected", "Cancelled peer still registered");
    Console.WriteLine("PASS cancellation: reader/heartbeat stopped and peer removed");
}

sealed class ControlledSocket(int sendDelay) : WebSocket
{
    private WebSocketState state = WebSocketState.Open;
    private int writers;
    public int MaxWriters { get; private set; }
    public override WebSocketCloseStatus? CloseStatus => null;
    public override string? CloseStatusDescription => null;
    public override WebSocketState State => state;
    public override string? SubProtocol => null;
    public override void Abort() => state = WebSocketState.Aborted;
    public override void Dispose() => state = WebSocketState.Closed;
    public override Task CloseAsync(WebSocketCloseStatus status, string? description, CancellationToken ct)
    { state = WebSocketState.Closed; return Task.CompletedTask; }
    public override Task CloseOutputAsync(WebSocketCloseStatus status, string? description, CancellationToken ct)
    { state = WebSocketState.CloseSent; return Task.CompletedTask; }
    public override async Task<WebSocketReceiveResult> ReceiveAsync(ArraySegment<byte> buffer, CancellationToken ct)
    { await Task.Delay(Timeout.Infinite, ct); throw new InvalidOperationException(); }
    public override async Task SendAsync(ArraySegment<byte> buffer, WebSocketMessageType type, bool end, CancellationToken ct)
    {
        var active = Interlocked.Increment(ref writers);
        MaxWriters = Math.Max(MaxWriters, active);
        try { await Task.Delay(sendDelay, ct); }
        finally { Interlocked.Decrement(ref writers); }
    }
}
