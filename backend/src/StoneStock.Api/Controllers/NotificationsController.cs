using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StoneStock.Api.Auth;
using StoneStock.Application.Notifications;
using StoneStock.Domain.Security;
using StoneStock.Infrastructure.Persistence;

namespace StoneStock.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize(AuthenticationSchemes = CookieAuth.SchemeName, Policy = PermissionKeys.NotificationsView)]
public sealed class NotificationsController : ControllerBase
{
    private readonly AppDbContext _db;

    public NotificationsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var logs = await _db.NotificationLogs
            .OrderByDescending(n => n.CreatedAt)
            .Take(500)
            .Select(n => new NotificationLogDto(
                n.Id, n.Type.ToString(), n.Recipient, n.Subject, n.Status.ToString(),
                n.SentAt, n.ErrorMessage, n.CreatedAt))
            .ToListAsync(ct);

        return Ok(logs);
    }
}
