import { describe, expect, it } from 'vitest'
import { metrics, seed, transition, validDatabase } from './domain'

describe('incident lifecycle', () => {
  it('records acknowledgement, resolution and reopening in the timeline', () => {
    const start = { ...seed.incidents[0], acknowledgedAt: null }
    const ack = transition(start, 'acknowledge', '2026-01-01T00:00:00.000Z')
    expect(ack.acknowledgedAt).toBe('2026-01-01T00:00:00.000Z')
    expect(transition(ack, 'acknowledge')).toBe(ack)
    const resolved = transition(ack, 'resolve', '2026-01-01T01:00:00.000Z')
    const reopened = transition(resolved, 'reopen', '2026-01-01T02:00:00.000Z')
    expect(reopened.status).toBe('Investigating')
    expect(reopened.resolvedAt).toBeNull()
    expect(reopened.timeline).toHaveLength(start.timeline.length + 3)
  })
  it('derives metrics and rejects invalid backups', () => {
    expect(metrics(seed.incidents).open).toBe(2)
    expect(metrics(seed.incidents).critical).toBe(1)
    expect(validDatabase(seed)).toBe(true)
    expect(validDatabase({ version: 1, services: [], incidents: seed.incidents })).toBe(false)
  })
})
