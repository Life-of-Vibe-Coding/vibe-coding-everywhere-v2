import { z } from 'zod';
import { UserService } from '@/lib/services/user.service';
import { ApiResponse } from '@/lib/utils/response';
import { ErrorMessage, SuccessMessage, HttpStatus } from '@/lib/constants/http';
import { registerSchema } from '@/lib/validation/schemas';

export async function POST(request: Request) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const userData = registerSchema.parse(body);

    // Create user
    const user = await UserService.createUser(userData);

    return ApiResponse.success(
      { message: SuccessMessage.USER_CREATED, userId: user.id },
      HttpStatus.CREATED
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return ApiResponse.badRequest(ErrorMessage.INVALID_INPUT, error.errors);
    }

    if (error instanceof Error && error.message === 'User already exists') {
      return ApiResponse.badRequest(ErrorMessage.USER_ALREADY_EXISTS);
    }

    console.error('Failed to register user:', error);
    return ApiResponse.internalError(ErrorMessage.INTERNAL_SERVER_ERROR);
  }
}
