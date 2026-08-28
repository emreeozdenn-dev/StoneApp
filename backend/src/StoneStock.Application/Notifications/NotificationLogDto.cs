namespace StoneStock.Application.Notifications;

public sealed record NotificationLogDto(
    int Id,
    string Type,
    string Recipient,
    string Subject,
    string Status,
    DateTimeOffset? SentAt,
    string? ErrorMessage,
    DateTimeOffset CreatedAt);
