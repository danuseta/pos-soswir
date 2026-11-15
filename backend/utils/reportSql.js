const storeProfitJoin = `
  LEFT JOIN (
    SELECT si.sale_id,
           SUM(CASE WHEN stx.sale_id IS NOT NULL THEN stx.store_profit ELSE si.quantity * si.price_at_sale END) AS store_profit
    FROM sale_items si
    LEFT JOIN (
      SELECT sale_id, product_id, SUM(store_profit) AS store_profit
      FROM sale_taxes
      GROUP BY sale_id, product_id
    ) stx ON stx.sale_id = si.sale_id AND stx.product_id IS NOT DISTINCT FROM si.product_id
    GROUP BY si.sale_id
  ) kp ON kp.sale_id = s.id
`;

const supplierJoin = `
  LEFT JOIN (
    SELECT sale_id, SUM(supplier_amount) AS supplier_amount
    FROM sale_taxes
    GROUP BY sale_id
  ) st ON st.sale_id = s.id
`;

module.exports = { storeProfitJoin, supplierJoin, perSaleProfitJoins: supplierJoin + storeProfitJoin };
