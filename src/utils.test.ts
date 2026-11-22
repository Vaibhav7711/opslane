import { describe, expect, it } from 'vitest'
import { calculateSlaRisk, filterIncidents, formatDuration } from './utils'
import { initialIncidents } from './data'

describe('incident utilities', () => {
  it('formats incident duration for minutes and hours', () => {
    expect(formatDuration(38)).toBe('38m')
    expect(formatDuration(128)).toBe('2h 8m')
  })

  it('assigns higher risk to the critical payment incident', () => {
    expect(calculateSlaRisk(initialIncidents[0])).toBeGreaterThan(calculateSlaRisk(initialIncidents[3]))
  })

  it('filters across service metadata and severity', () => {
    expect(filterIncidents(initialIncidents, 'identity', 'All')).toHaveLength(1)
    expect(filterIncidents(initialIncidents, '', 'SEV-2')).toHaveLength(2)
  })
})
