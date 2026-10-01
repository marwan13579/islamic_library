"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { fileURLToPath } = require("node:url");

const root = path.join(__dirname, "..");
const load = (relative) => import(`file://${path.join(root, "src", relative)}`);

/** يهيّئ بيئة DOM مصغّرة تكفي لوحدات PWA. */
function stubEnvironment() {
  const listeners = new Map();
  global.window = {
    isSecureContext: true,
    matchMedia: () => ({ matches: false }),
    navigator: { userAgent: "node-test", platform: "", maxTouchPoints: 0 },
    addEventListener: (type, handler) => {
      listeners.set(type, [...(listeners.get(type) ?? []), handler]);
    },
    location: { reload() {} },
  };
  global.document = { getElementById: () => null };
  // navigator في Node خاصية للقراءة فقط، فنُعرّفها صراحةً.
  Object.defineProperty(global, "navigator", {
    configurable: true,
    writable: true,
    value: {
      userAgent: "node-test",
      platform: "",
      maxTouchPoints: 0,
      serviceWorker: { controller: null, register: async () => ({ addEventListener() {} }) },
    },
  });
  global.Notification = class {
    static permission = "default";
  };
  return {
    emit(type, event) {
      for (const handler of listeners.get(type) ?? []) handler(event);
    },
  };
}

test("manifest references only files that exist and carries PWA identity metadata", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  assert.ok(manifest.id, "manifest must declare id");
  assert.ok(manifest.scope, "manifest must declare scope");
  assert.ok(Array.isArray(manifest.display_override), "manifest must declare display_override");

  const referenced = [
    ...manifest.icons.map((icon) => icon.src),
    ...manifest.shortcuts.flatMap((shortcut) => shortcut.icons.map((icon) => icon.src)),
  ];
  for (const src of referenced) {
    assert.ok(fs.existsSync(path.join(root, src.replace(/^\.\//, ""))), `missing asset ${src}`);
  }
  assert.ok(
    manifest.icons.some((icon) => icon.purpose === "maskable"),
    "manifest needs a maskable icon",
  );
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"), "manifest needs a 512px icon");
});

test("both entry pages carry Apple web-app metadata and an install control", () => {
  for (const page of ["src/site/noor.html", "src/app/app.html"]) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    assert.match(html, /rel="apple-touch-icon"/, `${page} must link apple-touch-icon`);
    assert.match(html, /apple-mobile-web-app-capable/, `${page} must set apple-mobile-web-app-capable`);
    assert.match(html, /id="installBtn"/, `${page} must expose an install button`);
    assert.match(html, /id="updateBtn"/, `${page} must expose an update control`);
  }
});

test("the offline fallback page links back into the working-offline features", () => {
  const html = fs.readFileSync(path.join(root, "offline.html"), "utf8");
  assert.match(html, /dir="rtl"/);
  assert.match(html, /app\.html#tab\/quran/);
  assert.match(html, /app\.html#tab\/athkar/);
  assert.match(html, /index\.html/);
});

test("the service worker precaches every shell asset and sets notification handlers", () => {
  const source = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const shell = source
    .split("const SHELL = [")[1]
    .split("];")[0]
    .match(/"([^"]+)"/g)
    .map((entry) => entry.slice(1, -1));

  assert.ok(shell.includes("./offline.html"), "offline page must be precached");
  assert.ok(shell.includes("./icons/icon-192.png"), "icons must be precached");
  assert.ok(shell.includes("./src/lib/pwa.js"), "pwa helper must be precached");

  for (const asset of shell) {
    assert.ok(fs.existsSync(path.join(root, asset.replace(/^\.\//, ""))), `precached ${asset} is missing`);
  }
  assert.match(source, /addEventListener\("notificationclick"/);
  assert.match(source, /addEventListener\("message"/);
  assert.match(source, /CACHE_VERSION = "islamic-library-v\d+"/);
});

test("every asset a module resolves relative to itself actually exists", async () => {
  const sources = ["src/lib/pwa.js", "src/app/tabs.js", "src/app/app.js", "src/site/site.js"];
  for (const file of sources) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    // مسارات تُبنى عبر new URL(..., import.meta.url) أو سلاسل نسبية
    const relative = [
      ...source.matchAll(/new URL\(\s*"([^"]+)"\s*,\s*import\.meta\.url/g),
      ...source.matchAll(/(?:fetch|register)\(\s*["'](\.[^"']+)["']/g),
    ].map((match) => match[1]);

    for (const ref of relative) {
      // fileURLToPath ضروري لأن مسار المشروع عربي.
      const target = fileURLToPath(new URL(ref, `file://${path.join(root, file)}`));
      assert.ok(
        fs.existsSync(target),
        `${file} resolves "${ref}" to ${target}, which does not exist`,
      );
    }
  }
});

test("isStandalone and canInstall reflect the browser state", async () => {
  const env = stubEnvironment();
  const { isStandalone, canInstall, setupInstallButton } = await load("lib/pwa.js");
  assert.equal(isStandalone(), false);
  assert.equal(canInstall(), false);

  const button = { hidden: true, textContent: "", addEventListener: () => {} };
  setupInstallButton(button);

  let prevented = false;
  env.emit("beforeinstallprompt", {
    preventDefault: () => {
      prevented = true;
    },
  });
  assert.equal(prevented, true, "the default install prompt must be suppressed");
  assert.equal(canInstall(), true);
  assert.equal(button.hidden, false, "the install button must be revealed");
});

test("notify routes through the service worker when a controller exists", async () => {
  stubEnvironment();
  const { notify } = await load("lib/pwa.js");
  assert.equal(notify({ title: "ت", body: "ب" }), false, "no controller means no message");

  const posted = [];
  global.navigator.serviceWorker.controller = { postMessage: (data) => posted.push(data) };
  assert.equal(notify({ title: "🕌", body: "حي على الصلاة", tag: "Fajr" }), true);
  assert.deepEqual(posted, [
    { type: "notify", title: "🕌", body: "حي على الصلاة", tag: "Fajr" },
  ]);
});