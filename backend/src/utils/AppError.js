export class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, message, details);
export const unauthorized = (message = "Authentication required") => new AppError(401, message);
export const forbidden = (message = "Access denied") => new AppError(403, message);
export const notFound = (message = "Not found") => new AppError(404, message);
export const conflict = (message) => new AppError(409, message);
