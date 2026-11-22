import type { Incident, Severity } from './types'

const severityWeight: Record<Severity, number> = { 'SEV-1': 3, 'SEV-2': 2, 'SEV-3': 1 }

export function calculateSlaRisk(incident: Incident): number {
  const timePressure = Math.min(incident.elapsedMinutes / 90, 1)
  const impactPressure = Math.min(incident.customerImpact / 20, 1)
  const severityPressure = severityWeight[incident.severity] / 3
  return Math.round((timePressure * 0.35 + impactPressure * 0.35 + severityPressure * 0.3) * 100)
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

export function filterIncidents(incidents: Incident[], query: string, severity: string): Incident[] {
  const needle = query.trim().toLowerCase()
  return incidents.filter((incident) => {
    const matchesSeverity = severity === 'All' || incident.severity === severity
    const matchesQuery = !needle || [incident.title, incident.id, incident.service, incident.owner]
      .some((field) => field.toLowerCase().includes(needle))
    return matchesSeverity && matchesQuery
  })
}
