/* Everyday Helpers: shared helpers. Plain script, defines window.Helpers. */
(() => {
  const LANGUAGES = [
    ["English", "English"], ["Deutsch", "German"], ["Français", "French"], ["Español", "Spanish"],
    ["Italiano", "Italian"], ["Português", "Portuguese"], ["Türkçe", "Turkish"], ["Polski", "Polish"],
    ["Українська", "Ukrainian"], ["Русский", "Russian"], ["العربية", "Arabic"], ["فارسی", "Persian"],
  ];

  const store = {
    get(key) { try { return localStorage.getItem("everyday:" + key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem("everyday:" + key, value); } catch { /* storage off */ } },
  };

  function capability(name) {
    try {
      if (window.claude && typeof window.claude.use === "function") return window.claude.use(name).catch(() => null);
    } catch { /* not in a Claude viewer */ }
    return Promise.resolve(null);
  }

  let samplePromise = null;
  const ai = () => (samplePromise ||= capability("sample"));
  let declined = false;

  const ERRORS = {
    not_granted: "This page is not allowed to use Claude in this view. Use Copy as prompt instead.",
    sampling_disabled: "Claude is not available for this account. Use Copy as prompt instead.",
    rate_limited: "Too many requests right now, or your Claude usage limit is reached. Try again in a little while.",
    session_expired: "Your Claude sign-in has expired. Sign in again, then try once more.",
    image_rejected: "One of the photos could not be used. Try a JPG or PNG photo under 20 MB.",
    images_unavailable: "Photos cannot be sent from this view. Paste the text instead.",
    refused: "Claude could not help with this text. Change what you ask and try again.",
    prompt_too_large: "That is too much text at once. Send a shorter part.",
    invalid_json: "The answer came back in a broken format. Press the button to try again.",
    empty_completion: "Claude returned an empty answer. Try again with a little less text.",
    unavailable: "Claude is not available in this copy of the page. Use Copy as prompt instead.",
  };
  const PERMANENT = new Set(["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"]);

  function errorText(error) {
    if (error && PERMANENT.has(error.code)) declined = true;
    return ERRORS[error?.code] || "Something went wrong on the way to Claude. Try again in a moment.";
  }

  /** True when this view can ask Claude. Resolves within about 10 s at most. */
  async function live() { return !declined && Boolean(await ai()); }

  async function askJSON(prompt, { images, signal, tier, onText } = {}) {
    const sample = await ai();
    if (!sample) throw { code: "unavailable" };
    const options = { signal, modelTier: tier || "default" };
    if (images && images.length) options.images = images;
    if (onText) options.onText = onText;
    return sample.json(prompt, options);
  }

  async function ask(input, { images, signal, tier, onText, cache } = {}) {
    const sample = await ai();
    if (!sample) throw { code: "unavailable" };
    const options = { signal, modelTier: tier || "default" };
    if (images && images.length) options.images = images;
    if (onText) options.onText = onText;
    if (cache !== undefined) options.cache = cache;
    return sample(input, options);
  }

  async function imageLimits() {
    const sample = await ai();
    if (!sample || typeof sample.limits !== "function") return null;
    try { return (await sample.limits()).images || null; } catch { return null; }
  }

  /** Build an element: el("p", {class: "hint", text: "..."}, child, child). Text is always set as text. */
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === null || value === undefined || value === false) continue;
      if (key === "text") node.textContent = value;
      else if (key === "class") node.className = value;
      else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  function languagePicker(select, fallback = "English") {
    select.replaceChildren(...LANGUAGES.map(([shown, english]) => el("option", { value: english, text: shown })));
    select.value = store.get("language") || fallback;
    if (!select.value) select.value = fallback;
    select.addEventListener("change", () => store.set("language", select.value));
    return () => select.value;
  }

  async function copy(text, button) {
    const label = button ? button.textContent : "";
    try {
      await navigator.clipboard.writeText(text);
      if (button) { button.textContent = "Copied"; setTimeout(() => { button.textContent = label; }, 1600); }
      return true;
    } catch {
      return false;
    }
  }

  /** Shows the exact prompt with a copy button and a link to Claude, for copies of the page that cannot ask Claude. */
  function promptPanel(prompt, note) {
    const area = el("textarea", { readonly: true, "aria-label": "Prompt to paste into Claude", id: "prompt-copy" });
    area.value = prompt;
    const copyButton = el("button", { class: "btn primary small", type: "button", text: "Copy prompt" });
    copyButton.addEventListener("click", async () => {
      if (!(await copy(prompt, copyButton))) { area.focus(); area.select(); }
    });
    return el("section", { class: "sheet prompt-panel" },
      el("h2", { text: "Paste this into Claude" }),
      el("p", { class: "hint", text: note || "This copy of the page cannot reach Claude directly. Copy the prompt, open a new chat on claude.ai and paste it." }),
      area,
      el("div", { class: "row" }, copyButton,
        el("a", { class: "btn small", href: "https://claude.ai/new", target: "_blank", rel: "noopener", text: "Open claude.ai" })));
  }

  async function saveFile(filename, data, type = "text/plain") {
    const downloads = await capability("downloads");
    if (downloads) {
      const result = await downloads.save({ filename, data });
      return result.status;
    }
    if (window.claude) throw { code: "unavailable" };
    const url = URL.createObjectURL(new Blob([data], { type }));
    const link = el("a", { href: url, download: filename });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return "saved";
  }

  const pad = (n) => String(n).padStart(2, "0");
  function todayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function parseISO(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }
  function daysUntil(iso) {
    const target = parseISO(iso);
    if (!target) return null;
    const today = parseISO(todayISO());
    return Math.round((target - today) / 86400000);
  }
  function daysText(days) {
    if (days === null) return "";
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    if (days > 1) return `in ${days} days`;
    if (days === -1) return "yesterday (overdue)";
    return `${-days} days ago (overdue)`;
  }
  function longDate(iso) {
    const d = parseISO(iso);
    return d ? d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric" }) : "";
  }

  /** A one-day calendar event with a reminder, as .ics text. */
  function ics({ title, date, description = "", remindDaysBefore = 2 }) {
    const day = date.replaceAll("-", "");
    const next = parseISO(date); next.setDate(next.getDate() + 1);
    const end = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
    const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Everyday Helpers//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
      `UID:${stamp}-${Math.random().toString(36).slice(2)}@everyday-helpers`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${end}`, `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(description)}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(title)}`, `TRIGGER:-P${remindDaysBefore}D`, "END:VALARM",
      "END:VEVENT", "END:VCALENDAR", "",
    ].join("\r\n");
  }

  /** Photo picker: a drop zone plus thumbnails. Returns {files(), clear(), setAllowed(limits)}. */
  function photoPicker(zone, input, thumbs, max = 4) {
    let files = [];
    const draw = () => thumbs.replaceChildren(...files.map((file, i) => {
      const url = URL.createObjectURL(file);
      return el("div", { class: "thumb" }, el("img", { src: url, alt: `Photo ${i + 1}` }),
        el("button", { type: "button", "aria-label": `Remove photo ${i + 1}`, text: "×", onclick: () => { files.splice(i, 1); draw(); } }));
    }));
    const add = (list) => {
      for (const file of list) if (file.type.startsWith("image/") && files.length < max) files.push(file);
      draw();
    };
    zone.addEventListener("click", () => input.click());
    zone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    input.addEventListener("change", () => { add(input.files); input.value = ""; });
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("over"));
    zone.addEventListener("drop", (e) => { e.preventDefault(); zone.classList.remove("over"); add(e.dataTransfer.files); });
    return {
      files: () => files.slice(),
      clear: () => { files = []; draw(); },
      setMax: (n) => { max = n; files = files.slice(0, n); draw(); },
    };
  }

  /** Main button: live mode asks Claude; copy mode shows the prompt panel. */
  async function wireMainButton({ button, liveLabel, copyLabel = "Copy as prompt", onLive, onCopy }) {
    button.textContent = liveLabel;
    button.addEventListener("click", async () => {
      if (await live()) onLive(); else onCopy();
    });
    const isLive = await live();
    if (!isLive) button.textContent = copyLabel;
    return isLive;
  }

  window.Helpers = {
    LANGUAGES, store, ai, live, ask, askJSON, imageLimits, errorText, el, languagePicker, copy, promptPanel,
    saveFile, todayISO, parseISO, daysUntil, daysText, longDate, ics, photoPicker, wireMainButton, capability,
  };
})();
