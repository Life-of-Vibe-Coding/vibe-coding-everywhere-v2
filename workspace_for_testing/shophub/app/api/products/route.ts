import { ProductService } from '@/lib/services/product.service';
import { ApiResponse } from '@/lib/utils/response';
import { ErrorMessage } from '@/lib/constants/http';
import type { ProductFilters } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters: ProductFilters = {
      category: searchParams.get('category') || undefined,
      featured: searchParams.get('featured') === 'true' ? true : undefined,
      search: searchParams.get('search') || undefined,
    };

    const products = await ProductService.getProducts(filters);

    return ApiResponse.success(products);
  } catch (error) {
    console.error('Failed to fetch products:', error);
    return ApiResponse.internalError(ErrorMessage.FAILED_TO_FETCH_PRODUCTS);
  }
}
