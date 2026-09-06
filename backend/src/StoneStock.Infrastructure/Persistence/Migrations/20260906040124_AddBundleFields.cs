using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StoneStock.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBundleFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BundleNumber",
                table: "Plates",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BundleCount",
                table: "IncomingStocks",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BundleNumber",
                table: "Plates");

            migrationBuilder.DropColumn(
                name: "BundleCount",
                table: "IncomingStocks");
        }
    }
}
