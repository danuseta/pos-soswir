const baseUrl = process.env.SMOKE_FRONTEND_URL || "http://localhost:5173";
const routes = [
  "/login",
  "/superadmin",
  "/superadmin/dashboard",
  "/superadmin/products",
  "/superadmin/categories",
  "/superadmin/suppliers",
  "/superadmin/daily-stock",
  "/superadmin/cashiers",
  "/superadmin/transactions",
  "/superadmin/revenue",
  "/superadmin/activities",
  "/superadmin/settings",
  "/superadmin/profile",
  "/cashier",
  "/cashier/dashboard",
  "/cashier/products",
  "/cashier/pos",
  "/cashier/transactions",
  "/cashier/profile"
];

async function run() {
  const failures = [];

  for (const route of routes) {
    const response = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
    const body = await response.text();
    const hasSsrError = /not a valid SSR component|Unrecoverable HMR error|Internal Error/i.test(body);
    const passed = response.status < 500 && !hasSsrError;
    console.log(`${passed ? "PASS" : "FAIL"} ${response.status} ${route}`);
    if (!passed) failures.push(`${route} (${response.status})`);
  }

  if (failures.length > 0) {
    throw new Error(`SSR smoke gagal: ${failures.join(", ")}`);
  }

  console.log(`SSR smoke selesai: ${routes.length}/${routes.length} route lolos.`);
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
