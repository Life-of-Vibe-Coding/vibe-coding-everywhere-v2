import { ProductService } from '@/lib/services/product.service';
import { ApiResponse } from '@/lib/utils/response';
import { ErrorMessage } from '@/lib/constants/http';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const product = await ProductService.getProductById(params.id);

    if (!product) {
      return ApiResponse.notFound(ErrorMessage.PRODUCT_NOT_FOUND);
    }

    return ApiResponse.success(product);
  } catch (error) {
    console.error('Failed to fetch product:', error);
    return ApiResponse.internalError(ErrorMessage.FAILED_TO_FETCH_PRODUCT);
  }
}
