import { createPostgresStore } from './pg-store.mjs'
import { createPostgresApi } from './pg-api.mjs'

if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required')
const credentials=JSON.parse(process.env.OPSLANE_CREDENTIALS || '[]')
const store=createPostgresStore(process.env.DATABASE_URL)
await store.migrate()
for(const workspace of new Set(credentials.map(c=>c.workspace)))await store.provision(workspace)
const server=createPostgresApi(store,{credentials,allowedOrigin:process.env.OPSLANE_ORIGIN||'http://localhost:5173'})
server.listen(Number(process.env.PORT||8787),process.env.HOST||'127.0.0.1',()=>console.log(JSON.stringify({event:'listening',port:Number(process.env.PORT||8787)})))
