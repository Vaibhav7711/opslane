# Opslane product plan

## User and outcome

An on-call engineer needs to record an incident, coordinate its investigation, and review a trustworthy history afterwards. Opslane is a local-first demonstration; it does not monitor production services or notify a team.

## Screens and workflows

- Overview: counts and response-time statistics calculated from incident records, with recent activity and links to the queue.
- Incidents: searchable, filterable, sortable list and a form to declare an incident.
- Incident detail: direct URL, editable fields, acknowledgement, resolution and reopening actions, and an append-only timeline of updates and state changes.
- Services: create and edit service records, show incident-derived status, and link to associated incidents. Prevent deleting a service that is referenced by an incident.
- Data: export a versioned JSON backup and validate imports before replacing local data.

## Model and behavior

Incidents have stable identifiers, a title, description, severity, lifecycle status, owner, affected service identifiers, created/acknowledged/resolved timestamps, and timeline entries. Reopening clears the current resolution timestamp and adds a timeline entry. Metrics exclude records without the timestamps needed to calculate them. Existing mock telemetry must be removed rather than presented as live information.

Use a versioned local storage document with validation and explicit recovery for corrupt data. Browser storage is device-local, can be cleared, and is not a synchronization service. Tests should cover transitions, metrics, validation, and import/export; browser tests should cover the primary incident and service flows.
