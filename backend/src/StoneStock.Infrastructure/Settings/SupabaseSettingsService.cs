using System.Net.Http.Headers;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Configuration;
using StoneStock.Application.Settings;

namespace StoneStock.Infrastructure.Settings;

public sealed class SupabaseSettingsService : ISupabaseSettingsService
{
    private readonly string _appSettingsPath;
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;

    public SupabaseSettingsService(string appSettingsPath, IConfiguration configuration, HttpClient httpClient)
    {
        _appSettingsPath = appSettingsPath;
        _configuration = configuration;
        _httpClient = httpClient;
    }

    public async Task<ConnectionTestResult> TestAsync(SupabaseSettingsRequest request, CancellationToken ct)
    {
        var baseUrl = request.ProjectUrl.TrimEnd('/');

        try
        {
            using var restRequest = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/auth/v1/settings");
            restRequest.Headers.Add("apikey", request.AnonKey);
            using var restResponse = await _httpClient.SendAsync(restRequest, ct);
            if (!restResponse.IsSuccessStatusCode)
            {
                return new ConnectionTestResult(false, $"anon key doğrulanamadı (HTTP {(int)restResponse.StatusCode}). Project URL ve anon key'i kontrol edin.");
            }

            using var adminRequest = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/auth/v1/admin/users?page=1&per_page=1");
            adminRequest.Headers.Add("apikey", request.ServiceRoleKey);
            adminRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", request.ServiceRoleKey);
            using var adminResponse = await _httpClient.SendAsync(adminRequest, ct);
            if (!adminResponse.IsSuccessStatusCode)
            {
                return new ConnectionTestResult(false, $"service role key doğrulanamadı (HTTP {(int)adminResponse.StatusCode}). Service role key'i kontrol edin.");
            }

            return new ConnectionTestResult(true, "Supabase bağlantısı başarılı (anon + service role key doğrulandı).");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return new ConnectionTestResult(false, $"Supabase'e ulaşılamadı: {ex.Message}");
        }
    }

    public async Task SaveAsync(SupabaseSettingsRequest request, CancellationToken ct)
    {
        var json = await File.ReadAllTextAsync(_appSettingsPath, ct);
        var root = JsonNode.Parse(json)!.AsObject();

        if (root["Supabase"] is not JsonObject supabase)
        {
            supabase = new JsonObject();
            root["Supabase"] = supabase;
        }

        supabase["ProjectUrl"] = request.ProjectUrl;
        supabase["AnonKey"] = request.AnonKey;
        supabase["ServiceRoleKey"] = request.ServiceRoleKey;

        var options = new System.Text.Json.JsonSerializerOptions { WriteIndented = true };
        await File.WriteAllTextAsync(_appSettingsPath, root.ToJsonString(options), ct);
    }

    public SupabaseSettingsRequest? GetCurrent()
    {
        var section = _configuration.GetSection("Supabase");
        var projectUrl = section["ProjectUrl"];
        if (string.IsNullOrWhiteSpace(projectUrl))
        {
            return null;
        }

        return new SupabaseSettingsRequest(projectUrl, section["AnonKey"] ?? string.Empty, string.Empty);
    }
}
