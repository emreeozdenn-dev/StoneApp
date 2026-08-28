using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StoneStock.Api.Auth;
using StoneStock.Application.Auth;
using StoneStock.Domain.Entities;
using StoneStock.Domain.Enums;
using StoneStock.Domain.Security;
using StoneStock.Infrastructure.Persistence;

namespace StoneStock.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ISupabaseAuthClient _authClient;
    private readonly ISupabaseAdminClient _adminClient;

    public AuthController(AppDbContext db, ISupabaseAuthClient authClient, ISupabaseAdminClient adminClient)
    {
        _db = db;
        _authClient = authClient;
        _adminClient = adminClient;
    }

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

        CookieAuth.SetAuthCookies(Response, tokens);

        user.LastLoginAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Giriş başarılı." });
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
