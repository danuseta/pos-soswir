import test from 'node:test';
import assert from 'node:assert';
import './lib-alias.mjs';

const { createEditableProduct } = await import('../product.ts');

test('edit produk mempertahankan category_id dan supplier_id saat objek relasi tidak ada', () => {
  const product = { id: 1, name: 'Risol', category_id: 7, supplier_id: 3, category: null, supplier: null };
  const editable = createEditableProduct(product);
  assert.strictEqual(editable.category_id, 7);
  assert.strictEqual(editable.supplier_id, 3);
});

test('edit produk memakai id objek relasi bila category_id tidak ada', () => {
  const editable = createEditableProduct({ id: 1, category: { id: 4 }, supplier: { id: 2 } });
  assert.strictEqual(editable.category_id, 4);
  assert.strictEqual(editable.supplier_id, 2);
});
