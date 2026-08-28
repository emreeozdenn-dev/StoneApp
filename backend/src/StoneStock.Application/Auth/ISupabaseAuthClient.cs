namespace StoneStock.Application.Auth;

public interface ISupabaseAuthClient
{
    Task<SupabaseTokenResult?> SignInWithPasswordAsync(string email, string password, CancellationToken ct);

    Task<SupabaseTokenResult?> RefreshAsync(string refreshToken, CancellationToken ct);

    Task SignOutAsync(string accessToken, CancellationToken ct);

    Task<SupabaseTokenValidationResult> ValidateAccessTokenAsync(string accessToken, CancellationToken ct);
}

public interface ISupabaseAdminClient
{
    Task<Guid> CreateUserAsync(string email, string password, CancellationToken ct);

    Task SetBannedAsync(Guid authUserId, bool banned, CancellationToken ct);

    Task DeleteUserAsync(Guid authUserId, CancellationToken ct);

    Task ResetPasswordAsync(Guid authUserId, string newPassword, CancellationToken ct);
}
