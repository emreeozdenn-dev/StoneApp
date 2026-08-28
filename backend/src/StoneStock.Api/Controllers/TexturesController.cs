using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StoneStock.Api.Auth;
using StoneStock.Domain.Entities;
using StoneStock.Domain.Security;
using StoneStock.Infrastructure.Persistence;

namespace StoneStock.Api.Controllers;

public sealed record TextureOptionDto(int Id, string Name);
public sealed record CreateTextureOptionRequest(string Name);

[ApiController]
[Route("api/textures")]
[Authorize(AuthenticationSchemes = CookieAuth.SchemeName)]
public sealed class TexturesController : ControllerBase
{
    private readonly AppDbContext _db;

    public TexturesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<List<TextureOptionDto>>> GetAll(CancellationToken ct)
    {
        var options = await _db.TextureOptions
            .OrderBy(t => t.Name)
            .Select(t => new TextureOptionDto(t.Id, t.Name))
            .ToListAsync(ct);
        return Ok(options);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTextureOptionRequest request, CancellationToken ct)
    {
        if (!User.HasClaim("permission", PermissionKeys.IncomingStockCreate) &&
            !User.HasClaim("permission", PermissionKeys.PlatesCreate))
        {
            return Forbid();
        }

        var name = (request.Name ?? string.Empty).Trim();
        if (name.Length == 0)
        {
            return BadRequest(new { message = "Doku adı gerekli." });
        }

        var existing = await _db.TextureOptions.FirstOrDefaultAsync(t => t.Name.ToLower() == name.ToLower(), ct);
        if (existing is not null)
        {
            return Ok(new TextureOptionDto(existing.Id, existing.Name));
        }

        var option = new TextureOption { Name = name };
        _db.TextureOptions.Add(option);
        await _db.SaveChangesAsync(ct);

        return Ok(new TextureOptionDto(option.Id, option.Name));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!User.HasClaim("permission", PermissionKeys.IncomingStockCreate) &&
            !User.HasClaim("permission", PermissionKeys.PlatesCreate))
        {
            return Forbid();
        }

        var option = await _db.TextureOptions.FindAsync([id], ct);
        if (option is null)
        {
            return NotFound();
        }

        _db.TextureOptions.Remove(option);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Doku değeri silindi." });
    }

    internal static async Task EnsureExistsAsync(AppDbContext db, string name, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return;
        }

        var exists = await db.TextureOptions.AnyAsync(t => t.Name.ToLower() == name.ToLower(), ct);
        if (!exists)
        {
            db.TextureOptions.Add(new TextureOption { Name = name });
        }
    }
}
