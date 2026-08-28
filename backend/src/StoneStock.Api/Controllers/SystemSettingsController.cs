using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StoneStock.Api.Auditing;
using StoneStock.Api.Auth;
using StoneStock.Application.Notifications;
using StoneStock.Application.Settings;
using StoneStock.Application.Storage;
using StoneStock.Domain.Entities;
using StoneStock.Domain.Security;
using StoneStock.Infrastructure.Notifications;
using StoneStock.Infrastructure.Persistence;

namespace StoneStock.Api.Controllers;

[ApiController]
[Route("api/system-settings")]
[Authorize(AuthenticationSchemes = CookieAuth.SchemeName)]
public sealed class SystemSettingsController : ControllerBase
{
    private const string LogoBucket = "company-logos";
    private static readonly HashSet<string> AllowedImageTypes = new() { "image/jpeg", "image/png", "image/webp" };
    private const long MaxImageBytes = 5 * 1024 * 1024;

    private readonly AppDbContext _db;
    private readonly IDataProtectionProvider _dataProtectionProvider;
    private readonly IEmailSender _emailSender;
    private readonly ISupabaseStorageClient _storageClient;

    public SystemSettingsController(
        AppDbContext db, IDataProtectionProvider dataProtectionProvider, IEmailSender emailSender, ISupabaseStorageClient storageClient)
    {
        _db = db;
        _dataProtectionProvider = dataProtectionProvider;
        _emailSender = emailSender;
        _storageClient = storageClient;
    }

