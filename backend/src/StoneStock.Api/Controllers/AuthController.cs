using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using StoneStock.Api.Auth;
using StoneStock.Application.Auth;
using StoneStock.Application.Notifications;
using StoneStock.Domain.Entities;
using StoneStock.Domain.Enums;
using StoneStock.Domain.Security;
using StoneStock.Infrastructure.Notifications;
using StoneStock.Infrastructure.Persistence;

namespace StoneStock.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private const string TempPasswordChars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

    private const int MaxTwoFactorAttempts = 5;
    private static readonly TimeSpan PendingTwoFactorTtl = TimeSpan.FromMinutes(5);

    private readonly AppDbContext _db;
    private readonly ISupabaseAuthClient _authClient;
    private readonly ISupabaseAdminClient _adminClient;
    private readonly IDataProtectionProvider _dataProtectionProvider;
    private readonly IEmailSender _emailSender;
    private readonly ITotpService _totpService;
    private readonly IMemoryCache _memoryCache;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        AppDbContext db,
        ISupabaseAuthClient authClient,
        ISupabaseAdminClient adminClient,
        IDataProtectionProvider dataProtectionProvider,
        IEmailSender emailSender,
        ITotpService totpService,
        IMemoryCache memoryCache,
        ILogger<AuthController> logger)
    {
        _db = db;
        _authClient = authClient;
        _adminClient = adminClient;
        _dataProtectionProvider = dataProtectionProvider;
        _emailSender = emailSender;
        _totpService = totpService;
        _memoryCache = memoryCache;
        _logger = logger;
    }

    private sealed class PendingTwoFactorLogin
    {
        public required int UserId { get; init; }
        public required SupabaseTokenResult Tokens { get; init; }
        public int Attempts { get; set; }
    }

    private static string PendingTwoFactorCacheKey(string pendingToken) => $"2fa-pending-login:{pendingToken}";

    [HttpGet("setup-required")]
    [AllowAnonymous]
    public async Task<ActionResult<object>> SetupRequired(CancellationToken ct)
    {
        var hasUsers = await _db.Users.AnyAsync(ct);
        return Ok(new { required = !hasUsers });
    }

    [HttpPost("setup")]
    [AllowAnonymous]
    public async Task<IActionResult> Setup([FromBody] SetupRequest request, CancellationToken ct)
    {
        if (await _db.Users.AnyAsync(ct))
        {
            return Conflict(new { message = "Kurulum zaten tamamlanmış." });
        }

        Guid authUserId;
        try
        {
            authUserId = await _adminClient.CreateUserAsync(request.Email, request.Password, ct);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        var user = new User
        {
            AuthUserId = authUserId,
            FirstName = request.FirstName,
            LastName = request.LastName,
            Username = request.Username,
            Email = request.Email,
            RoleId = 1, // Admin
            Status = UserStatus.Aktif,
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        var tokens = await _authClient.SignInWithPasswordAsync(request.Email, request.Password, ct);
        if (tokens is not null)
        {
            CookieAuth.SetAuthCookies(Response, tokens);
        }

        return Ok(new { message = "Admin hesabı oluşturuldu." });
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var input = request.UsernameOrEmail.Trim().ToLowerInvariant();
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Username.ToLower() == input || u.Email.ToLower() == input, ct);

        if (user is null)
        {
            return Unauthorized(new { message = "Kullanıcı adı/e-posta veya şifre hatalı." });
        }

        if (user.Status != UserStatus.Aktif)
        {
            return StatusCode(403, new { message = "Hesabınız pasif durumda. Sisteme giriş yapamazsınız." });
        }

        var tokens = await _authClient.SignInWithPasswordAsync(user.Email, request.Password, ct);
        if (tokens is null)
        {
            return Unauthorized(new { message = "Kullanıcı adı/e-posta veya şifre hatalı." });
        }

        if (user.TwoFactorEnabled)
        {
            var pendingToken = Guid.NewGuid().ToString("N");
            _memoryCache.Set(
                PendingTwoFactorCacheKey(pendingToken),
                new PendingTwoFactorLogin { UserId = user.Id, Tokens = tokens },
                PendingTwoFactorTtl);

            return Ok(new { message = "Doğrulama kodu gerekli.", requiresTwoFactor = true, pendingToken });
        }

        CookieAuth.SetAuthCookies(Response, tokens);

        user.LastLoginAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Giriş başarılı.", requiresTwoFactor = false });
    }

    [HttpPost("login/verify-2fa")]
    [AllowAnonymous]
    public async Task<IActionResult> VerifyTwoFactorLogin([FromBody] VerifyTwoFactorLoginRequest request, CancellationToken ct)
    {
        var cacheKey = PendingTwoFactorCacheKey(request.PendingToken ?? string.Empty);
        if (!_memoryCache.TryGetValue(cacheKey, out PendingTwoFactorLogin? pending) || pending is null)
        {
            return BadRequest(new { message = "Oturum süresi doldu. Lütfen tekrar giriş yapın." });
        }

        var user = await _db.Users.FindAsync([pending.UserId], ct);
        if (user is null || !user.TwoFactorEnabled || string.IsNullOrEmpty(user.TwoFactorSecretEncrypted))
        {
            _memoryCache.Remove(cacheKey);
            return BadRequest(new { message = "Doğrulama başarısız. Lütfen tekrar giriş yapın." });
        }

        var protector = _dataProtectionProvider.CreateProtector(TwoFactorConstants.ProtectorName);
        var secret = protector.Unprotect(user.TwoFactorSecretEncrypted);

        if (!_totpService.VerifyCode(secret, request.Code ?? string.Empty))
        {
            pending.Attempts++;
            if (pending.Attempts >= MaxTwoFactorAttempts)
            {
                _memoryCache.Remove(cacheKey);
                return BadRequest(new { message = "Çok fazla hatalı deneme. Lütfen tekrar giriş yapın." });
            }

            return BadRequest(new { message = "Kod hatalı." });
        }

        _memoryCache.Remove(cacheKey);
        CookieAuth.SetAuthCookies(Response, pending.Tokens);

        user.LastLoginAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Giriş başarılı.", requiresTwoFactor = false });
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken ct)
    {
        var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
        var genericResult = Ok(new { message = "Bu e-posta adresi sistemde kayıtlıysa, yeni şifreniz e-posta ile gönderildi." });

        if (email.Length == 0)
        {
            return genericResult;
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email, ct);
        if (user is null || user.Status != UserStatus.Aktif)
        {
            // Kullanıcı numarası sızdırmamak için hem "yok" hem "pasif" durumunda aynı genel mesaj döner.
            return genericResult;
        }

        var settings = await _db.SystemSettings.FirstOrDefaultAsync(ct);
        if (settings is null || string.IsNullOrWhiteSpace(settings.SmtpHost) || settings.SmtpPort is null ||
            string.IsNullOrWhiteSpace(settings.SmtpSenderEmail))
        {
            _logger.LogWarning("Şifre sıfırlama istendi ama SMTP ayarları yapılandırılmamış (kullanıcı: {Username})", user.Username);
            return genericResult;
        }

        var newPassword = GenerateTempPassword();
        try
        {
            await _adminClient.ResetPasswordAsync(user.AuthUserId, newPassword, ct);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogError(ex, "Şifre sıfırlama sırasında Supabase hatası (kullanıcı: {Username})", user.Username);
            return genericResult;
        }

        string? smtpPassword = null;
        if (!string.IsNullOrEmpty(settings.SmtpPasswordEncrypted))
        {
            try
            {
                var protector = _dataProtectionProvider.CreateProtector(NotificationDispatcher.SmtpProtectorName);
                smtpPassword = protector.Unprotect(settings.SmtpPasswordEncrypted);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SMTP şifresi çözülemedi, şifre sıfırlama e-postası gönderilemedi (kullanıcı: {Username})", user.Username);
                return genericResult;
            }
        }

        var options = new SmtpSendOptions(
            settings.SmtpHost!, settings.SmtpPort!.Value, settings.SmtpUsername, smtpPassword,
            settings.SmtpUseSsl, settings.SmtpSenderEmail!, settings.SmtpSenderName ?? settings.SmtpSenderEmail!);

        var (success, error) = await _emailSender.SendAsync(
            options, user.Email, "StoneStock - Yeni Şifreniz",
            $"<p>Merhaba {user.FirstName},</p>" +
            $"<p>Şifre sıfırlama talebiniz üzerine yeni şifreniz oluşturuldu:</p>" +
            $"<p style=\"font-size:18px;font-weight:bold;letter-spacing:1px;\">{System.Net.WebUtility.HtmlEncode(newPassword)}</p>" +
            $"<p>Giriş yaptıktan sonra bu şifreyi değiştirmenizi öneririz.</p>",
            ct);

        if (!success)
        {
            _logger.LogError("Şifre sıfırlama e-postası gönderilemedi (kullanıcı: {Username}): {Error}", user.Username, error);
        }

        return genericResult;
    }

    private static string GenerateTempPassword(int length = 10)
    {
        var bytes = RandomNumberGenerator.GetBytes(length);
        var chars = new char[length];
        for (var i = 0; i < length; i++)
        {
            chars[i] = TempPasswordChars[bytes[i] % TempPasswordChars.Length];
        }

        return new string(chars);
    }

    [HttpPost("logout")]
    [Authorize(AuthenticationSchemes = CookieAuth.SchemeName)]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var accessToken = Request.Cookies[CookieAuth.AccessCookie];
        if (!string.IsNullOrEmpty(accessToken))
        {
            await _authClient.SignOutAsync(accessToken, ct);
        }

        CookieAuth.ClearAuthCookies(Response);
        return Ok(new { message = "Çıkış yapıldı." });
    }

    [HttpGet("me")]
    [Authorize(AuthenticationSchemes = CookieAuth.SchemeName)]
    public async Task<ActionResult<CurrentUserDto>> Me(CancellationToken ct)
    {
        var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);
        var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            return Unauthorized();
        }

        var permissions = User.FindAll("permission").Select(c => c.Value).ToArray();
        return Ok(new CurrentUserDto(
            user.Id, user.FirstName, user.LastName, user.Username, user.Email, user.Role.Name, permissions));
    }
}
