import {
  ArgumentsHost,
  Catch,
  HttpException,
  InternalServerErrorException
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { GqlContextType } from '@nestjs/graphql';
import * as os from 'os';

@Catch()
export class GlobalExceptionFilter extends BaseExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost) {
    const gql = host.getType<GqlContextType>() === 'graphql';

    if (exception instanceof HttpException) {
      if (gql) {
        throw exception;
      }

      const response = exception.getResponse();
      const status = exception.getStatus();
      const ctx = host.switchToHttp();
      const request = ctx.getRequest();

      // 401/403: minimal body so unauthenticated scans don't trigger Nuclei (stack/env/etc).
      // Only authenticated requests should reach dashboard and get the intentional vuln responses.
      if (status === 401 || status === 403) {
        const minimal = typeof response === 'object' && response !== null && !Array.isArray(response)
          ? { statusCode: status, error: (response as any).error ?? 'Unauthorized', message: (response as any).message }
          : { statusCode: status, error: 'Unauthorized', message: String(response) };
        return host.getArgByIndex(1).status(status).json(minimal);
      }

      // Other HTTP errors: add debug info (for training / non-auth endpoints)
      const debugInfo = {
        ...(typeof response === 'object' ? response : { message: response }),
        debug: {
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
          stack: (exception as any).stack?.split('\n').slice(0, 5),
          nodeVersion: process.version,
          platform: os.platform(),
          hostname: os.hostname(),
          memoryUsage: {
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
          }
        }
      };

      return host.getArgByIndex(1).status(status).json(debugInfo);
    }

    // Enhanced error information for non-HTTP exceptions
    const error = exception as Error;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    
    const debugError = {
      error: error.message,
      debug: {
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        stack: error.stack?.split('\n').slice(0, 10), // Show first 10 stack lines
        nodeVersion: process.version,
        platform: os.platform(),
        hostname: os.hostname(),
        memoryUsage: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB'
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          pid: process.pid,
          uptime: Math.round(process.uptime()) + 's'
        }
      },
      message: 'An internal error has occurred, and the API was unable to service your request.'
    };

    const unprocessableException = new InternalServerErrorException(debugError);

    if (gql) {
      throw unprocessableException;
    }

    const applicationRef =
      this.applicationRef ||
      (this.httpAdapterHost && this.httpAdapterHost.httpAdapter);

    return applicationRef.reply(
      host.getArgByIndex(1),
      unprocessableException.getResponse(),
      unprocessableException.getStatus()
    );
  }
}
