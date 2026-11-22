import pg from 'pg'
import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const { Pool } = pg
const digest = alert => createHash('sha256').update(JSON.stringify([alert.fingerprint,alert.title,alert.serviceId,alert.severity,alert.impact,alert.text])).digest('hex')
export class ConflictError extends Error { constructor(message, current) { super(message); this.current=current } }
export function createPostgresStore(connectionString) {
  const pool = new Pool({connectionString, max:10})
  const tx = async fn => { const c=await pool.connect(); try { await c.query('BEGIN'); const result=await fn(c); await c.query('COMMIT'); return result } catch(e) { await c.query('ROLLBACK'); throw e } finally { c.release() } }
  const migrate = async () => { const sql=await readFile(new URL('./migrations/001_initial.sql',import.meta.url),'utf8'); await tx(async c=>{await c.query("SELECT pg_advisory_xact_lock(hashtextextended('opslane:migrations',0))");await c.query(sql)}) }
  const provision = async (workspace='demo') => { await pool.query('INSERT INTO workspaces(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING',[workspace,'Northstar Labs']); await pool.query('INSERT INTO services(workspace_id,id,name,description) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[workspace,'inference','Inference Gateway','Synthetic inference service']) }
  const get = async (workspace,id,client=pool) => { const {rows}=await client.query('SELECT i.*, s.name AS service FROM incidents i JOIN services s ON s.workspace_id=i.workspace_id AND s.id=i.service_id WHERE i.workspace_id=$1 AND i.id=$2',[workspace,id]); if(!rows[0])return null; const events=await client.query('SELECT e.seq::text,e.id,e.kind,e.actor,e.body AS text,e.created_at AS at FROM incident_events e WHERE e.workspace_id=$1 AND e.incident_id=$2 ORDER BY e.seq',[workspace,id]); return {...rows[0],events:events.rows} }
  const append = async(c,workspace,incidentId,kind,actor,body)=>{const eventId=randomUUID();await c.query('INSERT INTO incident_events(id,workspace_id,incident_id,kind,actor,body) VALUES($1,$2,$3,$4,$5,$6)',[eventId,workspace,incidentId,kind,actor,body]);return eventId}
  const monitor = async(workspace,alert,options={}) => tx(async c=>{
    if (![alert.deliveryId,alert.fingerprint,alert.title,alert.serviceId,alert.severity,alert.impact,alert.text].every(x=>typeof x==='string' && x.trim())) throw new Error('Missing alert fields')
    const hash=digest(alert)
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${workspace}:delivery:${alert.deliveryId}`])
    const prior=await c.query('SELECT * FROM alert_deliveries WHERE workspace_id=$1 AND delivery_id=$2',[workspace,alert.deliveryId])
    if(prior.rowCount){if(prior.rows[0].payload_hash!==hash)throw new ConflictError('Delivery ID reused with different content');return {duplicate:true,incident:await get(workspace,prior.rows[0].incident_id,c)}}
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${workspace}:fingerprint:${alert.fingerprint}`])
    const active=await c.query("SELECT id FROM incidents WHERE workspace_id=$1 AND fingerprint=$2 AND status <> 'Resolved' FOR UPDATE",[workspace,alert.fingerprint])
    const incidentId=active.rows[0]?.id ?? randomUUID()
    if(active.rowCount)await c.query("UPDATE incidents SET impact=$3,version=version+1,updated_at=date_trunc('milliseconds',now()) WHERE workspace_id=$1 AND id=$2",[workspace,incidentId,alert.impact])
    else await c.query("INSERT INTO incidents(workspace_id,id,fingerprint,title,service_id,severity,impact,next_action,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'Investigating')",[workspace,incidentId,alert.fingerprint,alert.title,alert.serviceId,alert.severity,alert.impact,'Investigate the rollout and assess customer impact.'])
    const eventId=await append(c,workspace,incidentId,'monitoring','Monitoring',alert.text)
    await c.query('INSERT INTO alert_deliveries(workspace_id,delivery_id,payload_hash,incident_id,event_id) VALUES($1,$2,$3,$4,$5)',[workspace,alert.deliveryId,hash,incidentId,eventId])
    if(options.failBeforeCommit)throw new Error('Injected failure before commit')
    return {duplicate:false,incident:await get(workspace,incidentId,c)}
  })
  const mutate = async(workspace,id,expectedVersion,actor,action,text)=>tx(async c=>{
    if(typeof actor!=='string'||!actor.trim()||typeof text!=='string'||!text.trim())return {error:'invalid'}
    const rows=await c.query('SELECT * FROM incidents WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[workspace,id]);const current=rows.rows[0];if(!current)return {error:'not_found'}
    const notes=['note','handoff'];if(action!=='note'&&current.version!==expectedVersion)return {error:'conflict',incident:await get(workspace,id,c)}
    const fields={acknowledge:['status','Acknowledged'],assign:['owner',text],severity:['severity',text],impact:['impact',text],next:['next_action',text],mitigate:['status','Mitigating'],resolve:['status','Resolved'],reopen:['status','Investigating']}
    if(!notes.includes(action)&&!Object.hasOwn(fields,action))return {error:'invalid'}
    if(action==='reopen'&&current.status!=='Resolved'||action==='resolve'&&current.status==='Resolved'||action==='severity'&&!['SEV-1','SEV-2','SEV-3'].includes(text))return {error:'invalid'}
    if(!notes.includes(action)){const [field,value]=fields[action];await c.query(`UPDATE incidents SET ${field}=$3 WHERE workspace_id=$1 AND id=$2`,[workspace,id,value])}
    await append(c,workspace,id,action,actor,text);await c.query("UPDATE incidents SET version=version+1,updated_at=date_trunc('milliseconds',now()) WHERE workspace_id=$1 AND id=$2",[workspace,id]);return {incident:await get(workspace,id,c)}
  })
  const list = async(workspace,{status,service,limit=50,cursor}={})=>{const n=Math.max(1,Math.min(Number(limit)||50,100));const [timestamp,incidentId]=cursor?cursor.split('|'):[null,null];const values=[workspace,status??null,service??null,timestamp,incidentId,n+1];const result=await pool.query(`SELECT i.*,s.name AS service,(SELECT body FROM incident_events e WHERE e.workspace_id=i.workspace_id AND e.incident_id=i.id ORDER BY seq DESC LIMIT 1) AS latest_change FROM incidents i JOIN services s ON s.workspace_id=i.workspace_id AND s.id=i.service_id WHERE i.workspace_id=$1 AND ($2::text IS NULL OR i.status=$2) AND ($3::text IS NULL OR i.service_id=$3) AND ($4::timestamptz IS NULL OR (i.updated_at,i.id)<($4::timestamptz,$5::uuid)) ORDER BY i.updated_at DESC,i.id DESC LIMIT $6`,values);const rows=result.rows.slice(0,n);return {items:rows,nextCursor:result.rows.length>n?`${rows.at(-1).updated_at.toISOString()}|${rows.at(-1).id}`:null} }
  const eventsAfter = async(workspace,id,seq=0,limit=100)=>{const result=await pool.query('SELECT e.seq::text,e.id,e.kind,e.actor,e.body AS text,e.created_at AS at FROM incident_events e WHERE e.workspace_id=$1 AND e.incident_id=$2 AND e.seq>$3 ORDER BY e.seq LIMIT $4',[workspace,id,seq,Math.max(1,Math.min(Number(limit)||100,100))]);return result.rows}
  return {pool,migrate,provision,monitor,mutate,get,list,eventsAfter,close:()=>pool.end()}
}
