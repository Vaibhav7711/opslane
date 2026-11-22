import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createPostgresStore } from './pg-store.mjs'
import { createPostgresApi } from './pg-api.mjs'

describe.skipIf(!process.env.DATABASE_URL)('PostgreSQL API permissions',()=>{
  const store=createPostgresStore(process.env.DATABASE_URL);const workspace=`api-${randomUUID()}`;const other=`api-${randomUUID()}`
  const credentials=[{token:'m'.repeat(32),workspace,role:'monitor'},{token:'r'.repeat(32),workspace,role:'responder',actor:'Responder A'},{token:'v'.repeat(32),workspace,role:'viewer'},{token:'o'.repeat(32),workspace:other,role:'viewer'}];const server=createPostgresApi(store,{credentials});let base
  const request=(path,token,body)=>fetch(`${base}${path}`,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})
  beforeAll(async()=>{await store.migrate();await store.provision(workspace);await store.provision(other);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`})
  afterAll(async()=>{await new Promise(resolve=>server.close(resolve));await store.pool.query('DELETE FROM alert_deliveries WHERE workspace_id IN ($1,$2)',[workspace,other]);await store.pool.query('DELETE FROM incident_events WHERE workspace_id IN ($1,$2)',[workspace,other]);await store.pool.query('DELETE FROM incidents WHERE workspace_id IN ($1,$2)',[workspace,other]);await store.pool.query('DELETE FROM services WHERE workspace_id IN ($1,$2)',[workspace,other]);await store.pool.query('DELETE FROM workspaces WHERE id IN ($1,$2)',[workspace,other]);await store.close()})
  it('enforces viewer, monitoring, and workspace boundaries',async()=>{
    const alert={deliveryId:'d1',fingerprint:'ttft',title:'TTFT spike',serviceId:'inference',severity:'SEV-1',impact:'Slow first token',text:'Alert fired'}
    expect((await request('/api/v1/alerts',credentials[2].token,alert)).status).toBe(403)
    const created=await (await request('/api/v1/alerts',credentials[0].token,alert)).json();const id=created.incident.id
    expect((await request(`/api/v1/incidents/${id}`,credentials[3].token)).status).toBe(404)
    expect((await request(`/api/v1/incidents/${id}/events`,credentials[3].token)).status).toBe(404)
    expect((await request(`/api/v1/incidents/${id}/actions`,credentials[2].token,{expectedVersion:1,action:'resolve',text:'Forbidden'})).status).toBe(403)
    const action=await request(`/api/v1/incidents/${id}/actions`,credentials[1].token,{expectedVersion:1,action:'acknowledge',text:'Acknowledged'});expect(action.status).toBe(200)
    const history=await (await request(`/api/v1/incidents/${id}/events?after=0`,credentials[2].token)).json();expect(history.items.map(e=>e.kind)).toEqual(['monitoring','acknowledge']);expect(history.items[1].actor).toBe('Responder A')
  })
})
