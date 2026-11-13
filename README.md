# UniHub Portfolio Demo
## About the project

UniHub is a centralized workspace for organizing team schedules, shared resources, and operational knowledge. It brings scheduling, knowledge publishing, and workflow configuration together in one interface, helping teams find information and coordinate their work.

### Key capabilities

- Explore the master schedule and task-assignment interface.
- Browse shared guides, checklists, shortcuts, and other resources.
- Create and review InfoCards for sharing knowledge across workflows.
- Explore workflow configuration and operational tools using sample content.

The GitHub Pages version is a browser-only portfolio demo with fictional data. Its changes stay in memory and reset on refresh; it does not connect to Google services. The included Apps Script source contains separate backend automations and should be reviewed before deployment.


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
