// Runs each tool's live-mode buttons against a fake Claude that returns empty or null-filled answers.
// Catches crashes and stray "null"/"undefined" text in code paths that only run when Claude is reachable.
// Usage: node scripts/check-live.mjs <out-dir> <page.html> [...]   (Chrome must be installed)
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
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.result.value;

// The fake runtime. MODE "empty" answers {} and ""; MODE "nulls" answers an object whose every field is null.
const stub = (mode) => `(() => {
  const nulls = () => new Proxy({}, { get: (t, k) => (k === "then" || typeof k === "symbol" ? undefined : k === "toJSON" ? () => ({}) : null) });
  const answer = () => (${JSON.stringify(mode)} === "empty" ? {} : nulls());
  const sample = async (input, opts = {}) => { const text = "Gut.\\n---TIPS---\\nTip."; opts.onText?.({ text, delta: text }); return { text, truncated: false }; };
  sample.json = async () => answer();
  sample.limits = async () => ({ images: { maxCount: 4, maxBytes: 5000000 } });
  const downloads = { save: async () => ({ status: "saved" }) };
  const tts = { speak: async () => {}, stop() {}, onState() {} };
  window.claude = { use: async (name) => ({ sample, downloads, tts })[name] || null };
})();`;
const SKIP = /^(copy|copied|remove|×|hear it|stop|remind me|add to calendar|copy prompt|open claude\.ai|copy recipe|add option|copy for)/i;

await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
let failed = false;
for (const page of pages) {
  for (const mode of ["empty", "nulls"]) {
    errors.length = 0;
    const { result } = await send("Page.addScriptToEvaluateOnNewDocument", { source: stub(mode) });
    await send("Page.navigate", { url: "file://" + resolve(page) });
    await sleep(1500);
    const clicked = [];
    for (let round = 0; round < 3; round++) {
      const labels = await evaluate(`[...document.querySelectorAll("button")].filter((b) => b.offsetParent && !b.disabled).map((b) => b.textContent.trim())`);
      const todo = labels.filter((l) => l && !SKIP.test(l) && !clicked.includes(l));
      if (!todo.length) break;
      for (const label of todo) {
        clicked.push(label);
        await evaluate(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.offsetParent && !x.disabled && x.textContent.trim() === ${JSON.stringify(label)}); b?.click(); })()`);
        await sleep(700);
      }
    }
    const junk = await evaluate(`(document.body.innerText.match(/\\b(null|undefined|NaN)\\b|\\[object Object\\]/g) || []).length`);
    if (junk) errors.push(`${junk}x null/undefined/NaN text`);
    if (errors.length) failed = true;
    const name = `${basename(page, ".html")}-${mode}`;
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(`${out}/${name}.png`, Buffer.from(shot.result.data, "base64"));
    console.log(`${errors.length ? "ERRORS" : "clean"} ${name} clicked: ${clicked.join(" / ")}${errors.length ? "\n   " + errors.slice(0, 4).join("\n   ") : ""}`);
    await send("Page.removeScriptToEvaluateOnNewDocument", { identifier: result.identifier });
  }
}
ws.close(); chrome.kill();
process.exit(failed ? 1 : 0);
