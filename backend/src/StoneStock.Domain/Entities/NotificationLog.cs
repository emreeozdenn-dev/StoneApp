using StoneStock.Domain.Enums;

namespace StoneStock.Domain.Entities;

public sealed class NotificationLog
{
    public int Id { get; set; }
    public NotificationType Type { get; set; }
    public string Recipient { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public DateTimeOffset? SentAt { get; set; }
    public NotificationStatus Status { get; set; } = NotificationStatus.Pending;
    public string? ErrorMessage { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
