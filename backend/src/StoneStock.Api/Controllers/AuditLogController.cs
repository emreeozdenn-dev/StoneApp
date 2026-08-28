using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StoneStock.Api.Auth;
using StoneStock.Application.Auditing;
using StoneStock.Domain.Security;
using StoneStock.Infrastructure.Persistence;

namespace StoneStock.Api.Controllers;

[ApiController]
[Route("api/audit-log")]
[Authorize(AuthenticationSchemes = CookieAuth.SchemeName, Policy = PermissionKeys.AuditLogView)]
public sealed class AuditLogController : ControllerBase
{
    private readonly AppDbContext _db;

    public AuditLogController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var logs = await _db.AuditLogs
            .Include(a => a.User)
            .OrderByDescending(a => a.CreatedAt)
            .Take(500)
            .Select(a => new AuditLogDto(
                a.Id, a.CreatedAt, $"{a.User.FirstName} {a.User.LastName}",
                a.Action, a.RecordType, a.RecordId, a.Details))
            .ToListAsync(ct);

        return Ok(logs);
    }
}
