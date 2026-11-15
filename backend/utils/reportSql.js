const saleTaxesFor = (row, saleItemId) => `
  LEFT JOIN LATERAL (
    SELECT SUM(x.tax_amount) AS tax_amount,
           SUM(x.store_profit) AS store_profit,
           SUM(x.supplier_amount) AS supplier_amount
    FROM sale_taxes x
    WHERE x.sale_id = ${row}.sale_id
      AND x.sale_item_id = ${saleItemId}
  ) st ON true
`;

const saleTaxesPerItem = saleTaxesFor("si", "si.id");

const storeProfitJoin = `
  LEFT JOIN (
    SELECT si.sale_id,
           SUM(COALESCE(st.store_profit, si.quantity * si.price_at_sale)) AS store_profit
    FROM sale_items si
    ${saleTaxesPerItem}
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

module.exports = { saleTaxesFor, saleTaxesPerItem, storeProfitJoin, supplierJoin, perSaleProfitJoins: supplierJoin + storeProfitJoin };
