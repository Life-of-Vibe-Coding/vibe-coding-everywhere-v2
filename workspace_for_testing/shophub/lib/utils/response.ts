/**
 * Standardized response utilities
 */

import { NextResponse } from 'next/server';
import { HttpStatus } from '../constants/http';
import type { ApiError } from '../types';

export class ApiResponse {
  static success<T>(data: T, status: number = HttpStatus.OK) {
    return NextResponse.json(data, { status });
  }

  static error(message: string, status: number = HttpStatus.INTERNAL_SERVER_ERROR, details?: any) {
    const error: ApiError = { error: message };
    if (details) {
      error.details = details;
    }
    return NextResponse.json(error, { status });
  }

  static unauthorized(message: string = 'Unauthorized') {
    return this.error(message, HttpStatus.UNAUTHORIZED);
  }

  static notFound(message: string) {
    return this.error(message, HttpStatus.NOT_FOUND);
  }

  static badRequest(message: string, details?: any) {
    return this.error(message, HttpStatus.BAD_REQUEST, details);
  }

  static internalError(message: string = 'Internal server error') {
    return this.error(message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
