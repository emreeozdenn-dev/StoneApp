using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StoneStock.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RenamePlateSaleCostToSaleAmount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "SaleCost",
                table: "Plates",
                newName: "SaleAmount");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "SaleAmount",
                table: "Plates",
                newName: "SaleCost");
        }
    }
}
