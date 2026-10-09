using System.ComponentModel.DataAnnotations;

namespace MEAAF.Backend.Contracts;

public sealed record PostInvoiceRequest(
    [property: Range(1, int.MaxValue)] int InvoiceId,
    [property: Range(typeof(decimal), "0.01", "9999999999999999.99")] decimal TotalAmount,
    [property: Range(typeof(decimal), "0", "9999999999999999.99")] decimal Discount,
    [property: Range(typeof(decimal), "0", "9999999999999999.99")] decimal CashPaid,
    [property: Range(typeof(decimal), "0", "9999999999999999.99")] decimal CreditPaid,
    [property: Range(1, int.MaxValue)] int CashAccountId,
    [property: Range(1, int.MaxValue)] int ReceivableAccountId,
    [property: Range(1, int.MaxValue)] int RevenueAccountId,
    int? DiscountAccountId,
    [property: Required, MaxLength(450)] string UserId);

public sealed record JournalPostingResult(int JournalEntryId, string ReferenceNumber, decimal Debit, decimal Credit);

public sealed record DispenseMedicineRequest(
    Guid OperationId,
    [property: Range(1, int.MaxValue)] int ProductId,
    [property: Range(1, int.MaxValue)] int Quantity,
    [property: Range(typeof(decimal), "0.01", "9999999999999999.99")] decimal UnitPrice,
    [property: Range(1, int.MaxValue)] int CashAccountId,
    [property: Range(1, int.MaxValue)] int InventoryAccountId,
    [property: Range(1, int.MaxValue)] int CogsAccountId,
    [property: Range(1, int.MaxValue)] int RevenueAccountId,
    [property: Required, MaxLength(450)] string UserId);

public sealed record DispenseMedicineResult(
    int JournalEntryId,
    string ReferenceNumber,
    int RemainingStock,
    decimal SaleAmount,
    decimal CostAmount);

public sealed record CalculateStayRequest(DateTime AdmissionDate, DateTime DischargeDate, decimal DailyRate);

public sealed record StayChargeResult(int ChargedDays, decimal TotalCharges);

public sealed record CloseFiscalYearRequest(
    [property: Range(2000, 9999)] int FiscalYear,
    [property: Range(1, int.MaxValue)] int RetainedEarningsAccountId,
    [property: Required, MaxLength(450)] string UserId);

public sealed record FiscalClosingResult(
    int JournalEntryId,
    string ReferenceNumber,
    decimal NetIncome,
    int ClosedAccountCount);
