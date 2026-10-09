using MEAAF.Backend.Contracts;
using MEAAF.Backend.Data;
using MEAAF.Backend.Infrastructure;
using MEAAF.Backend.Services;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddProblemDetails();
builder.Services.AddSingleton<ISqlConnectionFactory, SqlConnectionFactory>();
builder.Services.AddScoped<IInvoicePostingService, InvoicePostingService>();
builder.Services.AddScoped<IPharmacyInventoryService, PharmacyInventoryService>();
builder.Services.AddSingleton<IInpatientAdmissionService, InpatientAdmissionService>();
builder.Services.AddScoped<IFiscalClosingService, FiscalClosingService>();

var app = builder.Build();

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        var (status, title, detail) = exception switch
        {
            ServiceValidationException validation => (StatusCodes.Status400BadRequest, "Validation failed", validation.Message),
            ResourceNotFoundException notFound => (StatusCodes.Status404NotFound, "Resource not found", notFound.Message),
            OperationConflictException conflict => (StatusCodes.Status409Conflict, "Operation conflict", conflict.Message),
            SqlException => (StatusCodes.Status503ServiceUnavailable, "Database unavailable", "The database operation could not be completed."),
            _ => (StatusCodes.Status500InternalServerError, "Unexpected error", "An unexpected server error occurred.")
        };

        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = detail,
            Instance = context.Request.Path
        });
    });
});

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "MEAAF.Backend" }));

var accounting = app.MapGroup("/api/accounting");
accounting.MapPost("/invoices/post", async (
        PostInvoiceRequest request,
        IInvoicePostingService service,
        CancellationToken cancellationToken) =>
        Results.Ok(await service.PostInvoiceWithLedgerAsync(request, cancellationToken)))
    .AddEndpointFilter(new DataAnnotationsFilter<PostInvoiceRequest>());

accounting.MapPost("/fiscal-years/close", async (
        CloseFiscalYearRequest request,
        IFiscalClosingService service,
        CancellationToken cancellationToken) =>
        Results.Ok(await service.ExecuteYearEndClosingAsync(request, cancellationToken)))
    .AddEndpointFilter(new DataAnnotationsFilter<CloseFiscalYearRequest>());

app.MapPost("/api/pharmacy/dispense", async (
        DispenseMedicineRequest request,
        IPharmacyInventoryService service,
        CancellationToken cancellationToken) =>
        Results.Ok(await service.DispenseMedicineAsync(request, cancellationToken)))
    .AddEndpointFilter(new DataAnnotationsFilter<DispenseMedicineRequest>());

app.MapPost("/api/inpatient/calculate-charges", (
        CalculateStayRequest request,
        IInpatientAdmissionService service) =>
        Results.Ok(service.CalculateInpatientStayCharges(request)))
    .AddEndpointFilter(new DataAnnotationsFilter<CalculateStayRequest>());

app.Run();

public partial class Program { }
