namespace StoneStock.Application.Auditing;

public sealed record AuditLogDto(
    int Id,
    DateTimeOffset CreatedAt,
    string UserName,
    string Action,
    string RecordType,
    string RecordId,
    string? Details);