    [HttpGet]
    [Authorize(Policy = PermissionKeys.SettingsManage)]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var settings = await GetOrCreateAsync(ct);
        return Ok(Map(settings));
    }

    [HttpGet("branding")]
    [AllowAnonymous]
    public async Task<IActionResult> GetBranding(CancellationToken ct)
    {
        var settings = await GetOrCreateAsync(ct);
        return Ok(new CompanyBrandingDto(settings.CompanyName, settings.LogoUrl));
    }

    [HttpPut]
    [Authorize(Policy = PermissionKeys.SettingsManage)]
    public async Task<IActionResult> Update([FromBody] UpdateSystemSettingsRequest request, CancellationToken ct)
    {
        var settings = await GetOrCreateAsync(ct);

        settings.CompanyName = string.IsNullOrWhiteSpace(request.CompanyName) ? null : request.CompanyName.Trim();
        settings.SmtpHost = string.IsNullOrWhiteSpace(request.SmtpHost) ? null : request.SmtpHost.Trim();
        settings.SmtpPort = request.SmtpPort;
        settings.SmtpUsername = string.IsNullOrWhiteSpace(request.SmtpUsername) ? null : request.SmtpUsername.Trim();
        settings.SmtpSenderEmail = string.IsNullOrWhiteSpace(request.SmtpSenderEmail) ? null : request.SmtpSenderEmail.Trim();
        settings.SmtpSenderName = string.IsNullOrWhiteSpace(request.SmtpSenderName) ? null : request.SmtpSenderName.Trim();
        settings.SmtpUseSsl = request.SmtpUseSsl;
        settings.NotifyNewStock = request.NotifyNewStock;
        settings.NotifyLowStock = request.NotifyLowStock;
        settings.NotifyPlateSold = request.NotifyPlateSold;

        if (!string.IsNullOrWhiteSpace(request.NewStockSubjectTemplate))
        {
            settings.NewStockSubjectTemplate = request.NewStockSubjectTemplate.Trim();
        }
        if (!string.IsNullOrWhiteSpace(request.NewStockBodyTemplate))
        {
            settings.NewStockBodyTemplate = request.NewStockBodyTemplate.Trim();
        }
        if (!string.IsNullOrWhiteSpace(request.LowStockSubjectTemplate))
        {
            settings.LowStockSubjectTemplate = request.LowStockSubjectTemplate.Trim();
        }
        if (!string.IsNullOrWhiteSpace(request.LowStockBodyTemplate))
        {
            settings.LowStockBodyTemplate = request.LowStockBodyTemplate.Trim();
        }
        if (!string.IsNullOrWhiteSpace(request.PlateSoldSubjectTemplate))
        {
            settings.PlateSoldSubjectTemplate = request.PlateSoldSubjectTemplate.Trim();
        }
        if (!string.IsNullOrWhiteSpace(request.PlateSoldBodyTemplate))
        {
            settings.PlateSoldBodyTemplate = request.PlateSoldBodyTemplate.Trim();
        }

        if (request.ClearSmtpPassword)
        {
            settings.SmtpPasswordEncrypted = null;
        }
        else if (!string.IsNullOrEmpty(request.SmtpPassword))
        {
            settings.SmtpPasswordEncrypted = Protector.Protect(request.SmtpPassword);
        }

        AuditLogWriter.Log(_db, User, "Updated", "SystemSettings", "smtp", "SMTP / bildirim ayarları güncellendi.");
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Ayarlar kaydedildi." });
    }

    [HttpPost("logo")]
    [Authorize(Policy = PermissionKeys.SettingsManage)]
    public async Task<IActionResult> UploadLogo(IFormFile logo, CancellationToken ct)
    {
        var settings = await GetOrCreateAsync(ct);

        if (logo is null || logo.Length == 0)
        {
            return BadRequest(new { message = "Logo dosyası gerekli." });
        }

        if (logo.Length > MaxImageBytes)
        {
            return BadRequest(new { message = "Logo en fazla 5MB olabilir." });
        }

        if (!AllowedImageTypes.Contains(logo.ContentType))
        {
            return BadRequest(new { message = "Yalnızca JPEG, PNG veya WebP görsel yüklenebilir." });
        }

        var extension = logo.ContentType switch
        {
            "image/png" => "png",
            "image/webp" => "webp",
            _ => "jpg",
        };
        var objectPath = $"logo-{Guid.NewGuid():N}.{extension}";

        string url;
        await using (var stream = logo.OpenReadStream())
        {
            try
            {
                url = await _storageClient.UploadAsync(LogoBucket, objectPath, stream, logo.ContentType, ct);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        settings.LogoUrl = url;
        AuditLogWriter.Log(_db, User, "Updated", "SystemSettings", "logo", "Firma logosu güncellendi.");
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Logo yüklendi.", logoUrl = url });
    }

    [HttpPost("test-email")]
    [Authorize(Policy = PermissionKeys.SettingsManage)]
    public async Task<IActionResult> TestEmail([FromBody] TestSmtpRequest request, CancellationToken ct)
    {
        var settings = await GetOrCreateAsync(ct);
        if (string.IsNullOrWhiteSpace(settings.SmtpHost) || settings.SmtpPort is null || string.IsNullOrWhiteSpace(settings.SmtpSenderEmail))
        {
            return BadRequest(new { message = "Önce SMTP ayarlarını kaydedin." });
        }

        string? password = null;
        if (!string.IsNullOrEmpty(settings.SmtpPasswordEncrypted))
        {
            try
            {
                password = Protector.Unprotect(settings.SmtpPasswordEncrypted);
            }
            catch
            {
                return BadRequest(new { message = "Kayıtlı SMTP şifresi çözülemedi, lütfen yeniden girin." });
            }
        }

        var options = new SmtpSendOptions(
            settings.SmtpHost!, settings.SmtpPort!.Value, settings.SmtpUsername, password,
            settings.SmtpUseSsl, settings.SmtpSenderEmail!, settings.SmtpSenderName ?? settings.SmtpSenderEmail!);

        var (success, error) = await _emailSender.SendAsync(
            options, request.TestRecipientEmail, "StoneStock Test E-postası",
            "<p>Bu, StoneStock sisteminden gönderilen bir test e-postasıdır. SMTP ayarlarınız doğru çalışıyor.</p>", ct);

        if (!success)
        {
            return BadRequest(new { message = $"Test e-postası gönderilemedi: {error}" });
        }

        return Ok(new { message = "Test e-postası gönderildi." });
    }

    private IDataProtector Protector => _dataProtectionProvider.CreateProtector(NotificationDispatcher.SmtpProtectorName);

    private async Task<SystemSettings> GetOrCreateAsync(CancellationToken ct)
    {
        var settings = await _db.SystemSettings.FirstOrDefaultAsync(ct);
        if (settings is null)
        {
            settings = new SystemSettings { Id = 1 };
            _db.SystemSettings.Add(settings);
            await _db.SaveChangesAsync(ct);
        }

        return settings;
    }

    private static SystemSettingsDto Map(SystemSettings s) => new(
        s.CompanyName, s.LogoUrl,
        s.SmtpHost, s.SmtpPort, s.SmtpUsername, !string.IsNullOrEmpty(s.SmtpPasswordEncrypted),
        s.SmtpSenderEmail, s.SmtpSenderName, s.SmtpUseSsl,
        s.NotifyNewStock, s.NotifyLowStock, s.NotifyPlateSold,
        s.NewStockSubjectTemplate, s.NewStockBodyTemplate,
        s.LowStockSubjectTemplate, s.LowStockBodyTemplate,
        s.PlateSoldSubjectTemplate, s.PlateSoldBodyTemplate);
}

[ApiController]
[Route("api/notification-recipients")]
[Authorize(AuthenticationSchemes = CookieAuth.SchemeName, Policy = PermissionKeys.SettingsManage)]
public sealed class NotificationRecipientsController : ControllerBase
{
    private readonly AppDbContext _db;

    public NotificationRecipientsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var recipients = await _db.NotificationRecipients
            .OrderBy(r => r.Email)
            .Select(r => new NotificationRecipientDto(r.Id, r.Email, r.IsActive))
            .ToListAsync(ct);
        return Ok(recipients);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateNotificationRecipientRequest request, CancellationToken ct)
    {
        var email = (request.Email ?? string.Empty).Trim();
        if (email.Length == 0)
        {
            return BadRequest(new { message = "E-posta adresi gerekli." });
        }

        if (await _db.NotificationRecipients.AnyAsync(r => r.Email.ToLower() == email.ToLower(), ct))
        {
            return Conflict(new { message = "Bu e-posta zaten kayıtlı." });
        }

        _db.NotificationRecipients.Add(new NotificationRecipient { Email = email, IsActive = true });
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Alıcı eklendi." });
    }

    [HttpPost("{id:int}/status")]
    public async Task<IActionResult> SetStatus(int id, [FromBody] SetRecipientStatusRequest request, CancellationToken ct)
    {
        var recipient = await _db.NotificationRecipients.FindAsync([id], ct);
        if (recipient is null)
        {
            return NotFound();
        }

        recipient.IsActive = request.Active;
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Güncellendi." });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var recipient = await _db.NotificationRecipients.FindAsync([id], ct);
        if (recipient is null)
        {
            return NotFound();
        }

        _db.NotificationRecipients.Remove(recipient);
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Alıcı silindi." });
    }
}
