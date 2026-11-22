import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'

/** All mutations and revision checks run inside one SQLite transaction. */
export function createStore(path = ':memory:') {
  const db = new DatabaseSync(path)
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS incidents (id TEXT PRIMARY KEY, issue_key TEXT NOT NULL, title TEXT NOT NULL, service TEXT NOT NULL, severity TEXT NOT NULL, impact TEXT NOT NULL, next_action TEXT NOT NULL, owner TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, incident_id TEXT NOT NULL REFERENCES incidents(id), kind TEXT NOT NULL, actor TEXT NOT NULL, text TEXT NOT NULL, at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS deliveries (delivery_id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(id), event_id TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS events_incident_seq ON events(incident_id, seq);
    CREATE INDEX IF NOT EXISTS incidents_issue ON incidents(issue_key, status);`)
  const transaction = fn => { db.exec('BEGIN IMMEDIATE'); try { const result=fn(); db.exec('COMMIT'); return result } catch(e) { db.exec('ROLLBACK'); throw e } }
  const append = (incidentId,kind,actor,text,at) => { const eventId=randomUUID(); db.prepare('INSERT INTO events(id,incident_id,kind,actor,text,at) VALUES (?,?,?,?,?,?)').run(eventId,incidentId,kind,actor,text,at); return eventId }
  const get = id => { const incident=db.prepare('SELECT * FROM incidents WHERE id=?').get(id); if (!incident) return null; return { ...incident, events:db.prepare('SELECT * FROM events WHERE incident_id=? ORDER BY seq').all(id) } }
  const monitor = ({ deliveryId, issueKey, title, service, severity, impact, text, at = new Date().toISOString() }) => transaction(() => {
    if (![deliveryId,issueKey,title,service,severity,impact,text].every(x => typeof x === 'string' && x.trim())) throw new Error('Missing monitoring event fields')
    const existingDelivery=db.prepare('SELECT incident_id FROM deliveries WHERE delivery_id=?').get(deliveryId)
    if (existingDelivery) return { duplicate:true, incident:get(existingDelivery.incident_id) }
    let incident=db.prepare("SELECT * FROM incidents WHERE issue_key=? AND status != 'Resolved' ORDER BY created_at DESC LIMIT 1").get(issueKey)
    if (!incident) { const incidentId=randomUUID(); db.prepare("INSERT INTO incidents(id,issue_key,title,service,severity,impact,next_action,status,created_at) VALUES(?,?,?,?,?,?,?,'Investigating',?)").run(incidentId,issueKey,title,service,severity,impact,'Investigate the rollout and assess customer impact.',at); incident=db.prepare('SELECT * FROM incidents WHERE id=?').get(incidentId) }
    else db.prepare('UPDATE incidents SET impact=?,version=version+1 WHERE id=?').run(impact,incident.id)
    const eventId=append(incident.id,'monitoring','Monitoring',text,at)
    db.prepare('INSERT INTO deliveries(delivery_id,incident_id,event_id) VALUES(?,?,?)').run(deliveryId,incident.id,eventId)
    return { duplicate:false,incident:get(incident.id) }
  })
  const mutate = (incidentId, expectedVersion, actor, action, text, at = new Date().toISOString()) => transaction(() => {
    const current=db.prepare('SELECT * FROM incidents WHERE id=?').get(incidentId)
    if (!current) return { error:'not_found' }
    if (current.version !== expectedVersion) return { error:'conflict', incident:get(incidentId) }
    if (typeof actor !== 'string' || !actor.trim() || typeof text !== 'string' || !text.trim()) return { error:'invalid' }
    const changes={ acknowledge: ['status','Acknowledged'], assign:['owner',text], impact:['impact',text], next:['next_action',text], resolve:['status','Resolved'], reopen:['status','Investigating'] }
    if (action === 'note' || action === 'handoff') { /* Append without replacing the current state. */ }
    else if (Object.hasOwn(changes,action)) { if (action === 'reopen' && current.status !== 'Resolved') return {error:'invalid'}; if (action === 'resolve' && current.status === 'Resolved') return {error:'invalid'}; const [column,value]=changes[action]; db.prepare(`UPDATE incidents SET ${column}=? WHERE id=?`).run(value,incidentId) }
    else return {error:'invalid'}
    append(incidentId,action,actor,text,at)
    db.prepare('UPDATE incidents SET version=version+1 WHERE id=?').run(incidentId)
    return {incident:get(incidentId)}
  })
  const eventsAfter = (incidentId, seq) => db.prepare('SELECT * FROM events WHERE incident_id=? AND seq>? ORDER BY seq').all(incidentId,seq)
  const list = () => db.prepare('SELECT i.*, (SELECT text FROM events e WHERE e.incident_id=i.id ORDER BY e.seq DESC LIMIT 1) AS latest_change FROM incidents i ORDER BY i.created_at DESC').all()
  return { monitor, mutate, get, eventsAfter, list, close:()=>db.close() }
}
