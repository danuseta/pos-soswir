const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const RED = "#dc2626";

async function outline(page, selector) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "attached", timeout: 5000 });
  await el.evaluate((node, color) => {
    node.style.transition = "none";
    if (node.tagName === "TR") {
      for (const cell of node.cells) {
        cell.style.transition = "none";
        cell.style.boxShadow = `inset 0 4px 0 ${color}, inset 0 -4px 0 ${color}`;
      }
    } else {
      node.style.outline = `4px solid ${color}`;
      node.style.outlineOffset = "2px";
    }
    node.scrollIntoView({ block: "center" });
  }, RED);
  await page.waitForTimeout(300);
}

async function gotoReady(page, url) {
  const open = new Set();
  const track = (req) => open.add(req);
  const done = (req) => open.delete(req);
  page.on("request", track);
  page.on("requestfinished", done);
  page.on("requestfailed", done);
  try {
    for (let attempt = 1; ; attempt += 1) {
      const res = await page.goto(url, { waitUntil: "load", timeout: 60000 });
      try {
        await page.waitForLoadState("networkidle", { timeout: 10000 });
      } catch {
        res.openRequests = [...open].map((req) => req.url());
      }
      if (res.status() < 500 || attempt === 3) return res;
      await page.waitForTimeout(3000);
    }
  } finally {
    page.off("request", track);
    page.off("requestfinished", done);
    page.off("requestfailed", done);
  }
}

async function newContext(browser, session) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  if (session) {
    await context.addInitScript((s) => {
      localStorage.setItem("pos_token", s.token);
      localStorage.setItem("pos_user_role", s.role);
      localStorage.setItem("pos_user_id", String(s.id));
      localStorage.setItem("pos_username", s.username);
    }, session);
  }
  return context;
}

async function warmUp(browser, frontendUrl, loginAs, screens) {
  for (const screen of screens) {
    const context = await newContext(browser, screen.page === "/login" ? null : await loginAs(screen.as));
    try {
      await gotoReady(await context.newPage(), frontendUrl + screen.page);
    } finally {
      await context.close();
    }
  }
}

async function loginThroughForm(page, frontendUrl, username, password) {
  await gotoReady(page, frontendUrl + "/login");
  await page.fill("#username", username);
  await page.fill("#password", password);
  await page.getByRole("button", { name: /Sign In/ }).click();
  const alert = page.locator('[role="alert"]').first();
  await alert.waitFor({ state: "visible", timeout: 10000 });
  return { url: new URL(page.url()).pathname, alert: (await alert.innerText()).trim() };
}

async function checkImage(page, alt) {
  const img = page.locator(`img[alt="${alt}"]`).first();
  await img.waitFor({ state: "attached", timeout: 10000 });
  await img.scrollIntoViewIfNeeded();
  await page.waitForFunction(
    (selector) => {
      const node = document.querySelector(selector);
      return node && node.complete;
    },
    `img[alt="${alt}"]`,
    { timeout: 10000 }
  );
  return img.evaluate((node) => ({ src: node.currentSrc || node.src, complete: node.complete, naturalWidth: node.naturalWidth, naturalHeight: node.naturalHeight }));
}

async function brokenImages(page) {
  return page.$$eval("img", (nodes) =>
    nodes
      .filter((node) => node.getAttribute("src") && node.complete && node.naturalWidth === 0)
      .map((node) => ({ alt: node.alt, src: node.getAttribute("src"), resolved: node.currentSrc || node.src }))
  );
}

function markFail(scenario, reason) {
  if (scenario.status === "pass") scenario.status = "fail";
  scenario.actual = `${scenario.actual} | Browser: ${reason}`;
}

async function captureOne(browser, scenario, { outDir, frontendUrl, loginAs, passwordOf }) {
  const { page: route, as, highlight, imageAlt } = scenario.screen;
  const context = await newContext(browser, route === "/login" ? null : await loginAs(as));
  const pageErrors = [];
  try {
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const browserCheck = { page: route, as };

    if (route === "/login") {
      Object.assign(browserCheck, await loginThroughForm(page, frontendUrl, as, passwordOf(as)));
    } else {
      const res = await gotoReady(page, frontendUrl + route);
      browserCheck.httpStatus = res.status();
      if (res.openRequests) browserCheck.openRequests = res.openRequests;
      if (res.status() >= 500) markFail(scenario, `halaman ${route} membalas HTTP ${res.status()}`);
      await page.waitForTimeout(500);
      browserCheck.url = new URL(page.url()).pathname;
      if (browserCheck.url !== route) markFail(scenario, `halaman ${route} dialihkan ke ${browserCheck.url}`);
    }

    if (imageAlt) {
      const image = await checkImage(page, imageAlt);
      browserCheck.image = image;
      if (!(image.naturalWidth > 0)) {
        markFail(scenario, `gambar "${imageAlt}" di ${route} tidak termuat (naturalWidth ${image.naturalWidth}, src ${image.src})`);
      }
    }

    const broken = await brokenImages(page);
    if (broken.length > 0) {
      browserCheck.brokenImages = broken;
      markFail(scenario, `${broken.length} gambar di ${route} gagal dimuat, contoh src "${broken[0].src}" (diminta ke ${broken[0].resolved})`);
    }

    if (highlight && scenario.status !== "pass") {
      try {
        await outline(page, highlight);
      } catch (error) {
        browserCheck.highlightError = `elemen ${highlight} tidak ditemukan: ${error.message.split("\n")[0]}`;
      }
    }

    if (pageErrors.length > 0) {
      browserCheck.pageErrors = pageErrors;
      markFail(scenario, `halaman melempar error JavaScript: ${pageErrors[0]}`);
    }

    const file = path.join(outDir, "shots", `${scenario.id}.png`);
    await page.screenshot({ path: file, fullPage: false });
    scenario.screenshot = path.relative(outDir, file).split(path.sep).join("/");
    scenario.browserCheck = browserCheck;
  } finally {
    await context.close();
  }
}

async function captureScreens({ results, outDir, frontendUrl, loginAs, passwordOf }) {
  fs.mkdirSync(path.join(outDir, "shots"), { recursive: true });
  const browser = await chromium.launch();
  try {
    const screens = new Map(results.scenarios.filter((s) => s.screen).map((s) => [s.screen.page, s.screen]));
    await warmUp(browser, frontendUrl, loginAs, [...screens.values()]);
    for (const scenario of results.scenarios) {
      if (!scenario.screen) continue;
      try {
        await captureOne(browser, scenario, { outDir, frontendUrl, loginAs, passwordOf });
      } catch (error) {
        scenario.browserCheck = { page: scenario.screen.page, as: scenario.screen.as, error: error.message.split("\n")[0] };
        markFail(scenario, `screenshot gagal: ${error.message.split("\n")[0]}`);
      }
      console.log(`SHOT  ${scenario.id} ${scenario.screenshot || "(tanpa gambar)"}`);
    }
  } finally {
    await browser.close();
  }
}

module.exports = { captureScreens };
