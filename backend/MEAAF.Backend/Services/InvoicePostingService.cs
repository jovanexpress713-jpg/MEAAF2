using System.Data;
using Microsoft.Data.SqlClient;
using MEAAF.Backend.Contracts;
using MEAAF.Backend.Data;
using MEAAF.Backend.Infrastructure;

namespace MEAAF.Backend.Services;

public sealed class InvoicePostingService(ISqlConnectionFactory connectionFactory) : IInvoicePostingService
{
    public async Task<JournalPostingResult> PostInvoiceWithLedgerAsync(
        PostInvoiceRequest request,
        CancellationToken cancellationToken)
    {
        var total = Money.RequireScale(request.TotalAmount, nameof(request.TotalAmount), allowZero: false);
        var discount = Money.RequireScale(request.Discount, nameof(request.Discount));
        var cash = Money.RequireScale(request.CashPaid, nameof(request.CashPaid));
        var credit = Money.RequireScale(request.CreditPaid, nameof(request.CreditPaid));
        if (cash + credit + discount != total)
        {
            throw new ServiceValidationException(
                $"Journal is not balanced: cash, credit, and discount ({cash + credit + discount:N2}) must equal invoice total ({total:N2}).");
        }

        if (discount > 0 && request.DiscountAccountId is null)
        {
            throw new ServiceValidationException("DiscountAccountId is required when the invoice includes a discount.");
        }

        if (string.IsNullOrWhiteSpace(request.UserId))
        {
            throw new ServiceValidationException("UserId is required.");
        }

        var reference = $"INV-{request.InvoiceId}";
        var lines = new List<LedgerLine>();
        AddLine(lines, request.CashAccountId, cash, 0, $"Invoice {request.InvoiceId} cash");
        AddLine(lines, request.ReceivableAccountId, credit, 0, $"Invoice {request.InvoiceId} receivable");
        if (discount > 0)
        {
            AddLine(lines, request.DiscountAccountId!.Value, discount, 0, $"Invoice {request.InvoiceId} discount");
        }
        AddLine(lines, request.RevenueAccountId, 0, total, $"Invoice {request.InvoiceId} revenue");

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        try
        {
            await LedgerWriter.ValidateAccountsAsync(connection, transaction, lines.Select(line => line.AccountId), cancellationToken);
            var journalEntryId = await LedgerWriter.CreateEntryAsync(
                connection,
                transaction,
                DateTime.UtcNow,
                $"Automatic posting for invoice #{request.InvoiceId}",
                reference,
                request.UserId.Trim(),
                lines,
                cancellationToken);

            await AuditWriter.WriteAsync(
                connection,
                transaction,
                "Accounting.JournalEntries",
                "POST",
                journalEntryId.ToString(),
                null,
                new { request.InvoiceId, TotalAmount = total, JournalEntryId = journalEntryId },
                request.UserId.Trim(),
                cancellationToken);

            await transaction.CommitAsync(cancellationToken);
            return new JournalPostingResult(journalEntryId, reference, total, total);
        }
        catch (SqlException exception) when (exception.Number is 2601 or 2627)
        {
            await transaction.RollbackAsync(CancellationToken.None);
            throw new OperationConflictException($"Invoice {request.InvoiceId} has already been posted.");
        }
        catch
        {
            await transaction.RollbackAsync(CancellationToken.None);
            throw;
        }
    }

    private static void AddLine(List<LedgerLine> lines, int accountId, decimal debit, decimal credit, string memo)
    {
        if (debit > 0 || credit > 0)
        {
            lines.Add(new LedgerLine(accountId, debit, credit, memo));
        }
    }
}
