using System.ComponentModel.DataAnnotations;

namespace MEAAF.Backend.Infrastructure;

public sealed class DataAnnotationsFilter<T> : IEndpointFilter where T : class
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var model = context.Arguments.OfType<T>().FirstOrDefault();
        if (model is null)
        {
            return Results.BadRequest(new { error = "Request body is required." });
        }

        var validationResults = new List<ValidationResult>();
        if (Validator.TryValidateObject(model, new ValidationContext(model), validationResults, validateAllProperties: true))
        {
            return await next(context);
        }

        var errors = validationResults
            .SelectMany(result => result.MemberNames.DefaultIfEmpty(string.Empty), (result, member) => new { member, result.ErrorMessage })
            .GroupBy(item => item.member)
            .ToDictionary(
                group => group.Key,
                group => group.Select(item => item.ErrorMessage ?? "Invalid value.").ToArray());
        return Results.ValidationProblem(errors);
    }
}
