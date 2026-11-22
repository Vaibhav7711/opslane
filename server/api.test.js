import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createStore } from './store.mjs'
import { createApi } from './api.mjs'

const tokens={responderToken:'r'.repeat(24),viewerToken:'v'.repeat(24),monitorToken:'m'.repeat(24)}
const store=createStore(); const server=createApi(store,tokens); let base
beforeAll(async()=>{ await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); base=`http://127.0.0.1:${server.address().port}` })
afterAll(async()=>{ await new Promise(resolve=>server.close(resolve));store.close() })
const request=(path,token,body)=>fetch(`${base}${path}`,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})
describe('API authorization and concurrent deliveries',()=>{
  it('rejects viewer mutations and atomically deduplicates simultaneous deliveries',async()=>{
    const alert={deliveryId:'same',issueKey:'ttft',title:'TTFT spike',service:'Inference',severity:'SEV-1',impact:'Slow first token',text:'Alert fired'}
    const [a,b]=await Promise.all([request('/api/monitoring',tokens.monitorToken,alert),request('/api/monitoring',tokens.monitorToken,alert)])
    const results=await Promise.all([a.json(),b.json()]); expect(results.filter(x=>x.duplicate)).toHaveLength(1); expect(results[0].incident.id).toBe(results[1].incident.id)
    const id=results[0].incident.id
    expect(await (await request('/api/session',tokens.viewerToken)).json()).toEqual({role:'viewer'})
    expect((await request(`/api/incidents/${id}/actions`,tokens.viewerToken,{expectedVersion:1,actor:'Viewer',action:'resolve',text:'No'})).status).toBe(403)
    expect((await request(`/api/incidents/${id}`,tokens.viewerToken)).status).toBe(200)
  })
})
