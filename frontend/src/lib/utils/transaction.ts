import { formatDateTime } from '$lib/utils/format';
import { downloadCsv } from '$lib/utils/csv';
import { compareValues } from '$lib/utils/sort';

export type TransactionExportOptions = {
  format: 'detail' | 'monthly-product';
  scope: 'single' | 'range' | 'all';
  singleMonth: string;
  startMonth: string;
  endMonth: string;
};

function monthKey(transaction: any): string {
  return transaction.periode || String(transaction.waktu || '').slice(0, 7);
}

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthNumber - 1, 1));
}

export function filterTransactionsByPeriod(transactions: any[], options: TransactionExportOptions) {
  if (options.scope === 'all') return [...transactions];
  if (options.scope === 'single') {
    return transactions.filter((transaction) => monthKey(transaction) === options.singleMonth);
  }
  return transactions.filter((transaction) => {
    const month = monthKey(transaction);
    return month >= options.startMonth && month <= options.endMonth;
  });
}

function detailRows(transactions: any[]) {
  return transactions.map((transaction) => ({
    Waktu: formatDateTime(transaction.waktu),
    Produk: transaction.produk || '',
    Kategori: transaction.kategori || '',
    Jumlah: transaction.jumlah || 0,
    'Harga per Unit': transaction.harga || 0,
    'Total Harga': transaction.total || 0,
    Kasir: transaction.kasir || '',
    'Metode Pembayaran': transaction.payment_method || 'Cash',
    'Keuntungan Toko': transaction.keuntungan_toko || 0,
    'Keuntungan Supplier': transaction.keuntungan_supplier || 0
  }));
}

export function monthlyProductRows(transactions: any[]) {
  const groups = new Map<string, {
    month: string;
    product: string;
    category: string;
    saleIds: Set<string>;
    quantity: number;
    revenue: number;
    storeProfit: number;
    supplierProfit: number;
  }>();

  for (const transaction of transactions) {
    const month = monthKey(transaction);
    const product = transaction.produk || 'Produk tidak diketahui';
    const productKey = transaction.product_id ?? product;
    const key = `${month}|${productKey}|${product}`;
    const group = groups.get(key) || {
      month,
      product,
      category: transaction.kategori || 'Tidak Berkategori',
      saleIds: new Set<string>(),
      quantity: 0,
      revenue: 0,
      storeProfit: 0,
      supplierProfit: 0
    };

    group.saleIds.add(String(transaction.sale_id ?? transaction.id));
    group.quantity += Number(transaction.jumlah) || 0;
    group.revenue += Number(transaction.total) || 0;
    group.storeProfit += Number(transaction.keuntungan_toko) || 0;
    group.supplierProfit += Number(transaction.keuntungan_supplier) || 0;
    groups.set(key, group);
  }

  return [...groups.values()]
    .sort((left, right) => left.month.localeCompare(right.month) || left.product.localeCompare(right.product, 'id'))
    .map((group) => ({
      Periode: formatMonth(group.month),
      Produk: group.product,
      Kategori: group.category,
      'Jumlah Transaksi': group.saleIds.size,
      'Jumlah Terjual': group.quantity,
      'Total Penjualan': group.revenue,
      'Keuntungan Toko': group.storeProfit,
      'Pendapatan Supplier': group.supplierProfit
    }));
}

function periodLabel(options: TransactionExportOptions): string {
  if (options.scope === 'single') return options.singleMonth;
  if (options.scope === 'range') return `${options.startMonth}_sampai_${options.endMonth}`;
  return 'semua-periode';
}

function exportFilename(options: TransactionExportOptions, extension: string) {
  const type = options.format === 'detail' ? 'Detail_Transaksi' : 'Rekap_Produk_Bulanan';
  return `${type}_${periodLabel(options)}.${extension}`;
}

function rowsForExport(transactions: any[], options: TransactionExportOptions) {
  return options.format === 'detail' ? detailRows(transactions) : monthlyProductRows(transactions);
}

export function exportTransactionsCsv(transactions: any[], options: TransactionExportOptions) {
  const rows = rowsForExport(transactions, options);
  downloadCsv(exportFilename(options, 'csv'), Object.keys(rows[0] || {}), rows.map(Object.values));
}

export async function exportTransactionsExcel(transactions: any[], options: TransactionExportOptions) {
  const module = await import('xlsx');
  const XLSX: any = (module as any).utils ? module : (module as any).default;
  if (!XLSX?.utils) throw new Error('XLSX utils tidak tersedia');
  const workbook = XLSX.utils.book_new();
  const rows = rowsForExport(transactions, options);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = (options.format === 'detail'
    ? [20, 25, 15, 10, 15, 15, 15, 18, 15, 18]
    : [20, 25, 18, 16, 15, 18, 18, 20]
  ).map((wch) => ({ wch }));
  worksheet['!autofilter'] = { ref: worksheet['!ref'] || 'A1:A1' };
  XLSX.utils.book_append_sheet(workbook, worksheet, options.format === 'detail' ? 'Detail Transaksi' : 'Rekap Produk Bulanan');
  XLSX.writeFile(workbook, exportFilename(options, 'xlsx'));
}

export function filterAndSortTransactions(transactions: any[], search: string, dateRange: any, sortField: string, direction: string) {
  const query = search.toLowerCase();
  return transactions.filter((transaction) => {
    const matchesSearch = ['kasir', 'produk', 'kategori', 'payment_method']
      .some((field) => transaction[field]?.toLowerCase().includes(query));
    if (!dateRange.from || !dateRange.to) return matchesSearch;
    const transactionDate = transaction.waktu?.split('T')[0] || '';
    const from = dateRange.from instanceof Date ? dateRange.from.toISOString().split('T')[0] : dateRange.from;
    const to = dateRange.to instanceof Date ? dateRange.to.toISOString().split('T')[0] : dateRange.to;
    return matchesSearch && transactionDate >= from && transactionDate <= to;
  }).sort((a, b) => {
    let left = a[sortField] || '';
    let right = b[sortField] || '';
    if (typeof left === 'string') {
      left = left.toLowerCase();
      right = right.toLowerCase();
    }
    if (sortField === 'waktu') {
      left = new Date(left);
      right = new Date(right);
    }
    const result = compareValues(left, right);
    return direction === 'asc' ? result : -result;
  });
}
