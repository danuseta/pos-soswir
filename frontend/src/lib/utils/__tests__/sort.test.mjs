import test from 'node:test';
import assert from 'node:assert';
import './lib-alias.mjs';

const { filterAndSortRevenue, filterAndSortCategories, filterAndSortSuppliers } = await import('../managementLists.ts');
const { filterAndSortTransactions } = await import('../transaction.ts');

const noRange = { from: null, to: null };

test('revenue diurutkan sebagai angka, bukan teks', () => {
  const items = ['9000.00', '10000.00', '500.50'].map((total_revenue) => ({ total_revenue, formatted_date: 'x', type_label: 'Harian', type: 'daily' }));
  const sorted = filterAndSortRevenue(items, '', '', 'total_revenue', 'asc').map((i) => i.total_revenue);
  assert.deepStrictEqual(sorted, ['500.50', '9000.00', '10000.00']);
});

test('kategori dan supplier diurutkan angka untuk kolom hitungan', () => {
  const categories = ['10', '9', '100'].map((product_count, i) => ({ name: `k${i}`, product_count }));
  assert.deepStrictEqual(filterAndSortCategories(categories, '', '', 'product_count', 'desc').map((c) => c.product_count), ['100', '10', '9']);
  const suppliers = ['20000.00', '3000.00'].map((total_revenue, i) => ({ name: `s${i}`, total_revenue }));
  assert.deepStrictEqual(filterAndSortSuppliers(suppliers, '', 'total_revenue', 'asc').map((s) => s.total_revenue), ['3000.00', '20000.00']);
});

test('transaksi diurutkan angka untuk jumlah, harga, total, keuntungan', () => {
  const rows = [
    { kasir: 'a', jumlah: 10, harga: '9000.00', total: '90000.00', keuntungan_toko: '900.00', keuntungan_supplier: '0.00' },
    { kasir: 'b', jumlah: 9, harga: '10000.00', total: '100000.00', keuntungan_toko: '10000.00', keuntungan_supplier: '8100.00' }
  ];
  for (const field of ['harga', 'total', 'keuntungan_toko', 'keuntungan_supplier']) {
    const sorted = filterAndSortTransactions(rows, '', noRange, field, 'asc').map((r) => r.kasir);
    assert.deepStrictEqual(sorted, ['a', 'b'], field);
  }
  assert.deepStrictEqual(filterAndSortTransactions(rows, '', noRange, 'jumlah', 'asc').map((r) => r.kasir), ['b', 'a']);
});

test('kolom teks tetap diurutkan alfabetis tanpa beda huruf besar', () => {
  const rows = [{ kasir: 'budi' }, { kasir: 'Ani' }, { kasir: 'cici' }];
  assert.deepStrictEqual(filterAndSortTransactions(rows, '', noRange, 'kasir', 'asc').map((r) => r.kasir), ['Ani', 'budi', 'cici']);
});
