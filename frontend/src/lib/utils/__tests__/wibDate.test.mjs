import test from 'node:test';
import assert from 'node:assert';
import './lib-alias.mjs';

const { filterAndSortTransactions, wibDate } = await import('../transaction.ts');

test('wibDate memberi tanggal Asia/Jakarta', () => {
  assert.strictEqual(wibDate('2026-11-15T17:30:00.000Z'), '2026-11-16');
  assert.strictEqual(wibDate(new Date('2026-11-16T00:00:00+07:00')), '2026-11-16');
  assert.strictEqual(wibDate('2026-11-16'), '2026-11-16');
  assert.strictEqual(wibDate(null), '');
});

test('filter tanggal transaksi memakai hari WIB, bukan UTC', () => {
  const rows = [
    { kasir: 'pagi', waktu: '2026-11-15T17:30:00.000Z' },
    { kasir: 'kemarin', waktu: '2026-11-15T16:59:00.000Z' },
    { kasir: 'malam', waktu: '2026-11-16T16:30:00.000Z' }
  ];
  const day = new Date('2026-11-16T00:00:00+07:00');
  const byDate = filterAndSortTransactions(rows, '', { from: day, to: day }, 'kasir', 'asc').map((r) => r.kasir);
  assert.deepStrictEqual(byDate, ['malam', 'pagi']);
  const byString = filterAndSortTransactions(rows, '', { from: '2026-11-16', to: '2026-11-16' }, 'kasir', 'asc').map((r) => r.kasir);
  assert.deepStrictEqual(byString, ['malam', 'pagi']);
});
