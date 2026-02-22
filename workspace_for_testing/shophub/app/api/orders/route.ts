import { z } from 'zod';
import { OrderService } from '@/lib/services/order.service';
import { AuthService } from '@/lib/utils/auth';
import { ApiResponse } from '@/lib/utils/response';
import { ErrorMessage, HttpStatus } from '@/lib/constants/http';
import { createOrderSchema } from '@/lib/validation/schemas';

export async function POST(request: Request) {
  try {
    // Authenticate user
    const user = await AuthService.requireAuth();

    // Parse and validate request body
    const body = await request.json();
    const orderData = createOrderSchema.parse(body);

    // Create order
    const order = await OrderService.createOrder(user.id, orderData);

    return ApiResponse.success(order, HttpStatus.CREATED);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return ApiResponse.badRequest(ErrorMessage.INVALID_INPUT, error.errors);
    }

    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return ApiResponse.unauthorized();
      }
      if (error.message === 'User not found') {
        return ApiResponse.notFound(ErrorMessage.USER_NOT_FOUND);
      }
    }

    console.error('Failed to create order:', error);
    return ApiResponse.internalError(ErrorMessage.FAILED_TO_CREATE_ORDER);
  }
}

export async function GET(request: Request) {
  try {
    // Authenticate user
    const user = await AuthService.requireAuth();

    // Get user's orders
    const orders = await OrderService.getUserOrders(user.id);

    return ApiResponse.success(orders);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return ApiResponse.unauthorized();
      }
      if (error.message === 'User not found') {
        return ApiResponse.notFound(ErrorMessage.USER_NOT_FOUND);
      }
    }

    console.error('Failed to fetch orders:', error);
    return ApiResponse.internalError(ErrorMessage.FAILED_TO_FETCH_ORDERS);
  }
}
