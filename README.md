# Opslane

Opslane is a production-style incident response command center built for engineering teams. It combines live service telemetry, incident triage, SLA risk scoring, and operational workflows in one responsive interface.

## Highlights

- Live telemetry simulation with pause/resume controls
- Searchable and severity-filtered incident queue
- Explainable SLA risk score based on severity, duration, and customer impact
- Persistent acknowledgement state using `localStorage`
- Keyboard-accessible command palette (`⌘/Ctrl + K`)
- Responsive operations dashboard with accessible reduced-motion support
- Unit-tested domain utilities and automated GitHub Pages deployment

## Stack

React · TypeScript · Vite · Recharts · Lucide · Vitest · GitHub Actions

## Run locally

```bash
npm install
npm run dev
```

```bash
npm test
npm run build
```

## Architecture notes

The UI treats incident scoring, formatting, and filtering as domain functions independent from React. This keeps operational rules deterministic and testable. Seed data is isolated from the view layer, while transient telemetry and durable acknowledgement state are managed separately.

## Resume bullet

> Built a responsive incident command center in React and TypeScript with simulated live telemetry, explainable SLA risk scoring, persistent workflows, keyboard navigation, unit tests, and CI/CD to GitHub Pages.
