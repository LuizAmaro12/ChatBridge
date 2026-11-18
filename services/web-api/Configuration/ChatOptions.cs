namespace ChatBridge;

public sealed class ChatOptions
{
    public required string Origin { get; init; }
    public string RemoteOrigin => Origin == "web" ? "mobile" : "web";
    public required string Username { get; init; }
    public required string DisplayName { get; init; }
    public required string Password { get; init; }
    public required string SigningKey { get; init; }
    public required string Issuer { get; init; }
    public required string Audience { get; init; }
    public required string ServiceKey { get; init; }
    public required string PeerUrl { get; init; }
    public required string AllowedOrigin { get; init; }
    public int TokenSeconds { get; init; }
    public int AckSeconds { get; init; }
    public int HeartbeatSeconds { get; init; }
    public int RetentionSeconds { get; init; }
    public int CacheLimit { get; init; }
    public int MaxClients { get; init; }

    public static ChatOptions Load(IConfiguration c, string origin)
    {
        string Required(string key) => !string.IsNullOrWhiteSpace(c[key]) ? c[key]! :
            throw new InvalidOperationException($"Configuração obrigatória ausente: {key}");
        int Number(string key, int fallback, int min, int max)
        {
            var value = c.GetValue<int?>(key) ?? fallback;
            return value >= min && value <= max ? value :
                throw new InvalidOperationException($"Configuração fora do limite: {key}");
        }
        var signingKey = Required("Auth:SigningKey");
        var serviceKey = Required("Interbackend:ServiceKey");
        if (System.Text.Encoding.UTF8.GetByteCount(signingKey) < 32 ||
            System.Text.Encoding.UTF8.GetByteCount(serviceKey) < 32 || signingKey == serviceKey)
            throw new InvalidOperationException("Chaves devem ter ao menos 32 bytes e ser distintas.");
        return new ChatOptions
        {
            Origin = origin, Username = Required("DemoUser:Username"),
            DisplayName = Required("DemoUser:Name"), Password = Required("DemoUser:Password"),
            SigningKey = signingKey, ServiceKey = serviceKey,
            Issuer = Required("Auth:Issuer"), Audience = Required("Auth:Audience"),
            PeerUrl = c["Interbackend:Url"] ?? "ws://localhost:5002/internal/ws",
            AllowedOrigin = c["Cors:AllowedOrigin"] ?? "http://localhost:3000",
            TokenSeconds = Number("Auth:TokenSeconds", 3600, 1, 86400),
            AckSeconds = Number("Interbackend:AckTimeoutSeconds", 5, 1, 30),
            HeartbeatSeconds = Number("Interbackend:HeartbeatSeconds", 10, 1, 60),
            RetentionSeconds = Number("Chat:RetentionSeconds", 600, 1, 3600),
            CacheLimit = Number("Chat:CacheLimit", 10000, 1, 10000),
            MaxClients = Number("Chat:MaxClients", 100, 1, 1000)
        };
    }
}
