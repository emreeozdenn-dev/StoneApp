namespace StoneStock.Domain.Entities;

public sealed class AuditLog
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string Action { get; set; } = string.Empty;
    public string RecordType { get; set; } = string.Empty;
    public string RecordId { get; set; } = string.Empty;
    public string? Details { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
