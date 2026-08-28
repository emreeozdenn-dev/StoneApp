using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using StoneStock.Application.Auth;

namespace StoneStock.Infrastructure.Auth;

public sealed class SupabaseAdminClient : ISupabaseAdminClient
{
    private readonly HttpClient _httpClient;
    private readonly string _baseUrl;
    private readonly string _serviceRoleKey;

    public SupabaseAdminClient(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _baseUrl = (configuration["Supabase:ProjectUrl"] ?? string.Empty).TrimEnd('/');
        _serviceRoleKey = configuration["Supabase:ServiceRoleKey"] ?? string.Empty;
    }

    public async Task<Guid> CreateUserAsync(string email, string password, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/auth/v1/admin/users");
        AddAdminHeaders(request);
        request.Content = JsonContent(new { email, password, email_confirm = true });

        using var response = await _httpClient.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Supabase kullanıcı oluşturma başarısız (HTTP {(int)response.StatusCode}): {body}");
        }

        using var doc = JsonDocument.Parse(body);
        return Guid.Parse(doc.RootElement.GetProperty("id").GetString()!);
    }

    public async Task SetBannedAsync(Guid authUserId, bool banned, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Put, $"{_baseUrl}/auth/v1/admin/users/{authUserId}");
        AddAdminHeaders(request);
        request.Content = JsonContent(new { ban_duration = banned ? "876000h" : "none" });

        using var response = await _httpClient.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"Supabase kullanıcı durumu güncellenemedi (HTTP {(int)response.StatusCode}): {body}");
        }
    }

    public async Task ResetPasswordAsync(Guid authUserId, string newPassword, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Put, $"{_baseUrl}/auth/v1/admin/users/{authUserId}");
        AddAdminHeaders(request);
        request.Content = JsonContent(new { password = newPassword });

        using var response = await _httpClient.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"Şifre sıfırlanamadı (HTTP {(int)response.StatusCode}): {body}");
        }
    }

    public async Task DeleteUserAsync(Guid authUserId, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, $"{_baseUrl}/auth/v1/admin/users/{authUserId}");
        AddAdminHeaders(request);
        using var response = await _httpClient.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
    }

    private void AddAdminHeaders(HttpRequestMessage request)
    {
        request.Headers.Add("apikey", _serviceRoleKey);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _serviceRoleKey);
    }

    private static StringContent JsonContent(object payload) =>
        new(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
}
