import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class HttpExceptionLoggingFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionLoggingFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttpException
      ? exception.getResponse()
      : {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "Internal server error",
        };

    const method = request.method;
    const path = request.originalUrl || request.url;
    const summary = `${method} ${path} -> ${status}`;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(summary, stack);
    } else {
      const details =
        typeof payload === "string"
          ? payload
          : JSON.stringify(payload);
      this.logger.warn(`${summary} ${details}`);
    }

    response.status(status).json(
      typeof payload === "string"
        ? {
            statusCode: status,
            message: payload,
          }
        : payload,
    );
  }
}
