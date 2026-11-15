import { compareValues } from '$lib/utils/sort';

export function filterAndSortCategories(categories: any[], search: string, type: string, field: string, direction: string) {
  const query = search.toLowerCase();
  return categories.filter((category) => {
    const matchesSearch = category.name.toLowerCase().includes(query) || category.description?.toLowerCase().includes(query);
    const matchesType = !type || (type === 'toko' && !category.is_reseller) || (type === 'pubj' && category.is_reseller);
    return matchesSearch && matchesType;
  }).sort((a, b) => compare(a, b, field, direction));
}

export function filterAndSortSuppliers(suppliers: any[], search: string, field: string, direction: string) {
  const query = search.toLowerCase();
  return suppliers.filter((supplier) => supplier.name.toLowerCase().includes(query) || supplier.phone?.includes(search))
    .sort((a, b) => compare(a, b, field, direction));
}

export function createSupplierForm(supplier?: any) {
  return supplier ? { ...supplier } : { id: null, name: '', phone: '' };
}

export function createSupplierPayload(supplier: any) {
  return { name: supplier.name.trim(), phone: supplier.phone || null };
}

function compare(a: any, b: any, field: string, direction: string) {
  let left = a[field] || '';
  let right = b[field] || '';
  if (typeof left === 'string') {
    left = left.toLowerCase();
    right = right.toLowerCase();
  }
  const result = compareValues(left, right);
  return direction === 'asc' ? result : -result;
}

function formatRevenueDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${day} ${months[month - 1]} ${year}`;
}

export function combineRevenueData(data: any) {
  return [
    ...data.daily.map((item: any) => ({ ...item, type: 'daily', type_label: 'Harian', formatted_date: formatRevenueDate(item.date), sort_date: new Date(`${item.date}T12:00:00`), total_profit: (+item.total_revenue || 0) - (+item.supplier_profit || 0) })),
    ...data.monthly.map((item: any) => ({ ...item, type: 'monthly', type_label: 'Bulanan', formatted_date: new Date(item.year, item.month - 1).toLocaleDateString('id-ID', { year: 'numeric', month: 'long' }), sort_date: new Date(item.year, item.month - 1, 15), date: `${item.year}-${String(item.month).padStart(2, '0')}`, total_profit: (+item.total_revenue || 0) - (+item.supplier_profit || 0) })),
    ...data.yearly.map((item: any) => ({ ...item, type: 'yearly', type_label: 'Tahunan', formatted_date: item.year.toString(), sort_date: new Date(item.year, 6, 1), date: item.year.toString(), total_profit: (+item.total_revenue || 0) - (+item.supplier_profit || 0) }))
  ];
}

export function filterAndSortRevenue(items: any[], search: string, type: string, field: string, direction: string) {
  const query = search.toLowerCase();
  return items.filter((item) => (!query || item.formatted_date.toLowerCase().includes(query) || item.type_label.toLowerCase().includes(query)) && (!type || item.type === type))
    .sort((a, b) => {
      const left = field === 'date' || field === 'formatted_date' ? a.sort_date : a[field];
      const right = field === 'date' || field === 'formatted_date' ? b.sort_date : b[field];
      const result = compareValues(left, right);
      return direction === 'asc' ? result : -result;
    });
}
