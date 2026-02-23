import React, { useState, useEffect } from 'react'
import {
    Search, Plus, Play, Edit3, Trash2, Copy, ChevronDown, ChevronRight,
    ArrowUp, ArrowDown, X, Zap, Clock, Save, Sparkles, Loader,
    CheckCircle, AlertCircle, FlaskConical
} from 'lucide-react'
import { TEST_CASES, TEST_CATEGORIES } from './TestCases'

const COMMAND_TYPES = [
    { value: 'click', label: 'CLICK', fields: ['x', 'y'] },
    { value: 'click_element', label: 'CLICK_ELEMENT', fields: ['selector'] },
    { value: 'type', label: 'TYPE', fields: ['text'] },
    { value: 'fill', label: 'FILL', fields: ['selector', 'value'] },
    { value: 'press', label: 'PRESS', fields: ['key'] },
    { value: 'scroll', label: 'SCROLL', fields: ['deltaY'] },
    { value: 'navigate', label: 'NAVIGATE', fields: ['url'] },
    { value: 'wait', label: 'WAIT', fields: ['ms'] },
    { value: 'find', label: 'FIND', fields: ['selector'] },
]

function describeCommand(cmd) {
    switch (cmd.type) {
        case 'click': return `Click at (${cmd.x}, ${cmd.y})`
        case 'click_element': return `Click "${cmd.selector}"`
        case 'type': return `Type "${cmd.text?.length > 30 ? cmd.text.substring(0, 30) + '\u2026' : cmd.text}"`
        case 'fill': return `Fill "${cmd.selector}" \u2192 "${cmd.value?.length > 20 ? cmd.value.substring(0, 20) + '\u2026' : cmd.value}"`
        case 'press': return `Press ${cmd.key}`
        case 'scroll': return `Scroll ${cmd.deltaY > 0 ? 'down' : 'up'} ${Math.abs(cmd.deltaY)}px`
        case 'navigate': return `Navigate \u2192 ${cmd.url?.length > 40 ? cmd.url.substring(0, 40) + '\u2026' : cmd.url}`
        case 'wait': return `Wait ${cmd.ms}ms`
        case 'find': return `Find "${cmd.selector}"`
        default: return cmd.type
    }
}

function createBlankCommand(type) {
    switch (type) {
        case 'click': return { type: 'click', x: 0, y: 0 }
        case 'click_element': return { type: 'click_element', selector: '' }
        case 'type': return { type: 'type', text: '' }
        case 'fill': return { type: 'fill', selector: '', value: '' }
        case 'press': return { type: 'press', key: 'Enter' }
        case 'scroll': return { type: 'scroll', deltaY: 300 }
        case 'navigate': return { type: 'navigate', url: '' }
        case 'wait': return { type: 'wait', ms: 1000 }
        case 'find': return { type: 'find', selector: '' }
        default: return { type: 'click', x: 0, y: 0 }
    }
}

