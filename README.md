# UniHub Portfolio Demo

**[Open the live demo](https://vlabarile3-sys.github.io/UniHub/)**

UniHub is an interactive, browser-only portfolio demo of a workflow and knowledge-management application.

## What to explore

- The original interface, UX, and CSS, rendered as a static web app.
- Fictional sample guides, schedules, InfoCards, shortcuts, and announcements.
- Local-only interactions: changes are kept in memory and reset on refresh.
- No connection to Google Sheets, Gmail, Drive, or an Apps Script deployment.

## Browse the project

- [`index.html`](./index.html) - deployable web demo.
- [`demo-bridge.js`](./demo-bridge.js) - fictional records and local Apps Script mock.
- [`build-demo.mjs`](./build-demo.mjs) - builds the demo from the source modules.
- [`source/`](./source/) - browse the supplied modules directly on GitHub.
- [`flowpilot-source.zip`](./flowpilot-source.zip) - download the supplied modules.

The source includes backend automations for Google services. Do not deploy or run those modules against personal or production accounts without reviewing their permissions and behavior. GitHub Pages serves only the static browser demo; it does not execute the Apps Script backend.

## Run locally

Requires Node.js. From this folder:

```sh
node build-demo.mjs
python -m http.server 8767
```

Open `http://localhost:8767/`.
