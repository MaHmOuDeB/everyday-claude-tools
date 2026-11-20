# Everyday Helpers: design

Seven small tools for everyday life. Each is one web page that runs as a Claude artifact: it asks Claude on the
viewer's own Claude account, and works without any install. The same files sit in this repository, where a downloaded
copy still works in a reduced "copy the prompt" mode.

## Shared rules for every tool

**One job per page.** The page opens on a filled example (clearly labelled "Example"), so people see what it does before
they type anything. One main button runs the tool.

**How a tool reaches Claude.** `tools/shared.js` wraps the artifact runtime:
- `Helpers.ai()` resolves `sample` (`claude.use("sample")`) or `null`.
- `Helpers.askJSON(prompt, {images, signal, tier})` asks for JSON and maps every error code to plain viewer copy.
- When Claude is not available (a downloaded copy, GitHub Pages, or the viewer declined), the main button becomes
  **Copy as prompt**. It copies the exact prompt the tool would send, and links to claude.ai so the person can paste it
  into any chat. Photos cannot travel this way, so the page says "attach your photo in the chat".
- Every prompt is built by one pure function `buildPrompt(state)` per tool, so the live call and the copied prompt are
  identical.

**Answer language.** Every tool has an "Answer in" picker: English, Deutsch, Français, Español, Italiano, Português,
Türkçe, Polski, Українська, Русский, العربية, فارسی. Output elements use `dir="auto"` so Arabic and Persian read
right to left. The choice is remembered in browser storage (try/catch).

**Privacy.** Nothing is stored on a server. The text and photos a person adds go to Claude on their own account, only
when they press the button; the page says so next to the button. Pages never ask for ID numbers, bank logins or
passwords, and tell people to black out account numbers on photos.

**Not advice.** Tools that touch law, money or health end with one plain line: what the tool cannot judge and where to
get real help (a lawyer, a consumer advice centre, a doctor), without naming specific organisations as endorsements.

**Look.** One family of pages with a shared stylesheet (`tools/shared.css`): soft grey-green paper, deep pine ink,
Bricolage Grotesque for headings, Atkinson Hyperlegible for text (built for legibility, which suits people reading in a
second language). Each tool sets one accent colour. Light and dark themes, works at 375 px, visible keyboard focus,
reduced motion respected.

**Files.** `tools/<slug>.html` plus the shared `tools/shared.css` and `tools/shared.js`. No build step, no framework.
When published as an artifact, the shared files are published alongside the page.

## The seven tools

### 1. Letter Helper (`letter-helper.html`, accent: ink blue)
For official letters: tax office, health insurance, job centre, landlord, immigration office, bank, court, utilities.
- Input: paste the text, or add up to 4 photos of the pages. Country (default Germany). Answer language.
- Output (JSON from Claude, rendered as cards):
  - **In one sentence:** what the letter is.
  - **Who sent it** and **what kind** (bill, reminder, decision, request for documents, information only, other).
  - **Urgency:** act now / act soon / for your information, as a coloured label.
  - **What you need to do:** numbered steps, each with a deadline if the letter gives one.
  - **Deadline:** the date, and days left, computed by the page from today's date.
  - **Money:** amounts, what they are for, how to pay.
  - **If you do nothing:** the stated or usual consequence.
  - **Documents to prepare.**
  - **Words explained:** hard terms from the letter with plain meanings.
  - **Check it is real:** warning signs of a scam letter, if any (unusual payment method, pressure, odd sender).
  - **Draft reply:** in the letter's language, with a translation in the answer language; copy buttons for both.
- Extra: **Add deadline to calendar** saves an .ics file (downloads capability).
- Capabilities: `sample` with images, `downloads`.

### 2. Fridge to Dinner (`fridge-to-dinner.html`, accent: tomato red)
- Input: ingredients as chips (type and press Enter) or a photo of the fridge or shelf; "use first" chips for things
  about to go off; time (15 / 30 / 45 / 60 min); servings; diet (vegetarian, vegan, halal, no pork, gluten free,
  lactose free); equipment (stove, oven, microwave only); skill (beginner / confident).
