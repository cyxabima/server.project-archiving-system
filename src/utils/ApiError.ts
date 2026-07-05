class ApiError extends Error {
  success: boolean;
  statusCode: number;
  errorType: string;

  constructor(statusCode: number, errorType: string, message: string) {
    super(message);
    this.success = false;
    this.statusCode = statusCode;
    this.errorType = errorType;
    // this.name = "ApiError";
    this.message = message;
    // Only works in V8 give the stack trace of error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  toJSON() {
    return {
      success: this.success,
      statusCode: this.statusCode,
      errorType: this.errorType,
      message: this.message, // Explicitly included
      // we can even hide the stack trace in production here!
      stack: process.env.NODE_ENV === "development" ? this.stack : undefined,
    };
  }
}

export default ApiError;
