using System.Globalization;
using System.Net.WebSockets;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;

namespace ChatBridge;

public static class Program
{
    public static async Task Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        // Request-start logging can contain query JWTs. Never enable it for these endpoints.
        builder.Logging.AddFilter("Microsoft.AspNetCore", LogLevel.Warning);
        builder.WebHost.ConfigureKestrel(server => server.Limits.MaxRequestBodySize = 4096);
        var options = ChatOptions.Load(builder.Configuration, "web");
        builder.Services.AddSingleton(options);
        builder.Services.AddSingleton<AuthService>();
        builder.Services.AddSingleton<ClientHub>();
        builder.Services.AddSingleton<MessageCache>();
        builder.Services.AddSingleton<PeerTransport>();
        builder.Services.AddHostedService(sp => sp.GetRequiredService<PeerTransport>());
        builder.Services.AddSingleton<ChatService>();
        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(jwt =>
        {
            jwt.MapInboundClaims = false;
            jwt.TokenValidationParameters = new AuthService(options).Validation;
            jwt.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    if (context.Request.Path == "/ws/chat")
                        context.Token = context.Request.Query["access_token"].ToString();
                    return Task.CompletedTask;
                }
            };
        });
        builder.Services.AddCors(cors => cors.AddDefaultPolicy(policy =>
            policy.WithOrigins(options.AllowedOrigin).WithMethods("POST").WithHeaders("Content-Type")));
        var app = builder.Build();
        app.UseCors();
        app.UseWebSockets();
        app.UseAuthentication();

        app.MapGet("/health", (PeerTransport peer) => Results.Ok(new { status = "ok", interbackend = peer.Status }));
        app.MapPost("/auth/login", async (HttpContext context, AuthService auth) =>
        {
            try
            {
                var login = await context.Request.ReadFromJsonAsync<LoginRequest>(context.RequestAborted);
                if (login is null) return Results.BadRequest(new { code = "invalid_payload", message = "JSON inválido." });
                var result = auth.Login(login);
                return result is null
                    ? Results.Json(new { code = "invalid_credentials", message = "Credenciais inválidas." }, statusCode: 401)
                    : Results.Ok(result);
            }
            catch (Exception ex) when (ex is JsonException or BadHttpRequestException or InvalidOperationException)
            { return Results.BadRequest(new { code = "invalid_payload", message = "Requisição inválida." }); }
        });
        app.Map("/ws/chat", ClientEndpointAsync);
        if (options.Origin == "mobile")
        {
            var peerGate = new SemaphoreSlim(1, 1);
            app.Map("/internal/ws", async (HttpContext context, PeerTransport peer, ILoggerFactory logs,
                IHostApplicationLifetime application) =>
            {
                if (!AuthService.SecretEquals(context.Request.Headers.Authorization.ToString(), "Bearer " + options.ServiceKey))
                { context.Response.StatusCode = 401; return; }
                if (!context.WebSockets.IsWebSocketRequest) { context.Response.StatusCode = 400; return; }
                if (!await peerGate.WaitAsync(0, context.RequestAborted))
                { context.Response.StatusCode = 409; return; }
                try
                {
                    using var socket = await context.WebSockets.AcceptWebSocketAsync();
                    using var connection = new SocketConnection(socket, logs.CreateLogger("PeerSocket"));
                    using var stopping = CancellationTokenSource.CreateLinkedTokenSource(
                        context.RequestAborted, application.ApplicationStopping);
                    if (peer.TryAttach(connection))
                        await peer.RunConnectionAsync(connection, stopping.Token);
                }
                finally { peerGate.Release(); }
            });
        }
        await app.RunAsync();
    }

    private static async Task ClientEndpointAsync(HttpContext context, ChatOptions options,
        ClientHub hub, ChatService chat, PeerTransport peer, ILoggerFactory logs,
        IHostApplicationLifetime application)
    {
        var auth = await context.AuthenticateAsync();
        if (!auth.Succeeded || auth.Principal?.FindFirst("sub")?.Value != options.Username ||
            auth.Principal.FindFirst("name")?.Value != options.DisplayName ||
            !long.TryParse(auth.Principal.FindFirst("exp")?.Value, NumberStyles.None,
                CultureInfo.InvariantCulture, out var expires))
        { context.Response.StatusCode = 401; return; }
        var origin = context.Request.Headers.Origin.ToString();
        if ((options.Origin == "web" || origin.Length > 0) && origin != options.AllowedOrigin)
        { context.Response.StatusCode = 403; return; }
        if (!context.WebSockets.IsWebSocketRequest) { context.Response.StatusCode = 400; return; }
        var remaining = DateTimeOffset.FromUnixTimeSeconds(expires) - DateTimeOffset.UtcNow;
        if (remaining <= TimeSpan.Zero) { context.Response.StatusCode = 401; return; }
        var logger = logs.CreateLogger("ClientSocket");
        using var socket = await context.WebSockets.AcceptWebSocketAsync();
        using var connection = new SocketConnection(socket, logger);
        using var lifetime = CancellationTokenSource.CreateLinkedTokenSource(
            context.RequestAborted, application.ApplicationStopping);
        var session = hub.Register(connection, lifetime.Token);
        if (session is null)
        {
            // No reader was started for a rejected session. Complete the close handshake
            // before Dispose aborts the socket, otherwise the client may see 1006/reset.
            using var closeTimeout = CancellationTokenSource.CreateLinkedTokenSource(lifetime.Token);
            closeTimeout.CancelAfter(TimeSpan.FromSeconds(2));
            try { await socket.CloseAsync(WebSocketCloseStatus.PolicyViolation, "Client limit", closeTimeout.Token); }
            catch (Exception ex) when (ex is WebSocketException or OperationCanceledException)
            { logger.LogDebug("Rejected client close interrupted: {Reason}", ex.GetType().Name); }
            return;
        }
        var writer = session.RunWriterAsync();
        var expiry = ExpireAsync(connection, remaining, lifetime, logger);
        var work = new List<Task>();
        session.Enqueue(new { type = "connection.status", interbackend = peer.Status });
        try
        {
            while (!session.Token.IsCancellationRequested && connection.Open)
            {
                JsonDocument? document;
                try { document = await connection.ReceiveAsync(session.Token); }
                catch (JsonException)
                {
                    session.Enqueue(Protocol.Error(null, "invalid_json"));
                    continue;
                }
                using (document)
                {
                    if (document is null) break;
                    if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() >= expires) break;
                    work.RemoveAll(task => task.IsCompleted);
                    if (work.Count >= 100)
                    {
                        session.Enqueue(Protocol.Error(Protocol.Id(document.RootElement), "busy"));
                        continue;
                    }
                    // Clone because completion can outlive the receive document.
                    work.Add(ProcessAsync(document.RootElement.Clone(), auth.Principal, chat, session, logger));
                }
            }
        }
        catch (Exception ex) when (ex is WebSocketException or OperationCanceledException or ObjectDisposedException)
        { logger.LogDebug("Client disconnected: {Reason}", ex.GetType().Name); }
        finally
        {
            lifetime.Cancel();
            hub.Remove(session);
            await Task.WhenAll(work);
            await writer;
            await expiry;
            await connection.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
            session.Dispose();
        }
    }

    private static async Task ProcessAsync(JsonElement input, System.Security.Claims.ClaimsPrincipal user,
        ChatService chat, ClientSession session, ILogger logger)
    {
        try { session.Enqueue(await chat.SendAsync(input, user, session.Token)); }
        catch (OperationCanceledException) { logger.LogDebug("Client request cancelled"); }
    }

    private static async Task ExpireAsync(SocketConnection connection, TimeSpan remaining,
        CancellationTokenSource lifetime, ILogger logger)
    {
        try
        {
            await Task.Delay(remaining, lifetime.Token);
            await connection.SendAsync(Protocol.Error(null, "session_expired"), lifetime.Token);
            await connection.CloseAsync(WebSocketCloseStatus.PolicyViolation, "Session expired", lifetime.Token);
            // Let the sole reader observe the peer's close response before cancelling it.
            // Cancelling ReceiveAsync immediately can abort the socket before close 1008 is flushed.
            await Task.Delay(TimeSpan.FromSeconds(2), lifetime.Token);
            lifetime.Cancel();
        }
        catch (Exception ex) when (ex is OperationCanceledException or WebSocketException or ObjectDisposedException)
        { logger.LogDebug("Session expiration task stopped: {Reason}", ex.GetType().Name); }
    }
}
