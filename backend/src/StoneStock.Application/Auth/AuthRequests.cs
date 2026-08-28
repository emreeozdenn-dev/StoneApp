namespace StoneStock.Application.Auth;

public sealed record LoginRequest(string UsernameOrEmail, string Password);

public sealed record SetupRequest(
    string FirstName,
    string LastName,
    string Username,
    string Email,
    string Password);
