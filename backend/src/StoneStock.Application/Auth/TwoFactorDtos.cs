namespace StoneStock.Application.Auth;

public static class TwoFactorConstants
{
    public const string ProtectorName = "StoneStock.TotpSecret";
}

public interface ITotpService
{
    string GenerateSecret();
    string BuildOtpAuthUri(string secret, string email);
    bool VerifyCode(string secret, string code);
}

public sealed record TwoFactorStatusDto(bool Enabled);

public sealed record TwoFactorSetupResult(string Secret, string OtpAuthUri);

public sealed record TwoFactorCodeRequest(string Code);

public sealed record VerifyTwoFactorLoginRequest(string PendingToken, string Code);
