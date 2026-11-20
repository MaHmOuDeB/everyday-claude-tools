// Opens each tool page in headless Chrome at phone and desktop width, light and dark.
// Reports horizontal overflow and script errors, and saves screenshots.
// Usage: node scripts/check-pages.mjs <out-dir> <page.html> [...]   (Chrome must be installed)
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";
const [out, ...pages] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const chromePath = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn(chromePath, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${out}/.chrome`, "--no-first-run", "--hide-scrollbars", ...(process.env.CI ? ["--no-sandbox"] : []), "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 120 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await sleep(250); } }
if (!targets) { chrome.kill(); console.error("Chrome did not start"); process.exit(2); }
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0; const waiting = new Map(); const errors = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value || a.description).join(" "));
});
const send = (method, params = {}) => new Promise((r) => { waiting.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
await send("Page.enable"); await send("Runtime.enable");
let failed = false;
for (const page of pages) {
  for (const [w, h, mobile] of [[390, 844, true], [1280, 900, false]]) {
    for (const scheme of ["light", "dark"]) {
      errors.length = 0;
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
      await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
      await send("Page.navigate", { url: "file://" + resolve(page) });
      await sleep(1800);
      const r = await send("Runtime.evaluate", { expression: "JSON.stringify({sw: document.documentElement.scrollWidth, iw: innerWidth, h: document.documentElement.scrollHeight, junk: (document.body.innerText.match(/\\b(null|undefined|NaN)\\b|\\[object Object\\]/g) || []).length})", returnByValue: true });
      const m = JSON.parse(r.result.result.value);
      const overflow = m.sw > m.iw;
      if (m.junk) errors.push(`${m.junk}x null/undefined/NaN text`);
      if (overflow || errors.length) failed = true;
      const name = `${basename(page, ".html")}-${w}-${scheme}`;
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: Math.min(m.h, Number(process.env.SHOT_HEIGHT) || 4000), deviceScaleFactor: 1, mobile });
      await sleep(300);
      const shot = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(`${out}/${name}.png`, Buffer.from(shot.result.data, "base64"));
      console.log(`${overflow ? "OVERFLOW" : "ok"} ${errors.length ? "ERRORS" : "clean"} ${name}${overflow ? ` (${m.sw}>${m.iw})` : ""}${errors.length ? " " + errors.slice(0, 3).join(" | ") : ""}`);
    }
  }
}
ws.close(); chrome.kill();
process.exit(failed ? 1 : 0);
