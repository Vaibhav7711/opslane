import { createStore } from './store.mjs'
import { createApi } from './api.mjs'

const store=createStore(process.env.OPSLANE_DB || './opslane.sqlite')
const server=createApi(store,{ responderToken:process.env.OPSLANE_RESPONDER_TOKEN, viewerToken:process.env.OPSLANE_VIEWER_TOKEN, monitorToken:process.env.OPSLANE_MONITOR_TOKEN, allowedOrigin:process.env.OPSLANE_ORIGIN || 'http://localhost:5173' })
server.listen(Number(process.env.PORT || 8787),'127.0.0.1',()=>console.log('Opslane local API listening on 127.0.0.1'))
