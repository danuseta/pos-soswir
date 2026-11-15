const path = require("path");

const money = (value) => Math.round(Number(value) * 100);
const FIXTURE_IMAGE = path.join(__dirname, "..", "fixtures", "images", "kuning.png");

async function sell(ctx, username, items) {
  return ctx.as(username).post("/api/sales", { items, customer_name: "Pelanggan Skenario", payment_method: "Cash" });
}

async function addDailyStock(ctx, product, quantity) {
  const res = await ctx.as("superadmin").post("/api/daily-stock", {
    product_id: product.id,
    supplier_id: ctx.fixture.supplierId,
    quantity_in: quantity
  });
  if (res.status !== 201) throw new Error(`Gagal membuat stok harian ${product.name}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.id;
}

async function dailyEntry(ctx, entryId) {
  const res = await ctx.as("superadmin").get("/api/daily-stock");
  const entry = Array.isArray(res.body) ? res.body.find((e) => e.id === entryId) : null;
  if (!entry) throw new Error(`Entry stok harian ${entryId} tidak ditemukan`);
  return entry;
}

module.exports = [
  {
    id: "S01",
    group: "Akses",
    title: "Superadmin login",
    steps: ["Buka halaman login", "Isi superadmin dan password", "Kirim"],
    expected: "Status 200 dan token terbit",
    screen: { page: "/superadmin/dashboard", as: "superadmin" },
    async run(ctx) {
      const res = await ctx.login("superadmin");
      ctx.actual(`Status ${res.status}, token ${res.body?.token ? "ada" : "tidak ada"}, role ${res.body?.user?.role}`);
      ctx.expect(res.status === 200 && typeof res.body.token === "string" && res.body.user.role === "superadmin");
    }
  },
  {
    id: "S02",
    group: "Akses",
    title: "Kasir login di dalam jam shift",
    steps: ["kasir1 ditempatkan di Shift A yang mencakup jam sekarang", "kasir1 login"],
    expected: "Status 200",
    screen: { page: "/cashier/pos", as: "kasir1" },
    async run(ctx) {
      const res = await ctx.login("kasir1");
      const [start, end] = ctx.fixture.shifts.A.window;
      ctx.actual(`Status ${res.status}, shift ${start}-${end}, jam WIB ${ctx.wibNow().time}`);
      ctx.expect(res.status === 200 && typeof res.body.token === "string");
    }
  },
  {
    id: "S03",
    group: "Akses",
    title: "Kasir login di luar jam shift",
    steps: ["kasir_luar ditempatkan di Shift B yang tidak mencakup jam sekarang", "kasir_luar login"],
    expected: "Status 403 dengan code OUT_OF_SHIFT",
    screen: { page: "/login", as: "kasir_luar", highlight: "[role=\"alert\"]" },
    async run(ctx) {
      const res = await ctx.login("kasir_luar");
      const [start, end] = ctx.fixture.shifts.B.window;
      ctx.actual(`Status ${res.status}, code ${res.body?.code}, shift ${start}-${end}, jam WIB ${ctx.wibNow().time}`);
      ctx.expect(res.status === 403 && res.body?.code === "OUT_OF_SHIFT");
    }
  },
  {
    id: "S04",
    group: "Penjualan",
    title: "Beli 1 barang toko",
    steps: ["Kasir login", "Tambah Nasi Goreng x1", "Checkout tunai"],
    expected: "Status 201, total 15.000, stok 10 jadi 9",
    screen: { page: "/cashier/pos", as: "kasir1", highlight: ".bg-card:has(> div.relative > img[alt=\"Nasi Goreng\"])" },
    async run(ctx) {
      const before = await ctx.product("Nasi Goreng");
      const res = await sell(ctx, "kasir1", [{ product_id: before.id, quantity: 1, price: Number(before.price) }]);
      const after = await ctx.product("Nasi Goreng");
      ctx.actual(`Status ${res.status}, total ${res.body?.total_amount}, stok ${before.stock} jadi ${after.stock}`);
      ctx.expect(res.status === 201 && res.body.total_amount === 15000 && after.stock === before.stock - 1);
    }
  },
  {
    id: "S05",
    group: "Penjualan",
    title: "Beli banyak barang dengan baris ganda",
    steps: [
      "Keranjang: Mie Ayam x1, Es Teh x1, Mie Ayam x1, Kopi Susu x5",
      "Checkout tunai",
      "Cek total, stok, dan item penjualan"
    ],
    expected: "Status 201, total = jumlah harga DB (69.000), stok berkurang 2/1/5, Mie Ayam jadi satu baris qty 2",
    screen: { page: "/cashier/transactions", as: "kasir1", highlight: "tr:has-text(\"Mie Ayam\")" },
    async run(ctx) {
      const names = ["Mie Ayam", "Es Teh", "Kopi Susu"];
      const before = {};
      for (const name of names) before[name] = await ctx.product(name);
      const qty = { "Mie Ayam": 2, "Es Teh": 1, "Kopi Susu": 5 };
      const res = await sell(ctx, "kasir1", [
        { product_id: before["Mie Ayam"].id, quantity: 1 },
        { product_id: before["Es Teh"].id, quantity: 1 },
        { product_id: before["Mie Ayam"].id, quantity: 1 },
        { product_id: before["Kopi Susu"].id, quantity: 5 }
      ]);
      const expectedTotal = names.reduce((sum, name) => sum + Number(before[name].price) * qty[name], 0);
      const after = {};
      for (const name of names) after[name] = await ctx.product(name);
      const detail = res.status === 201 ? await ctx.as("superadmin").get(`/api/sales/${res.body.sale_id}`) : null;
      const items = detail?.body?.items || [];
      const mieRows = items.filter((item) => item.product_id === before["Mie Ayam"].id);
      const stockOk = names.every((name) => after[name].stock === before[name].stock - qty[name]);
      ctx.actual(
        `Status ${res.status}, total ${res.body?.total_amount} (harga DB ${expectedTotal}), ` +
        `stok ${names.map((n) => `${n} ${before[n].stock}->${after[n].stock}`).join(", ")}, ` +
        `${items.length} baris item, Mie Ayam ${mieRows.length} baris qty ${mieRows[0]?.quantity}`
      );
      ctx.evidence({ request: { items: "Mie Ayam x1, Es Teh x1, Mie Ayam x1, Kopi Susu x5" }, response: res.body, saleDetail: detail?.body });
      ctx.expect(res.status === 201, "status bukan 201");
      ctx.expect(money(res.body?.total_amount) === money(expectedTotal), "total tidak sama dengan harga DB");
      ctx.expect(stockOk, "stok tidak berkurang sesuai");
      ctx.expect(items.length === 3 && mieRows.length === 1 && mieRows[0].quantity === 2, "baris ganda tidak digabung");
    }
  },
  {
    id: "S06",
    group: "Penjualan",
    title: "Beli melebihi stok",
    steps: ["Roti Bakar stok 3", "Kasir checkout Roti Bakar x5"],
    expected: "Status 400, stok tetap 3, tidak ada baris sales baru",
    screen: { page: "/cashier/pos", as: "kasir1", highlight: ".bg-card:has(> div.relative > img[alt=\"Roti Bakar\"])" },
    async run(ctx) {
      const before = await ctx.product("Roti Bakar");
      const [{ count: salesBefore }] = await ctx.sql("SELECT count(*)::int AS count FROM sales");
      const res = await sell(ctx, "kasir1", [{ product_id: before.id, quantity: 5 }]);
      const after = await ctx.product("Roti Bakar");
      const [{ count: salesAfter }] = await ctx.sql("SELECT count(*)::int AS count FROM sales");
      ctx.actual(`Status ${res.status} "${res.body?.message}", stok ${before.stock} jadi ${after.stock}, jumlah sales ${salesBefore} jadi ${salesAfter}`);
      ctx.expect(res.status === 400 && after.stock === before.stock && salesAfter === salesBefore);
    }
  },
  {
    id: "S07",
    group: "Penjualan",
    title: "Jumlah barang 0, negatif, dan pecahan",
    steps: ["Checkout Bakwan qty 0", "Checkout Bakwan qty -5", "Checkout Bakwan qty 1.5"],
    expected: "Status 400 untuk ketiganya, stok tidak berubah, tidak ada baris sales baru",
    screen: null,
    async run(ctx) {
      const before = await ctx.product("Bakwan");
      const [{ count: salesBefore }] = await ctx.sql("SELECT count(*)::int AS count FROM sales");
      const statuses = [];
      const responses = [];
      for (const quantity of [0, -5, 1.5]) {
        const res = await sell(ctx, "kasir1", [{ product_id: before.id, quantity }]);
        statuses.push(res.status);
        responses.push({ quantity, status: res.status, body: res.body });
      }
      const after = await ctx.product("Bakwan");
      const [{ count: salesAfter }] = await ctx.sql("SELECT count(*)::int AS count FROM sales");
      ctx.actual(`Status ${statuses.join("/")}, stok ${before.stock} jadi ${after.stock}, jumlah sales ${salesBefore} jadi ${salesAfter}`);
      ctx.evidence({ request: { product: "Bakwan", quantities: [0, -5, 1.5] }, response: responses });
      ctx.expect(statuses.every((status) => status === 400) && after.stock === before.stock && salesAfter === salesBefore);
    }
  },
  {
    id: "S08",
    group: "Penjualan",
    title: "Harga dimanipulasi client",
    steps: ["Kirim checkout Soto Ayam x2 dengan price: 1"],
    expected: "Status 201, total memakai harga DB (36.000), bukan 2",
    screen: { page: "/cashier/transactions", as: "kasir1", highlight: "tr:has-text(\"Soto Ayam\")" },
    async run(ctx) {
      const product = await ctx.product("Soto Ayam");
      const res = await sell(ctx, "kasir1", [{ product_id: product.id, quantity: 2, price: 1 }]);
      const expected = Number(product.price) * 2;
      ctx.actual(`Status ${res.status}, total ${res.body?.total_amount} (harga DB x2 = ${expected})`);
      ctx.expect(res.status === 201 && money(res.body.total_amount) === money(expected));
    }
  },
  {
    id: "S09",
    group: "Penjualan",
    title: "Jual produk nonaktif",
    steps: ["Superadmin menonaktifkan Pisang Goreng", "Kasir checkout Pisang Goreng x1"],
    expected: "Status 400",
    screen: { page: "/superadmin/products", as: "superadmin" },
    async run(ctx) {
      const product = await ctx.product("Pisang Goreng");
      const toggle = await ctx.as("superadmin").patch(`/api/products/${product.id}/toggle-active`);
      const res = await sell(ctx, "kasir1", [{ product_id: product.id, quantity: 1 }]);
      const after = await ctx.product("Pisang Goreng");
      ctx.actual(`Toggle ${toggle.status} (is_active ${toggle.body?.is_active}), checkout ${res.status} "${res.body?.message}", stok ${product.stock} jadi ${after.stock}`);
      ctx.expect(toggle.body?.is_active === false && res.status === 400 && after.stock === product.stock);
    }
  },
  {
    id: "S10",
    group: "Penjualan",
    title: "Dua kasir checkout bersamaan, stok 1",
    steps: ["Martabak stok 1", "kasir1 dan kasir2 checkout Martabak x1 bersamaan"],
    expected: "Tepat satu 201 dan satu 400, stok jadi 0",
    screen: null,
    async run(ctx) {
      const product = await ctx.product("Martabak");
      await ctx.as("kasir1").get("/api/products?active_only=true");
      await ctx.as("kasir2").get("/api/products?active_only=true");
      const [a, b] = await Promise.all([
        sell(ctx, "kasir1", [{ product_id: product.id, quantity: 1 }]),
        sell(ctx, "kasir2", [{ product_id: product.id, quantity: 1 }])
      ]);
      const after = await ctx.product("Martabak");
      const statuses = [a.status, b.status].sort();
      ctx.actual(`kasir1 ${a.status}, kasir2 ${b.status}, stok ${product.stock} jadi ${after.stock}`);
      ctx.evidence({ request: { product: "Martabak", stock: product.stock }, response: { kasir1: a.body, kasir2: b.body } });
      ctx.expect(statuses[0] === 201 && statuses[1] === 400 && after.stock === 0);
    }
  },
  {
    id: "S11",
    group: "PUBJ",
    title: "Stok harian masuk 20, jual 4",
    steps: ["Superadmin input stok harian Kue Lapis 20", "Kasir jual Kue Lapis x4", "Cek katalog, sale_taxes, dan entry"],
    expected: "Stok katalog 16, fee sale_taxes = persentase entry (10% = 2.000), revenue entry 4 x harga = 20.000",
    screen: { page: "/superadmin/daily-stock", as: "superadmin", highlight: "tr:has-text(\"Kue Lapis\")" },
    async run(ctx) {
      const product = await ctx.product("Kue Lapis");
      const entryId = await addDailyStock(ctx, product, 20);
      const update = await ctx.as("superadmin").put(`/api/products/${product.id}`, {
        name: product.name,
        description: product.description,
        price: product.price,
        category_id: product.category_id,
        supplier_id: product.supplier_id,
        tax_percentage: 20,
        tax_description: product.tax_description,
        image_url: product.image_url,
        image_filename: product.image_filename
      });
      const res = await sell(ctx, "kasir1", [{ product_id: product.id, quantity: 4 }]);
      const after = await ctx.product("Kue Lapis");
      const entry = await dailyEntry(ctx, entryId);
      const taxes = res.status === 201
        ? await ctx.sql("SELECT tax_percentage, tax_amount, supplier_amount FROM sale_taxes WHERE sale_id = $1", [res.body.sale_id])
        : [];
      const gross = Number(product.price) * 4;
      const fee = gross * Number(entry.tax_percentage) / 100;
      ctx.actual(
        `Fee produk diubah ${update.status} jadi ${after.tax_percentage}%, ` +
        `status ${res.status}, stok katalog ${after.stock}, sale_taxes ${taxes.length} baris ` +
        `(persen ${taxes[0]?.tax_percentage}, fee ${taxes[0]?.tax_amount}), entry persen ${entry.tax_percentage}, ` +
        `revenue entry ${entry.total_revenue}, terjual ${entry.quantity_sold}`
      );
      ctx.evidence({ productUpdate: update.body, productTaxPercentage: after.tax_percentage, sale: res.body, entry, saleTaxes: taxes });
      ctx.expect(update.status === 200 && after.tax_percentage === 20 && Number(entry.tax_percentage) === 10, "fee produk tidak berbeda dari fee entry");
      ctx.expect(res.status === 201 && after.stock === 16, "stok katalog bukan 16");
      ctx.expect(taxes.length === 1 && Number(taxes[0].tax_percentage) === Number(entry.tax_percentage), "persentase fee beda dengan entry");
      ctx.expect(taxes.length === 1 && money(taxes[0].tax_amount) === money(fee), "nilai fee salah");
      ctx.expect(money(entry.total_revenue) === money(gross) && entry.quantity_sold === 4, "revenue entry salah");
    }
  },
  {
    id: "S12",
    group: "PUBJ",
    title: "Jual PUBJ tanpa entry hari ini",
    steps: ["Risoles belum punya stok harian hari ini", "Kasir checkout Risoles x1"],
    expected: "Status 400 \"belum ada stok hari ini\"",
    screen: { page: "/cashier/pos", as: "kasir1", highlight: ".bg-card:has(> div.relative > img[alt=\"Risoles\"])" },
    async run(ctx) {
      const product = await ctx.product("Risoles");
      const res = await sell(ctx, "kasir1", [{ product_id: product.id, quantity: 1 }]);
      ctx.actual(`Status ${res.status} "${res.body?.message}"`);
      ctx.expect(res.status === 400 && /belum ada stok hari ini/.test(res.body?.message || ""));
    }
  },
  {
    id: "S13",
    group: "PUBJ",
    title: "Harga naik setelah terjual, lalu entry diselesaikan",
    steps: ["Stok harian Lemper 10", "Kasir jual Lemper x2", "Superadmin menaikkan harga Lemper", "Superadmin menyelesaikan entry"],
    expected: "Revenue entry tetap 2 x harga lama (12.000)",
    screen: { page: "/superadmin/daily-stock", as: "superadmin", highlight: "tr:has-text(\"Lemper\")" },
    async run(ctx) {
      const product = await ctx.product("Lemper");
      const entryId = await addDailyStock(ctx, product, 10);
      const sale = await sell(ctx, "kasir1", [{ product_id: product.id, quantity: 2 }]);
      const newPrice = Number(product.price) + 2000;
      const update = await ctx.as("superadmin").put(`/api/products/${product.id}`, {
        name: product.name,
        description: product.description,
        price: newPrice,
        category_id: product.category_id,
        supplier_id: product.supplier_id,
        tax_percentage: product.tax_percentage,
        tax_description: product.tax_description,
        image_url: product.image_url,
        image_filename: product.image_filename
      });
      const stored = await ctx.product("Lemper");
      const complete = await ctx.as("superadmin").patch(`/api/daily-stock/${entryId}/complete`);
      const entry = await dailyEntry(ctx, entryId);
      const oldRevenue = Number(product.price) * 2;
      ctx.actual(
        `Jual ${sale.status}, ubah harga ${update.status} (${product.price} jadi ${newPrice}, tersimpan ${stored.price}), selesaikan ${complete.status}, ` +
        `status entry ${entry.status}, revenue entry ${entry.total_revenue}`
      );
      ctx.expect(sale.status === 201 && update.status === 200 && complete.status === 200, "langkah gagal");
      ctx.expect(money(stored.price) === money(newPrice), "harga baru tidak tersimpan");
      ctx.expect(entry.status === "completed" && money(entry.total_revenue) === money(oldRevenue), "revenue entry berubah");
    }
  },
  {
    id: "S14",
    group: "PUBJ",
    title: "Tutup hari dengan entry aktif",
    steps: ["Stok harian Onde-onde 10", "Kasir jual Onde-onde x1", "Superadmin jalankan tutup hari (end-of-day)"],
    expected: "Status 200, entry jadi completed, stok katalog Onde-onde 0",
    screen: { page: "/superadmin/daily-stock", as: "superadmin", highlight: "tr:has-text(\"Onde-onde\")" },
    async run(ctx) {
      const product = await ctx.product("Onde-onde");
      const entryId = await addDailyStock(ctx, product, 10);
      const sale = await sell(ctx, "kasir1", [{ product_id: product.id, quantity: 1 }]);
      const res = await ctx.as("superadmin").post("/api/daily-stock/end-of-day");
      const entry = await dailyEntry(ctx, entryId);
      const after = await ctx.product("Onde-onde");
      ctx.actual(`Jual ${sale.status}, end-of-day ${res.status} (${res.body?.completed_count} entry), status entry ${entry.status}, stok katalog ${after.stock}`);
      ctx.expect(sale.status === 201 && res.status === 200 && entry.status === "completed" && after.stock === 0);
    }
  },
  {
    id: "S15",
    group: "PUBJ",
    title: "Edit stok harian lebih kecil dari terjual",
    steps: ["Stok harian Pastel 10", "Kasir jual Pastel x5", "Ubah stok masuk jadi 3"],
    expected: "Status 400, stok masuk tetap 10",
    screen: { page: "/superadmin/daily-stock", as: "superadmin", highlight: "tr:has-text(\"Pastel\")" },
    async run(ctx) {
      const product = await ctx.product("Pastel");
      const entryId = await addDailyStock(ctx, product, 10);
      const sale = await sell(ctx, "kasir1", [{ product_id: product.id, quantity: 5 }]);
      const res = await ctx.as("superadmin").put(`/api/daily-stock/${entryId}`, { quantity_in: 3 });
      const entry = await dailyEntry(ctx, entryId);
      ctx.actual(`Jual ${sale.status}, ubah ${res.status} "${res.body?.message}", stok masuk ${entry.quantity_in}, terjual ${entry.quantity_sold}`);
      ctx.expect(sale.status === 201 && res.status === 400 && entry.quantity_in === 10);
    }
  },
  {
    id: "S16",
    group: "Produk",
    title: "Tambah stok produk toko",
    steps: ["Air Mineral stok 5", "Superadmin tambah stok +10"],
    expected: "Stok jadi 15",
    screen: { page: "/superadmin/products", as: "superadmin", highlight: "tr:has-text(\"Air Mineral\")" },
    async run(ctx) {
      const before = await ctx.product("Air Mineral");
      const res = await ctx.as("superadmin").patch(`/api/products/${before.id}/add-stock`, { quantity: 10 });
      const after = await ctx.product("Air Mineral");
      ctx.actual(`Status ${res.status}, stok ${before.stock} jadi ${after.stock}`);
      ctx.expect(res.status === 200 && after.stock === before.stock + 10);
    }
  },
  {
    id: "S17",
    group: "Produk",
    title: "Upload gambar lokal dan tampil di katalog POS",
    steps: ["Superadmin upload kuning.png", "Buat produk Teh Kotak dengan gambar itu", "Ambil URL gambar", "Kasir buka katalog POS"],
    expected: "URL /uploads/products/... status 200 bertipe gambar, produk di katalog aktif memakai URL itu",
    screen: { page: "/cashier/pos", as: "kasir1", imageAlt: "Teh Kotak", highlight: ".bg-card:has(> div.relative > img[alt=\"Teh Kotak\"])" },
    async run(ctx) {
      const upload = await ctx.as("superadmin").upload("/api/products/upload-image", FIXTURE_IMAGE);
      if (upload.status !== 200) throw new Error(`Upload gagal: ${upload.status} ${JSON.stringify(upload.body)}`);
      const { imageUrl, imageFilename } = upload.body;
      const created = await ctx.as("superadmin").post("/api/products", {
        name: "Teh Kotak",
        price: 6000,
        stock: 10,
        category_id: ctx.fixture.categories.Minuman,
        image_url: imageUrl,
        image_filename: imageFilename
      });
      const image = await ctx.fetchRaw(imageUrl);
      const catalog = await ctx.as("kasir1").get("/api/products?active_only=true");
      const listed = Array.isArray(catalog.body) ? catalog.body.find((p) => p.id === created.body?.id) : null;
      ctx.actual(
        `Upload ${upload.status} ${imageUrl}, produk ${created.status}, gambar ${image.status} ${image.contentType} ${image.bytes} byte, ` +
        `katalog POS ${listed ? `memuat produk dengan image_url ${listed.image_url}` : "tidak memuat produk"}`
      );
      ctx.evidence({ upload: upload.body, product: created.body, image, catalogEntry: listed });
      ctx.expect(/^\/uploads\/products\//.test(imageUrl) && created.status === 201, "upload atau buat produk gagal");
      ctx.expect(image.status === 200 && /^image\//.test(image.contentType || "") && image.bytes > 0, "gambar tidak bisa diambil");
      ctx.expect(listed && listed.image_url === imageUrl, "produk tidak muncul di katalog dengan gambar itu");
    }
  },
  {
    id: "S18",
    group: "Produk",
    title: "Hard delete produk yang punya riwayat",
    steps: ["Kasir jual Gorengan Lama x1", "Superadmin hapus permanen Gorengan Lama dengan password"],
    expected: "Status 200, penjualan tetap ada dengan product_id null",
    screen: { page: "/superadmin/transactions", as: "superadmin", highlight: "tr:has-text(\"Gorengan Lama\")" },
    async run(ctx) {
      const product = await ctx.product("Gorengan Lama");
      const sale = await sell(ctx, "kasir1", [{ product_id: product.id, quantity: 1 }]);
      if (sale.status !== 201) throw new Error(`Penjualan awal gagal: ${sale.status}`);
      const res = await ctx.as("superadmin").del(`/api/products/${product.id}/hard-delete`, { password: "superadmin123" });
      const sales = await ctx.sql("SELECT id, total_amount FROM sales WHERE id = $1", [sale.body.sale_id]);
      const items = await ctx.sql("SELECT product_id, quantity FROM sale_items WHERE sale_id = $1", [sale.body.sale_id]);
      const logs = await ctx.sql("SELECT product_id, product_name FROM transaction_logs WHERE sale_id = $1", [sale.body.sale_id]);
      ctx.actual(
        `Hapus ${res.status}, sales ${sales.length} baris, sale_items product_id ${items.map((i) => String(i.product_id)).join(",")}, ` +
        `log "${logs[0]?.product_name}" product_id ${logs[0]?.product_id}`
      );
      ctx.evidence({ request: { method: "DELETE", url: `/api/products/${product.id}/hard-delete` }, response: res.body, sales, items, logs });
      ctx.expect(res.status === 200 && sales.length === 1, "hapus gagal atau penjualan hilang");
      ctx.expect(items.length === 1 && items[0].product_id === null, "sale_items tidak di-null-kan");
      ctx.expect(logs.length === 1 && logs[0].product_id === null && logs[0].product_name === "Gorengan Lama", "log transaksi rusak");
    }
  },
  {
    id: "S19",
    group: "Pengguna",
    title: "Hapus kasir yang punya transaksi",
    steps: ["Buat kasir_hapus di Shift A", "kasir_hapus jual Kerupuk x1", "Superadmin hapus kasir_hapus"],
    expected: "Status 409, kasir tetap ada",
    screen: { page: "/superadmin/cashiers", as: "superadmin", highlight: "tr:has-text(\"kasir_hapus\")" },
    async run(ctx) {
      const created = await ctx.as("superadmin").post("/api/users/cashiers", { username: "kasir_hapus", password: "kasir123" });
      if (created.status !== 201) throw new Error(`Buat kasir gagal: ${created.status}`);
      await ctx.as("superadmin").put(`/api/shifts/assign/${created.body.id}`, { shift_id: ctx.fixture.shifts.A.id });
      const product = await ctx.product("Kerupuk");
      const sale = await sell(ctx, "kasir_hapus", [{ product_id: product.id, quantity: 1 }]);
      const res = await ctx.as("superadmin").del(`/api/users/cashiers/${created.body.id}`);
      const still = await ctx.as("superadmin").get(`/api/users/cashiers/${created.body.id}`);
      ctx.actual(`Jual ${sale.status}, hapus ${res.status} "${res.body?.message}", cek kasir ${still.status}`);
      ctx.evidence({ request: { method: "DELETE", url: `/api/users/cashiers/${created.body.id}` }, response: { status: res.status, body: res.body } });
      ctx.expect(sale.status === 201 && res.status === 409 && still.status === 200);
    }
  },
  {
    id: "S20",
    group: "Laporan",
    title: "Transaksi jam 00:30 WIB masuk hari ini",
    steps: [
      "Kasir jual Bubur Ayam x1",
      "Geser created_at sales dan transaction_logs ke 00:30 WIB hari ini (SQL langsung)",
      "Superadmin buka dashboard"
    ],
    expected: "todayStats tetap menghitung transaksi itu (jumlah dan omzet tidak turun setelah digeser)",
    screen: { page: "/superadmin/dashboard", as: "superadmin", highlight: ".bg-card:has(> * > :text-is(\"Penjualan Hari Ini\"))" },
    async run(ctx) {
      const product = await ctx.product("Bubur Ayam");
      const sale = await sell(ctx, "kasir2", [{ product_id: product.id, quantity: 1 }]);
      if (sale.status !== 201) throw new Error(`Penjualan awal gagal: ${sale.status}`);
      const [{ crosses }] = await ctx.sql(
        `SELECT (created_at AT TIME ZONE 'UTC')::date
                <> ((current_date + time '00:30') AT TIME ZONE 'Asia/Jakarta' AT TIME ZONE 'UTC')::date AS crosses
         FROM sales WHERE id = $1`,
        [sale.body.sale_id]
      );
      if (!crosses) {
        throw new Error("tidak bisa membuktikan zona waktu pada jam ini (00:00-07:00 WIB); jalankan ulang setelah 07:00 WIB");
      }
      const before = await ctx.as("superadmin").get("/api/dashboard");
      await ctx.sql(
        `UPDATE sales SET created_at = (current_date + time '00:30') AT TIME ZONE 'Asia/Jakarta' WHERE id = $1`,
        [sale.body.sale_id]
      );
      await ctx.sql(
        `UPDATE transaction_logs SET created_at = (current_date + time '00:30') AT TIME ZONE 'Asia/Jakarta' WHERE sale_id = $1`,
        [sale.body.sale_id]
      );
      const [moved] = await ctx.sql(
        `SELECT to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS wib,
                to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS utc,
                created_at::date = current_date AS today_wib
         FROM sales WHERE id = $1`,
        [sale.body.sale_id]
      );
      const after = await ctx.as("superadmin").get("/api/dashboard");
      const b = before.body.todayStats;
      const a = after.body.todayStats;
      ctx.actual(
        `Sale ${sale.body.sale_id} digeser ke ${moved.wib} WIB (${moved.utc} UTC). ` +
        `todayStats sebelum ${b.transactions} trx/${b.revenue}, sesudah ${a.transactions} trx/${a.revenue}`
      );
      ctx.evidence({ moved, todayStatsBefore: b, todayStatsAfter: a });
      ctx.expect(moved.today_wib && moved.utc.slice(0, 10) < moved.wib.slice(0, 10), "pergeseran waktu tidak menguji batas tanggal UTC");
      ctx.expect(a.transactions === b.transactions && money(a.revenue) === money(b.revenue), "transaksi 00:30 WIB keluar dari todayStats");
    }
  },
  {
    id: "S21",
    group: "Laporan",
    title: "Total supplier vs jumlah entry",
    steps: ["Superadmin buka daftar supplier", "Bandingkan total_revenue Bu Ani dengan jumlah revenue semua entry-nya"],
    expected: "total_revenue = jumlah revenue entry (tidak terkali jumlah produk)",
    screen: { page: "/superadmin/suppliers", as: "superadmin", highlight: "tr:has-text(\"Bu Ani\")" },
    async run(ctx) {
      const res = await ctx.as("superadmin").get("/api/suppliers");
      const supplier = (res.body || []).find((s) => s.id === ctx.fixture.supplierId);
      const [sum] = await ctx.sql(
        `SELECT COALESCE(SUM(total_revenue), 0) AS revenue, COUNT(*)::int AS entries
         FROM daily_stock_entries WHERE supplier_id = $1 AND entry_date >= current_date - 30`,
        [ctx.fixture.supplierId]
      );
      ctx.actual(`API total_revenue ${supplier?.total_revenue} (${supplier?.product_count} produk), jumlah ${sum.entries} entry = ${sum.revenue}`);
      ctx.evidence({ supplier, entrySum: sum });
      ctx.expect(supplier && money(sum.revenue) > 0 && money(supplier.total_revenue) === money(sum.revenue));
    }
  },
  {
    id: "S22",
    group: "Laporan",
    title: "Laba toko dashboard vs laporan transaksi",
    steps: ["Superadmin buka dashboard", "Superadmin buka laporan transaksi", "Bandingkan laba toko total"],
    expected: "totalStats.storeProfit = jumlah keuntungan_toko di laporan transaksi = hitungan K1 langsung dari tabel",
    screen: { page: "/superadmin/revenue", as: "superadmin" },
    async run(ctx) {
      const dashboard = await ctx.as("superadmin").get("/api/dashboard");
      const transactions = await ctx.as("superadmin").get("/api/transactions");
      const rows = Array.isArray(transactions.body) ? transactions.body : [];
      const reportSum = rows.reduce((sum, row) => sum + money(row.keuntungan_toko || 0), 0);
      const dashboardProfit = money(dashboard.body?.totalStats?.storeProfit);
      const [oracle] = await ctx.sql(`
        SELECT
          (SELECT COALESCE(SUM(si.quantity * si.price_at_sale), 0)
           FROM sale_items si
           WHERE NOT EXISTS (
             SELECT 1 FROM sale_taxes stx
             WHERE stx.sale_id = si.sale_id
               AND stx.sale_item_id = si.id
           )) AS toko,
          (SELECT COALESCE(SUM(store_profit), 0) FROM sale_taxes) AS pubj
      `);
      const oracleProfit = money(oracle.toko) + money(oracle.pubj);
      ctx.actual(`Dashboard ${dashboardProfit / 100}, laporan transaksi ${reportSum / 100} (${rows.length} baris), hitungan K1 dari tabel ${oracleProfit / 100}`);
      ctx.evidence({ dashboardTotalStats: dashboard.body?.totalStats, transactionRows: rows.length, transactionProfitSum: reportSum / 100, oracle: { tokoRevenue: oracle.toko, pubjStoreProfit: oracle.pubj, total: oracleProfit / 100 } });
      ctx.expect(dashboard.status === 200 && transactions.status === 200 && rows.length > 0 && dashboardProfit === reportSum, "dashboard tidak sama dengan laporan transaksi");
      ctx.expect(dashboardProfit === oracleProfit, "laba toko tidak sama dengan hitungan K1 dari tabel");
    }
  },
  {
    id: "S23",
    group: "Profil",
    title: "Update profil tanpa username",
    steps: ["kasir2 kirim ubah profil tanpa field username"],
    expected: "Status 400, username tidak berubah",
    screen: { page: "/cashier/dashboard", as: "kasir2" },
    async run(ctx) {
      const res = await ctx.as("kasir2").put("/api/auth/profile", { currentPassword: "kasir123" });
      const [user] = await ctx.sql("SELECT username FROM users WHERE username = 'kasir2'");
      ctx.actual(`Status ${res.status} "${res.body?.message}", username ${user ? "tetap kasir2" : "berubah"}`);
      ctx.expect(res.status === 400 && Boolean(user));
    }
  },
  {
    id: "S24",
    group: "Stabilitas",
    title: "Server tetap sehat setelah 30 request gagal",
    steps: ["Kirim 15 checkout qty -1 dan 15 GET /api/sales/999999 berturut-turut", "Kirim GET /api/products"],
    expected: "30 request gagal dengan 400/404, request normal tetap 200 dalam < 2 detik",
    screen: null,
    async run(ctx) {
      const product = await ctx.product("Es Teh");
      const statuses = [];
      for (let i = 0; i < 15; i += 1) {
        statuses.push((await sell(ctx, "kasir1", [{ product_id: product.id, quantity: -1 }])).status);
        statuses.push((await ctx.as("kasir1").get("/api/sales/999999")).status);
      }
      const normal = await ctx.as("kasir1").get("/api/products");
      const tally = statuses.reduce((acc, s) => ({ ...acc, [s]: (acc[s] || 0) + 1 }), {});
      ctx.actual(`30 request: ${Object.entries(tally).map(([s, n]) => `${n}x ${s}`).join(", ")}; GET /api/products ${normal.status} dalam ${normal.ms} ms`);
      ctx.evidence({ request: { errors: 30, then: "GET /api/products" }, response: { tally, normalStatus: normal.status, normalMs: normal.ms } });
      ctx.expect(statuses.length === 30 && statuses.every((s) => s === 400 || s === 404) && normal.status === 200 && normal.ms < 2000);
    }
  }
];
