export function getTodayWIB() {
  const wibOffsetMs = 7 * 60 * 60 * 1000;
  return new Date(Date.now() + wibOffsetMs).toISOString().split('T')[0];
}

export function formatDailyStockDate(dateString: string) {
  if (!dateString) return 'Tanggal tidak valid';
  try {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  } catch {
    return 'Tanggal tidak valid';
  }
}

export function createDailyStockEntry(selectedDate = '') {
  return {
    id: null,
    product_id: null,
    supplier_id: null,
    entry_date: selectedDate || getTodayWIB(),
    quantity_in: 0,
    notes: ''
  };
}

export function getGlobalCompletionData(entries: any[]) {
  const today = getTodayWIB();
  const activeToday = entries.filter((entry) => {
    const entryDate = entry.entry_date?.split('T')[0] || '';
    return entry.status === 'active' && entryDate === today;
  });
  return {
    activeToday,
    summary: {
      totalEntries: activeToday.length,
      totalProducts: new Set(activeToday.map((entry) => entry.product_id)).size,
      totalStock: activeToday.reduce((sum, entry) => sum + entry.quantity_in, 0)
    }
  };
}

export function filterAndSortDailyStock(entries: any[], filters: any, sortField: string, sortDirection: string) {
  const query = filters.search.toLowerCase();
  return entries.filter((entry) => {
    const entryDate = entry.entry_date?.split('T')[0] || '';
    return (!query || entry.product_name.toLowerCase().includes(query) || entry.supplier_name.toLowerCase().includes(query))
      && (!filters.date || entryDate === filters.date)
      && (!filters.supplier || entry.supplier_id.toString() === filters.supplier)
      && (!filters.status || entry.status === filters.status);
  }).sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];
    if (sortField === 'entry_date') {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    } else if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    const result = aValue > bValue ? 1 : -1;
    return sortDirection === 'asc' ? result : -result;
  });
}
