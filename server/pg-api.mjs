import { createServer } from 'node:http'
import { randomUUID, timingSafeEqual } from 'node:crypto'
import { ConflictError } from './pg-store.mjs'

const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
export function createPostgresApi(store,{credentials,allowedOrigin}) {
  if(!Array.isArray(credentials)||!credentials.length||credentials.some(c=>typeof c.token!=='string'||c.token.length<24||!c.workspace||!['viewer','responder','admin','monitor'].includes(c.role)))throw Error('Invalid credentials configuration')
  return createServer(async(req,res)=>{
    const requestId=randomUUID();res.setHeader('X-Request-Id',requestId);res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store')
    const send=(status,body)=>{res.writeHead(status);res.end(JSON.stringify(body));console.log(JSON.stringify({requestId,method:req.method,path:new URL(req.url,'http://localhost').pathname,status}))}
    const origin=req.headers.origin;if(origin&&origin!==allowedOrigin)return send(403,{error:'origin_forbidden'});if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin')}
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});return res.end()}
    const url=new URL(req.url,'http://localhost');if(req.method==='GET'&&url.pathname==='/health')return send(200,{status:'ok'})
    if(req.method==='GET'&&url.pathname==='/ready'){try{await store.pool.query('SELECT 1');return send(200,{status:'ready'})}catch{return send(503,{status:'unavailable'})}}
    const token=(req.headers.authorization??'').replace(/^Bearer /,'');const principal=credentials.find(c=>equal(token,c.token));if(!principal)return send(401,{error:'unauthorized'})
    const {workspace,role}=principal;const read=['viewer','responder','admin'].includes(role);const write=['responder','admin'].includes(role)
    try {
      if(req.method==='GET'&&url.pathname==='/api/v1/session')return send(200,{workspace,role})
      if(req.method==='GET'&&url.pathname==='/api/v1/services'&&read){const {rows}=await store.pool.query('SELECT id,name,description FROM services WHERE workspace_id=$1 ORDER BY name',[workspace]);return send(200,{items:rows})}
      if(req.method==='GET'&&url.pathname==='/api/v1/incidents'&&read)return send(200,await store.list(workspace,{status:url.searchParams.get('status'),service:url.searchParams.get('service'),cursor:url.searchParams.get('cursor'),limit:url.searchParams.get('limit')}))
      const match=url.pathname.match(/^\/api\/v1\/incidents\/([0-9a-f-]{36})(?:\/(events|actions))?$/i)
      if(req.method==='GET'&&match&&read){const incident=await store.get(workspace,match[1]);if(!incident)return send(404,{error:'not_found'});if(match[2]==='events')return send(200,{items:await store.eventsAfter(workspace,match[1],url.searchParams.get('after')||0,url.searchParams.get('limit')||100)});if(!match[2])return send(200,incident)}
      if(req.method!=='POST')return send(404,{error:'not_found'})
      if(url.pathname==='/api/v1/alerts'&&role!=='monitor')return send(403,{error:'forbidden'})
      if(match?.[2]==='actions'&&!write)return send(403,{error:'forbidden'})
      if(url.pathname==='/api/v1/services'&&role!=='admin')return send(403,{error:'forbidden'})
      if(url.pathname!=='/api/v1/alerts'&&url.pathname!=='/api/v1/services'&&match?.[2]!=='actions')return send(404,{error:'not_found'})
      let body='';for await(const chunk of req){body+=chunk;if(body.length>65536)return send(413,{error:'too_large'})}const data=JSON.parse(body)
      if(url.pathname==='/api/v1/alerts')return send(200,await store.monitor(workspace,data))
      if(url.pathname==='/api/v1/services'){if(!data.id||!data.name)return send(400,{error:'invalid'});const {rows}=await store.pool.query('INSERT INTO services(workspace_id,id,name,description) VALUES($1,$2,$3,$4) RETURNING id,name,description',[workspace,data.id,data.name,data.description||'']);return send(201,rows[0])}
      const result=await store.mutate(workspace,match[1],data.expectedVersion,principal.actor||role,data.action,data.text);return send(result.error==='conflict'?409:result.error==='not_found'?404:result.error?400:200,result)
    }catch(e){if(e instanceof ConflictError)return send(409,{error:'conflict',message:e.message});return send(400,{error:'invalid_request'})}
  })
}
