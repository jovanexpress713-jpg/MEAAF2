using MEAAF.Backend.Contracts;
using MEAAF.Backend.Infrastructure;

namespace MEAAF.Backend.Services;

public sealed class InpatientAdmissionService : IInpatientAdmissionService
{
    public StayChargeResult CalculateInpatientStayCharges(CalculateStayRequest request)
    {
        var dailyRate = Money.RequireScale(request.DailyRate, nameof(request.DailyRate));
        if (request.DischargeDate < request.AdmissionDate)
        {
            throw new ServiceValidationException("Discharge date cannot precede admission date.");
        }

        var days = Math.Max(1, checked((int)Math.Ceiling((request.DischargeDate - request.AdmissionDate).TotalDays)));
        return new StayChargeResult(days, Money.Multiply(dailyRate, days, "TotalCharges"));
    }
}
