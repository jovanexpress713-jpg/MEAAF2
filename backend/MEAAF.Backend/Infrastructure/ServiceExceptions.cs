namespace MEAAF.Backend.Infrastructure;

public class ServiceValidationException(string message) : Exception(message);

public sealed class ResourceNotFoundException(string message) : Exception(message);

public sealed class OperationConflictException(string message) : Exception(message);
