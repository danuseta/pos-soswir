const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const GROUPS = ["Akses", "Penjualan", "PUBJ", "Produk", "Pengguna", "Laporan", "Profil", "Stabilitas"];

const BUGS = [
  ["#1", "Harga dikirim dari kasir (client) dipercaya, bisa dimanipulasi", ["S08"]],
  ["#2", "Jumlah barang 0, negatif, atau pecahan diterima", ["S07"]],
  ["#3", "Dua kasir bisa menjual stok terakhir yang sama (tanpa kunci)", ["S10"]],
  ["#4", "Tutup hari menghasilkan NaN", ["S14"]],
  ["#5", "Edit stok harian tanpa validasi", ["S15"]],
  ["#6", "Stok PUBJ di katalog beda sumber dengan saat checkout", ["S11", "S12"]],
  ["#7", "Fee PUBJ diambil dari sumber yang berbeda", ["S11"]],
  ["#8", "Total supplier terkali jumlah produk", ["S21"]],
  ["#9", "Daftar penjualan terkali jumlah baris (GET /sales)", []],
  ["#10", "Filter 30 hari ditaruh di ON sehingga tidak menyaring", []],
  ["#11", "Rumus laba toko berbeda antara dashboard dan laporan", ["S22"]],
  ["#12", "Revenue stok harian dihitung ulang dengan harga baru", ["S13"]],
  ["#13", "Tanggal dihitung dalam UTC, transaksi dini hari pindah hari", ["S20"]]
];

const STATUS_LABEL = { pass: "Lulus", fail: "Gagal", error: "Error" };

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const badge = (status) => `<span class="badge ${esc(status)}">${esc(STATUS_LABEL[status] || status)}</span>`;
const pct = (n, total) => (total === 0 ? 0 : Math.round((n / total) * 1000) / 10);

