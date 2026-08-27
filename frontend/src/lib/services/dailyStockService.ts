import { api, apiData } from '$lib/apiConfig';

export function loadDailyStock(filters: { date?: string; supplierId?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters.date) params.set('date', filters.date);
  if (filters.supplierId) params.set('supplier_id', filters.supplierId);
  if (filters.status) params.set('status', filters.status);
  return apiData<any[]>(api.get(`/api/daily-stock?${params}`));
}

export async function loadResellerProducts() {
  const products = await apiData<any[]>(api.get('/api/products'));
  return products.filter((product) => product.category_is_reseller);
}

export function loadStockSuppliers() {
  return apiData<any[]>(api.get('/api/suppliers'));
}

export function saveDailyStock(entry: any, editingId?: number) {
  return editingId
    ? apiData(api.put(`/api/daily-stock/${editingId}`, entry))
    : apiData(api.post('/api/daily-stock', entry));
}

export function markDailyStockPaid(id: number) {
  return apiData(api.patch(`/api/daily-stock/${id}/paid`));
}

export function completeDailyStock(id: number) {
  return apiData<any>(api.patch(`/api/daily-stock/${id}/complete`));
}

export function completeDailyStockDay(date: string) {
  return apiData<any>(api.post('/api/daily-stock/auto-complete', { date }));
}
