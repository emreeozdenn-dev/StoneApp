using Microsoft.AspNetCore.Mvc;
using StoneStock.Application.Settings;

namespace StoneStock.Api.Controllers;

[ApiController]
[Route("api/settings")]
public sealed class SettingsController : ControllerBase
{
    private readonly IConnectionSettingsService _connectionSettingsService;
    private readonly ISupabaseSettingsService _supabaseSettingsService;

    public SettingsController(
        IConnectionSettingsService connectionSettingsService,
        ISupabaseSettingsService supabaseSettingsService)
    {
        _connectionSettingsService = connectionSettingsService;
        _supabaseSettingsService = supabaseSettingsService;
    }

    [HttpGet("connection")]
    public ActionResult<ConnectionSettingsRequest> GetConnection()
    {
        var current = _connectionSettingsService.GetCurrent();
        return current is null ? NotFound() : Ok(current);
    }

    [HttpPost("connection/test")]
    public async Task<ActionResult<ConnectionTestResult>> TestConnection(
        [FromBody] ConnectionSettingsRequest request, CancellationToken ct)
    {
        var result = await _connectionSettingsService.TestConnectionAsync(request, ct);
        return Ok(result);
    }

    [HttpPost("connection")]
    public async Task<IActionResult> SaveConnection(
        [FromBody] ConnectionSettingsRequest request, CancellationToken ct)
    {
        await _connectionSettingsService.SaveConnectionStringAsync(request, ct);
        return Ok(new { message = "Bağlantı bilgileri kaydedildi. Değişikliklerin etkili olması için API'nin yeniden başlatılması gerekir." });
    }

    [HttpGet("supabase")]
    public ActionResult<SupabaseSettingsRequest> GetSupabase()
    {
        var current = _supabaseSettingsService.GetCurrent();
        return current is null ? NotFound() : Ok(current);
    }

    [HttpPost("supabase/test")]
    public async Task<ActionResult<ConnectionTestResult>> TestSupabase(
        [FromBody] SupabaseSettingsRequest request, CancellationToken ct)
    {
        var result = await _supabaseSettingsService.TestAsync(request, ct);
        return Ok(result);
    }

    [HttpPost("supabase")]
    public async Task<IActionResult> SaveSupabase(
        [FromBody] SupabaseSettingsRequest request, CancellationToken ct)
    {
        await _supabaseSettingsService.SaveAsync(request, ct);
        return Ok(new { message = "Supabase bilgileri kaydedildi. Değişikliklerin etkili olması için API'nin yeniden başlatılması gerekir." });
    }
}
