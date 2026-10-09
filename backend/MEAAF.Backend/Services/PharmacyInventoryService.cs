using System.Data;
using Microsoft.Data.SqlClient;
using MEAAF.Backend.Contracts;
using MEAAF.Backend.Data;
using MEAAF.Backend.Infrastructure;

namespace MEAAF.Backend.Services;

public sealed class PharmacyInventoryService(ISqlConnectionFactory connectionFactory) : IPharmacyInventoryService
{
    public async Task<DispenseMedicineResult> DispenseMedicineAsync(
        DispenseMedicineRequest request,
        CancellationToken cancellationToken)
    {
        if (request.OperationId == Guid.Empty)
        {
            throw new ServiceValidationException("OperationId is required for idempotent dispensing.");
        }
        if (request.Quantity <= 0)
        {
            throw new ServiceValidationException("Quantity must be greater than zero.");
        }
        if (string.IsNullOrWhiteSpace(request.UserId))
        {
            throw new ServiceValidationException("UserId is required.");
        }

        var unitPrice = Money.RequireScale(request.UnitPrice, nameof(request.UnitPrice), allowZero: false);
        var saleAmount = Money.Multiply(unitPrice, request.Quantity, "SaleAmount");
        var reference = $"PHARM-{request.OperationId:N}";

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        try
        {
            string productName;
            decimal costPrice;
            int stockBefore;
            await using (var product = new SqlCommand(
                """
                SELECT ProductName, CostPrice, StockQuantity
                FROM Pharmacy.Products WITH (UPDLOCK, HOLDLOCK)
                WHERE ProductId = @productId;
                """,
                connection,
                transaction))
            {
                product.Parameters.Add("@productId", SqlDbType.Int).Value = request.ProductId;
                await using var reader = await product.ExecuteReaderAsync(CommandBehavior.SingleRow, cancellationToken);
                if (!await reader.ReadAsync(cancellationToken))
                {
                    throw new ResourceNotFoundException($"Pharmacy product {request.ProductId} was not found.");
                }

                productName = reader.GetString(0);
                costPrice = reader.GetDecimal(1);
                stockBefore = reader.GetInt32(2);
            }

            if (stockBefore < request.Quantity)
            {
                throw new OperationConflictException(
                    $"Insufficient stock for product {request.ProductId}. Available: {stockBefore}, requested: {request.Quantity}.");
            }

            var stockAfter = stockBefore - request.Quantity;
            var costAmount = Money.Multiply(costPrice, request.Quantity, "CostAmount");
            var lines = new List<LedgerLine>
            {
                new(request.CashAccountId, saleAmount, 0, $"Pharmacy sale: {productName}"),
                new(request.RevenueAccountId, 0, saleAmount, $"Pharmacy revenue: {productName}")
            };
            if (costAmount > 0)
            {
                lines.Add(new LedgerLine(request.CogsAccountId, costAmount, 0, $"COGS: {productName}"));
                lines.Add(new LedgerLine(request.InventoryAccountId, 0, costAmount, $"Inventory issue: {productName}"));
            }

            await LedgerWriter.ValidateAccountsAsync(connection, transaction, lines.Select(line => line.AccountId), cancellationToken);

            await using (var update = new SqlCommand(
                "UPDATE Pharmacy.Products SET StockQuantity = @stock WHERE ProductId = @productId;",
                connection,
                transaction))
            {
                update.Parameters.Add("@stock", SqlDbType.Int).Value = stockAfter;
                update.Parameters.Add("@productId", SqlDbType.Int).Value = request.ProductId;
                await update.ExecuteNonQueryAsync(cancellationToken);
            }

            var journalEntryId = await LedgerWriter.CreateEntryAsync(
                connection,
                transaction,
                DateTime.UtcNow,
                $"Pharmacy dispensing: {productName} × {request.Quantity}",
                reference,
                request.UserId.Trim(),
                lines,
                cancellationToken);

            await AuditWriter.WriteAsync(
                connection,
                transaction,
                "Pharmacy.Products",
                "UPDATE",
                request.ProductId.ToString(),
                new { StockQuantity = stockBefore },
                new { StockQuantity = stockAfter, request.Quantity, SaleAmount = saleAmount, JournalEntryId = journalEntryId },
                request.UserId.Trim(),
                cancellationToken);

            await transaction.CommitAsync(cancellationToken);
            return new DispenseMedicineResult(journalEntryId, reference, stockAfter, saleAmount, costAmount);
        }
        catch (SqlException exception) when (exception.Number is 2601 or 2627)
        {
            await transaction.RollbackAsync(CancellationToken.None);
            throw new OperationConflictException($"Dispensing operation {request.OperationId} has already been processed.");
        }
        catch
        {
            await transaction.RollbackAsync(CancellationToken.None);
            throw;
        }
    }
}
