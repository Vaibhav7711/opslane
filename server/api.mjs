import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'

const same = (a,b) => { const x=Buffer.from(a), y=Buffer.from(b); return x.length===y.length && timingSafeEqual(x,y) }
export function createApi(store,{ responderToken, viewerToken, monitorToken, allowedOrigin }) {
  if (![responderToken,viewerToken,monitorToken].every(x=>typeof x==='string' && x.length>=24) || new Set([responderToken,viewerToken,monitorToken]).size!==3) throw Error('Set three distinct tokens of at least 24 characters')
  const role = token => same(token,responderToken)?'responder':same(token,viewerToken)?'viewer':same(token,monitorToken)?'monitor':null
  return createServer(async(req,res) => {
    const origin=req.headers.origin
    if (origin && origin!==allowedOrigin) { res.writeHead(403); return res.end() }
    if (origin) { res.setHeader('Access-Control-Allow-Origin',origin); res.setHeader('Vary','Origin') }
    if (req.method==='OPTIONS') { res.writeHead(204,{'Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}); return res.end() }
    res.setHeader('Content-Type','application/json'); res.setHeader('Cache-Control','no-store')
    const send=(status,body)=>{res.writeHead(status);res.end(JSON.stringify(body))}
    const identity=role((req.headers.authorization??'').replace(/^Bearer /,''))
    if (!identity) return send(401,{error:'unauthorized'})
    const url=new URL(req.url,'http://localhost')
    if (req.method==='GET' && url.pathname==='/api/session') return send(200,{role:identity})
    if (req.method==='GET' && url.pathname==='/api/incidents' && identity!=='monitor') return send(200,store.list())
    const match=url.pathname.match(/^\/api\/incidents\/([^/]+)(?:\/(events|actions))?$/)
    if (req.method==='GET' && match && identity!=='monitor') {
      if (match[2]==='events') return send(200,store.eventsAfter(match[1],Math.max(0,Number(url.searchParams.get('after'))||0)))
      if (!match[2]) { const incident=store.get(match[1]); return incident?send(200,incident):send(404,{error:'not_found'}) }
    }
    if (req.method!=='POST') return send(404,{error:'not_found'})
    if (url.pathname==='/api/monitoring' && identity!=='monitor') return send(403,{error:'forbidden'})
    if (match?.[2]==='actions' && identity!=='responder') return send(403,{error:'forbidden'})
    if (url.pathname!=='/api/monitoring' && match?.[2]!=='actions') return send(404,{error:'not_found'})
    try {
      let body=''; for await(const chunk of req) { body+=chunk; if (body.length>65536) return send(413,{error:'too_large'}) }
      const data=JSON.parse(body)
      if (url.pathname==='/api/monitoring') return send(200,store.monitor(data))
      const result=store.mutate(match[1],data.expectedVersion,data.actor,data.action,data.text)
      return send(result.error==='conflict'?409:result.error==='not_found'?404:result.error?400:200,result)
    } catch { return send(400,{error:'invalid_request'}) }
  })
}
