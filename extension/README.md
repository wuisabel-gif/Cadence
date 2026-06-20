# Cadence — Chrome extension

Score any text for AI tone, right in your browser. The detector is bundled, so it
runs entirely on your machine — no account, no network, nothing leaves the page.

## Try it now (load unpacked)

1. From the repo root, build the assets: `npm run build:extension`
2. Open `chrome://extensions` and turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this `extension/` folder.
4. Click the Cadence icon in the toolbar — paste prose and watch the score and the
   named tells update as you type. Or select text on any page, right-click, and
   choose **Score with Cadence**.

## What it does

- Scores text 0–100 and names every AI tell — banned phrases, hollow-confidence
  words, reflexive triads, negation pivots, cliché openers.
- Flags the rhythm-variance metric (`CV`), the strongest tell of all.
- The detector in `detector.js` is **generated from the same `deslop.mjs`** the CLI
  and the Claude Code plugin use, so it can't drift. Regenerate it any time with
  `npm run build:extension`; a test fails if the two ever disagree.

This is the *detector* half of Cadence. Rewriting in a chosen voice needs an LLM and
lives in the Claude Code plugin (see the main [README](../README.md)).

## Publishing (optional)

To put it on the Chrome Web Store you need a one-time $5 developer account; then zip
this folder and upload it. Not required to use it yourself.