function git(args) {
  try {
    return execFileSync("git", args, { cwd: __dirname, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function commitInfo() {
  const hash = git(["rev-parse", "--short", "HEAD"]) || "tidak diketahui";
  return git(["status", "--porcelain"]) ? `${hash} (ada perubahan lokal belum di-commit)` : hash;
}

function imageData(outDir, scenario) {
  if (!scenario.screenshot) return null;
  const file = path.join(outDir, scenario.screenshot);
  if (!fs.existsSync(file)) return null;
  return `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
}

function json(value) {
  return esc(JSON.stringify(value, null, 2));
}

function failCard(s, img) {
  const steps = (s.steps || []).map((step) => `<li>${esc(step)}</li>`).join("");
  const shot = img
    ? `<figure><img class="full" src="${img}" alt="Screenshot ${esc(s.id)}"><figcaption>Halaman ${esc(s.screen?.page)} sebagai ${esc(s.screen?.as)}. Garis merah menandai bagian yang terkait.</figcaption></figure>`
    : `<p class="muted">Tidak ada screenshot untuk skenario ini${s.screen ? "" : " (skenario API saja)"}.</p>`;
  const browser = s.browserCheck
    ? `<details><summary>Pemeriksaan di browser</summary><pre>${json(s.browserCheck)}</pre></details>`
    : "";
  return `<article class="card fail-card" id="gagal-${esc(s.id)}">
  <h3>${badge(s.status)} ${esc(s.id)} - ${esc(s.title)} <span class="muted">(${esc(s.group)})</span></h3>
  <ol class="steps">${steps}</ol>
  <div class="compare">
    <div class="box expected"><h4>Diharapkan</h4><p>${esc(s.expected)}</p></div>
    <div class="box actual"><h4>Yang terjadi</h4><p>${esc(s.actual)}</p></div>
  </div>
  ${shot}
  <details><summary>Bukti request dan response</summary><pre>${json(s.evidence)}</pre></details>
  ${browser}
</article>`;
}

function thumb(s, img) {
  if (!img) return `<span class="muted">${s.screen ? "gagal diambil" : "tanpa layar"}</span>`;
  return `<details class="zoom"><summary title="Klik untuk memperbesar, klik lagi untuk menutup"><img src="${img}" alt="Screenshot ${esc(s.id)}"></summary></details>`;
}

function render(results, outDir) {
  const list = results.scenarios;
  const count = (status, items = list) => items.filter((s) => s.status === status).length;
  const total = list.length;
  const pass = count("pass");
  const fail = count("fail");
  const error = count("error");
  const bad = list.filter((s) => s.status !== "pass");
  const images = new Map(list.map((s) => [s.id, imageData(outDir, s)]));
  const byId = new Map(list.map((s) => [s.id, s]));
  const startedAt = String(results.startedAt || "").replace("T", " ").replace("+07:00", " WIB");

  const groupRows = GROUPS.map((group) => {
    const items = list.filter((s) => s.group === group);
    return `<tr><td>${esc(group)}</td><td>${items.length}</td><td>${count("pass", items)}</td><td>${count("fail", items)}</td><td>${count("error", items)}</td></tr>`;
  }).join("");

  const allRows = list.map((s) => `<tr class="row-${esc(s.status)}">
    <td>${s.status === "pass" ? esc(s.id) : `<a href="#gagal-${esc(s.id)}">${esc(s.id)}</a>`}</td>
    <td>${esc(s.group)}</td><td>${esc(s.title)}</td><td>${badge(s.status)}</td>
    <td>${esc(s.expected)}</td><td>${esc(s.actual)}</td><td>${thumb(s, images.get(s.id))}</td></tr>`).join("");

  const bugRows = BUGS.map(([no, text, ids]) => {
    const proof = ids.length === 0
      ? `<span class="muted">Belum ada skenario khusus</span>`
      : ids.map((id) => `${esc(id)} ${byId.has(id) ? badge(byId.get(id).status) : ""}`).join("<br>");
    return `<tr><td>${esc(no)}</td><td>${esc(text)}</td><td>${proof}</td></tr>`;
  }).join("");

  const forced = results.fixture?.forceFail || [];
  const forcedNote = forced.length
    ? `<p class="notice">Mode uji: hasil ${esc(forced.join(", "))} sengaja dibalik lewat SCENARIO_FORCE_FAIL untuk memastikan jalur "gagal" tergambar. Kegagalan ini bukan bug aplikasi.</p>`
    : "";

  const failSection = bad.length
    ? `<section><h2>Yang gagal (${bad.length})</h2>${bad.map((s) => failCard(s, images.get(s.id))).join("\n")}</section>`
    : `<section><h2>Yang gagal</h2><p class="ok-note">Tidak ada. Semua ${total} skenario lulus.</p></section>`;

  const directWrites = (results.directWrites || []).map((w) => `<li>${esc(w)}</li>`).join("");

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Laporan Skenario POS Soswir</title>
<style>
:root {
  --bg: #f6f7f9; --surface: #ffffff; --text: #1c2430; --muted: #5d6b7a; --border: #d9dee5;
  --pass: #15803d; --pass-bg: #dcfce7; --fail: #b91c1c; --fail-bg: #fee2e2; --error: #9a3412; --error-bg: #ffedd5;
  --code-bg: #f1f3f6; --accent: #1d4ed8;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #12161c; --surface: #1b2129; --text: #e6eaef; --muted: #9aa6b4; --border: #2e3742;
    --pass: #4ade80; --pass-bg: #123222; --fail: #f87171; --fail-bg: #3a1717; --error: #fdba74; --error-bg: #3a2414;
    --code-bg: #232a34; --accent: #93b4ff;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 1200px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 1.6rem; margin: 0 0 4px; }
h2 { font-size: 1.25rem; margin: 32px 0 12px; }
h3 { font-size: 1.05rem; margin: 0 0 8px; }
h4 { margin: 0 0 4px; font-size: .9rem; }
a { color: var(--accent); }
.muted { color: var(--muted); }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 16px; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; }
.stat { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; }
.stat b { display: block; font-size: 1.8rem; line-height: 1.2; }
.stat.pass b { color: var(--pass); } .stat.fail b { color: var(--fail); } .stat.error b { color: var(--error); }
.bar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; margin: 12px 0; background: var(--border); }
.bar span.pass { background: var(--pass); } .bar span.fail { background: var(--fail); } .bar span.error { background: var(--error); }
.table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid var(--border); }
th { font-size: .85rem; color: var(--muted); white-space: nowrap; }
tr.row-fail td, tr.row-error td { background: var(--fail-bg); }
.all td:nth-child(5), .all td:nth-child(6) { min-width: 220px; font-size: .9rem; }
.badge { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: .8rem; font-weight: 600; white-space: nowrap; }
.badge.pass { color: var(--pass); background: var(--pass-bg); }
.badge.fail { color: var(--fail); background: var(--fail-bg); }
.badge.error { color: var(--error); background: var(--error-bg); }
.fail-card { border-left: 4px solid var(--fail); }
.steps { margin: 0 0 12px; padding-left: 20px; }
.compare { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin-bottom: 12px; }
.box { border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; overflow-wrap: anywhere; }
.box p { margin: 0; }
.box.expected { background: var(--pass-bg); } .box.actual { background: var(--fail-bg); }
figure { margin: 0 0 12px; }
img.full { width: 100%; height: auto; border: 1px solid var(--border); border-radius: 6px; display: block; }
figcaption { font-size: .85rem; color: var(--muted); margin-top: 4px; }
details { margin-top: 8px; }
summary { cursor: pointer; }
pre { background: var(--code-bg); padding: 12px; border-radius: 6px; overflow-x: auto; font-size: .8rem; max-height: 480px; }
.zoom summary { list-style: none; }
.zoom summary::-webkit-details-marker { display: none; }
.zoom img { width: 120px; height: auto; border: 1px solid var(--border); border-radius: 4px; display: block; }
.zoom[open] img { position: fixed; inset: 0; width: 100vw; height: 100vh; object-fit: contain; background: rgba(0, 0, 0, .88); border: 0; border-radius: 0; z-index: 10; padding: 16px; }
.notice { background: var(--error-bg); border: 1px solid var(--error); border-radius: 6px; padding: 10px 12px; }
.ok-note { background: var(--pass-bg); border: 1px solid var(--pass); border-radius: 6px; padding: 10px 12px; }
dl.env { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
dl.env dt { color: var(--muted); } dl.env dd { margin: 0; overflow-wrap: anywhere; }
</style>
</head>
<body>
<main>
<header>
  <h1>Laporan Skenario POS Soswir</h1>
  <p class="muted">Dijalankan ${esc(startedAt)} - commit ${esc(commitInfo())}</p>
  ${forcedNote}
</header>

<section>
  <h2>Ringkasan</h2>
  <div class="stats">
    <div class="stat"><span class="muted">Total</span><b>${total}</b></div>
    <div class="stat pass"><span class="muted">Lulus</span><b>${pass}</b></div>
    <div class="stat fail"><span class="muted">Gagal</span><b>${fail}</b></div>
    <div class="stat error"><span class="muted">Error</span><b>${error}</b></div>
  </div>
  <div class="bar" role="img" aria-label="${pass} lulus, ${fail} gagal, ${error} error">
    <span class="pass" style="width:${pct(pass, total)}%"></span><span class="fail" style="width:${pct(fail, total)}%"></span><span class="error" style="width:${pct(error, total)}%"></span>
  </div>
  <div class="table-wrap"><table>
    <thead><tr><th>Grup</th><th>Total</th><th>Lulus</th><th>Gagal</th><th>Error</th></tr></thead>
    <tbody>${groupRows}</tbody>
  </table></div>
</section>

${failSection}

<section>
  <h2>Semua skenario</h2>
  <div class="table-wrap"><table class="all">
    <thead><tr><th>ID</th><th>Grup</th><th>Judul</th><th>Status</th><th>Diharapkan</th><th>Yang terjadi</th><th>Layar</th></tr></thead>
    <tbody>${allRows}</tbody>
  </table></div>
</section>

<section>
  <h2>Lampiran: bug audit dan skenario pembuktinya</h2>
  <div class="table-wrap"><table>
    <thead><tr><th>Bug</th><th>Masalah</th><th>Dibuktikan oleh</th></tr></thead>
    <tbody>${bugRows}</tbody>
  </table></div>
</section>

<section>
  <h2>Cara membaca</h2>
  <div class="card">
    <ul>
      <li>Setiap skenario dijalankan ke backend sungguhan dengan database uji <code>pos_scenario</code> yang dibuat ulang setiap kali, lalu halaman terkait difoto di browser.</li>
      <li><b>Lulus</b> berarti semua pengecekan cocok. <b>Gagal</b> berarti aplikasi berjalan tapi hasilnya tidak sesuai harapan. <b>Error</b> berarti skenario berhenti di tengah jalan.</li>
      <li>Di bagian "Yang gagal", kolom kiri adalah yang diharapkan dan kolom kanan yang benar-benar terjadi. Garis merah di screenshot menandai bagian yang terkait.</li>
      <li>Klik thumbnail di tabel untuk memperbesar, klik lagi untuk menutup.</li>
    </ul>
  </div>
</section>

<section>
  <h2>Lingkungan</h2>
  <div class="card">
    <dl class="env">
      <dt>Waktu jalan</dt><dd>${esc(startedAt)}</dd>
      <dt>Node</dt><dd>${esc(results.env?.node)}</dd>
      <dt>Postgres</dt><dd>${esc(results.env?.postgres)}</dd>
      <dt>Commit</dt><dd>${esc(commitInfo())}</dd>
      <dt>Backend</dt><dd>${esc(results.env?.backend)}</dd>
      <dt>Frontend</dt><dd>${esc(results.env?.frontend || "tidak dijalankan")}</dd>
    </dl>
    ${directWrites ? `<p>Data yang diubah langsung lewat SQL (di luar API):</p><ul>${directWrites}</ul>` : ""}
  </div>
</section>
</main>
</body>
</html>
`;
}

async function buildReport({ resultsPath, outDir }) {
  const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  const report = path.join(outDir, "laporan-skenario.html");
  const latest = path.join(outDir, "..", "laporan-skenario-terbaru.html");
  fs.writeFileSync(report, render(results, outDir));
  fs.copyFileSync(report, latest);
  return { report, latest: path.resolve(latest) };
}

module.exports = { buildReport };
