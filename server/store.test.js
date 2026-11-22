import { describe, expect, it } from 'vitest'
import { createStore } from './store.mjs'

describe('incident event store', () => {
  it('deduplicates deliveries, updates an ongoing issue, and preserves resolution history', () => {
    const store=createStore()
    const alert={ deliveryId:'delivery-1', issueKey:'ttft-rollout', title:'TTFT spike', service:'Inference', severity:'SEV-1', impact:'TTFT elevated', text:'Rollout triggered alert' }
    const first=store.monitor(alert); const retry=store.monitor(alert)
    expect(retry.duplicate).toBe(true)
    expect(retry.incident.id).toBe(first.incident.id)
    const next=store.monitor({...alert,deliveryId:'delivery-2',text:'TTFT still elevated'})
    expect(next.incident.id).toBe(first.incident.id)
    expect(next.incident.events).toHaveLength(2)
    const stale=next.incident.version
    const changed=store.mutate(first.incident.id,stale,'A','assign','A')
    const conflict=store.mutate(first.incident.id,stale,'B','handoff','Draft handoff')
    expect(conflict.error).toBe('conflict')
    const note=store.mutate(first.incident.id,changed.incident.version,'B','handoff','Draft handoff')
    const resolved=store.mutate(first.incident.id,note.incident.version,'A','resolve','Rolled back rollout')
    const reopened=store.mutate(first.incident.id,resolved.incident.version,'A','reopen','TTFT rose again')
    expect(reopened.incident.events.map(e=>e.kind)).toEqual(['monitoring','monitoring','assign','handoff','resolve','reopen'])
    const cursor=note.incident.events.at(-1).seq
    expect(store.eventsAfter(first.incident.id,cursor).map(e=>e.kind)).toEqual(['resolve','reopen'])
    store.close()
  })
})
