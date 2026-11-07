# FlowPilot

FlowPilot is a Google Apps Script workflow and knowledge-management project, presented as an interactive, browser-only portfolio demo.

## Live demo

**[Open FlowPilot](https://vlabarile3-sys.github.io/FlowPilot-Portfolio/)**

## Demo behavior

- Uses fictional sample records and runs locally in the browser.
- Preserves the original FlowPilot interface, UX, and CSS.
- Stores interactions in memory; refreshing resets changes.
- Does not connect to Google Sheets, Gmail, Drive, or an Apps Script deployment.

## Source modules

The supplied anonymized Apps Script modules are available in [`flowpilot-source.zip`](./flowpilot-source.zip). The source includes backend automations; do not deploy those modules publicly or run them against personal or production accounts.

The demo page is `index.html`. `demo-bridge.js` simulates Apps Script calls in memory. `build-demo.mjs` regenerates the page from the modules in `source/`.

To rebuild locally, extract the archive into a `source/` directory, then run:

```sh
node build-demo.mjs
python -m http.server 8767
```

Open `http://localhost:8767/`.
