using StoneStock.Domain.Enums;

namespace StoneStock.Domain.Entities;

public sealed class User
{
    public int Id { get; set; }
    public Guid AuthUserId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public int RoleId { get; set; }
    public Role Role { get; set; } = null!;
    public UserStatus Status { get; set; } = UserStatus.Aktif;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastLoginAt { get; set; }
}
