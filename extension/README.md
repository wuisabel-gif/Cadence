# Cadence — Chrome extension

Score any text for AI tone, and get a live assistant right in your compose box —
in Gmail, WhatsApp Web, Telegram, LinkedIn, Instagram and Facebook. The detector is
bundled, so scoring runs on your machine: no account, no network, nothing leaves the
page.

## Try it now (load unpacked)

1. From the repo root, build the assets: `npm run build:extension`
2. Open `chrome://extensions` and turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this `extension/` folder.

Then two things work:

- **Anywhere** — click the Cadence icon and paste prose to see the score and every
  named tell, or select text on a page, right-click, and choose **Score with
  Cadence**.
- **In a compose box** — Gmail, WhatsApp Web, Telegram, LinkedIn or Instagram — start
  a reply. A small Cadence panel appears by the compose box.

## What the in-page assistant does

- **Impression check.** As you type, it scores the draft 0–100 and names the AI
  tells — banned phrases, hollow-confidence words, triads, uniform rhythm. This is
  the same deterministic detector the CLI uses, run locally. Nothing is sent.
- **Draft in my voice.** One click drafts a reply. The background worker calls the
  Claude API with your own key and your voice sample, then runs the Cadence loop:
  it scores the draft locally, and if the writing still reads as AI, it hands the
  model the exact tells and redrafts, keeping the better version. The button
  reports the final grade.
  - **It reads the thread.** The draft is grounded in the last several messages of
    the open conversation (labeled you/them), so it can use the names, plans, and
    shared details already there. Type a short note or an occasion — "happy
    birthday", "congrats on the new job" — and it writes the whole message to fit
    that relationship, without inventing facts the thread doesn't contain.
  - **Where the thread can't be read** (Instagram and Facebook obfuscate their DM
    markup) the panel shows a small box to paste the recent messages into. Paste
    is optional; anything you paste becomes the context the draft is built on.
- **Learn my voice.** A "Learn my voice" button reads what you've written on the page
  you're looking at — your posts on Instagram, Facebook or LinkedIn, or your own sent
  messages on WhatsApp and Telegram — and distills your sentence-usage traits (rhythm,
  diction, habits) into a voice profile it saves for you. It reads only what's
  visible; it doesn't scrape via any API.

## Settings

Right-click the extension → **Options**, or open it from the panel's prompt. Paste
your Anthropic API key (get one at `console.anthropic.com`) and, optionally, a few
of your own messages as a voice sample. Both are stored only in this browser. The
key lives in the background worker and never enters the page.

## Privacy, honestly

The **score is on-device** — always. **Drafting** is the one step that leaves your
machine: it's a direct request to Anthropic with your key when you click the
button. The options copy says so plainly.

## Adding a surface

Each site is a small adapter in `assistant.js` — a compose selector, a way to read
the thread, and an insert strategy. Six ship today: Gmail, WhatsApp Web, Telegram,
LinkedIn, Instagram and Facebook. Adding another is about ten lines plus a `matches`
entry in `manifest.json`. Site selectors are DOM-dependent and may need a nudge when
a site ships a redesign.

## How the detector stays honest

The detector in `detector.js` is **generated from the same `deslop.mjs`** the CLI
and the Claude Code plugin use, so it can't drift. Regenerate it any time with
`npm run build:extension`; a test fails if the two ever disagree.

## Publishing (optional)

To put it on the Chrome Web Store you need a one-time $5 developer account; then zip
this folder and upload it. Not required to use it yourself.
