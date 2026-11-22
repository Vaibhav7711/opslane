import { useEffect, useMemo, useState } from 'react'
import {
  Activity, Bell, Blocks, Check, ChevronDown, CircleGauge, Clock3, Command,
  Flame, Gauge, LayoutDashboard, LifeBuoy, Menu, Moon, Radio, Search,
  Server, Settings, ShieldCheck, Sparkles, Users, X, Zap,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { initialIncidents, services, timeline } from './data'
import type { Incident, Severity } from './types'
import { calculateSlaRisk, filterIncidents, formatDuration } from './utils'

const nav = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Incidents', icon: Flame, badge: '3' },
  { label: 'Services', icon: Blocks },
  { label: 'On-call', icon: Users },
  { label: 'Runbooks', icon: LifeBuoy },
]

function Sparkline({ values, critical }: { values: number[]; critical: boolean }) {
  const points = values.map((value, index) => `${index * 18},${48 - value * 0.65}`).join(' ')
  return (
    <svg viewBox="0 0 126 48" className="sparkline" role="img" aria-label="Recent service latency trend">
      <polyline points={points} fill="none" stroke={critical ? '#ff826e' : '#b7f36b'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MetricCard({ label, value, note, tone, icon: Icon }: { label: string; value: string; note: string; tone: string; icon: typeof Activity }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}><Icon size={18} /></div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{note}</span>
      </div>
    </article>
  )
}

function App() {
  const [incidents, setIncidents] = useState<Incident[]>(() => {
    const saved = localStorage.getItem('opslane-incidents')
    return saved ? JSON.parse(saved) : initialIncidents
  })
  const [selectedId, setSelectedId] = useState(initialIncidents[0].id)
  const [query, setQuery] = useState('')
  const [severity, setSeverity] = useState<Severity | 'All'>('All')
  const [live, setLive] = useState(true)
  const [mobileNav, setMobileNav] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [pulse, setPulse] = useState(0)

  useEffect(() => localStorage.setItem('opslane-incidents', JSON.stringify(incidents)), [incidents])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen((open) => !open)
      }
      if (event.key === 'Escape') setCommandOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    if (!live) return
    const timer = window.setInterval(() => setPulse((value) => value + 1), 5000)
    return () => window.clearInterval(timer)
  }, [live])

  const visibleIncidents = useMemo(() => filterIncidents(incidents, query, severity), [incidents, query, severity])
  const selected = incidents.find((incident) => incident.id === selectedId) ?? incidents[0]
  const chartData = useMemo(() => timeline.map((point, index) => ({
    ...point,
    latency: index === timeline.length - 1 ? Math.max(250, point.latency + ((pulse % 4) - 2) * 22) : point.latency,
  })), [pulse])

  const acknowledge = (id: string) => setIncidents((items) => items.map((item) => item.id === id ? { ...item, acknowledged: true } : item))

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand"><span><Activity size={19} /></span><b>opslane</b></div>
        <button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X /></button>
        <div className="workspace-switcher">
          <div className="workspace-logo">N</div>
          <div><span>Workspace</span><b>Northstar Labs</b></div>
          <ChevronDown size={15} />
        </div>
        <nav aria-label="Primary navigation">
          <p className="nav-label">Command center</p>
          {nav.map(({ label, icon: Icon, badge }) => (
            <button key={label} className={label === 'Overview' ? 'active' : ''}>
              <Icon size={18} /><span>{label}</span>{badge && <em>{badge}</em>}
            </button>
          ))}
          <p className="nav-label">Workspace</p>
          <button><ShieldCheck size={18} /><span>Policies</span></button>
          <button><Settings size={18} /><span>Settings</span></button>
        </nav>
        <div className="oncall-card">
          <div><Radio size={16} /><span>ON-CALL NOW</span></div>
          <strong>Platform rotation</strong>
          <p><span className="avatar">AM</span>Aarav & 2 others</p>
          <button>View schedule</button>
        </div>
        <div className="user-row"><span className="avatar light">VJ</span><div><b>Vaibhav Jain</b><small>Engineering</small></div><ChevronDown size={15} /></div>
      </aside>

      {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation overlay" />}

      <main>
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu /></button>
          <button className="command-search" onClick={() => setCommandOpen(true)}><Search size={17} /><span>Search incidents, services, runbooks…</span><kbd>⌘ K</kbd></button>
          <div className="top-actions">
            <button className={`live-toggle ${live ? 'enabled' : ''}`} onClick={() => setLive((value) => !value)}><span />{live ? 'Live' : 'Paused'}</button>
            <button aria-label="Theme"><Moon size={18} /></button>
            <button aria-label="Notifications" className="notification"><Bell size={18} /><span /></button>
            <span className="avatar light">VJ</span>
          </div>
        </header>

        <div className="dashboard">
          <section className="page-heading">
            <div><p className="eyebrow">COMMAND CENTER <span>•</span> LAST UPDATED JUST NOW</p><h1>System overview</h1><p>Monitor service health and coordinate active response.</p></div>
            <button className="new-incident"><Zap size={17} fill="currentColor" />Declare incident</button>
          </section>

          <section className="metrics-grid" aria-label="System metrics">
            <MetricCard label="System availability" value="99.94%" note="↑ 0.03% vs last week" tone="green" icon={ShieldCheck} />
            <MetricCard label="Active incidents" value="3" note="1 requires attention" tone="coral" icon={Flame} />
            <MetricCard label="Median response" value="3m 42s" note="↓ 18s from target" tone="violet" icon={Clock3} />
            <MetricCard label="Services healthy" value="18 / 20" note="2 services degraded" tone="blue" icon={Server} />
          </section>

          <section className="main-grid">
            <article className="panel telemetry-panel">
              <div className="panel-heading"><div><p className="eyebrow">PAYMENTS API</p><h2>Traffic health</h2></div><div className="legend"><span className="latency-dot" />Latency <span className="error-dot" />Errors</div></div>
              <div className="chart-summary"><div><strong>{chartData.at(-1)?.latency} ms</strong><span>p95 latency</span></div><div><strong>5.1%</strong><span>error rate</span></div><div><strong>14.8k</strong><span>req / min</span></div></div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                    <defs><linearGradient id="latencyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b7f36b" stopOpacity={0.28} /><stop offset="100%" stopColor="#b7f36b" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid stroke="#292d27" strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="time" stroke="#73796e" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis stroke="#73796e" tickLine={false} axisLine={false} fontSize={11} />
                    <Tooltip contentStyle={{ background: '#171a16', border: '1px solid #353a31', borderRadius: 12 }} />
                    <Area type="monotone" dataKey="latency" stroke="#b7f36b" strokeWidth={2.5} fill="url(#latencyFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="anomaly-note"><Sparkles size={16} /><div><b>Anomaly detected at 11:26</b><span>Latency exceeded the 30-day baseline by 3.2×</span></div><button>Inspect trace</button></div>
            </article>

            <article className="panel services-panel">
              <div className="panel-heading"><div><p className="eyebrow">SERVICE CATALOG</p><h2>Live health</h2></div><button>View all</button></div>
              <div className="service-list">
                {services.map((service) => <div className="service-row" key={service.name}>
                  <div className={`state-icon ${service.state.toLowerCase()}`}><CircleGauge size={17} /></div>
                  <div className="service-name"><b>{service.name}</b><span><i className={service.state.toLowerCase()} />{service.state}</span></div>
                  <Sparkline values={service.spark} critical={service.state === 'Critical'} />
                  <div className="service-latency"><b>{service.latency}ms</b><span className={service.change > 0 ? 'up' : 'down'}>{service.change > 0 ? '↑' : '↓'} {Math.abs(service.change)}%</span></div>
                </div>)}
              </div>
            </article>
          </section>

          <section className="incidents-layout">
            <article className="panel incident-list-panel">
              <div className="panel-heading incident-heading"><div><p className="eyebrow">INCIDENT QUEUE</p><h2>Active response</h2></div><div className="filters">{(['All', 'SEV-1', 'SEV-2', 'SEV-3'] as const).map((item) => <button key={item} onClick={() => setSeverity(item)} className={severity === item ? 'active' : ''}>{item}</button>)}</div></div>
              <div className="incident-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter incidents" aria-label="Filter incidents" /></div>
              <div className="incident-table">
                {visibleIncidents.map((incident) => <button key={incident.id} className={`incident-row ${selectedId === incident.id ? 'selected' : ''}`} onClick={() => setSelectedId(incident.id)}>
                  <span className={`severity ${incident.severity.toLowerCase()}`}>{incident.severity}</span>
                  <span className="incident-main"><b>{incident.title}</b><small>{incident.id} · {incident.service}</small></span>
                  <span className="status"><i />{incident.status}</span>
                  <span className="incident-owner"><span className="avatar">{incident.owner.split(' ').map((part) => part[0]).join('')}</span>{incident.owner}</span>
                  <span className="elapsed">{formatDuration(incident.elapsedMinutes)}</span>
                </button>)}
              </div>
            </article>

            <aside className="panel incident-detail">
              <div className="detail-top"><span className={`severity ${selected.severity.toLowerCase()}`}>{selected.severity}</span><span>{selected.id}</span><button aria-label="More options">•••</button></div>
              <h2>{selected.title}</h2><p>{selected.update}</p>
              <div className="risk-meter"><div><span>SLA risk</span><b>{calculateSlaRisk(selected)}%</b></div><div className="meter"><span style={{ width: `${calculateSlaRisk(selected)}%` }} /></div><small>Based on severity, elapsed time, and customer impact</small></div>
              <dl><div><dt>Status</dt><dd><i />{selected.status}</dd></div><div><dt>Commander</dt><dd><span className="avatar">{selected.owner.split(' ').map((part) => part[0]).join('')}</span>{selected.owner}</dd></div><div><dt>Impact</dt><dd>{selected.customerImpact}% of requests</dd></div><div><dt>Duration</dt><dd>{formatDuration(selected.elapsedMinutes)}</dd></div></dl>
              <button className={`acknowledge ${selected.acknowledged ? 'done' : ''}`} onClick={() => acknowledge(selected.id)} disabled={selected.acknowledged}>{selected.acknowledged ? <><Check size={17} />Acknowledged</> : 'Acknowledge incident'}</button>
            </aside>
          </section>
        </div>
      </main>

      {commandOpen && <div className="command-overlay" onMouseDown={() => setCommandOpen(false)}>
        <section className="command-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Command palette">
          <div><Search size={19} /><input autoFocus placeholder="Type a command or search…" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>ESC</kbd></div>
          <p>QUICK ACTIONS</p>
          <button onClick={() => setCommandOpen(false)}><span className="command-icon"><Flame size={18} /></span><span><b>Declare a new incident</b><small>Start an incident response room</small></span><kbd>D</kbd></button>
          <button onClick={() => { setLive((value) => !value); setCommandOpen(false) }}><span className="command-icon"><Radio size={18} /></span><span><b>{live ? 'Pause' : 'Resume'} live telemetry</b><small>Control incoming metric updates</small></span><kbd>L</kbd></button>
          <button onClick={() => setCommandOpen(false)}><span className="command-icon"><Gauge size={18} /></span><span><b>Open service catalog</b><small>Review all service-level objectives</small></span><kbd>S</kbd></button>
          <footer><span><Command size={13} /> K to open</span><span>↑↓ Navigate · ↵ Select</span></footer>
        </section>
      </div>}
    </div>
  )
}

export default App
