import test from 'node:test';
import assert from 'node:assert';
import './lib-alias.mjs';

const { formatDateTime, formatTransactionDateTime, formatDate, formatTime } = await import('../format.ts');

test('timestamp dari server (UTC) ditampilkan dalam jam WIB', () => {
  assert.strictEqual(formatTransactionDateTime('2026-11-15T17:30:00.000Z'), '16/11/2026 00:30');
  assert.strictEqual(formatDateTime('2026-11-15T17:30:00.000Z'), '16 Nov 2026, 00.30');
  assert.strictEqual(formatDate('2026-11-15T17:30:00.000Z'), '16 Nov 2026');
  assert.strictEqual(formatTime('2026-11-15T17:30:00.000Z'), '00.30');
});

test('tanggal saja (YYYY-MM-DD) tidak digeser', () => {
  assert.strictEqual(formatDate('2026-11-16'), '16 Nov 2026');
});

test('nilai kosong tetap aman', () => {
  assert.strictEqual(formatDateTime(''), '');
  assert.strictEqual(formatDate(''), '');
  assert.strictEqual(formatTime(''), '');
  assert.strictEqual(formatTransactionDateTime(''), 'Tanggal tidak valid');
});
