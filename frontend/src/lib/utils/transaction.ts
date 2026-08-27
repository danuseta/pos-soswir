import { formatDateTime } from '$lib/utils/format';
import { downloadCsv } from '$lib/utils/csv';

function exportRows(transactions: any[]) {
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

function exportFilename(extension: string) {
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '-');
  return `Log_Transaksi_${date}_${time}.${extension}`;
}

export function exportTransactionsCsv(transactions: any[]) {
  const rows = exportRows(transactions);
  downloadCsv(exportFilename('csv'), Object.keys(rows[0] || {}), rows.map(Object.values));
}

export async function exportTransactionsExcel(transactions: any[]) {
  const module = await import('xlsx');
  const XLSX: any = (module as any).utils ? module : (module as any).default;
  if (!XLSX?.utils) throw new Error('XLSX utils tidak tersedia');
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(exportRows(transactions));
  worksheet['!cols'] = [20, 25, 15, 10, 15, 15, 15, 18, 15, 18].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Log Transaksi');
  XLSX.writeFile(workbook, exportFilename('xlsx'));
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
    const result = left > right ? 1 : -1;
    return direction === 'asc' ? result : -result;
  });
}
