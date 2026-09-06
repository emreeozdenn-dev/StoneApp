using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StoneStock.Api.Auth;
using StoneStock.Domain.Entities;
using StoneStock.Domain.Security;
using StoneStock.Infrastructure.Persistence;

namespace StoneStock.Api.Controllers;

public sealed record ColorOptionDto(int Id, string Name);
public sealed record CreateColorOptionRequest(string Name);

[ApiController]
[Route("api/colors")]
[Authorize(AuthenticationSchemes = CookieAuth.SchemeName)]
public sealed class ColorsController : ControllerBase
{
    private readonly AppDbContext _db;

    public ColorsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<List<ColorOptionDto>>> GetAll(CancellationToken ct)
    {
        var options = await _db.ColorOptions
            .OrderBy(c => c.Name)
            .Select(c => new ColorOptionDto(c.Id, c.Name))
            .ToListAsync(ct);
        return Ok(options);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateColorOptionRequest request, CancellationToken ct)
    {
        if (!User.HasClaim("permission", PermissionKeys.StonesCreate) &&
            !User.HasClaim("permission", PermissionKeys.StonesEdit))
        {
            return Forbid();
        }

        var name = (request.Name ?? string.Empty).Trim();
        if (name.Length == 0)
        {
            return BadRequest(new { message = "Renk adı gerekli." });
        }

        var existing = await _db.ColorOptions.FirstOrDefaultAsync(c => c.Name.ToLower() == name.ToLower(), ct);
        if (existing is not null)
        {
            return Ok(new ColorOptionDto(existing.Id, existing.Name));
        }

        var option = new ColorOption { Name = name };
        _db.ColorOptions.Add(option);
        await _db.SaveChangesAsync(ct);

        return Ok(new ColorOptionDto(option.Id, option.Name));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!User.HasClaim("permission", PermissionKeys.StonesCreate) &&
            !User.HasClaim("permission", PermissionKeys.StonesEdit))
        {
            return Forbid();
        }

        var option = await _db.ColorOptions.FindAsync([id], ct);
        if (option is null)
        {
            return NotFound();
        }

        _db.ColorOptions.Remove(option);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Renk değeri silindi." });
    }

    internal static async Task EnsureExistsAsync(AppDbContext db, string name, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return;
        }

        var exists = await db.ColorOptions.AnyAsync(c => c.Name.ToLower() == name.ToLower(), ct);
        if (!exists)
        {
            db.ColorOptions.Add(new ColorOption { Name = name });
        }
    }
}
