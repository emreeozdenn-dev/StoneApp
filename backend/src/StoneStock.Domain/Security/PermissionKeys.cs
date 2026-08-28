namespace StoneStock.Domain.Security;

public static class PermissionKeys
{
    public const string StonesView = "stones.view";
    public const string StonesCreate = "stones.create";
    public const string StonesEdit = "stones.edit";
    public const string IncomingStockView = "incomingstock.view";
    public const string IncomingStockCreate = "incomingstock.create";
    public const string IncomingStockEdit = "incomingstock.edit";
    public const string PlatesView = "plates.view";
    public const string PlatesCreate = "plates.create";
    public const string PlatesEdit = "plates.edit";
    public const string CostUnitView = "cost.unit.view";
    public const string CostCurrencyView = "cost.currency.view";
    public const string CostSaleView = "cost.sale.view";
    public const string UsersManage = "users.manage";
    public const string SettingsManage = "settings.manage";
    public const string ThemeManage = "theme.manage";
    public const string NotificationsView = "notifications.view";
    public const string AuditLogView = "auditlog.view";
    public const string QrScanLogView = "qrscanlog.view";
    public const string StonesDelete = "stones.delete";
    public const string IncomingStockDelete = "incomingstock.delete";
    public const string PlatesDelete = "plates.delete";

    public static readonly string[] All =
    {
        StonesView, StonesCreate, StonesEdit,
        IncomingStockView, IncomingStockCreate,
        PlatesView, PlatesCreate, PlatesEdit,
        CostUnitView, CostCurrencyView, CostSaleView,
        UsersManage, SettingsManage, ThemeManage,
        NotificationsView, AuditLogView, QrScanLogView,
        // Yeni izinler mevcut ID eşlemesini bozmamak için sona eklenir.
        IncomingStockEdit,
        StonesDelete, IncomingStockDelete, PlatesDelete,
    };
}

public static class RoleNames
{
    public const string Admin = "Admin";
    public const string Kullanici = "Kullanici";
    public const string Goruntuleyici = "Goruntuleyici";
}
