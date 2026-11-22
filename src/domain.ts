export type Status = 'Investigating' | 'Mitigating' | 'Monitoring' | 'Resolved'
export type Severity = 'SEV-1' | 'SEV-2' | 'SEV-3'
export interface Update { id: string; at: string; text: string }
export interface Incident { id: string; title: string; description: string; severity: Severity; status: Status; owner: string; serviceId: string; createdAt: string; acknowledgedAt: string | null; resolvedAt: string | null; timeline: Update[] }
export interface Service { id: string; name: string; description: string }
export interface Database { version: 1; incidents: Incident[]; services: Service[] }

const now = Date.now()
const ago = (minutes: number) => new Date(now - minutes * 60000).toISOString()
export const seed: Database = { version: 1, services: [
  { id: 'payments', name: 'Payments API', description: 'Checkout and payment processing' },
  { id: 'identity', name: 'Identity', description: 'Authentication and sessions' },
  { id: 'search', name: 'Search', description: 'Product discovery and indexing' },
], incidents: [
  { id: 'inc-2481', title: 'Elevated checkout failures', description: 'Some customers cannot complete checkout.', severity: 'SEV-1', status: 'Mitigating', owner: 'Aarav Mehta', serviceId: 'payments', createdAt: ago(75), acknowledgedAt: ago(70), resolvedAt: null, timeline: [{ id: 'u1', at: ago(30), text: 'Traffic shifted to the secondary processor.' }] },
  { id: 'inc-2479', title: 'Search indexing delay', description: 'New products are appearing late in search.', severity: 'SEV-2', status: 'Monitoring', owner: 'Meera Shah', serviceId: 'search', createdAt: ago(180), acknowledgedAt: ago(170), resolvedAt: null, timeline: [{ id: 'u2', at: ago(45), text: 'Backlog cleared; monitoring freshness.' }] },
  { id: 'inc-2472', title: 'Session timeout spike', description: 'Elevated timeouts after deployment.', severity: 'SEV-2', status: 'Resolved', owner: 'Noah Kim', serviceId: 'identity', createdAt: ago(1440), acknowledgedAt: ago(1435), resolvedAt: ago(1380), timeline: [{ id: 'u3', at: ago(1380), text: 'Deployment rolled back; error rate recovered.' }] },
] }
export const id = () => crypto.randomUUID()
export function transition(incident: Incident, action: 'acknowledge' | 'resolve' | 'reopen', at = new Date().toISOString()): Incident {
  if (action === 'acknowledge' && incident.acknowledgedAt) return incident
  if (action === 'resolve' && incident.status === 'Resolved') return incident
  if (action === 'reopen' && incident.status !== 'Resolved') return incident
  const text = action === 'acknowledge' ? 'Incident acknowledged.' : action === 'resolve' ? 'Incident resolved.' : 'Incident reopened.'
  return { ...incident, acknowledgedAt: action === 'acknowledge' ? at : incident.acknowledgedAt, status: action === 'resolve' ? 'Resolved' : action === 'reopen' ? 'Investigating' : incident.status, resolvedAt: action === 'resolve' ? at : action === 'reopen' ? null : incident.resolvedAt, timeline: [...incident.timeline, { id: id(), at, text }] }
}
export function metrics(incidents: Incident[]) {
  const average = (values: number[]) => values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length / 60000) : null
  return { open: incidents.filter(i => i.status !== 'Resolved').length, critical: incidents.filter(i => i.status !== 'Resolved' && i.severity === 'SEV-1').length, acknowledge: average(incidents.filter(i => i.acknowledgedAt).map(i => Date.parse(i.acknowledgedAt!) - Date.parse(i.createdAt)).filter(n => n >= 0)), resolution: average(incidents.filter(i => i.resolvedAt).map(i => Date.parse(i.resolvedAt!) - Date.parse(i.createdAt)).filter(n => n >= 0)) }
}
export function validDatabase(value: unknown): value is Database {
  if (!value || typeof value !== 'object') return false
  const v = value as Database
  return v.version === 1 && Array.isArray(v.services) && Array.isArray(v.incidents) && v.services.every(s => typeof s.id === 'string' && typeof s.name === 'string' && typeof s.description === 'string') && v.incidents.every(i => typeof i.id === 'string' && typeof i.title === 'string' && typeof i.description === 'string' && typeof i.owner === 'string' && v.services.some(s => s.id === i.serviceId) && ['SEV-1','SEV-2','SEV-3'].includes(i.severity) && ['Investigating','Mitigating','Monitoring','Resolved'].includes(i.status) && !Number.isNaN(Date.parse(i.createdAt)) && Array.isArray(i.timeline) && i.timeline.every(u => typeof u.id === 'string' && typeof u.text === 'string' && !Number.isNaN(Date.parse(u.at))) && (i.acknowledgedAt === null || !Number.isNaN(Date.parse(i.acknowledgedAt))) && (i.resolvedAt === null || !Number.isNaN(Date.parse(i.resolvedAt))))
}
