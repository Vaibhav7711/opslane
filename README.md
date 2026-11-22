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
