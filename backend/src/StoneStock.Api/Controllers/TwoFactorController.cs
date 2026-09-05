using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StoneStock.Api.Auditing;
using StoneStock.Api.Auth;
using StoneStock.Application.Auth;
using StoneStock.Domain.Security;
using StoneStock.Infrastructure.Persistence;

namespace StoneStock.Api.Controllers;

[ApiController]
[Route("api/2fa")]
[Authorize(AuthenticationSchemes = CookieAuth.SchemeName)]
public sealed class TwoFactorController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ITotpService _totpService;
    private readonly IDataProtectionProvider _dataProtectionProvider;

    public TwoFactorController(AppDbContext db, ITotpService totpService, IDataProtectionProvider dataProtectionProvider)
    {
        _db = db;
        _totpService = totpService;
        _dataProtectionProvider = dataProtectionProvider;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    [HttpGet("status")]
    public async Task<ActionResult<TwoFactorStatusDto>> Status(CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([CurrentUserId], ct);
        if (user is null)
        {
            return Unauthorized();
        }

        return Ok(new TwoFactorStatusDto(user.TwoFactorEnabled));
    }

    [HttpPost("setup")]
    public async Task<ActionResult<TwoFactorSetupResult>> Setup(CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([CurrentUserId], ct);
        if (user is null)
        {
            return Unauthorized();
        }

        if (user.TwoFactorEnabled)
        {
            return BadRequest(new { message = "İki faktörlü doğrulama zaten etkin. Önce kapatın." });
        }

        var secret = _totpService.GenerateSecret();
        var protector = _dataProtectionProvider.CreateProtector(TwoFactorConstants.ProtectorName);
        user.TwoFactorSecretEncrypted = protector.Protect(secret);
        await _db.SaveChangesAsync(ct);

        return Ok(new TwoFactorSetupResult(secret, _totpService.BuildOtpAuthUri(secret, user.Email)));
    }

    [HttpPost("enable")]
    public async Task<IActionResult> Enable([FromBody] TwoFactorCodeRequest request, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([CurrentUserId], ct);
        if (user is null)
        {
            return Unauthorized();
        }

        if (string.IsNullOrEmpty(user.TwoFactorSecretEncrypted))
        {
            return BadRequest(new { message = "Önce QR kodu okutup kurulumu başlatın." });
        }

        var protector = _dataProtectionProvider.CreateProtector(TwoFactorConstants.ProtectorName);
        var secret = protector.Unprotect(user.TwoFactorSecretEncrypted);

        if (!_totpService.VerifyCode(secret, request.Code))
        {
            return BadRequest(new { message = "Kod hatalı. Lütfen tekrar deneyin." });
        }

        user.TwoFactorEnabled = true;
        user.TwoFactorEnabledAt = DateTimeOffset.UtcNow;
        AuditLogWriter.Log(_db, User, "TwoFactorEnabled", "User", user.Username, user.Username);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "İki faktörlü doğrulama etkinleştirildi." });
    }

    [HttpPost("disable")]
    public async Task<IActionResult> Disable([FromBody] TwoFactorCodeRequest request, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([CurrentUserId], ct);
        if (user is null)
        {
            return Unauthorized();
        }

        if (!user.TwoFactorEnabled || string.IsNullOrEmpty(user.TwoFactorSecretEncrypted))
        {
            return BadRequest(new { message = "İki faktörlü doğrulama zaten kapalı." });
        }

        var protector = _dataProtectionProvider.CreateProtector(TwoFactorConstants.ProtectorName);
        var secret = protector.Unprotect(user.TwoFactorSecretEncrypted);

        if (!_totpService.VerifyCode(secret, request.Code))
        {
            return BadRequest(new { message = "Kod hatalı." });
        }

        user.TwoFactorEnabled = false;
        user.TwoFactorSecretEncrypted = null;
        user.TwoFactorEnabledAt = null;
        AuditLogWriter.Log(_db, User, "TwoFactorDisabled", "User", user.Username, user.Username);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "İki faktörlü doğrulama kapatıldı." });
    }

    [HttpPost("admin-reset/{userId:int}")]
    [Authorize(Policy = PermissionKeys.UsersManage)]
    public async Task<IActionResult> AdminReset(int userId, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([userId], ct);
        if (user is null)
        {
            return NotFound();
        }

        user.TwoFactorEnabled = false;
        user.TwoFactorSecretEncrypted = null;
        user.TwoFactorEnabledAt = null;
        AuditLogWriter.Log(_db, User, "TwoFactorReset", "User", user.Username, user.Username);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Kullanıcının iki faktörlü doğrulaması sıfırlandı." });
    }
}
