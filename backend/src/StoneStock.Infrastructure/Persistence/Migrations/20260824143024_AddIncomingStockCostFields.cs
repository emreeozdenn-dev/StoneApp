using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StoneStock.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddIncomingStockCostFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CustomsCost",
                table: "IncomingStocks",
                type: "numeric(14,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "IncomingStocks",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "OtherCost",
                table: "IncomingStocks",
                type: "numeric(14,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SaleCost",
                table: "IncomingStocks",
                type: "numeric(14,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ShippingCost",
                table: "IncomingStocks",
                type: "numeric(14,2)",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CustomsCost",
                table: "IncomingStocks");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "IncomingStocks");

            migrationBuilder.DropColumn(
                name: "OtherCost",
                table: "IncomingStocks");

            migrationBuilder.DropColumn(
                name: "SaleCost",
                table: "IncomingStocks");

            migrationBuilder.DropColumn(
                name: "ShippingCost",
                table: "IncomingStocks");
        }
    }
}
