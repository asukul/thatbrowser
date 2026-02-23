import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Trash2, Monitor, Cpu, AlertCircle, Terminal, Wifi, RefreshCw } from 'lucide-react'

const LEVEL_COLOR = {
    info:  '#9898a8',
    debug: '#5e5e72',
    warn:  '#F1BE48',
    error: '#E8334D'
}

const CATEGORY_COLOR = {
    AI:         '#a78bfa',
    Browser:    '#34d399',
    Network:    '#60a5fa',
    Automation: '#f97316',
    System:     '#9898a8',
    IPC:        '#e879f9',
    Default:    '#9898a8'
}

const TABS = ['All', 'AI', 'Browser', 'Network', 'Errors', 'System']

function formatTs(ts) {
    const d = new Date(ts)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    const ms = String(d.getMilliseconds()).padStart(3, '0')
    return `${hh}:${mm}:${ss}.${ms}`
}

function MemoryBar({ used, total, label }) {
    const pct = total > 0 ? Math.round((used / total) * 100) : 0
    const color = pct > 80 ? '#E8334D' : pct > 60 ? '#F1BE48' : '#34d399'
    return (
        <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9898a8', marginBottom: 2 }}>
                <span>{label}</span>
                <span>{used}MB / {total}MB ({pct}%)</span>
            </div>
            <div style={{ height: 4, background: '#22222e', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
        </div>
    )
}

export default function DevModePanel({ onClose }) {
    const [logs, setLogs] = useState([])
    const [activeTab, setActiveTab] = useState('All')
    const [memory, setMemory] = useState(null)
    const [expandedIds, setExpandedIds] = useState(new Set())
    const [autoScroll, setAutoScroll] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const logsEndRef = useRef(null)
    const containerRef = useRef(null)

    // Load existing logs on mount
    useEffect(() => {
        window.browserAPI.devmode.getLogs().then(existing => {
            setLogs(existing || [])
        }).catch(() => { })
    }, [])

    // Subscribe to live logs
    useEffect(() => {
        const unsub = window.browserAPI.devmode.onLog((entry) => {
            setLogs(prev => {
                const next = [...prev, entry]
                return next.length > 600 ? next.slice(-600) : next
            })
        })
        return () => unsub?.()
    }, [])

    // Fetch memory every 3 seconds
    useEffect(() => {
        const fetch = () => {
            window.browserAPI.devmode.getMemory().then(m => setMemory(m)).catch(() => { })
        }
        fetch()
        const interval = setInterval(fetch, 3000)
        return () => clearInterval(interval)
    }, [])

    // Auto-scroll
    useEffect(() => {
        if (autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [logs, autoScroll])

    const handleScroll = useCallback(() => {
        const el = containerRef.current
        if (!el) return
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
        setAutoScroll(atBottom)
    }, [])

    const handleClear = () => {
        window.browserAPI.devmode.clearLogs()
        setLogs([])
        setExpandedIds(new Set())
    }

    const toggleExpand = (id) => {
        setExpandedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    // Filter logs by active tab and search query
    const filteredLogs = logs.filter(log => {
        const tabMatch =
            activeTab === 'All' ||
            (activeTab === 'Errors' && log.level === 'error') ||
            log.category === activeTab

        const queryMatch = !searchQuery ||
            log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.category.toLowerCase().includes(searchQuery.toLowerCase())

        return tabMatch && queryMatch
    })

    const errorCount = logs.filter(l => l.level === 'error').length
    const warnCount = logs.filter(l => l.level === 'warn').length

    return (
        <div className="devmode-panel">
            {/* Header */}
            <div className="devmode-panel__header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Terminal size={14} color="#F1BE48" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#eaeaf0' }}>Dev Console</span>
                    {errorCount > 0 && (
                        <span style={{
                            fontSize: 10, fontWeight: 700, background: 'rgba(200,16,46,0.2)',
                            color: '#E8334D', padding: '1px 6px', borderRadius: 10
                        }}>{errorCount} error{errorCount !== 1 ? 's' : ''}</span>
                    )}
                    {warnCount > 0 && (
                        <span style={{
                            fontSize: 10, fontWeight: 700, background: 'rgba(241,190,72,0.15)',
                            color: '#F1BE48', padding: '1px 6px', borderRadius: 10
                        }}>{warnCount} warn{warnCount !== 1 ? 's' : ''}</span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button className="devmode-btn" onClick={() => window.browserAPI.devmode.openDevTools()} title="Open App DevTools">
                        <Monitor size={12} /> App
                    </button>
                    <button className="devmode-btn" onClick={() => window.browserAPI.devmode.openTabDevTools()} title="Open Tab DevTools">
                        <Monitor size={12} /> Tab
                    </button>
                    <button className="devmode-btn devmode-btn--danger" onClick={handleClear} title="Clear logs">
                        <Trash2 size={12} />
                    </button>
                    <button className="devmode-btn" onClick={onClose} title="Close Dev Mode">
                        <X size={12} />
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                {/* Left: Logs */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    {/* Tab bar + Search */}
                    <div className="devmode-panel__tabs">
                        {TABS.map(tab => (
                            <button
                                key={tab}
                                className={`devmode-tab ${activeTab === tab ? 'devmode-tab--active' : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab}
                                {tab === 'Errors' && errorCount > 0 && (
                                    <span className="devmode-tab__badge devmode-tab__badge--error">{errorCount}</span>
                                )}
                            </button>
                        ))}
                        <div style={{ flex: 1 }} />
                        <input
                            className="devmode-search"
                            placeholder="Filter logs…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        <button
                            className={`devmode-btn ${autoScroll ? 'devmode-btn--active' : ''}`}
                            onClick={() => setAutoScroll(v => !v)}
                            title="Auto-scroll"
                            style={{ fontSize: 10 }}
                        >
                            <RefreshCw size={10} /> Tail
                        </button>
                    </div>

                    {/* Log entries */}
                    <div
                        className="devmode-panel__logs"
                        ref={containerRef}
                        onScroll={handleScroll}
                    >
                        {filteredLogs.length === 0 ? (
                            <div style={{ padding: 16, color: '#5e5e72', fontSize: 12, textAlign: 'center' }}>
                                No log entries{searchQuery ? ' matching filter' : ''}
                            </div>
                        ) : (
                            filteredLogs.map(log => (
                                <div
                                    key={log.id}
                                    className={`devmode-log-entry devmode-log-entry--${log.level}`}
                                    onClick={() => log.data && toggleExpand(log.id)}
                                    style={{ cursor: log.data ? 'pointer' : 'default' }}
                                >
                                    <span className="devmode-log-ts">{formatTs(log.ts)}</span>
                                    <span
                                        className="devmode-log-level"
                                        style={{ color: LEVEL_COLOR[log.level] || '#9898a8' }}
                                    >
                                        {log.level.toUpperCase()}
                                    </span>
                                    <span
                                        className="devmode-log-cat"
                                        style={{ color: CATEGORY_COLOR[log.category] || CATEGORY_COLOR.Default }}
                                    >
                                        {log.category}
                                    </span>
                                    <span className="devmode-log-msg">{log.message}</span>
                                    {log.data && (
                                        <span style={{ color: '#5e5e72', fontSize: 10, marginLeft: 4 }}>
                                            {expandedIds.has(log.id) ? '▲' : '▶'}
                                        </span>
                                    )}
                                    {log.data && expandedIds.has(log.id) && (
                                        <pre className="devmode-log-data">{log.data}</pre>
                                    )}
                                </div>
                            ))
                        )}
                        <div ref={logsEndRef} />
                    </div>
                </div>

                {/* Right: Memory + Status sidebar */}
                <div className="devmode-panel__sidebar">
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#F1BE48', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Cpu size={12} /> Resources
                    </div>

                    {memory ? (
                        <>
                            <MemoryBar
                                label="JS Heap"
                                used={memory.heapUsed}
                                total={memory.heapTotal}
                            />
                            <MemoryBar
                                label="RSS (Process)"
                                used={memory.rss}
                                total={memory.sysTotalM}
                            />
                            <MemoryBar
                                label="System RAM"
                                used={memory.sysTotalM - memory.sysFreeM}
                                total={memory.sysTotalM}
                            />
                            <div style={{ marginTop: 10, fontSize: 10, color: '#5e5e72' }}>
                                <div>External: {memory.external}MB</div>
                                <div style={{ marginTop: 4, color: memory.activeRequests > 0 ? '#F1BE48' : '#5e5e72' }}>
                                    Active AI requests: {memory.activeRequests}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ fontSize: 11, color: '#5e5e72' }}>Loading…</div>
                    )}

                    <div style={{ marginTop: 16, fontSize: 11, fontWeight: 600, color: '#F1BE48', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Wifi size={12} /> Stats
                    </div>
                    <div style={{ fontSize: 10, color: '#9898a8' }}>
                        <div>Total logs: {logs.length}</div>
                        <div>Errors: <span style={{ color: errorCount > 0 ? '#E8334D' : '#9898a8' }}>{errorCount}</span></div>
                        <div>Warnings: <span style={{ color: warnCount > 0 ? '#F1BE48' : '#9898a8' }}>{warnCount}</span></div>
                        <div>Visible: {filteredLogs.length}</div>
                    </div>

                    <div style={{ marginTop: 16, fontSize: 11, fontWeight: 600, color: '#F1BE48', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertCircle size={12} /> Recent Errors
                    </div>
                    <div style={{ fontSize: 10 }}>
                        {logs.filter(l => l.level === 'error').slice(-5).reverse().map(l => (
                            <div key={l.id} style={{ color: '#E8334D', marginBottom: 6, lineHeight: 1.4 }}>
                                <div style={{ color: '#5e5e72' }}>{formatTs(l.ts)}</div>
                                <div>{l.message}</div>
                            </div>
                        ))}
                        {logs.filter(l => l.level === 'error').length === 0 && (
                            <div style={{ color: '#34d399' }}>✓ No errors</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
