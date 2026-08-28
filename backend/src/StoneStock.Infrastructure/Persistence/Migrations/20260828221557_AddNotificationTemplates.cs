using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StoneStock.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LowStockBodyTemplate",
                table: "SystemSettings",
                type: "text",
                nullable: false,
                defaultValue: "<p><strong>{{TasAdi}}</strong> taşının stoğu minimum seviyenin altına düştü.</p><p>Minimum Stok: {{MinimumStok}} m²</p>");

            migrationBuilder.AddColumn<string>(
                name: "LowStockSubjectTemplate",
                table: "SystemSettings",
                type: "text",
                nullable: false,
                defaultValue: "Düşük Stok Uyarısı: {{TasAdi}}");

            migrationBuilder.AddColumn<string>(
                name: "NewStockBodyTemplate",
                table: "SystemSettings",
                type: "text",
                nullable: false,
                defaultValue: "<p><strong>{{TasAdi}}</strong> taşından yeni parti geldi.</p><p>Parti Kodu: {{PartiKodu}}<br/>Miktar: {{Miktar}}<br/>Depo: {{Depo}}</p>");

            migrationBuilder.AddColumn<string>(
                name: "NewStockSubjectTemplate",
                table: "SystemSettings",
                type: "text",
                nullable: false,
                defaultValue: "Yeni Stok: {{TasAdi}} ({{PartiKodu}})");

            migrationBuilder.AddColumn<string>(
                name: "PlateSoldBodyTemplate",
                table: "SystemSettings",
                type: "text",
                nullable: false,
                defaultValue: "<p><strong>{{PlakaNo}}</strong> ({{TasAdi}}) plakası satıldı olarak işaretlendi.</p><p>Alan: {{Alan}} m²<br/>Satış Tutarı: {{SatisTutari}}</p>");

            migrationBuilder.AddColumn<string>(
                name: "PlateSoldSubjectTemplate",
                table: "SystemSettings",
                type: "text",
                nullable: false,
                defaultValue: "Plaka Satıldı: {{PlakaNo}}");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LowStockBodyTemplate",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "LowStockSubjectTemplate",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "NewStockBodyTemplate",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "NewStockSubjectTemplate",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "PlateSoldBodyTemplate",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "PlateSoldSubjectTemplate",
                table: "SystemSettings");
        }
    }
}
