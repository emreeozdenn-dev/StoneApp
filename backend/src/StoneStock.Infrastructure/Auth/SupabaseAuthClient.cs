using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using StoneStock.Application.Auth;

namespace StoneStock.Infrastructure.Auth;

public sealed class SupabaseAuthClient : ISupabaseAuthClient
{
    private const string JwksCacheKey = "supabase-jwks";

    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private readonly string _baseUrl;
    private readonly string _anonKey;
    private readonly ILogger<SupabaseAuthClient> _logger;

    public SupabaseAuthClient(HttpClient httpClient, IMemoryCache cache, IConfiguration configuration, ILogger<SupabaseAuthClient> logger)
    {
        _httpClient = httpClient;
        _cache = cache;
        _baseUrl = (configuration["Supabase:ProjectUrl"] ?? string.Empty).TrimEnd('/');
        _anonKey = configuration["Supabase:AnonKey"] ?? string.Empty;
        _logger = logger;
    }

    public async Task<SupabaseTokenResult?> SignInWithPasswordAsync(string email, string password, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/auth/v1/token?grant_type=password");
        request.Headers.Add("apikey", _anonKey);
        request.Content = JsonContent(new { email, password });

        using var response = await _httpClient.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        return await ParseTokenResponseAsync(response, ct);
    }

    public async Task<SupabaseTokenResult?> RefreshAsync(string refreshToken, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/auth/v1/token?grant_type=refresh_token");
        request.Headers.Add("apikey", _anonKey);
        request.Content = JsonContent(new { refresh_token = refreshToken });

        using var response = await _httpClient.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        return await ParseTokenResponseAsync(response, ct);
    }

    public async Task SignOutAsync(string accessToken, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/auth/v1/logout");
        request.Headers.Add("apikey", _anonKey);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        try
        {
            await _httpClient.SendAsync(request, ct);
        }
        catch
        {
            // best-effort: cookie is cleared locally regardless
        }
    }

    public async Task<SupabaseTokenValidationResult> ValidateAccessTokenAsync(string accessToken, CancellationToken ct)
    {
        var jwks = await GetJwksAsync(ct);

        var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = $"{_baseUrl}/auth/v1",
            ValidateAudience = false,
            ValidateLifetime = true,
            IssuerSigningKeys = jwks.Keys,
        };

        try
        {
            var principal = handler.ValidateToken(accessToken, validationParameters, out _);
            var sub = principal.FindFirst("sub")?.Value;
            var email = principal.FindFirst("email")?.Value;
            if (sub is null || !Guid.TryParse(sub, out var authUserId))
            {
                return new SupabaseTokenValidationResult(false, null, null);
            }

            return new SupabaseTokenValidationResult(true, authUserId, email);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Supabase access token validation failed");
            return new SupabaseTokenValidationResult(false, null, null);
        }
    }

    private async Task<JsonWebKeySet> GetJwksAsync(CancellationToken ct)
    {
        if (_cache.TryGetValue(JwksCacheKey, out JsonWebKeySet? cached) && cached is not null)
        {
            return cached;
        }

        var json = await _httpClient.GetStringAsync($"{_baseUrl}/auth/v1/.well-known/jwks.json", ct);
        var jwks = new JsonWebKeySet(json);
        _cache.Set(JwksCacheKey, jwks, TimeSpan.FromHours(1));
        return jwks;
    }

    private static async Task<SupabaseTokenResult?> ParseTokenResponseAsync(HttpResponseMessage response, CancellationToken ct)
    {
        using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        var root = doc.RootElement;

        if (!root.TryGetProperty("access_token", out var accessTokenEl) ||
            !root.TryGetProperty("refresh_token", out var refreshTokenEl))
        {
            return null;
        }

        var expiresIn = root.TryGetProperty("expires_in", out var expiresEl) ? expiresEl.GetInt32() : 3600;
        return new SupabaseTokenResult(accessTokenEl.GetString()!, refreshTokenEl.GetString()!, expiresIn);
    }

    private static StringContent JsonContent(object payload) =>
        new(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");
}
