-- Hubungkan sale_taxes dan transaction_logs ke baris sale_items-nya.
-- Idempotent: aman dijalankan berulang.
ALTER TABLE sale_taxes ADD COLUMN IF NOT EXISTS sale_item_id integer REFERENCES sale_items(id) ON DELETE CASCADE;
ALTER TABLE transaction_logs ADD COLUMN IF NOT EXISTS sale_item_id integer REFERENCES sale_items(id) ON DELETE SET NULL;

UPDATE sale_taxes st SET sale_item_id = si.id
FROM sale_items si
WHERE st.sale_item_id IS NULL AND si.sale_id = st.sale_id AND si.product_id = st.product_id;

UPDATE transaction_logs tl SET sale_item_id = si.id
FROM sale_items si
WHERE tl.sale_item_id IS NULL AND si.sale_id = tl.sale_id AND si.product_id = tl.product_id;
