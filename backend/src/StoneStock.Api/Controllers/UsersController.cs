using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StoneStock.Api.Auditing;
using StoneStock.Api.Auth;
using StoneStock.Application.Auth;
using StoneStock.Application.Users;
using StoneStock.Domain.Entities;
using StoneStock.Domain.Enums;
using StoneStock.Domain.Security;
using StoneStock.Infrastructure.Persistence;

namespace StoneStock.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(AuthenticationSchemes = CookieAuth.SchemeName, Policy = PermissionKeys.UsersManage)]
public sealed class UsersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ISupabaseAdminClient _adminClient;

    public UsersController(AppDbContext db, ISupabaseAdminClient adminClient)
    {
        _db = db;
        _adminClient = adminClient;
    }

    [HttpGet]
    public async Task<ActionResult<List<UserListItemDto>>> GetAll(CancellationToken ct)
    {
        var users = await _db.Users
            .Include(u => u.Role)
            .OrderBy(u => u.CreatedAt)
            .Select(u => new UserListItemDto(
                u.Id, u.FirstName, u.LastName, u.Username, u.Email,
                u.Role.Name, u.Status.ToString(), u.CreatedAt, u.LastLoginAt))
            .ToListAsync(ct);
        return Ok(users);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request, CancellationToken ct)
    {
        if (await _db.Users.AnyAsync(u => u.Username == request.Username || u.Email == request.Email, ct))
        {
            return Conflict(new { message = "Bu kullanıcı adı veya e-posta zaten kayıtlı." });
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
            RoleId = request.RoleId,
            Status = UserStatus.Aktif,
        };
        _db.Users.Add(user);
        AuditLogWriter.Log(_db, User, "Created", "User", user.Username, $"{user.FirstName} {user.LastName} ({user.Username})");
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Kullanıcı oluşturuldu." });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateUserRequest request, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([id], ct);
        if (user is null)
        {
            return NotFound();
        }

        user.FirstName = request.FirstName;
        user.LastName = request.LastName;
        user.RoleId = request.RoleId;
        AuditLogWriter.Log(_db, User, "Updated", "User", user.Username, $"{user.FirstName} {user.LastName} ({user.Username})");
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Kullanıcı güncellendi." });
    }

    [HttpPost("{id:int}/status")]
    public async Task<IActionResult> SetStatus(int id, [FromBody] SetUserStatusRequest request, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([id], ct);
        if (user is null)
        {
            return NotFound();
        }

        user.Status = request.Active ? UserStatus.Aktif : UserStatus.Pasif;
        await _adminClient.SetBannedAsync(user.AuthUserId, !request.Active, ct);
        AuditLogWriter.Log(_db, User, "StatusChanged", "User", user.Username, $"{user.Username} → {user.Status}");
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = request.Active ? "Kullanıcı aktif edildi." : "Kullanıcı pasif edildi." });
    }

    [HttpPost("{id:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetPasswordRequest request, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([id], ct);
        if (user is null)
        {
            return NotFound();
        }

        var password = request.NewPassword ?? string.Empty;
        if (password.Length < 6)
        {
            return BadRequest(new { message = "Şifre en az 6 karakter olmalıdır." });
        }

        try
        {
            await _adminClient.ResetPasswordAsync(user.AuthUserId, password, ct);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        AuditLogWriter.Log(_db, User, "PasswordReset", "User", user.Username, user.Username);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Şifre sıfırlandı." });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([id], ct);
        if (user is null)
        {
            return NotFound();
        }

        var currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        if (user.Id == currentUserId)
        {
            return BadRequest(new { message = "Kendi hesabınızı silemezsiniz." });
        }

        if (user.RoleId == 1 /* Admin */ && await _db.Users.CountAsync(u => u.RoleId == 1, ct) <= 1)
        {
            return BadRequest(new { message = "Sistemdeki son yönetici hesabı silinemez." });
        }

        // Stok/plaka/tarama kayıtları FK Cascade ile silinir; bağlı geçmiş verisi olan kullanıcıları
        // silmek yerine pasif hale getirmeye yönlendiriyoruz ki envanter/işlem geçmişi kaybolmasın.
        var hasHistory = await _db.IncomingStocks.AnyAsync(i => i.CreatedByUserId == id, ct)
            || await _db.Plates.AnyAsync(p => p.SoldByUserId == id, ct)
            || await _db.QrScanLogs.AnyAsync(q => q.ScannedByUserId == id, ct);
        if (hasHistory)
        {
            return Conflict(new
            {
                message = "Bu kullanıcıya bağlı gelen stok, satış veya QR tarama kayıtları var. " +
                           "Bu kayıtlar kaybolacağı için silinemez; bunun yerine kullanıcıyı pasif hale getirin.",
            });
        }

        try
        {
            await _adminClient.DeleteUserAsync(user.AuthUserId, ct);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        _db.Users.Remove(user);
        AuditLogWriter.Log(_db, User, "Deleted", "User", user.Username, $"{user.FirstName} {user.LastName} ({user.Username})");
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Kullanıcı silindi." });
    }
}

[ApiController]
[Route("api/roles")]
[Authorize(AuthenticationSchemes = CookieAuth.SchemeName)]
public sealed class RolesController : ControllerBase
{
    private readonly AppDbContext _db;

    public RolesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<List<RoleDto>>> GetAll(CancellationToken ct)
    {
        var roles = await _db.Roles
            .OrderBy(r => r.Id)
            .Select(r => new RoleDto(r.Id, r.Name, r.IsSystemRole, r.Users.Count))
            .ToListAsync(ct);
        return Ok(roles);
    }

    [HttpGet("permissions")]
    [Authorize(Policy = PermissionKeys.UsersManage)]
    public async Task<ActionResult<List<PermissionDto>>> GetPermissions(CancellationToken ct)
    {
        var permissions = await _db.Permissions
            .OrderBy(p => p.Id)
            .Select(p => new PermissionDto(p.Id, p.Key, p.Description))
            .ToListAsync(ct);
        return Ok(permissions);
    }

    [HttpGet("{id:int}/permissions")]
    [Authorize(Policy = PermissionKeys.UsersManage)]
    public async Task<IActionResult> GetRolePermissions(int id, CancellationToken ct)
    {
        var role = await _db.Roles
            .Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(r => r.Id == id, ct);
        if (role is null)
        {
            return NotFound();
        }

        return Ok(new RolePermissionsDto(
            role.Id, role.Name, role.IsSystemRole,
            role.RolePermissions.Select(rp => rp.Permission.Key).ToList()));
    }

    [HttpPut("{id:int}/permissions")]
    [Authorize(Policy = PermissionKeys.UsersManage)]
    public async Task<IActionResult> UpdateRolePermissions(int id, [FromBody] UpdateRolePermissionsRequest request, CancellationToken ct)
    {
        var role = await _db.Roles.Include(r => r.RolePermissions).FirstOrDefaultAsync(r => r.Id == id, ct);
        if (role is null)
        {
            return NotFound();
        }

        var requestedKeys = (request.PermissionKeys ?? new List<string>()).Distinct().ToList();

        // Sistemde en az bir rolün kullanıcı yönetimi yetkisi kalmalı; aksi halde kimse
        // yeniden yetki veremeyecek şekilde sistem kilitlenebilir.
        if (!requestedKeys.Contains(PermissionKeys.UsersManage))
        {
            var otherRoleHasUsersManage = await _db.RolePermissions
                .Include(rp => rp.Permission)
                .AnyAsync(rp => rp.RoleId != id && rp.Permission.Key == PermissionKeys.UsersManage, ct);
            if (!otherRoleHasUsersManage)
            {
                return BadRequest(new { message = "En az bir rolde 'Kullanıcı Yönetimi' yetkisi kalmalıdır." });
            }
        }

        var allPermissions = await _db.Permissions.ToDictionaryAsync(p => p.Key, ct);
        var validKeys = requestedKeys.Where(k => allPermissions.ContainsKey(k)).ToList();

        _db.RolePermissions.RemoveRange(role.RolePermissions);
        foreach (var key in validKeys)
        {
            _db.RolePermissions.Add(new RolePermission { RoleId = id, PermissionId = allPermissions[key].Id });
        }

        AuditLogWriter.Log(_db, User, "PermissionsUpdated", "Role", role.Name, $"{role.Name}: {validKeys.Count} yetki");
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Yetkiler güncellendi." });
    }

    [HttpPost]
    [Authorize(Policy = PermissionKeys.UsersManage)]
    public async Task<IActionResult> Create([FromBody] CreateRoleRequest request, CancellationToken ct)
    {
        var name = (request.Name ?? string.Empty).Trim();
        if (name.Length == 0)
        {
            return BadRequest(new { message = "Rol adı gerekli." });
        }

        if (await _db.Roles.AnyAsync(r => r.Name.ToLower() == name.ToLower(), ct))
        {
            return Conflict(new { message = "Bu rol adı zaten kullanılıyor." });
        }

        var role = new Role { Name = name, IsSystemRole = false };
        _db.Roles.Add(role);
        AuditLogWriter.Log(_db, User, "Created", "Role", name, name);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Rol oluşturuldu.", id = role.Id });
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = PermissionKeys.UsersManage)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateRoleRequest request, CancellationToken ct)
    {
        var role = await _db.Roles.FindAsync([id], ct);
        if (role is null)
        {
            return NotFound();
        }

        if (role.IsSystemRole)
        {
            return BadRequest(new { message = "Sistem rollerinin adı değiştirilemez." });
        }

        var name = (request.Name ?? string.Empty).Trim();
        if (name.Length == 0)
        {
            return BadRequest(new { message = "Rol adı gerekli." });
        }

        if (await _db.Roles.AnyAsync(r => r.Id != id && r.Name.ToLower() == name.ToLower(), ct))
        {
            return Conflict(new { message = "Bu rol adı zaten kullanılıyor." });
        }

        var oldName = role.Name;
        role.Name = name;
        AuditLogWriter.Log(_db, User, "Updated", "Role", name, $"{oldName} → {name}");
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Rol güncellendi." });
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = PermissionKeys.UsersManage)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var role = await _db.Roles.FindAsync([id], ct);
        if (role is null)
        {
            return NotFound();
        }

        if (role.IsSystemRole)
        {
            return BadRequest(new { message = "Sistem rolleri silinemez." });
        }

        if (await _db.Users.AnyAsync(u => u.RoleId == id, ct))
        {
            return Conflict(new { message = "Bu role atanmış kullanıcılar var; önce onları başka bir role taşıyın." });
        }

        _db.Roles.Remove(role);
        AuditLogWriter.Log(_db, User, "Deleted", "Role", role.Name, role.Name);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Rol silindi." });
    }
}
