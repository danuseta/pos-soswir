import { api, apiData } from '$lib/apiConfig';

export function normalizeProducts(products: any[], categories: any[], suppliers: any[]) {
  return products.map(product => ({
    ...product,
    price: parseFloat(product.price) || 0,
    stock: parseInt(product.stock) || 0,
    tax_percentage: parseFloat(product.tax_percentage) || 0,
    category: categories.find(category => category.id === product.category_id) || null,
    supplier: suppliers.find(supplier => supplier.id === product.supplier_id) || null
  }));
}

export async function loadProductPageData() {
  const [productsResult, categoriesResult, suppliersResult] = await Promise.allSettled([
    apiData<any[]>(api.get('/api/products')),
    apiData<any[]>(api.get('/api/categories')),
    apiData<any[]>(api.get('/api/suppliers'))
  ]);
  const categories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : [];
  const suppliers = suppliersResult.status === 'fulfilled' ? suppliersResult.value : [];
  if (productsResult.status === 'rejected') throw productsResult.reason;

  return { categories, suppliers, products: normalizeProducts(productsResult.value, categories, suppliers) };
}

export async function loadProducts(categories: any[], suppliers: any[]) {
  return normalizeProducts(await apiData<any[]>(api.get('/api/products')), categories, suppliers);
}

export async function uploadProductImage(file: File) {
  const formData = new FormData();
  formData.append('image', file);
  return apiData<any>(api.upload('/api/products/upload-image', formData));
}

export function saveProduct(productId: number | null, payload: any) {
  return productId
    ? apiData(api.put(`/api/products/${productId}`, payload))
    : apiData(api.post('/api/products', payload));
}

export function addProductStock(productId: number, quantity: number) {
  return apiData<any>(api.patch(`/api/products/${productId}/add-stock`, { quantity }));
}

export function toggleProductActive(productId: number) {
  return apiData(api.patch(`/api/products/${productId}/toggle-active`));
}

export function hardDeleteProduct(product: any, password: string) {
  return apiData(api.delete(`/api/products/${product.id}/hard-delete`, {
    password,
    confirmation: `DELETE_${product.name.toUpperCase()}`
  }));
}