/** Parse automation commands from AI response text */
function parseCommands(text) {
    const commands = []
    const allText = text.replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?/, '').replace(/```/, ''))
    const lines = allText.split('\n')
    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        let m
        if ((m = trimmed.match(/CLICK\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/))) {
            commands.push({ type: 'click', x: +m[1], y: +m[2] })
        } else if ((m = trimmed.match(/CLICK_ELEMENT\s*\(\s*"([^"]*)"\s*\)/))) {
            commands.push({ type: 'click_element', selector: m[1] })
        } else if ((m = trimmed.match(/TYPE\s*\(\s*"([^"]*)"\s*\)/))) {
            commands.push({ type: 'type', text: m[1] })
        } else if ((m = trimmed.match(/PRESS\s*\(\s*"([^"]*)"\s*\)/))) {
            commands.push({ type: 'press', key: m[1] })
        } else if ((m = trimmed.match(/SCROLL\s*\(\s*(-?\d+)\s*\)/))) {
            commands.push({ type: 'scroll', deltaY: +m[1] })
        } else if ((m = trimmed.match(/NAVIGATE\s*\(\s*"([^"]*)"\s*\)/))) {
            commands.push({ type: 'navigate', url: m[1] })
        } else if ((m = trimmed.match(/WAIT\s*\(\s*(\d+)\s*\)/))) {
            commands.push({ type: 'wait', ms: +m[1] })
        } else if ((m = trimmed.match(/FIND\s*\(\s*"([^"]*)"\s*\)/))) {
            commands.push({ type: 'find', selector: m[1] })
        } else if ((m = trimmed.match(/FILL\s*\(\s*"([^"]*?)"\s*,\s*"([^"]*)"\s*\)/))) {
            commands.push({ type: 'fill', selector: m[1], value: m[2] })
        }
    }
    return commands
}

export default function AutomationsTab({ onRunAutomation, activeProvider, runningAutomationId, runningStepIndex, automationSteps }) {
    const [automations, setAutomations] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedId, setExpandedId] = useState(null)
    const [editingId, setEditingId] = useState(null)
    const [editForm, setEditForm] = useState({ name: '', description: '', commands: [] })
    const [confirmDeleteId, setConfirmDeleteId] = useState(null)
    // AI generate state
    const [generatePrompt, setGeneratePrompt] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [generateError, setGenerateError] = useState(null)
    // Test cases dropdown
    const [showTestCases, setShowTestCases] = useState(false)

    useEffect(() => { loadAutomations() }, [])

    // Auto-expand the running automation card
    useEffect(() => {
        if (runningAutomationId) {
            setExpandedId(runningAutomationId)
        }
    }, [runningAutomationId])

    const loadAutomations = async () => {
        const data = await window.browserAPI.library.get()
        setAutomations(data?.automations || [])
    }

    const filtered = searchQuery
        ? automations.filter(a =>
            a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (a.description || '').toLowerCase().includes(searchQuery.toLowerCase())
        )
        : automations

    const sorted = [...filtered].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))

    const handleCreate = async () => {
        await window.browserAPI.library.saveAutomation({
            name: 'New Automation',
            commands: [],
            description: ''
        })
        const data = await window.browserAPI.library.get()
        const autos = data?.automations || []
        setAutomations(autos)
        if (autos.length > 0) {
            const newest = autos.reduce((a, b) => (b.createdAt || 0) > (a.createdAt || 0) ? b : a)
            setEditingId(newest.id)
            setEditForm({ name: newest.name, description: newest.description || '', commands: [...(newest.commands || [])] })
            setExpandedId(newest.id)
        }
    }

    const handleEdit = (auto) => {
        setEditingId(auto.id)
        setEditForm({
            name: auto.name,
            description: auto.description || '',
            commands: (auto.commands || []).map(c => ({ ...c }))
        })
        setExpandedId(auto.id)
    }

    const handleSaveEdit = async () => {
        if (!editingId) return
        await window.browserAPI.library.updateItem({
            id: editingId,
            type: 'automation',
            updates: {
                name: editForm.name.trim() || 'Untitled',
                description: editForm.description,
                commands: editForm.commands
            }
        })
        setEditingId(null)
        await loadAutomations()
    }

    const handleCancelEdit = () => {
        setEditingId(null)
    }

    const handleDelete = async (id) => {
        await window.browserAPI.library.deleteItem({ id, type: 'automation' })
        setConfirmDeleteId(null)
        if (editingId === id) setEditingId(null)
        if (expandedId === id) setExpandedId(null)
        await loadAutomations()
    }

    const handleDuplicate = async (id) => {
        await window.browserAPI.library.duplicateItem({ id, type: 'automation' })
        await loadAutomations()
    }

    const handleRun = (auto) => {
        onRunAutomation?.(auto)
    }

    const handleLoadTestCase = async (testCase) => {
        setShowTestCases(false)
        // Save as a new automation so user can re-run/edit later
        const saved = await window.browserAPI.library.saveAutomation({
            name: `Test: ${testCase.name}`,
            commands: testCase.commands,
            description: testCase.description
        })
        await loadAutomations()
        // Auto-run immediately
        onRunAutomation?.({
            id: saved.id,
            name: `Test: ${testCase.name}`,
            commands: testCase.commands,
            description: testCase.description
        })
    }

    // AI Generate
    const handleGenerate = async () => {
        if (!generatePrompt.trim() || isGenerating) return
        setIsGenerating(true)
        setGenerateError(null)

        try {
            const systemPrompt = `You are an automation workflow generator. The user will describe a task they want to automate in a web browser. You MUST respond ONLY with executable automation commands, one per line. Do NOT include any explanation, commentary, or markdown.

Available commands:
CLICK(x, y) — Click at pixel coordinates
CLICK_ELEMENT("css-selector") — Click element by CSS selector
TYPE("text") — Type text into focused element
FILL("css-selector", "value") — Fill an input field
PRESS("key") — Press a key (Enter, Tab, Escape, etc.)
SCROLL(pixels) — Scroll (positive=down, negative=up)
NAVIGATE("url") — Go to a URL
WAIT(milliseconds) — Wait
FIND("css-selector") — Find element

Example input: "Search Google for latest tech news"
Example output:
NAVIGATE("https://www.google.com")
WAIT(1000)
FILL("textarea[name='q']", "latest tech news")
PRESS("Enter")
WAIT(1500)`

            const result = await window.browserAPI.ai.chat({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: generatePrompt.trim() }
                ],
                provider: activeProvider
            })

            if (result.error) {
                setGenerateError(result.error)
                return
            }

            const commands = parseCommands(result.content)
            if (commands.length === 0) {
                setGenerateError('AI did not return any valid commands. Try rephrasing your prompt.')
                return
            }

            // Save as new automation
            await window.browserAPI.library.saveAutomation({
                name: generatePrompt.trim().substring(0, 60),
                commands,
                description: `AI-generated: ${generatePrompt.trim()}`
            })

            // Refresh, find newest, enter edit mode for review
            const data = await window.browserAPI.library.get()
            const autos = data?.automations || []
            setAutomations(autos)

            if (autos.length > 0) {
                const newest = autos.reduce((a, b) => (b.createdAt || 0) > (a.createdAt || 0) ? b : a)
                setEditingId(newest.id)
                setEditForm({
                    name: newest.name,
                    description: newest.description || '',
                    commands: [...(newest.commands || [])]
                })
                setExpandedId(newest.id)
            }

            setGeneratePrompt('')
        } catch (err) {
            setGenerateError(err.message)
        } finally {
            setIsGenerating(false)
        }
    }

    // Step editing
    const moveStep = (index, direction) => {
        const cmds = [...editForm.commands]
        const target = index + direction
        if (target < 0 || target >= cmds.length) return
        ;[cmds[index], cmds[target]] = [cmds[target], cmds[index]]
        setEditForm({ ...editForm, commands: cmds })
    }

    const removeStep = (index) => {
        setEditForm({ ...editForm, commands: editForm.commands.filter((_, i) => i !== index) })
    }

    const addStep = (type = 'navigate') => {
        setEditForm({ ...editForm, commands: [...editForm.commands, createBlankCommand(type)] })
    }

    const updateStep = (index, field, value) => {
        const cmds = editForm.commands.map((cmd, i) => {
            if (i !== index) return cmd
            const updated = { ...cmd, [field]: value }
            if (['x', 'y', 'deltaY', 'ms'].includes(field)) {
                updated[field] = parseInt(value, 10) || 0
            }
            return updated
        })
        setEditForm({ ...editForm, commands: cmds })
    }

    const changeStepType = (index, newType) => {
        const cmds = editForm.commands.map((cmd, i) => i === index ? createBlankCommand(newType) : cmd)
        setEditForm({ ...editForm, commands: cmds })
    }

    const formatDate = (ts) => {
        if (!ts) return ''
        const d = new Date(ts)
        const diff = Date.now() - d
        if (diff < 60000) return 'just now'
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
        return d.toLocaleDateString()
    }

    const renderStepFields = (cmd, index) => {
        const cmdType = COMMAND_TYPES.find(c => c.value === cmd.type)
        if (!cmdType) return null
        return cmdType.fields.map(field => (
            <input
                key={field}
                className="automation-step__field"
                type={['x', 'y', 'deltaY', 'ms'].includes(field) ? 'number' : 'text'}
                placeholder={field}
                value={cmd[field] ?? ''}
                onChange={(e) => updateStep(index, field, e.target.value)}
            />
        ))
    }

    return (
        <div className="automations-tab">
            <div className="automations-tab__toolbar">
                <div className="automations-tab__search">
                    <Search size={13} />
                    <input
                        type="text"
                        placeholder="Search automations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button className="automations-tab__create-btn" onClick={() => setShowTestCases(v => !v)}>
                        <FlaskConical size={13} /> Tests
                    </button>
                    {showTestCases && (
                        <>
                            <div className="test-cases-backdrop" onClick={() => setShowTestCases(false)} />
                            <div className="test-cases-dropdown test-cases-dropdown--automations">
                                {TEST_CATEGORIES.map(cat => {
                                    const cases = TEST_CASES.filter(tc => tc.category === cat)
                                    if (cases.length === 0) return null
                                    return (
                                        <div key={cat}>
                                            <div className="test-cases-dropdown__category">{cat}</div>
                                            {cases.map(tc => (
                                                <button
                                                    key={tc.id}
                                                    className="test-cases-dropdown__item"
                                                    onClick={() => handleLoadTestCase(tc)}
                                                >
                                                    <span className="test-cases-dropdown__item-name">
                                                        <Play size={10} /> {tc.name}
                                                    </span>
                                                    <span className="test-cases-dropdown__item-desc">{tc.description}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </div>
                <button className="automations-tab__create-btn" onClick={handleCreate}>
                    <Plus size={13} /> New
                </button>
            </div>

            {/* AI Generate Section */}
            <div className="automations-tab__generate">
                <div className="automations-tab__generate-input-wrap">
                    <Sparkles size={13} className="automations-tab__generate-icon" />
                    <textarea
                        className="automations-tab__generate-input"
                        value={generatePrompt}
                        onChange={(e) => setGeneratePrompt(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleGenerate()
                            }
                        }}
                        placeholder="Describe an automation to generate with AI..."
                        rows={2}
                        disabled={isGenerating}
                    />
                </div>
                <button
                    className="automations-tab__generate-btn"
                    onClick={handleGenerate}
                    disabled={!generatePrompt.trim() || isGenerating}
                >
                    {isGenerating ? (
                        <><Loader size={12} className="spinning" /> Generating...</>
                    ) : (
                        <><Sparkles size={12} /> Generate</>
                    )}
                </button>
                {generateError && (
                    <div className="automations-tab__generate-error">
                        {generateError}
                    </div>
                )}
            </div>

            <div className="automations-tab__list">
                {sorted.length === 0 ? (
                    <div className="automations-tab__empty">
                        <Zap size={28} />
                        <p>No automations yet</p>
                        <p className="automations-tab__empty-hint">
                            Create one or save from the Chat tab after running an automation.
                        </p>
                    </div>
                ) : (
                    sorted.map(auto => {
                        const isRunningThis = runningAutomationId === auto.id
                        const isExpanded = expandedId === auto.id || isRunningThis
                        const isEditing = editingId === auto.id
                        const isDeleting = confirmDeleteId === auto.id

                        return (
                            <div key={auto.id} className={`automation-card ${isExpanded ? 'automation-card--expanded' : ''} ${isRunningThis ? 'automation-card--running' : ''}`}>
                                <div
                                    className="automation-card__header"
                                    onClick={() => !isEditing && setExpandedId(isExpanded ? null : auto.id)}
                                >
                                    <span className="automation-card__chevron">
                                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    </span>
                                    <Zap size={13} className="automation-card__icon" />
                                    {isEditing ? (
                                        <input
                                            className="automation-card__name-input"
                                            value={editForm.name}
                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="Automation name..."
                                        />
                                    ) : (
                                        <span className="automation-card__name">{auto.name}</span>
                                    )}
                                    <span className="automation-card__meta">
                                        {(auto.commands || []).length} steps
                                    </span>
                                </div>

                                {isExpanded && (
                                    <div className="automation-card__body">
                                        {isEditing ? (
                                            <textarea
                                                className="automation-card__desc-input"
                                                value={editForm.description}
                                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                                placeholder="Description (optional)..."
                                                rows={2}
                                            />
                                        ) : (
                                            auto.description && (
                                                <p className="automation-card__description">{auto.description}</p>
                                            )
                                        )}

                                        <div className="automation-card__steps">
                                            <div className="automation-card__steps-header">Steps</div>
                                            {(isEditing ? editForm.commands : auto.commands || []).map((cmd, i) => {
                                                // Determine live step status if this automation is running
                                                const liveStep = isRunningThis && automationSteps ? automationSteps[i] : null
                                                const stepStatusClass = liveStep
                                                    ? `automation-step--live automation-step--live-${liveStep.status}`
                                                    : ''

                                                return (
                                                <div key={i} className={`automation-step ${stepStatusClass}`}>
                                                    <span className="automation-step__number">
                                                        {liveStep?.status === 'running' ? (
                                                            <Loader size={11} className="spinning" />
                                                        ) : liveStep?.status === 'done' ? (
                                                            <CheckCircle size={11} />
                                                        ) : liveStep?.status === 'error' ? (
                                                            <AlertCircle size={11} />
                                                        ) : (
                                                            i + 1
                                                        )}
                                                    </span>
                                                    {isEditing ? (
                                                        <>
                                                            <select
                                                                className="automation-step__type-select"
                                                                value={cmd.type}
                                                                onChange={(e) => changeStepType(i, e.target.value)}
                                                            >
                                                                {COMMAND_TYPES.map(ct => (
                                                                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                                                                ))}
                                                            </select>
                                                            <div className="automation-step__fields">
                                                                {renderStepFields(cmd, i)}
                                                            </div>
                                                            <div className="automation-step__controls">
                                                                <button onClick={() => moveStep(i, -1)} disabled={i === 0} title="Move up">
                                                                    <ArrowUp size={11} />
                                                                </button>
                                                                <button onClick={() => moveStep(i, 1)} disabled={i === editForm.commands.length - 1} title="Move down">
                                                                    <ArrowDown size={11} />
                                                                </button>
                                                                <button onClick={() => removeStep(i)} className="automation-step__delete" title="Remove step">
                                                                    <X size={11} />
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="automation-step__detail">{describeCommand(cmd)}</span>
                                                            {liveStep?.duration != null && (
                                                                <span className="automation-step__duration">
                                                                    {liveStep.duration < 1000 ? `${liveStep.duration}ms` : `${(liveStep.duration / 1000).toFixed(1)}s`}
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                                )
                                            })}
                                            {isEditing && (
                                                <button className="automation-card__add-step" onClick={() => addStep('navigate')}>
                                                    <Plus size={12} /> Add Step
                                                </button>
                                            )}
                                            {!isEditing && (!auto.commands || auto.commands.length === 0) && (
                                                <div className="automation-card__no-steps">No steps defined</div>
                                            )}
                                        </div>

                                        <div className="automation-card__date">
                                            <Clock size={10} /> {formatDate(auto.updatedAt || auto.createdAt)}
                                        </div>

                                        <div className="automation-card__actions">
                                            {isEditing ? (
                                                <>
                                                    <button className="automation-card__action automation-card__action--save" onClick={handleSaveEdit}>
                                                        <Save size={12} /> Save
                                                    </button>
                                                    <button className="automation-card__action" onClick={handleCancelEdit}>
                                                        Cancel
                                                    </button>
                                                </>
                                            ) : isDeleting ? (
                                                <>
                                                    <span className="automation-card__confirm-text">Delete?</span>
                                                    <button className="automation-card__action automation-card__action--danger" onClick={() => handleDelete(auto.id)}>
                                                        Yes, Delete
                                                    </button>
                                                    <button className="automation-card__action" onClick={() => setConfirmDeleteId(null)}>
                                                        Cancel
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        className="automation-card__action automation-card__action--run"
                                                        onClick={() => handleRun(auto)}
                                                        disabled={!auto.commands || auto.commands.length === 0}
                                                    >
                                                        <Play size={12} /> Run
                                                    </button>
                                                    <button className="automation-card__action" onClick={() => handleEdit(auto)}>
                                                        <Edit3 size={12} /> Edit
                                                    </button>
                                                    <button className="automation-card__action" onClick={() => handleDuplicate(auto.id)}>
                                                        <Copy size={12} /> Duplicate
                                                    </button>
                                                    <button className="automation-card__action automation-card__action--danger" onClick={() => setConfirmDeleteId(auto.id)}>
                                                        <Trash2 size={12} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
