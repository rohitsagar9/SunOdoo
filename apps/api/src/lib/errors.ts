export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = 'APP_ERROR',
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function notFound(entity: string) {
  return new AppError(404, `${entity} not found`, 'NOT_FOUND');
}

export function forbidden(message = 'You do not have permission to perform this action') {
  return new AppError(403, message, 'FORBIDDEN');
}
