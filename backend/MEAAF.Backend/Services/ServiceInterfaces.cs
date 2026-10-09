using MEAAF.Backend.Contracts;

namespace MEAAF.Backend.Services;

public interface IInvoicePostingService
{
    Task<JournalPostingResult> PostInvoiceWithLedgerAsync(PostInvoiceRequest request, CancellationToken cancellationToken);
}

public interface IPharmacyInventoryService
{
    Task<DispenseMedicineResult> DispenseMedicineAsync(DispenseMedicineRequest request, CancellationToken cancellationToken);
}

public interface IInpatientAdmissionService
{
    StayChargeResult CalculateInpatientStayCharges(CalculateStayRequest request);
}

public interface IFiscalClosingService
{
    Task<FiscalClosingResult> ExecuteYearEndClosingAsync(CloseFiscalYearRequest request, CancellationToken cancellationToken);
}