- Output: three recipes. Each: name, time, difficulty, what it uses from your list, what you would need to buy (if
  anything), steps, one tip. Recipes that use the "use first" items come first.
- Second mode, **Plan my week:** five dinners that share ingredients, and one shopping list grouped by shop section,
  with a copy button.
- Capabilities: `sample` with images.

### 3. Contract Checker (`contract-checker.html`, accent: amber)
For phone, internet, electricity, gas, gym, streaming, insurance contracts and their bills.
- Input: paste text or photos; country; the date the contract started if the person knows it.
- Output: provider, product, monthly price now and after any promotion, one-off fees, start date, minimum term,
  notice period, renewal rule, **next date you can cancel by** (computed in the page from the extracted dates, with the
  working shown), anything unusual or expensive, questions to ask the provider.
- **Cancellation letter:** a ready letter in the provider's language with the person's details as placeholders
  ([Your name], [Customer number]), how to send it (the contract's stated channel), and a copy button.
- **Remind me:** an .ics reminder two weeks before the cancel-by date.
- Germany note in the prompt: consumer contracts signed from March 2022 renew to month-by-month after the minimum term;
  the tool says "check" rather than asserting the law applies.
- Capabilities: `sample` with images, `downloads`.

### 4. Call Prep (`call-prep.html`, accent: teal)
For phone calls in a second language: booking a doctor, calling the landlord, the job centre, a school.
- Input: what you need from the call (one sentence), who you are calling, the call's language (default German), your
  level (A1 to C2), details you may be asked for (shown as a checklist, not sent anywhere).
- Output: what to have ready; the opening line; the call as a script (your lines and the likely replies, each with a
  translation); useful phrases when you do not understand; how to end the call; key words.
- **Hear it:** a speaker button on each of your lines reads it aloud in the call's language (tts capability), so
  people can practise pronunciation.
- **Practise:** a short role-play chat where Claude plays the other side, in simple language at the chosen level; it
  ends with three kind tips.
- Capabilities: `sample`, `tts`.

### 5. Money Snapshot (`money-snapshot.html`, accent: green)
- Input: a bank statement CSV export (most German and international formats: comma or semicolon, dot or comma
  decimals, the common column names). Parsing happens in the page; nothing is sent until the person asks.
- Output, computed in the page: money in, money out, balance change; spending by category (rule-based categories from
  the payee and text, which the person can change per payee); recurring payments (same payee, similar amount, monthly
  or yearly), with the yearly cost; the largest one-off spends.
- **Ask Claude for tips:** sends only the category totals and the recurring list (no IBANs, no names of people) and
  returns three concrete saving ideas.
- Opens on clearly marked example data. Works fully without Claude except the tips.
- Capabilities: `sample`.

### 6. Say It Simply (`say-it-simply.html`, accent: violet)
Two modes:
- **Understand:** paste any hard text (an email from work, a school notice, terms, a medical letter). Choose the answer
  language and the level (very simple / simple / normal). Output: the text rewritten plainly, the main points, what it
  asks of you, and hard words explained.
- **Write:** type what you want to say, roughly, in any language. Choose who it is for (official office, landlord,
  employer, teacher, friend), the language it should be in and the tone (polite / firm / friendly). Output: the
  message ready to send, plus a translation so you know what it says.
- Capabilities: `sample`.

### 7. Decision Helper (`decision-helper.html`, accent: indigo)
- Step 1: describe the decision and list 2 to 4 options.
- Step 2: Claude asks up to five short questions that matter for this choice; the person answers.
- Step 3: Claude proposes criteria with weights and scores each option 1 to 5 per criterion, with a reason. The page
  computes the weighted totals and redraws them live as the person moves the weight sliders (no new Claude call).
- Also shown: what would change the answer, the regret test ("in five years, which would you regret not trying?"), and
  the smallest next step for the leading option.
- Capabilities: `sample`.

## Order of work

Letter Helper first (it sets `shared.css` and `shared.js`), then the other six. Each is checked at desktop and phone
width in both themes, published as an artifact, and added to the repository README with its link.
