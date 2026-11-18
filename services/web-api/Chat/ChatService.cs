using System.Text.Json;
using System.Security.Claims;
namespace ChatBridge;

public sealed class ChatService(ChatOptions options, MessageCache cache, PeerTransport peer)
{
    public async Task<object> SendAsync(JsonElement input, ClaimsPrincipal user, CancellationToken ct)
    {
        var id = Protocol.Id(input);
        if (input.ValueKind != JsonValueKind.Object || Protocol.HasDuplicateProperties(input))
            return Protocol.Error(id, "invalid_payload");
        if (Protocol.Text(input, "type") != "chat.send") return Protocol.Error(id, "unsupported_type");
        if (id is null) return Protocol.Error(null, "invalid_message_id");
        if (input.TryGetProperty("roomId", out _) && Protocol.Text(input, "roomId") != "general")
            return Protocol.Error(id, "invalid_room");
        var content = Protocol.Text(input, "content")?.Trim();
        if (string.IsNullOrEmpty(content)) return Protocol.Error(id, "invalid_content");
        if (content.Length > 2000) return Protocol.Error(id, "content_too_long");
        var sender = user.FindFirst("sub")!.Value;
        var reservation = cache.Reserve($"{options.Origin}:{sender}:{id}", content, id.Value);
        if (reservation.Owner is not null)
        {
            object result;
            try
            {
                result = await peer.ForwardAsync(new ChatMessage("chat.message", id.Value,
                    "general", sender, user.FindFirst("name")!.Value, options.Origin,
                    content, DateTime.UtcNow), ct);
            }
            catch (OperationCanceledException) { result = Protocol.Error(id, "connection_lost"); }
            reservation.Owner.TrySetResult(result);
        }
        return await reservation.Result.WaitAsync(ct);
    }
}
