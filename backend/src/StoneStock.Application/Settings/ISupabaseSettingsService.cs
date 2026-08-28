namespace StoneStock.Application.Settings;

public interface ISupabaseSettingsService
{
    Task<ConnectionTestResult> TestAsync(SupabaseSettingsRequest request, CancellationToken ct);

    Task SaveAsync(SupabaseSettingsRequest request, CancellationToken ct);

    SupabaseSettingsRequest? GetCurrent();
}
