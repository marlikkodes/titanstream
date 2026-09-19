import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (
    obj &&
    typeof obj === 'object' &&
    ((obj.constructor && (obj.constructor.name === 'Decimal' || obj.constructor.name === 'PrismaDecimal')) ||
      (typeof obj.toNumber === 'function' && typeof obj.toFixed === 'function') ||
      (obj.s !== undefined && obj.e !== undefined && Array.isArray(obj.d)))
  ) {
    return typeof obj.toNumber === 'function' ? obj.toNumber() : Number(obj.toString());
  }
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      res[key] = serializeBigInt(obj[key]);
    }
    return res;
  }
  return obj;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data: serializeBigInt(data),
      })),
    );
  }
}