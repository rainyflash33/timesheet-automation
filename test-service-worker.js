const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const root = __dirname;
const handlers = {};
const context = {self:{location:{href:"https://example.test/clocky/service-worker.js"}, addEventListener:(name, handler) => { handlers[name] = handler; }}, URL};
vm.runInNewContext(fs.readFileSync(path.join(root, "service-worker.js"), "utf8") + ";globalThis.shell={CACHE_NAME,APP_SHELL};", context);
const shell = context.shell;
const base = "https://example.test/clocky/";
const cached = new Set(shell.APP_SHELL.map(asset => new URL(asset, base).href));
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const required = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]).filter(asset => /\.(?:js|css|webmanifest|png|jpe?g)(?:\?|$)/.test(asset));
for (const asset of required) assert(cached.has(new URL(asset, base).href), `Offline shell is missing the exact HTML asset URL: ${asset}`);
for (const asset of shell.APP_SHELL) {
  const file = new URL(asset, base).pathname.replace("/clocky/", "") || "index.html";
  assert(fs.existsSync(path.join(root, file)), `Precached asset does not exist: ${asset}`);
}
assert(cached.has(new URL("./index.html", base).href));
assert(cached.has(new URL("./assets/clocky-hero-office.jpeg", base).href));
assert(handlers.install && handlers.activate && handlers.fetch);
assert.equal(shell.CACHE_NAME, "clocky-shell-v21");
console.log("Service-worker manifest matches every essential HTML asset and all files exist.");
