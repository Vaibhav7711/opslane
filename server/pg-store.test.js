import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createPostgresStore, ConflictError } from './pg-store.mjs'

const configured=Boolean(process.env.DATABASE_URL)
describe.skipIf(!configured)('PostgreSQL incident transactions',()=>{
  const store=createPostgresStore(process.env.DATABASE_URL); const workspace=`test-${randomUUID()}`; const other=`test-${randomUUID()}`
  const alert={deliveryId:'delivery-1',fingerprint:'rollout-ttft',title:'TTFT spike',serviceId:'inference',severity:'SEV-1',impact:'First token is slow',text:'Threshold exceeded'}
  beforeAll(async()=>{await store.migrate();await store.provision(workspace);await store.provision(other)})
  afterAll(async()=>{await store.pool.query('DELETE FROM alert_deliveries WHERE workspace_id IN ($1,$2)',[workspace,other]);await store.pool.query('DELETE FROM incident_events WHERE workspace_id IN ($1,$2)',[workspace,other]);await store.pool.query('DELETE FROM incidents WHERE workspace_id IN ($1,$2)',[workspace,other]);await store.pool.query('DELETE FROM services WHERE workspace_id IN ($1,$2)',[workspace,other]);await store.pool.query('DELETE FROM workspaces WHERE id IN ($1,$2)',[workspace,other]);await store.close()})
  it('deduplicates simultaneous retries and rejects changed content',async()=>{
    const result=await Promise.all(Array.from({length:8},()=>store.monitor(workspace,alert)));expect(result.filter(x=>!x.duplicate)).toHaveLength(1);expect(new Set(result.map(x=>x.incident.id)).size).toBe(1);expect(result[0].incident.events).toHaveLength(1)
    await expect(store.monitor(workspace,{...alert,text:'Different payload'})).rejects.toBeInstanceOf(ConflictError)
    const missed=await store.monitor(workspace,alert);expect(missed.duplicate).toBe(true)
    const update=await store.monitor(workspace,{...alert,deliveryId:'delivery-2'});expect(update.incident.id).toBe(result[0].incident.id);expect(update.incident.events).toHaveLength(2)
  })
  it('rolls back an interrupted delivery before commit',async()=>{
    const candidate={...alert,deliveryId:'rolled-back',fingerprint:'different'}
    await expect(store.monitor(workspace,candidate,{failBeforeCommit:true})).rejects.toThrow('Injected')
    const retry=await store.monitor(workspace,candidate);expect(retry.duplicate).toBe(false);expect(retry.incident.events).toHaveLength(1)
  })
  it('orders numeric event cursors correctly beyond single digits',async()=>{
    const created=await store.monitor(workspace,{...alert,deliveryId:'ordering',fingerprint:'ordering'});const id=created.incident.id
    for(let n=0;n<12;n++)await store.mutate(workspace,id,0,'A','note',`Note ${n}`)
    const all=(await store.get(workspace,id)).events;expect(all.map(e=>BigInt(e.seq))).toEqual([...all.map(e=>BigInt(e.seq))].sort((a,b)=>a<b?-1:a>b?1:0))
    const cursor=all[4].seq;expect((await store.eventsAfter(workspace,id,cursor)).map(e=>e.id)).toEqual(all.slice(5).map(e=>e.id))
  })
  it('keeps concurrent notes, conflicts on ownership, scopes reads, and retains resolutions',async()=>{
    const created=await store.monitor(workspace,{...alert,deliveryId:'lifecycle',fingerprint:'lifecycle'});const id=created.incident.id;const version=created.incident.version
    const ownership=await Promise.all([store.mutate(workspace,id,version,'A','assign','A'),store.mutate(workspace,id,version,'B','assign','B')]);expect(ownership.filter(x=>x.error==='conflict')).toHaveLength(1)
    const notes=await Promise.all([store.mutate(workspace,id,version,'A','note','First note'),store.mutate(workspace,id,version,'B','handoff','Second note')]);expect(notes.every(x=>x.incident)).toBe(true)
    let current=await store.get(workspace,id);expect(current.events.filter(e=>['note','handoff'].includes(e.kind))).toHaveLength(2);expect(await store.get(other,id)).toBeNull()
    const cursor=current.events.at(-1).seq;current=(await store.mutate(workspace,id,current.version,'A','resolve','Rollback complete')).incident;current=(await store.mutate(workspace,id,current.version,'A','reopen','Issue recurred')).incident
    expect((await store.eventsAfter(workspace,id,cursor)).map(e=>e.kind)).toEqual(['resolve','reopen']);expect(current.events.some(e=>e.kind==='resolve')).toBe(true)
    await store.mutate(workspace,id,current.version,'A','resolve','Resolved again');const fresh=await store.monitor(workspace,{...alert,deliveryId:'new-firing',fingerprint:'lifecycle'});expect(fresh.incident.id).not.toBe(id)
  })
})
