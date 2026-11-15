async function refreshPubjStock(client, productId) {
  await client.query(
    `UPDATE products
     SET stock = COALESCE((
       SELECT SUM(quantity_in - quantity_sold)
       FROM daily_stock_entries
       WHERE product_id = $1 AND status = 'active' AND entry_date = current_date
     ), 0)
     WHERE id = $1`,
    [productId]
  );
}

module.exports = { refreshPubjStock };
