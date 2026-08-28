using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StoneStock.Api.Auth;
using StoneStock.Domain.Entities;
using StoneStock.Domain.Security;
using StoneStock.Infrastructure.Persistence;

namespace StoneStock.Api.Controllers;

public sealed record WarehouseOptionDto(int Id, string Name);
public sealed record CreateWarehouseOptionRequest(string Name);

[ApiController]
[Route("api/warehouses")]
[Authorize(AuthenticationSchemes = CookieAuth.SchemeName)]
public sealed class WarehousesController : ControllerBase
{
    private readonly AppDbContext _db;

    public WarehousesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<List<WarehouseOptionDto>>> GetAll(CancellationToken ct)
    {
        var options = await _db.WarehouseOptions
            .OrderBy(w => w.Name)
            .Select(w => new WarehouseOptionDto(w.Id, w.Name))
            .ToListAsync(ct);
        return Ok(options);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateWarehouseOptionRequest request, CancellationToken ct)
    {
        if (!User.HasClaim("permission", PermissionKeys.IncomingStockCreate) &&
            !User.HasClaim("permission", PermissionKeys.PlatesCreate))
        {
            return Forbid();
        }

        var name = (request.Name ?? string.Empty).Trim();
        if (name.Length == 0)
        {
            return BadRequest(new { message = "Depo adı gerekli." });
        }

        var existing = await _db.WarehouseOptions.FirstOrDefaultAsync(w => w.Name.ToLower() == name.ToLower(), ct);
        if (existing is not null)
        {
            return Ok(new WarehouseOptionDto(existing.Id, existing.Name));
        }

        var option = new WarehouseOption { Name = name };
        _db.WarehouseOptions.Add(option);
        await _db.SaveChangesAsync(ct);

        return Ok(new WarehouseOptionDto(option.Id, option.Name));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!User.HasClaim("permission", PermissionKeys.IncomingStockCreate) &&
            !User.HasClaim("permission", PermissionKeys.PlatesCreate))
        {
            return Forbid();
        }

        var option = await _db.WarehouseOptions.FindAsync([id], ct);
        if (option is null)
        {
            return NotFound();
        }

        _db.WarehouseOptions.Remove(option);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Depo değeri silindi." });
    }

    internal static async Task EnsureExistsAsync(AppDbContext db, string name, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return;
        }

        var exists = await db.WarehouseOptions.AnyAsync(w => w.Name.ToLower() == name.ToLower(), ct);
        if (!exists)
        {
            db.WarehouseOptions.Add(new WarehouseOption { Name = name });
        }
    }
}
