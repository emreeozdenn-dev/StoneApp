using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StoneStock.Application.Auth;
using StoneStock.Domain.Enums;
using StoneStock.Infrastructure.Persistence;

namespace StoneStock.Api.Auth;

public sealed class SupabaseCookieAuthOptions : AuthenticationSchemeOptions
{
}

public sealed class SupabaseCookieAuthHandler : AuthenticationHandler<SupabaseCookieAuthOptions>
{
    private readonly ISupabaseAuthClient _authClient;
    private readonly AppDbContext _db;

    public SupabaseCookieAuthHandler(
        IOptionsMonitor<SupabaseCookieAuthOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        ISupabaseAuthClient authClient,
        AppDbContext db)
        : base(options, logger, encoder)
    {
        _authClient = authClient;
        _db = db;
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var accessToken = Request.Cookies[CookieAuth.AccessCookie];
        var refreshToken = Request.Cookies[CookieAuth.RefreshCookie];

        if (string.IsNullOrEmpty(accessToken) && string.IsNullOrEmpty(refreshToken))
        {
            return AuthenticateResult.NoResult();
        }

        var validation = string.IsNullOrEmpty(accessToken)
            ? new SupabaseTokenValidationResult(false, null, null)
            : await _authClient.ValidateAccessTokenAsync(accessToken, Context.RequestAborted);

        if (!validation.IsValid && !string.IsNullOrEmpty(refreshToken))
        {
            var refreshed = await _authClient.RefreshAsync(refreshToken, Context.RequestAborted);
            if (refreshed is null)
            {
                CookieAuth.ClearAuthCookies(Response);
                return AuthenticateResult.NoResult();
            }

            CookieAuth.SetAuthCookies(Response, refreshed);
            validation = await _authClient.ValidateAccessTokenAsync(refreshed.AccessToken, Context.RequestAborted);
        }

        if (!validation.IsValid || validation.AuthUserId is null)
        {
            return AuthenticateResult.NoResult();
        }

        var user = await _db.Users
            .Include(u => u.Role)
            .ThenInclude(r => r.RolePermissions)
            .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.AuthUserId == validation.AuthUserId.Value, Context.RequestAborted);

        if (user is null || user.Status != UserStatus.Aktif)
        {
            return AuthenticateResult.Fail("Kullanıcı bulunamadı veya pasif.");
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new("auth_user_id", user.AuthUserId.ToString()),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role.Name),
        };
        claims.AddRange(user.Role.RolePermissions.Select(rp => new Claim("permission", rp.Permission.Key)));

        var identity = new ClaimsIdentity(claims, CookieAuth.SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, CookieAuth.SchemeName);
        return AuthenticateResult.Success(ticket);
    }
}
