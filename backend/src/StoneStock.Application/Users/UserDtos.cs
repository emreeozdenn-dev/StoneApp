namespace StoneStock.Application.Users;

public sealed record UserListItemDto(
    int Id,
    string FirstName,
    string LastName,
    string Username,
    string Email,
    string Role,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? LastLoginAt);

public sealed record CreateUserRequest(
    string FirstName,
    string LastName,
    string Username,
    string Email,
    string Password,
    int RoleId);

public sealed record UpdateUserRequest(string FirstName, string LastName, int RoleId);

public sealed record SetUserStatusRequest(bool Active);

public sealed record ResetPasswordRequest(string NewPassword);

public sealed record RoleDto(int Id, string Name, bool IsSystemRole, int UserCount);

public sealed record PermissionDto(int Id, string Key, string Description);

public sealed record RolePermissionsDto(int RoleId, string RoleName, bool IsSystemRole, List<string> PermissionKeys);

public sealed record UpdateRolePermissionsRequest(List<string> PermissionKeys);

public sealed record CreateRoleRequest(string Name);

public sealed record UpdateRoleRequest(string Name);
