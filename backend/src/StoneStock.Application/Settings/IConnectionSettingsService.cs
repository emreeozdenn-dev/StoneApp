namespace StoneStock.Application.Settings;

public interface IConnectionSettingsService
{
    Task<ConnectionTestResult> TestConnectionAsync(ConnectionSettingsRequest request, CancellationToken ct);

    Task SaveConnectionStringAsync(ConnectionSettingsRequest request, CancellationToken ct);

    ConnectionSettingsRequest? GetCurrent();
}
