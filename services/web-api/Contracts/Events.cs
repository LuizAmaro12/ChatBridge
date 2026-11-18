using System.Text.Json;
using System.Text.Json.Serialization;

namespace ChatBridge;

public sealed record ChatMessage(string Type, Guid MessageId, string RoomId, string SenderId,
    string SenderName, string Origin, string Content, DateTime Timestamp);
public sealed record ChatAck(Guid MessageId)
{
    public string Type => "chat.ack";
    public string Status => "remote_received";
}
public sealed record ChatError(Guid? MessageId, string Code, string Message)
{
    public string Type => "chat.error";
}
public static class Protocol
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    { DefaultIgnoreCondition = JsonIgnoreCondition.Never };
    public static string? Text(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var p) &&
        p.ValueKind == JsonValueKind.String ? p.GetString() : null;
    public static Guid? Id(JsonElement e) =>
        Guid.TryParse(Text(e, "messageId"), out var id) && id != Guid.Empty ? id : null;
    public static bool HasDuplicateProperties(JsonElement e) => e.ValueKind switch
    {
        JsonValueKind.Object => e.EnumerateObject().GroupBy(p => p.Name).Any(g => g.Count() > 1)
            || e.EnumerateObject().Any(p => HasDuplicateProperties(p.Value)),
        JsonValueKind.Array => e.EnumerateArray().Any(HasDuplicateProperties),
        _ => false
    };
    public static ChatError Error(Guid? id, string code) => new(id, code, code switch
    {
        "remote_unavailable" => "Sem conexão com o outro sistema. Tente após reconectar.",
        "ack_timeout" or "connection_lost" => "Não foi possível confirmar a recepção; a mensagem pode ter chegado.",
        "invalid_content" => "Informe uma mensagem de texto não vazia.",
        "content_too_long" => "A mensagem deve ter no máximo 2000 caracteres.",
        "session_expired" => "Sessão expirada. Faça login novamente.",
        "busy" => "Limite temporário atingido. Tente novamente mais tarde.",
        _ => "Mensagem inválida: " + code
    });
}
