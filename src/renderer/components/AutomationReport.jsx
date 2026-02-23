import React, { useState, useEffect } from 'react'
import {
    ChevronDown, ChevronUp, X, Play, CheckCircle, AlertCircle,
    Loader, Clock, Brain, ChevronRight, Activity, Zap
} from 'lucide-react'

function describeCommand(cmd) {
    switch (cmd?.type) {
        case 'click': return `Click at (${cmd.x}, ${cmd.y})`
        case 'click_element': return `Click "${cmd.selector}"`
        case 'type': return `Type "${cmd.text?.length > 30 ? cmd.text.substring(0, 30) + '\u2026' : cmd.text}"`
        case 'fill': return `Fill "${cmd.selector}" \u2192 "${cmd.value?.length > 20 ? cmd.value.substring(0, 20) + '\u2026' : cmd.value}"`
        case 'press': return `Press ${cmd.key}`
        case 'scroll': return `Scroll ${cmd.deltaY > 0 ? 'down' : 'up'} ${Math.abs(cmd.deltaY)}px`
        case 'navigate': return `Navigate \u2192 ${cmd.url?.length > 40 ? cmd.url.substring(0, 40) + '\u2026' : cmd.url}`
        case 'wait': return `Wait ${cmd.ms}ms`
        case 'find': return `Find "${cmd.selector}"`
        default: return cmd?.type || 'Unknown'
    }
}

function formatDuration(ms) {
    if (ms == null) return ''
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
}

function formatElapsed(ms) {
    const secs = Math.floor(ms / 1000)
    const mins = Math.floor(secs / 60)
    const remainSecs = secs % 60
    if (mins > 0) return `${mins}m ${remainSecs}s`
    return `${secs}s`
}

export default function AutomationReport({
    steps = [],
    isRunning = false,
    automationName = '',
    startTime = null,
    thinking = '',
    onClose,
    isCollapsed = false,
    onToggleCollapse
}) {
    const [elapsed, setElapsed] = useState(0)
    const [showThinking, setShowThinking] = useState(false)

    // Elapsed timer
    useEffect(() => {
        if (!isRunning || !startTime) return
        const interval = setInterval(() => {
            setElapsed(Date.now() - startTime)
        }, 200)
        return () => clearInterval(interval)
    }, [isRunning, startTime])

    // Update elapsed one final time when done
    useEffect(() => {
        if (!isRunning && startTime) {
            setElapsed(Date.now() - startTime)
        }
    }, [isRunning, startTime])

    // Stats
    const total = steps.length
    const completed = steps.filter(s => s.status === 'done').length
    const failed = steps.filter(s => s.status === 'error').length
    const running = steps.filter(s => s.status === 'running').length
    const pending = steps.filter(s => s.status === 'pending').length
    const progressPct = total > 0 ? ((completed + failed) / total) * 100 : 0
    const totalDuration = steps.reduce((sum, s) => sum + (s.duration || 0), 0)

    if (steps.length === 0) return null

    return (
        <div className={`automation-report ${isCollapsed ? 'automation-report--collapsed' : ''}`}>
            {/* Header */}
            <div className="automation-report__header">
                <div className="automation-report__header-left">
                    <Activity size={14} className={isRunning ? 'spinning' : ''} />
                    <span className="automation-report__name">
                        {automationName || 'Automation'}
                    </span>
                    <span className="automation-report__progress-text">
                        {completed + failed}/{total} steps
                    </span>
                </div>
                <div className="automation-report__header-right">
                    {(isRunning || elapsed > 0) && (
                        <span className="automation-report__timer">
                            <Clock size={11} />
                            {formatElapsed(elapsed)}
                        </span>
                    )}
                    <button
                        className="automation-report__toggle-btn"
                        onClick={onToggleCollapse}
                        title={isCollapsed ? 'Expand report' : 'Collapse report'}
                    >
                        {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                        className="automation-report__close-btn"
                        onClick={onClose}
                        title="Close report"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Progress bar */}
            <div className="automation-report__progress-bar">
                <div
                    className={`automation-report__progress-fill ${!isRunning && completed + failed === total ? 'automation-report__progress-fill--done' : ''}`}
                    style={{ width: `${progressPct}%` }}
                />
            </div>

            {!isCollapsed && (
                <>
                    {/* Step list */}
                    <div className="automation-report__steps">
                        {steps.map((step, i) => (
                            <div
                                key={i}
                                className={`automation-report__step automation-report__step--${step.status}`}
                            >
                                <span className="automation-report__step-number">
                                    {step.status === 'running' ? (
                                        <Loader size={11} className="spinning" />
                                    ) : step.status === 'done' ? (
                                        <CheckCircle size={11} />
                                    ) : step.status === 'error' ? (
                                        <AlertCircle size={11} />
                                    ) : (
                                        <span className="automation-report__step-idx">{i + 1}</span>
                                    )}
                                </span>
                                <span className="automation-report__step-detail">
                                    {step.detail}
                                </span>
                                {step.duration != null && (
                                    <span className="automation-report__step-time">
                                        {formatDuration(step.duration)}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* AI Thinking section */}
                    {thinking && (
                        <div className="automation-report__thinking">
                            <button
                                className="automation-report__thinking-toggle"
                                onClick={() => setShowThinking(v => !v)}
                            >
                                <Brain size={12} />
                                {showThinking ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                <span>AI Reasoning</span>
                            </button>
                            {showThinking && (
                                <pre className="automation-report__thinking-content">{thinking}</pre>
                            )}
                        </div>
                    )}

                    {/* Stats footer */}
                    <div className="automation-report__stats">
                        <div className="automation-report__stat">
                            <Zap size={11} />
                            <span>{total} total</span>
                        </div>
                        <div className="automation-report__stat automation-report__stat--done">
                            <CheckCircle size={11} />
                            <span>{completed} done</span>
                        </div>
                        {failed > 0 && (
                            <div className="automation-report__stat automation-report__stat--error">
                                <AlertCircle size={11} />
                                <span>{failed} failed</span>
                            </div>
                        )}
                        {running > 0 && (
                            <div className="automation-report__stat automation-report__stat--running">
                                <Loader size={11} className="spinning" />
                                <span>Running step {steps.findIndex(s => s.status === 'running') + 1}</span>
                            </div>
                        )}
                        <div className="automation-report__stat" style={{ marginLeft: 'auto' }}>
                            <Clock size={11} />
                            <span>{formatDuration(totalDuration)} total</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
