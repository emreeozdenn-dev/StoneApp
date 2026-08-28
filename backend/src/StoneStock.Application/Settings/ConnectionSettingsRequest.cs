namespace StoneStock.Application.Settings;

public sealed record ConnectionSettingsRequest(
    string Server,
    int Port,
    string Database,
    string UserId,
    string Password);

public sealed record ConnectionTestResult(bool Success, string Message);
