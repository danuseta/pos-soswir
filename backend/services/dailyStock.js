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

async function completeEntries(client, upToDate) {
  const { rows } = await client.query(
    `UPDATE daily_stock_entries
     SET status = 'completed', quantity_returned = quantity_in - quantity_sold
     WHERE status = 'active' AND entry_date <= COALESCE($1::date, current_date)
     RETURNING product_id`,
    [upToDate]
  );
  const productIds = [...new Set(rows.map((r) => r.product_id).filter(Boolean))];
  for (const productId of productIds) {
    await refreshPubjStock(client, productId);
  }
  return { completed: rows.length, products: productIds.length };
}

module.exports = { refreshPubjStock, completeEntries };
