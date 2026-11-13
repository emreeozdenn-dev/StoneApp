using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StoneStock.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddIncomingStockArrivalExchangeRate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ArrivalExchangeRate",
                table: "IncomingStocks",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ArrivalExchangeRateManual",
                table: "IncomingStocks",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ArrivalExchangeRate",
                table: "IncomingStocks");

            migrationBuilder.DropColumn(
                name: "ArrivalExchangeRateManual",
                table: "IncomingStocks");
        }
    }
}
