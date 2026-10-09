using System.Data;
using Microsoft.Data.SqlClient;
using MEAAF.Backend.Infrastructure;

namespace MEAAF.Backend.Data;

internal sealed record LedgerLine(int AccountId, decimal Debit, decimal Credit, string Memo);

internal static class LedgerWriter
{
    public static async Task ValidateAccountsAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        IEnumerable<int> accountIds,
        CancellationToken cancellationToken)
    {
        foreach (var accountId in accountIds.Distinct())
        {
            await using var command = new SqlCommand(
                "SELECT COUNT(1) FROM Accounting.Accounts WHERE AccountId = @id AND IsDetail = 1 AND IsActive = 1;",
                connection,
                transaction);
            command.Parameters.Add("@id", SqlDbType.Int).Value = accountId;
            var count = Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken));
            if (count != 1)
            {
                throw new ServiceValidationException($"Account {accountId} does not exist or is not an active detail account.");
            }
        }
    }

    public static async Task<int> CreateEntryAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        DateTime entryDate,
        string description,
        string referenceNumber,
        string createdBy,
        IReadOnlyCollection<LedgerLine> lines,
        CancellationToken cancellationToken)
    {
        var debit = lines.Sum(line => line.Debit);
        var credit = lines.Sum(line => line.Credit);
        if (lines.Count < 2 || debit <= 0 || debit != credit)
        {
            throw new ServiceValidationException($"Unbalanced journal entry: debit {debit:N2}, credit {credit:N2}.");
        }

        if (lines.Any(line => line.Debit < 0 || line.Credit < 0 ||
                              (line.Debit > 0) == (line.Credit > 0)))
        {
            throw new ServiceValidationException("Every journal line must contain a positive amount on exactly one side.");
        }

        await using var header = new SqlCommand(
            """
            INSERT INTO Accounting.JournalEntries
                (EntryDate, Description, ReferenceNumber, IsPosted, CreatedBy)
            OUTPUT INSERTED.JournalEntryId
            VALUES (@date, @description, @reference, 0, @createdBy);
            """,
            connection,
            transaction);
        header.Parameters.Add("@date", SqlDbType.DateTime2).Value = entryDate;
        header.Parameters.Add("@description", SqlDbType.NVarChar, 500).Value = description;
        header.Parameters.Add("@reference", SqlDbType.VarChar, 50).Value = referenceNumber;
        header.Parameters.Add("@createdBy", SqlDbType.NVarChar, 450).Value = createdBy;
        var journalEntryId = Convert.ToInt32(await header.ExecuteScalarAsync(cancellationToken));

        foreach (var line in lines)
        {
            await using var detail = new SqlCommand(
                """
                INSERT INTO Accounting.JournalLines
                    (JournalEntryId, AccountId, Debit, Credit, Memo)
                VALUES (@entryId, @accountId, @debit, @credit, @memo);
                """,
                connection,
                transaction);
            detail.Parameters.Add("@entryId", SqlDbType.Int).Value = journalEntryId;
            detail.Parameters.Add("@accountId", SqlDbType.Int).Value = line.AccountId;
            detail.Parameters.Add("@debit", SqlDbType.Decimal).ConfigureDecimal().Value = line.Debit;
            detail.Parameters.Add("@credit", SqlDbType.Decimal).ConfigureDecimal().Value = line.Credit;
            detail.Parameters.Add("@memo", SqlDbType.NVarChar, 250).Value = line.Memo;
            await detail.ExecuteNonQueryAsync(cancellationToken);
        }

        await using var post = new SqlCommand(
            "UPDATE Accounting.JournalEntries SET IsPosted = 1 WHERE JournalEntryId = @id;",
            connection,
            transaction);
        post.Parameters.Add("@id", SqlDbType.Int).Value = journalEntryId;
        await post.ExecuteNonQueryAsync(cancellationToken);
        return journalEntryId;
    }

    private static SqlParameter ConfigureDecimal(this SqlParameter parameter)
    {
        parameter.Precision = 18;
        parameter.Scale = 2;
        return parameter;
    }
}
