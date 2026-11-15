import { BACKEND_URL } from '$lib/apiConfig';

export function validateProduct(product: any, isReseller: boolean, suppliers: any[]): string | null {
  if (!product.name) return 'Nama produk tidak boleh kosong';
  if (isNaN(product.price) || product.price < 0) return 'Harga harus berupa angka positif';
  if (isNaN(product.stock) || product.stock < 0) return 'Stok harus berupa angka positif';
  if (!product.category_id) return 'Kategori harus dipilih';
  if (!isReseller) return null;
  if (!product.supplier_id) return 'Produk PUBJ harus memiliki supplier';
  if (!product.tax_percentage || product.tax_percentage <= 0 || product.tax_percentage > 100) {
    return 'Produk PUBJ harus memiliki persentase fee antara 1-100%';
  }
  return suppliers.some(supplier => supplier.id === parseInt(product.supplier_id))
    ? null
    : 'Supplier yang dipilih tidak valid';
}

export function createProductPayload(product: any, isReseller: boolean, isEditing: boolean, imageUrl: string, imageFilename: string | null) {
  return {
    name: product.name,
    price: parseFloat(String(product.price)),
    stock: isEditing ? undefined : parseInt(String(product.stock)),
    category_id: product.category_id,
    supplier_id: isReseller ? product.supplier_id : null,
    description: product.description || '',
    image_url: imageUrl,
    image_filename: imageFilename,
    tax_percentage: isReseller ? parseFloat(String(product.tax_percentage)) : 0,
    tax_description: isReseller ? product.tax_description : ''
  };
}

export function filterAndSortProducts(products: any[], search: string, category: string, stock: string, sortField: string, direction: string) {
  const query = search.toLowerCase();
  return products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(query) || product.description?.toLowerCase().includes(query);
    const matchesCategory = !category || product.category_id?.toString() === category;
    const matchesStock = stock === 'all' || (stock === 'low' && product.stock <= 10 && product.stock > 0) || (stock === 'out' && product.stock === 0);
    return matchesSearch && matchesCategory && matchesStock;
  }).sort((left, right) => {
    let leftValue = left[sortField];
    let rightValue = right[sortField];
    if (sortField === 'price' || sortField === 'stock') {
      leftValue = Number(leftValue) || 0;
      rightValue = Number(rightValue) || 0;
    } else {
      leftValue = String(leftValue || '').toLowerCase();
      rightValue = String(rightValue || '').toLowerCase();
    }
    const result = leftValue > rightValue ? 1 : -1;
    return direction === 'asc' ? result : -result;
  });
}

export function createProductForm(categoryId: number | null = null) {
  return {
    id: null,
    name: '',
    price: 0,
    stock: 0,
    category_id: categoryId,
    supplier_id: null,
    description: '',
    image_url: '',
    tax_percentage: 0,
    tax_description: ''
  };
}

export function createEditableProduct(product: any) {
  return {
    ...product,
    category_id: product.category_id ?? product.category?.id ?? null,
    supplier_id: product.supplier_id ?? product.supplier?.id ?? null,
    tax_percentage: product.tax_percentage || 0,
    tax_description: product.tax_description || ''
  };
}

export function imageSrc(url: string | null | undefined): string {
  if (!url) return '';
  return url.startsWith('/') ? `${BACKEND_URL}${url}` : url;
}
