using System.Security.Claims;
using StoneStock.Domain.Entities;
using StoneStock.Infrastructure.Persistence;

namespace StoneStock.Api.Auditing;

internal static class AuditLogWriter
{
    public static void Log(
        AppDbContext db, ClaimsPrincipal user, string action, string recordType, string recordId, string? details = null)
    {
        var userId = int.Parse(user.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        db.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = action,
            RecordType = recordType,
            RecordId = recordId,
            Details = details,
            CreatedAt = DateTimeOffset.UtcNow,
        });
    }
}
