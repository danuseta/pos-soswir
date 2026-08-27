export type RevenueExportOptions = {
  scope: 'single' | 'range' | 'all';
  singleMonth: string;
  startMonth: string;
  endMonth: string;
};

function monthKey(item: any) {
  return `${item.year}-${String(item.month).padStart(2, '0')}`;
}

export function filterMonthlyRevenue(items: any[], options: RevenueExportOptions) {
  const filtered = options.scope === 'all'
    ? items
    : options.scope === 'single'
      ? items.filter((item) => monthKey(item) === options.singleMonth)
      : items.filter((item) => {
          const key = monthKey(item);
          return key >= options.startMonth && key <= options.endMonth;
        });

  return [...filtered].sort((left, right) => monthKey(left).localeCompare(monthKey(right)));
}

function exportLabel(options: RevenueExportOptions) {
  if (options.scope === 'all') return 'semua-periode';
  if (options.scope === 'single') return options.singleMonth;
  return `${options.startMonth}_sampai_${options.endMonth}`;
}

function formatMonth(item: any) {
  return new Date(Number(item.year), Number(item.month) - 1, 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric'
  });
}

export async function exportRevenueExcel(items: any[], options: RevenueExportOptions) {
  const module = await import('xlsx');
  const XLSX: any = (module as any).utils ? module : (module as any).default;
  if (!XLSX?.utils) throw new Error('XLSX utils tidak tersedia');

  const rows = items.map((item) => ({
    Periode: formatMonth(item),
    'Jumlah Transaksi': Number(item.transaction_count) || 0,
    'Total Pendapatan': Number(item.total_revenue) || 0,
    'Total Keuntungan': (Number(item.total_revenue) || 0) - (Number(item.supplier_profit) || 0),
    'Keuntungan Toko': Number(item.store_profit) || 0,
    'Pendapatan Supplier': Number(item.supplier_profit) || 0
  }));

  const totals = rows.reduce((result, row) => ({
    Periode: 'TOTAL',
    'Jumlah Transaksi': result['Jumlah Transaksi'] + row['Jumlah Transaksi'],
    'Total Pendapatan': result['Total Pendapatan'] + row['Total Pendapatan'],
    'Total Keuntungan': result['Total Keuntungan'] + row['Total Keuntungan'],
    'Keuntungan Toko': result['Keuntungan Toko'] + row['Keuntungan Toko'],
    'Pendapatan Supplier': result['Pendapatan Supplier'] + row['Pendapatan Supplier']
  }), {
    Periode: 'TOTAL',
    'Jumlah Transaksi': 0,
    'Total Pendapatan': 0,
    'Total Keuntungan': 0,
    'Keuntungan Toko': 0,
    'Pendapatan Supplier': 0
  });

  const worksheet = XLSX.utils.json_to_sheet([...rows, totals]);
  worksheet['!cols'] = [22, 18, 20, 20, 20, 22].map((wch) => ({ wch }));
  worksheet['!autofilter'] = { ref: `A1:F${rows.length + 2}` };

  for (let row = 1; row <= rows.length + 1; row += 1) {
    const transactionCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 1 })];
    if (transactionCell) transactionCell.z = '#,##0';
    for (let column = 2; column <= 5; column += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell) cell.z = '"Rp" #,##0';
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Total Pendapatan');
  XLSX.writeFile(workbook, `Total_Pendapatan_${exportLabel(options)}.xlsx`);
}
