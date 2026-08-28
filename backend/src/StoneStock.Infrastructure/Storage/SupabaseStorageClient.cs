using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using StoneStock.Application.Storage;

namespace StoneStock.Infrastructure.Storage;

public sealed class SupabaseStorageClient : ISupabaseStorageClient
{
    private readonly HttpClient _httpClient;
    private readonly string _baseUrl;
    private readonly string _serviceRoleKey;
    private readonly HashSet<string> _ensuredBuckets = new();

    public SupabaseStorageClient(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _baseUrl = (configuration["Supabase:ProjectUrl"] ?? string.Empty).TrimEnd('/');
        _serviceRoleKey = configuration["Supabase:ServiceRoleKey"] ?? string.Empty;
    }

    public async Task<string> UploadAsync(string bucket, string objectPath, Stream content, string contentType, CancellationToken ct)
    {
        await EnsureBucketAsync(bucket, ct);

        using var uploadRequest = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/storage/v1/object/{bucket}/{objectPath}");
        AddAuthHeaders(uploadRequest);
        uploadRequest.Headers.Add("x-upsert", "true");
        var streamContent = new StreamContent(content);
        streamContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        uploadRequest.Content = streamContent;

        using var response = await _httpClient.SendAsync(uploadRequest, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"Görsel yüklenemedi (HTTP {(int)response.StatusCode}): {body}");
        }

        return $"{_baseUrl}/storage/v1/object/public/{bucket}/{objectPath}";
    }

    private async Task EnsureBucketAsync(string bucket, CancellationToken ct)
    {
        if (_ensuredBuckets.Contains(bucket))
        {
            return;
        }

        using var checkRequest = new HttpRequestMessage(HttpMethod.Get, $"{_baseUrl}/storage/v1/bucket/{bucket}");
        AddAuthHeaders(checkRequest);
        using var checkResponse = await _httpClient.SendAsync(checkRequest, ct);
        if (checkResponse.IsSuccessStatusCode)
        {
            _ensuredBuckets.Add(bucket);
            return;
        }

        using var createRequest = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/storage/v1/bucket");
        AddAuthHeaders(createRequest);
        var payload = JsonSerializer.Serialize(new { id = bucket, name = bucket, @public = true });
        createRequest.Content = new StringContent(payload, Encoding.UTF8, "application/json");

        using var createResponse = await _httpClient.SendAsync(createRequest, ct);
        if (!createResponse.IsSuccessStatusCode)
        {
            var body = await createResponse.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"Depolama bucket'ı oluşturulamadı (HTTP {(int)createResponse.StatusCode}): {body}");
        }

        _ensuredBuckets.Add(bucket);
    }

    private void AddAuthHeaders(HttpRequestMessage request)
    {
        request.Headers.Add("apikey", _serviceRoleKey);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _serviceRoleKey);
    }
}
