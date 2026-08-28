namespace StoneStock.Application.Storage;

public interface ISupabaseStorageClient
{
    Task<string> UploadAsync(string bucket, string objectPath, Stream content, string contentType, CancellationToken ct);
}
