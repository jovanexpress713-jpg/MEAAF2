using MEAAF.Backend.Infrastructure;

namespace MEAAF.Backend.Services;

internal static class Money
{
    public static decimal RequireScale(decimal value, string field, bool allowZero = true)
    {
        if (value < 0 || (!allowZero && value == 0))
        {
            throw new ServiceValidationException($"{field} must be {(allowZero ? "non-negative" : "greater than zero")}.");
        }

        if (decimal.Round(value, 2, MidpointRounding.AwayFromZero) != value)
        {
            throw new ServiceValidationException($"{field} must not contain more than two decimal places.");
        }

        return value;
    }

    public static decimal Multiply(decimal amount, int quantity, string field)
    {
        try
        {
            return decimal.Round(checked(amount * quantity), 2, MidpointRounding.AwayFromZero);
        }
        catch (OverflowException)
        {
            throw new ServiceValidationException($"{field} exceeds the supported monetary range.");
        }
    }
}
