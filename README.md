# Opslane

A local-first incident management workspace for practicing the full response lifecycle. [Live demo](https://vaibhav7711.github.io/opslane/) · [Repository](https://github.com/Vaibhav7711/opslane)

## What it does

- Declare and edit incidents with severity, owner, service, status, description and timestamp.
- Acknowledge, resolve and reopen incidents; add updates to an incident timeline.
- Search, filter and sort the incident queue. Each incident has a direct hash URL within the current browser's data.
- Create and edit services, review their incidents, and see status derived from open incidents. Referenced services cannot be deleted.
- View open and critical counts and average acknowledgement and resolution durations calculated from stored records.
- Export, validate and import a versioned JSON backup; reset the demo workspace.

## Run locally

```bash
npm ci
npm run dev
```

Run `npm run lint`, `npm test`, and `npm run build` for the checks used by CI. The project uses React, TypeScript, Vite, Vitest, and GitHub Actions. Pushes to `main` deploy to GitHub Pages.

## Architecture and limitations

`src/domain.ts` contains the data types, lifecycle transitions, metrics and backup validation; the React view keeps presentation and form state in `src/App.tsx`. Data is stored in localStorage under a versioned key. The initial records are examples. The app is not connected to monitoring, alerts, authentication or a backend; it does not synchronize between browsers or users. Browser data can be cleared, so export a backup. A direct incident link works only where that record exists in local storage.

Potential next steps include server-backed collaboration, service ownership, richer audit history, end-to-end automated browser tests, and accessible focus management for dialogs.

## Local incident desk prototype

The incident desk is a separate, experimental Node/SQLite service; it does not replace or import the browser-local workspace. Node 22.5 or later is required. Set three distinct random tokens of at least 24 characters in `OPSLANE_RESPONDER_TOKEN`, `OPSLANE_VIEWER_TOKEN`, and `OPSLANE_MONITOR_TOKEN`, and set `OPSLANE_ORIGIN` to the exact development server origin. Run `npm run server` and `npm run dev` in separate terminals. Open **Incident desk (local API)**, connect using the responder token, and send the synthetic alert with the monitoring token. In a second browser window, open the incident's URL and connect using the viewer or responder token. The API is bound to loopback and uses plaintext HTTP, shared role tokens, and self-reported actor names: it is a local demonstration, not a production identity system. Do not use real credentials or expose it to an untrusted network.

The SQLite store serializes alert delivery and revision checks in transactions. A repeated delivery ID returns the existing incident; a new delivery for an open issue appends an event. A stale write returns the current incident and leaves the draft in the client. Resolution and reopening are separate events, so the earlier resolution remains visible. `server/api.test.js` exercises simultaneous duplicate deliveries and viewer API denial; `server/store.test.js` covers revision conflicts and event history. The desk currently polls complete incident state and does not yet implement the requested review, metric drilldowns, durable offline drafts, or production hosting.

## PostgreSQL prototype

The `codex/postgres-integration` branch also contains a separate PostgreSQL implementation. It is not connected to the current public Pages site. It uses Node and the existing backend architecture, not FastAPI. Set `DATABASE_URL` and `OPSLANE_CREDENTIALS` in the environment, then run `npm run server:postgres`; the server applies the initial schema and provisions the named demo workspaces and inference service. `OPSLANE_CREDENTIALS` is a JSON array of objects with distinct random `token`, `workspace`, `role` (`monitor`, `viewer`, `responder`, or `admin`), and optional `actor`. Set `OPSLANE_ORIGIN` to the exact frontend origin; set `VITE_OPSLANE_API_URL` at frontend build time if the API is not on `http://127.0.0.1:8787`. Tokens belong in server environment configuration, not source control or public frontend assets.

Example alert after configuration (replace the placeholder with a monitoring token):

```sh
curl -X POST http://127.0.0.1:8787/api/v1/alerts \
  -H 'Authorization: Bearer MONITOR_TOKEN' -H 'Content-Type: application/json' \
  -d '{"deliveryId":"example-1","fingerprint":"ttft-rollout","title":"TTFT spike","serviceId":"inference","severity":"SEV-1","impact":"First token latency elevated","text":"Synthetic alert fired"}'
```

The GitHub Actions `postgres-integration` job runs against PostgreSQL 17 without requiring a local database. The implementation is still a prototype: it lacks a complete migrations framework, backup import, production authentication and hosting, full pagination integration in the UI, and a tested public connected demo. Do not deploy it as a production security boundary without further review.
