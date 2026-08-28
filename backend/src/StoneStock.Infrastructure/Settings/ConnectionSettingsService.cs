using System.Text.Json.Nodes;
using Microsoft.Extensions.Configuration;
using Npgsql;
using StoneStock.Application.Settings;

namespace StoneStock.Infrastructure.Settings;

public sealed class ConnectionSettingsService : IConnectionSettingsService
{
    private readonly string _appSettingsPath;
    private readonly IConfiguration _configuration;

    public ConnectionSettingsService(string appSettingsPath, IConfiguration configuration)
    {
        _appSettingsPath = appSettingsPath;
        _configuration = configuration;
    }

    public async Task<ConnectionTestResult> TestConnectionAsync(ConnectionSettingsRequest request, CancellationToken ct)
    {
        var connectionString = BuildConnectionString(request);

        await using var connection = new NpgsqlConnection(connectionString);
        try
        {
            await connection.OpenAsync(ct);
            return new ConnectionTestResult(true, "Bağlantı başarılı.");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return new ConnectionTestResult(false, $"Bağlantı kurulamadı: {ex.Message}");
        }
    }

    public async Task SaveConnectionStringAsync(ConnectionSettingsRequest request, CancellationToken ct)
    {
        var connectionString = BuildConnectionString(request);

        var json = await File.ReadAllTextAsync(_appSettingsPath, ct);
        var root = JsonNode.Parse(json)!.AsObject();

        if (root["ConnectionStrings"] is not JsonObject connectionStrings)
        {
            connectionStrings = new JsonObject();
            root["ConnectionStrings"] = connectionStrings;
        }

        connectionStrings["Default"] = connectionString;

        var options = new System.Text.Json.JsonSerializerOptions { WriteIndented = true };
        await File.WriteAllTextAsync(_appSettingsPath, root.ToJsonString(options), ct);
    }

    public ConnectionSettingsRequest? GetCurrent()
    {
        var connectionString = _configuration.GetConnectionString("Default");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return null;
        }

        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        return new ConnectionSettingsRequest(
            builder.Host ?? string.Empty,
            builder.Port,
            builder.Database ?? string.Empty,
            builder.Username ?? string.Empty,
            string.Empty);
    }

    private static string BuildConnectionString(ConnectionSettingsRequest request)
    {
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = request.Server,
            Port = request.Port,
            Database = request.Database,
            Username = request.UserId,
            Password = request.Password,
            SslMode = SslMode.Require,
        };
        return builder.ConnectionString;
    }
}
