namespace StoneStock.Application.Auth;

public sealed record SupabaseTokenResult(string AccessToken, string RefreshToken, int ExpiresIn);

public sealed record SupabaseTokenValidationResult(bool IsValid, Guid? AuthUserId, string? Email);

public sealed record CurrentUserDto(
    int Id,
    string FirstName,
    string LastName,
    string Username,
    string Email,
    string Role,
    string[] Permissions);
