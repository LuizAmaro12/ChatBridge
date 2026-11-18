namespace ChatBridge;

public sealed class MessageCache(ChatOptions options)
{
    private sealed record Entry(string Content, DateTime Expires, TaskCompletionSource<object> Result);
    private readonly Dictionary<string, Entry> entries = new();
    private readonly object gate = new();

    public (Task<object> Result, TaskCompletionSource<object>? Owner) Reserve(
        string key, string content, Guid id)
    {
        lock (gate)
        {
            var now = DateTime.UtcNow;
            foreach (var expired in entries.Where(p => p.Value.Expires <= now && p.Value.Result.Task.IsCompleted)
                         .Select(p => p.Key).ToArray())
                entries.Remove(expired);
            if (entries.TryGetValue(key, out var prior))
                return prior.Content == content ? (prior.Result.Task, null) :
                    (Task.FromResult<object>(Protocol.Error(id, "duplicate_conflict")), null);
            if (entries.Count >= options.CacheLimit)
                return (Task.FromResult<object>(Protocol.Error(id, "busy")), null);
            var result = new TaskCompletionSource<object>(TaskCreationOptions.RunContinuationsAsynchronously);
            entries.Add(key, new Entry(content, now.AddSeconds(options.RetentionSeconds), result));
            return (result.Task, result);
        }
    }
}
