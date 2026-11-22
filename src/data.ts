import type { Incident, Service, TimelinePoint } from './types'

export const initialIncidents: Incident[] = [
  {
    id: 'INC-2481', title: 'Elevated checkout failures', service: 'Payments API', severity: 'SEV-1',
    status: 'Mitigating', owner: 'Aarav M.', elapsedMinutes: 38, customerImpact: 18.4,
    acknowledged: false, update: 'Traffic shifted to the secondary processor. Error rate is trending down.',
  },
  {
    id: 'INC-2479', title: 'Search indexing delay', service: 'Search', severity: 'SEV-2',
    status: 'Monitoring', owner: 'Meera S.', elapsedMinutes: 74, customerImpact: 6.2,
    acknowledged: true, update: 'Backlog cleared. Watching index freshness for another 20 minutes.',
  },
  {
    id: 'INC-2478', title: 'Intermittent auth timeouts', service: 'Identity', severity: 'SEV-2',
    status: 'Investigating', owner: 'Noah K.', elapsedMinutes: 23, customerImpact: 3.8,
    acknowledged: false, update: 'Correlating timeout spikes with the latest connection pool change.',
  },
  {
    id: 'INC-2472', title: 'Delayed webhook delivery', service: 'Events', severity: 'SEV-3',
    status: 'Resolved', owner: 'Lina P.', elapsedMinutes: 128, customerImpact: 1.1,
    acknowledged: true, update: 'Queue consumers scaled and delayed events have been delivered.',
  },
]

export const services: Service[] = [
  { name: 'Payments API', uptime: 99.91, latency: 482, change: 21, state: 'Critical', spark: [22, 25, 24, 28, 31, 46, 52, 49] },
  { name: 'Identity', uptime: 99.97, latency: 218, change: 8, state: 'Degraded', spark: [18, 17, 19, 18, 21, 25, 23, 27] },
  { name: 'Search', uptime: 99.99, latency: 124, change: -4, state: 'Healthy', spark: [16, 18, 15, 17, 14, 13, 15, 12] },
  { name: 'Events', uptime: 100, latency: 86, change: -12, state: 'Healthy', spark: [20, 19, 17, 16, 15, 14, 12, 11] },
]

export const timeline: TimelinePoint[] = [
  { time: '09:00', latency: 118, errors: 0.8, requests: 620 },
  { time: '09:30', latency: 132, errors: 1.1, requests: 690 },
  { time: '10:00', latency: 145, errors: 1.4, requests: 760 },
  { time: '10:30', latency: 176, errors: 2.2, requests: 820 },
  { time: '11:00', latency: 268, errors: 4.9, requests: 890 },
  { time: '11:30', latency: 412, errors: 8.2, requests: 940 },
  { time: '12:00', latency: 482, errors: 7.4, requests: 910 },
  { time: '12:30', latency: 371, errors: 5.1, requests: 870 },
  { time: '13:00', latency: 286, errors: 3.2, requests: 850 },
]
