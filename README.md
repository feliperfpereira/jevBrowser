# jevBrowser

A small browser task runner where **Playwright controls the browser** and **TypeSafe AI / Jev makes constrained semantic decisions**.

The input is intentionally simple:

```json
{
  "url": "https://example.com",
  "task": "Search for \"mechanical keyboard\" and open the first relevant result"
}
```

The agent observes the page, sends a compact state to TypeSafe, receives typed decisions (`Choice` + `Noul`), executes one deterministic Playwright action, and repeats until the task is complete or a safety/verification boundary is reached.

## Why this architecture

TypeSafe is used for what it is good at: fast decisions over fixed alternatives. It does **not** generate arbitrary browser commands or selectors. Playwright owns navigation, locators, waits and side effects.

Each step batches several independent judgments into one `systemOne` call:

- is the task complete?
- is progress blocked?
- is the next step high-impact?
- what action should happen next?
- which element should be clicked/filled?
- which supplied value or select option should be used?

The page state contains a Playwright ARIA snapshot in `mode: "ai"`, visible page text and a capped list of actionable elements. Raw HTML is not sent.

## Requirements

- Node.js 20+
- a TypeSafe API key
- Chromium installed by Playwright

## Install

```bash
npm install
npm run install-browser
cp .env.example .env
```

Set the API key in your shell or `.env` loader of choice:

```bash
export TYPESAFE_API_KEY="..."
```

`jevBrowser` itself does not load `.env` files automatically, keeping runtime dependencies minimal.

## CLI

```bash
npm run dev -- run \
  https://example.com \
  'Search for "mechanical keyboard" and open the first relevant result'
```

Pass values that the browser may need to fill:

```bash
npm run dev -- run \
  https://example.com/login \
  'Sign in with the provided email and password' \
  --var email=me@example.com \
  --var password='secret'
```

Values supplied through `--var` stay local to the executor. The TypeSafe state only contains the variable name/description, not its secret value. Literal strings already present in the task (quoted text, emails and URLs) may also become fill candidates.

Useful options:

```text
--headed                  show Chromium
--max-steps 30            override the step limit
--allow-dangerous         permit high-impact actions that are blocked by default
--var key=value           provide a fill value; repeatable
```

## HTTP API

Start the server:

```bash
npm run dev -- serve --port 8787
```

Run a task:

```bash
curl -X POST http://127.0.0.1:8787/run \
  -H 'content-type: application/json' \
  -d '{
    "url": "https://example.com",
    "task": "Search for \"mechanical keyboard\" and open the first relevant result",
    "maxSteps": 20
  }'
```

Health check:

```bash
curl http://127.0.0.1:8787/health
```

## Result statuses

- `completed` — TypeSafe judges the task complete.
- `blocked` — CAPTCHA, MFA, missing user-only data or unsupported interaction detected.
- `requires_confirmation` — the next step appears high-impact and `allowDangerous` was not enabled.
- `max_steps` — the configured step budget was exhausted.
- `failed` — navigation, execution or decision failed.

Every result includes a compact step trace with action/target confidence and completion/block/risk probabilities.

## Safety boundary

By default the runner stops before controls that look like final purchase/payment, money transfer, deletion, publishing/sending content, booking/reservation or account closure. TypeSafe also independently estimates whether the immediate next step is high-impact. Set `allowDangerous: true` only when the caller is intentionally authorizing those effects.

## Configuration

Environment variables:

```text
TYPESAFE_API_KEY
TYPESAFE_MODEL=jev-latest
JEV_BROWSER_HEADLESS=true
JEV_BROWSER_MAX_STEPS=20
JEV_BROWSER_MAX_ELEMENTS=90
JEV_BROWSER_MAX_PAGE_TEXT_CHARS=12000
JEV_BROWSER_MAX_ARIA_CHARS=18000
JEV_BROWSER_NAV_TIMEOUT_MS=20000
JEV_BROWSER_ACTION_TIMEOUT_MS=8000
JEV_BROWSER_SETTLE_MS=250
JEV_BROWSER_COMPLETION_THRESHOLD=0.92
JEV_BROWSER_BLOCKED_THRESHOLD=0.92
JEV_BROWSER_DANGEROUS_THRESHOLD=0.82
JEV_BROWSER_MIN_ACTION_CONFIDENCE=0.22
JEV_BROWSER_MIN_TARGET_CONFIDENCE=0.18
JEV_BROWSER_PORT=8787
```

Thresholds are defaults, not universal truth. Calibrate them against your own task suite before production use.

## Current supported actions

```text
click
fill
select
scroll_down
scroll_up
back
wait
finish
fail
```

The runner intentionally executes one action per observation/decision cycle. That makes failures observable and keeps side effects deterministic.

## Current limitations

This first version is deliberately small:

- no arbitrary text generation; fill values must come from caller variables or literals already present in the task;
- no screenshot/vision model path;
- no dedicated CAPTCHA solver;
- main-frame DOM actions are the primary path; complex iframe/canvas apps may need additional adapters;
- a fresh Chromium process/context is created for each run; a browser/context pool is the next optimization for a high-throughput service;
- no persistent login/session storage yet.

## Next performance step

Keep the `PlaywrightDriver` boundary and add another driver/backend for Lightpanda via CDP. That lets compatible sites run on a much lighter browser while retaining Chromium as a fallback. A server-side browser pool can then reuse processes across requests.

## Development

```bash
npm test
npm run build
```

Project layout:

```text
src/
  agent/
    runner.ts          controlled observe/decide/execute loop
    utils.ts           value candidates and safety helpers
  browser/
    playwright-driver.ts
  typesafe/
    decision-engine.ts batched TypeSafe questions
  config.ts
  server.ts
  index.ts
  types.ts
```

## References

- TypeSafe AI quick start: https://docs.typesafe.ai/introduction/quickstart
- TypeSafe JavaScript SDK: https://docs.typesafe.ai/sdk/javascript
- TypeSafe primitives: https://docs.typesafe.ai/primitives
- Playwright Page API (`ariaSnapshotJSON`): https://playwright.dev/docs/api/class-page
