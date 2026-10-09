using System.Data;
using Microsoft.Data.SqlClient;
using MEAAF.Backend.Contracts;
using MEAAF.Backend.Data;
using MEAAF.Backend.Infrastructure;

namespace MEAAF.Backend.Services;

public sealed class FiscalClosingService(ISqlConnectionFactory connectionFactory) : IFiscalClosingService
{
    public async Task<FiscalClosingResult> ExecuteYearEndClosingAsync(
        CloseFiscalYearRequest request,
        CancellationToken cancellationToken)
    {
        if (request.FiscalYear is < 2000 or > 9999)
        {
            throw new ServiceValidationException("FiscalYear must be between 2000 and 9999.");
        }
        if (string.IsNullOrWhiteSpace(request.UserId))
        {
            throw new ServiceValidationException("UserId is required.");
        }

        var start = new DateTime(request.FiscalYear, 1, 1);
        var end = start.AddYears(1);
        var reference = $"YEAR-CLOSE-{request.FiscalYear}";

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        try
        {
            await EnsureNotClosedAsync(connection, transaction, reference, request.FiscalYear, cancellationToken);
            await ValidateRetainedEarningsAccountAsync(
                connection,
                transaction,
                request.RetainedEarningsAccountId,
                cancellationToken);

            var balances = await ReadIncomeStatementBalancesAsync(
                connection,
                transaction,
                start,
                end,
                cancellationToken);
            if (balances.Count == 0)
            {
                throw new OperationConflictException($"Fiscal year {request.FiscalYear} has no posted revenue or expense balances to close.");
            }

            var lines = new List<LedgerLine>();
            foreach (var balance in balances)
            {
                var netDebit = balance.Debit - balance.Credit;
                if (netDebit > 0)
                {
                    lines.Add(new LedgerLine(balance.AccountId, 0, netDebit, $"Close {balance.AccountCode} for {request.FiscalYear}"));
                }
                else if (netDebit < 0)
                {
                    lines.Add(new LedgerLine(balance.AccountId, -netDebit, 0, $"Close {balance.AccountCode} for {request.FiscalYear}"));
                }
            }

            var netIncome = lines.Sum(line => line.Debit - line.Credit);
            if (netIncome > 0)
            {
                lines.Add(new LedgerLine(request.RetainedEarningsAccountId, 0, netIncome, $"Net income {request.FiscalYear}"));
            }
            else if (netIncome < 0)
            {
                lines.Add(new LedgerLine(request.RetainedEarningsAccountId, -netIncome, 0, $"Net loss {request.FiscalYear}"));
            }

            var journalEntryId = await LedgerWriter.CreateEntryAsync(
                connection,
                transaction,
                end.AddTicks(-1),
                $"Year-end closing for fiscal year {request.FiscalYear}",
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
                new { request.FiscalYear, NetIncome = netIncome, ClosedAccounts = balances.Count, JournalEntryId = journalEntryId },
                request.UserId.Trim(),
                cancellationToken);

            await transaction.CommitAsync(cancellationToken);
            return new FiscalClosingResult(journalEntryId, reference, netIncome, balances.Count);
        }
        catch (SqlException exception) when (exception.Number is 2601 or 2627)
        {
            await transaction.RollbackAsync(CancellationToken.None);
            throw new OperationConflictException($"Fiscal year {request.FiscalYear} has already been closed.");
        }
        catch
        {
            await transaction.RollbackAsync(CancellationToken.None);
            throw;
        }
    }

    private static async Task EnsureNotClosedAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        string reference,
        int fiscalYear,
        CancellationToken cancellationToken)
    {
        await using var command = new SqlCommand(
            "SELECT COUNT(1) FROM Accounting.JournalEntries WITH (UPDLOCK, HOLDLOCK) WHERE ReferenceNumber = @reference;",
            connection,
            transaction);
        command.Parameters.Add("@reference", SqlDbType.VarChar, 50).Value = reference;
        if (Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken)) > 0)
        {
            throw new OperationConflictException($"Fiscal year {fiscalYear} has already been closed.");
        }
    }

    private static async Task ValidateRetainedEarningsAccountAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        int accountId,
        CancellationToken cancellationToken)
    {
        await using var command = new SqlCommand(
            """
            SELECT COUNT(1)
            FROM Accounting.Accounts
            WHERE AccountId = @id AND AccountType = 3 AND IsDetail = 1 AND IsActive = 1;
            """,
            connection,
            transaction);
        command.Parameters.Add("@id", SqlDbType.Int).Value = accountId;
        if (Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken)) != 1)
        {
            throw new ServiceValidationException("Retained earnings account must be an active detail equity account.");
        }
    }

    private static async Task<List<AccountBalance>> ReadIncomeStatementBalancesAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        DateTime start,
        DateTime end,
        CancellationToken cancellationToken)
    {
        await using var command = new SqlCommand(
            """
            SELECT a.AccountId,
                   a.AccountCode,
                   SUM(l.Debit) AS Debit,
                   SUM(l.Credit) AS Credit
            FROM Accounting.JournalEntries AS e
            INNER JOIN Accounting.JournalLines AS l ON l.JournalEntryId = e.JournalEntryId
            INNER JOIN Accounting.Accounts AS a ON a.AccountId = l.AccountId
            WHERE e.IsPosted = 1
              AND e.EntryDate >= @start
              AND e.EntryDate < @end
              AND a.AccountType IN (4, 5)
            GROUP BY a.AccountId, a.AccountCode
            HAVING SUM(l.Debit) <> SUM(l.Credit);
            """,
            connection,
            transaction);
        command.Parameters.Add("@start", SqlDbType.DateTime2).Value = start;
        command.Parameters.Add("@end", SqlDbType.DateTime2).Value = end;

        var result = new List<AccountBalance>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            result.Add(new AccountBalance(reader.GetInt32(0), reader.GetString(1), reader.GetDecimal(2), reader.GetDecimal(3)));
        }
        return result;
    }

    private sealed record AccountBalance(int AccountId, string AccountCode, decimal Debit, decimal Credit);
}
