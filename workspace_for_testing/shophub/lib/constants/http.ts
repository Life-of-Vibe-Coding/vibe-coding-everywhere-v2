/**
 * HTTP status codes and error messages
 */

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const ErrorMessage = {
  UNAUTHORIZED: 'Unauthorized',
  USER_NOT_FOUND: 'User not found',
  PRODUCT_NOT_FOUND: 'Product not found',
  ORDER_NOT_FOUND: 'Order not found',
  INVALID_INPUT: 'Invalid input',
  FAILED_TO_FETCH_PRODUCTS: 'Failed to fetch products',
  FAILED_TO_FETCH_PRODUCT: 'Failed to fetch product',
  FAILED_TO_CREATE_ORDER: 'Failed to create order',
  FAILED_TO_FETCH_ORDERS: 'Failed to fetch orders',
  USER_ALREADY_EXISTS: 'User already exists',
  INTERNAL_SERVER_ERROR: 'Internal server error',
} as const;

export const SuccessMessage = {
  USER_CREATED: 'User created successfully',
  ORDER_CREATED: 'Order created successfully',
} as const;
