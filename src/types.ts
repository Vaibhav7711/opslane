export type Severity = 'SEV-1' | 'SEV-2' | 'SEV-3'
export type IncidentStatus = 'Investigating' | 'Mitigating' | 'Monitoring' | 'Resolved'

export interface Incident {
  id: string
  title: string
  service: string
  severity: Severity
  status: IncidentStatus
  owner: string
  elapsedMinutes: number
  customerImpact: number
  acknowledged: boolean
  update: string
}

export interface Service {
  name: string
  uptime: number
  latency: number
  change: number
  state: 'Healthy' | 'Degraded' | 'Critical'
  spark: number[]
}

export interface TimelinePoint {
  time: string
  latency: number
  errors: number
  requests: number
}
