import React, { useState, useRef, useEffect, useCallback, Component } from 'react'
import { X, Send, Sparkles, FileText, Zap, Search, Loader, Eye, Square, ChevronDown, ChevronRight, Brain, Play, CheckCircle, AlertCircle, Camera, Mic, ImagePlus, BookOpen, Save, CheckSquare, Activity, FlaskConical } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import LibraryPanel from './LibraryPanel'
import AutomationsTab from './AutomationsTab'
import AutomationReport from './AutomationReport'
import { TEST_CASES, TEST_CATEGORIES } from './TestCases'

// Error boundary to prevent entire panel from going black on render errors
class PanelErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }
    componentDidCatch(error, info) {
        console.error('AIPanel render error:', error, info)
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: 16, color: '#E8334D', fontSize: 13 }}>
                    <p style={{ fontWeight: 600, marginBottom: 8 }}>Panel Error</p>
                    <p style={{ color: '#9898a8' }}>{this.state.error?.message || 'Unknown error'}</p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        style={{
                            marginTop: 12, padding: '6px 16px', background: '#22222e',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
                            color: '#F1BE48', cursor: 'pointer', fontSize: 12
                        }}
                    >
                        Retry
                    </button>
                </div>
            )
        }
        return this.props.children
    }
}

// Safe markdown renderer — falls back to plain text if ReactMarkdown fails
function SafeMarkdown({ children }) {
    try {
        return <ReactMarkdown>{children}</ReactMarkdown>
    } catch (e) {
        return <span style={{ whiteSpace: 'pre-wrap' }}>{children}</span>
    }
}

// Collapsible thinking block — shows the AI's raw reasoning (including commands)
function ThinkingBlock({ content }) {
    const [expanded, setExpanded] = useState(false)
    if (!content) return null
    return (
        <div className="ai-thinking-block">
            <button className="ai-thinking-block__toggle" onClick={() => setExpanded(v => !v)}>
                <Brain size={12} />
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>AI Reasoning</span>
            </button>
            {expanded && (
                <pre className="ai-thinking-block__content">{content}</pre>
            )}
        </div>
    )
}

// Live automation step log — shows each step with status and timing
function AutomationLog({ steps }) {
    if (!steps || steps.length === 0) return null
    return (
        <div className="ai-automation-log">
            {steps.map((step, i) => (
                <div key={i} className={`ai-automation-log__step ai-automation-log__step--${step.status}`}>
                    <span className="ai-automation-log__icon">
                        {step.status === 'running' ? <Loader size={11} className="spinning" /> :
                         step.status === 'done' ? <CheckCircle size={11} /> :
                         step.status === 'error' ? <AlertCircle size={11} /> :
                         <Play size={11} />}
                    </span>
                    <span className="ai-automation-log__detail">{step.detail}</span>
                    {step.duration != null && (
                        <span className="ai-automation-log__time">{step.duration < 1000 ? `${step.duration}ms` : `${(step.duration / 1000).toFixed(1)}s`}</span>
                    )}
                </div>
            ))}
        </div>
    )
}

const PROVIDER_LABELS = {
    openai: 'OpenAI',
    anthropic: 'Claude (Anthropic)',
    gemini: 'Gemini',
    openrouter: 'OpenRouter',
    ollama: 'Ollama (Local)',
    lmstudio: 'LM Studio (Local)'
}

// Strip raw automation command lines from display text (keep prose only)
function cleanMessageText(text) {
    return text
        .split('\n')
        .filter(line => {
            const t = line.trim()
            return !t.match(/^(CLICK_ELEMENT|CLICK|TYPE|FILL|PRESS|SCROLL|NAVIGATE|WAIT|FIND)\s*\(/)
        })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

export default function AIPanel({ settings, onClose, panelWidth = 380, onPanelResize, onAutomationChange }) {
    const [messages, setMessages] = useState([
        {
            role: 'system',
            content: 'AI Assistant ready. Select an action or type a message.'
        }
    ])
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const [activeProvider, setActiveProvider] = useState(
        settings?.aiSettings?.activeProvider || 'openai'
    )
    const [streamingContent, setStreamingContent] = useState('')
    const [isAutomating, setIsAutomating] = useState(false)
    const [automationSteps, setAutomationSteps] = useState([])
    const [showScreenshot, setShowScreenshot] = useState(null)
    // Voice input state
    const [isRecording, setIsRecording] = useState(false)
    const [mediaRecorder, setMediaRecorder] = useState(null)
    const audioChunksRef = useRef([])
    // Image attachment state
    const [attachedImage, setAttachedImage] = useState(null)
    const fileInputRef = useRef(null)
    // Library & save state
    const [showLibrary, setShowLibrary] = useState(false)
    const [showSaveDialog, setShowSaveDialog] = useState(false)
    const [saveDialogType, setSaveDialogType] = useState('conversation') // 'conversation' | 'automation'
    const [saveDialogName, setSaveDialogName] = useState('')
    const [lastAutomationCommands, setLastAutomationCommands] = useState(null) // saved for saving automations
    // Tab state: 'chat' | 'automations'
    const [activeTab, setActiveTab] = useState('chat')
    // Multi-select state for saving messages as automations
    const [isSelectMode, setIsSelectMode] = useState(false)
    const [selectedMessages, setSelectedMessages] = useState(new Set())
    // Automation report state
    const [showReport, setShowReport] = useState(false)
    const [reportCollapsed, setReportCollapsed] = useState(false)
    const [automationName, setAutomationName] = useState('')
    const [automationStartTime, setAutomationStartTime] = useState(null)
    const [automationThinking, setAutomationThinking] = useState('')
    const [runningAutomationId, setRunningAutomationId] = useState(null)
    const [runningStepIndex, setRunningStepIndex] = useState(-1)
    // Test cases dropdown state
    const [showTestCases, setShowTestCases] = useState(false)

    const messagesEndRef = useRef(null)
    const inputRef = useRef(null)
    const streamIdRef = useRef(null)
    // Accumulates streaming content for command parsing after stream ends
    const lastStreamContentRef = useRef('')
    // Prevents duplicate processing if stream-end fires twice (e.g. React StrictMode)
    const processedStreamIdsRef = useRef(new Set())

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [messages, isTyping, streamingContent, scrollToBottom])

    // Notify parent (App) whenever automation state changes, AND inject/remove the
    // in-page overlay (WebContentsView sits above React HTML, so we must inject into the tab)
    useEffect(() => {
        onAutomationChange?.(isAutomating)
        if (isAutomating) {
            window.browserAPI.automation.showOverlay()
        } else {
            window.browserAPI.automation.hideOverlay()
        }
    }, [isAutomating, onAutomationChange])

    // Setup stream listeners
    useEffect(() => {
        const unsubs = []

        unsubs.push(window.browserAPI.ai.onStreamChunk(({ streamId, chunk }) => {
            if (streamId === streamIdRef.current) {
                lastStreamContentRef.current += chunk
                setStreamingContent(prev => prev + chunk)
            }
        }))

        unsubs.push(window.browserAPI.ai.onStreamEnd(({ streamId }) => {
            if (streamId !== streamIdRef.current) return
            // Guard against duplicate stream-end events (React StrictMode / network quirks)
            if (processedStreamIdsRef.current.has(streamId)) return
            processedStreamIdsRef.current.add(streamId)

            const finalContent = lastStreamContentRef.current
            lastStreamContentRef.current = ''

            // Show clean prose to user — strip raw automation command lines from display
            const displayText = cleanMessageText(finalContent)

            setStreamingContent(() => '')
            setIsTyping(false)
            streamIdRef.current = null

            // Auto-execute automation commands found anywhere in the full AI response
            const cmds = parseCommands(finalContent)
            if (cmds.length > 0) {
                // Show assistant message with thinking (raw AI reasoning including commands)
                if (displayText) {
                    setMessages(msgs => [...msgs, { role: 'assistant', content: displayText, thinking: finalContent }])
                }
                // Build initial step list
                const initialSteps = cmds.map((cmd, i) => ({
                    detail: describeCommand(cmd),
                    status: 'pending',
                    duration: null
                }))
                setAutomationSteps(initialSteps)
                setIsAutomating(true)
                setLastAutomationCommands(cmds)
                // Report metadata for AI chat automation
                setAutomationName('AI Chat Automation')
                setAutomationStartTime(Date.now())
                setAutomationThinking(finalContent)
                setShowReport(true)
                setRunningAutomationId(null)
                executeAutomationCommands(cmds, (stepIndex, update) => {
                    setAutomationSteps(prev => prev.map((s, i) => i === stepIndex ? { ...s, ...update } : s))
                }).then(() => {
                    setIsAutomating(false)
                }).catch(err => {
                    setMessages(msgs => [...msgs, { role: 'error', content: `Automation error: ${err.message}` }])
                    setIsAutomating(false)
                })
            } else if (displayText) {
                setMessages(msgs => [...msgs, { role: 'assistant', content: displayText }])
            }
        }))

        unsubs.push(window.browserAPI.ai.onStreamError(({ streamId, error, aborted }) => {
            if (streamId === streamIdRef.current) {
                // If we had partial content, keep it as a message
                setStreamingContent(prev => {
                    if (prev) {
                        setMessages(msgs => [...msgs, {
                            role: 'assistant',
                            content: prev + (aborted ? '\n\n*(stopped)*' : '')
                        }])
                    }
                    return ''
                })
                if (!aborted) {
                    setMessages(msgs => [...msgs, { role: 'error', content: `Error: ${error}` }])
                } else {
                    setMessages(msgs => [...msgs, { role: 'system', content: '⏹ Request stopped.' }])
                }
                setIsTyping(false)
                setIsAutomating(false)
                streamIdRef.current = null
            }
        }))

        // Listen for explicit stop confirmation from main process
        unsubs.push(window.browserAPI.ai.onStopped(() => {
            setStreamingContent(prev => {
                if (prev) {
                    setMessages(msgs => [...msgs, { role: 'assistant', content: prev + '\n\n*(stopped)*' }])
                }
                return ''
            })
            setIsTyping(false)
            setIsAutomating(false)
            streamIdRef.current = null
        }))

        return () => unsubs.forEach(unsub => unsub?.())
    }, [])

    const handleProviderChange = async (e) => {
        const provider = e.target.value
        setActiveProvider(provider)
        const aiSettings = { ...settings.aiSettings, activeProvider: provider }
        await window.browserAPI.settings.set('aiSettings', aiSettings)
    }

    const addMessage = (role, content, extra = {}) => {
        setMessages(prev => [...prev, { role, content, ...extra }])
    }

    /** Capture a screenshot of the active tab, returns data URL or null */
    const captureScreenshot = async () => {
        try {
            const result = await window.browserAPI.automation.screenshot()
            if (result && result.data && !result.error) {
                return result.data // data:image/png;base64,...
            }
        } catch (e) {
            console.warn('Screenshot capture failed:', e.message)
        }
        return null
    }

    /** Toggle microphone recording for voice input */
    const handleMicToggle = async () => {
        if (isRecording) {
            // Stop recording
            mediaRecorder?.stop()
            return
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus' : 'audio/webm'
            const recorder = new MediaRecorder(stream, { mimeType })
            audioChunksRef.current = []

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data)
            }

            recorder.onstop = async () => {
                setIsRecording(false)
                setMediaRecorder(null)
                stream.getTracks().forEach(t => t.stop()) // Release mic

                const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType })
                if (audioBlob.size === 0) return

                addMessage('system', 'Transcribing audio...')

                // Convert blob to base64
                const reader = new FileReader()
                reader.onloadend = async () => {
                    const base64 = reader.result.split(',')[1] // strip data URL prefix
                    try {
                        const result = await window.browserAPI.ai.transcribe({
                            audioData: base64,
                            mimeType: recorder.mimeType
                        })
                        if (result.error) {
                            addMessage('error', `Voice input error: ${result.error}`)
                        } else if (result.text) {
                            setInput(prev => prev + (prev ? ' ' : '') + result.text)
                            addMessage('system', `Transcribed: "${result.text.length > 80 ? result.text.substring(0, 80) + '...' : result.text}"`)
                        }
                    } catch (err) {
                        addMessage('error', `Voice input error: ${err.message}`)
                    }
                }
                reader.readAsDataURL(audioBlob)
            }

            recorder.start()
            setMediaRecorder(recorder)
            setIsRecording(true)
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                addMessage('error', 'Microphone access denied. Please allow microphone access in your system settings.')
            } else {
                addMessage('error', `Microphone error: ${err.message}`)
            }
        }
    }

    /** Open file picker for image attachment */
    const handleImageAttach = () => {
        fileInputRef.current?.click()
    }

    /** Handle selected image file */
    const handleImageSelected = (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onloadend = () => {
            setAttachedImage(reader.result) // data:image/...;base64,...
        }
        reader.readAsDataURL(file)
        // Reset so same file can be selected again
        e.target.value = ''
    }

    const handleSend = async () => {
        if ((!input.trim() && !attachedImage) || isTyping) return

        const userMessage = input.trim()
        const imageToSend = attachedImage
        setInput('')
        setAttachedImage(null)
        setIsTyping(true)
        lastStreamContentRef.current = ''
        processedStreamIdsRef.current.clear()

        try {
            // Capture screenshot of current page to give the AI vision
            const screenshotData = await captureScreenshot()
            // User-attached image takes priority over auto-screenshot
            const imageData = imageToSend || screenshotData
            addMessage('user', userMessage || '(image)', {
                ...(screenshotData && !imageToSend ? { hasScreenshot: true } : {}),
                ...(imageToSend ? { hasImage: true } : {})
            })

            const chatMessages = messages
                .filter(m => m.role !== 'system' && m.role !== 'error')
                .concat([{ role: 'user', content: userMessage || 'Describe what you see in this image.', ...(imageData ? { image: imageData } : {}) }])
                .map(m => {
                    const msg = { role: m.role, content: m.content }
                    if (m.image) msg.image = m.image
                    return msg
                })

            chatMessages.unshift({
                role: 'system',
                content: `You are an AI research assistant in That Browser.
Be helpful, concise, and accurate. Format responses in markdown when appropriate.
You can help with research, summarization, task planning, and answering questions.

You have VISION capability — a screenshot of the current browser tab is attached to each user message. Use it to understand what the user sees, identify elements on the page, and make better automation decisions.

You have FULL browser automation capability. When the user asks you to interact with the browser (click links, fill forms, navigate, scroll, type), include the exact automation commands in your response on their own lines using this format:

CLICK_ELEMENT("css-selector") — click element by CSS selector (best for links/buttons)
CLICK(x, y) — click at pixel coordinates
TYPE("text") — type into focused element
FILL("css-selector", "value") — fill an input field
PRESS("Enter") — press a key (Enter, Tab, Escape, ArrowDown, etc.)
SCROLL(pixels) — scroll page (positive=down, negative=up)
NAVIGATE("url") — go to a URL
WAIT(milliseconds) — wait for page to load

Example — if user says "click the Google search box":
I'll click the Google search box for you.
CLICK_ELEMENT("textarea[name='q']")

Example — if user says "go to YouTube":
Navigating to YouTube now.
NAVIGATE("https://www.youtube.com")

Always include the commands when performing browser actions. Each command must be on its own line.`
            })

            // Try streaming first, fall back to regular
            const result = await window.browserAPI.ai.chatStream({
                messages: chatMessages,
                provider: activeProvider
            })

            if (result.error) {
                // Streaming not supported or failed, fall back to regular chat
                const regularResult = await window.browserAPI.ai.chat({
                    messages: chatMessages,
                    provider: activeProvider
                })
                if (regularResult.error) {
                    addMessage('error', `Error: ${regularResult.error}`)
                } else {
                    addMessage('assistant', regularResult.content)
                }
                setIsTyping(false)
            } else {
                // Streaming started
                streamIdRef.current = result.streamId
                setStreamingContent('')
            }
        } catch (err) {
            addMessage('error', `Error: ${err.message}`)
            setIsTyping(false)
        }
    }

    const handleSummarize = async () => {
        if (isTyping) return
        setIsTyping(true)
        addMessage('system', 'Summarizing current page...')

        try {
            const result = await window.browserAPI.ai.summarize({ provider: activeProvider })
            if (result.error) {
                addMessage('error', `Error: ${result.error}`)
            } else {
                addMessage('assistant', result.content)
            }
        } catch (err) {
            addMessage('error', `Error: ${err.message}`)
        } finally {
            setIsTyping(false)
        }
    }

    const handleExtractData = async () => {
        if (isTyping) return
        setIsTyping(true)
        addMessage('system', 'Extracting data from current page...')

        try {
            const pageContent = await window.browserAPI.ai.getPageContent()
            if (pageContent.error) {
                addMessage('error', `Error: ${pageContent.error}`)
                setIsTyping(false)
                return
            }

            const result = await window.browserAPI.ai.chat({
                messages: [
                    {
                        role: 'system',
                        content: `Extract and organize the key data from this web page into a structured format.
Use tables, lists, or JSON as appropriate. Focus on factual information, numbers, dates, and named entities.`
                    },
                    {
                        role: 'user',
                        content: `Extract structured data from this page:\n\nTitle: ${pageContent.title}\nURL: ${pageContent.url}\n\nContent:\n${pageContent.text}`
                    }
                ],
                provider: activeProvider
            })

            if (result.error) {
                addMessage('error', `Error: ${result.error}`)
            } else {
                addMessage('assistant', result.content)
            }
        } catch (err) {
            addMessage('error', `Error: ${err.message}`)
        } finally {
            setIsTyping(false)
        }
    }

    // === Automation Helpers ===

    /** Describe a command in human-readable form for the steps panel */
    const describeCommand = (cmd) => {
        switch (cmd.type) {
            case 'click': return `Click at (${cmd.x}, ${cmd.y})`
            case 'click_element': return `Click "${cmd.selector}"`
            case 'type': return `Type "${cmd.text.length > 30 ? cmd.text.substring(0, 30) + '…' : cmd.text}"`
            case 'fill': return `Fill "${cmd.selector}" → "${cmd.value.length > 20 ? cmd.value.substring(0, 20) + '…' : cmd.value}"`
            case 'press': return `Press ${cmd.key}`
            case 'scroll': return `Scroll ${cmd.deltaY > 0 ? 'down' : 'up'} ${Math.abs(cmd.deltaY)}px`
            case 'navigate': return `Navigate → ${cmd.url.length > 40 ? cmd.url.substring(0, 40) + '…' : cmd.url}`
            case 'wait': return `Wait ${cmd.ms}ms`
            case 'find': return `Find "${cmd.selector}"`
            default: return cmd.type
        }
    }

    /**
     * Parse automation commands from AI response.
     * Supports both code-block and inline formats.
     * Commands:
     *   CLICK(x, y) or CLICK_ELEMENT("selector")
     *   TYPE("text")
     *   PRESS("key")
     *   SCROLL(deltaY)
     *   NAVIGATE("url")
     *   WAIT(ms)
     *   FIND("selector")
     *   FILL("selector", "value")
     */
    const parseCommands = (text) => {
        const commands = []
        // Match commands both inside and outside code blocks
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

    const executeAutomationCommands = async (commands, onStepUpdate) => {
        // Show overlay DIRECTLY — don't rely on React state timing
        window.browserAPI.automation.showOverlay()
        // Small delay to let the overlay inject before we start clicking
        await new Promise(r => setTimeout(r, 150))

        for (let i = 0; i < commands.length; i++) {
            const cmd = commands[i]
            const startTime = Date.now()
            setRunningStepIndex(i)
            onStepUpdate?.(i, { status: 'running' })

            try {
                let result
                switch (cmd.type) {
                    case 'click':
                        result = await window.browserAPI.automation.click({ x: cmd.x, y: cmd.y })
                        break
                    case 'click_element':
                        result = await window.browserAPI.automation.clickElement({ selector: cmd.selector })
                        break
                    case 'type':
                        result = await window.browserAPI.automation.type({ text: cmd.text })
                        break
                    case 'fill':
                        result = await window.browserAPI.automation.fillInput({ selector: cmd.selector, value: cmd.value })
                        break
                    case 'press':
                        result = await window.browserAPI.automation.pressKey({ key: cmd.key })
                        break
                    case 'scroll':
                        result = await window.browserAPI.automation.scroll({ x: 400, y: 300, deltaX: 0, deltaY: cmd.deltaY })
                        break
                    case 'navigate':
                        result = await window.browserAPI.automation.navigate({ url: cmd.url })
                        break
                    case 'wait':
                        result = await window.browserAPI.automation.wait({ ms: cmd.ms })
                        break
                    case 'find':
                        result = await window.browserAPI.automation.getElements({ selector: cmd.selector })
                        break
                }
                const duration = Date.now() - startTime
                if (result?.error) {
                    onStepUpdate?.(i, { status: 'error', detail: `${describeCommand(cmd)} — ${result.error}`, duration })
                } else {
                    onStepUpdate?.(i, { status: 'done', duration })
                }
                // Brief pause between commands for page to react (faster than before)
                if (i < commands.length - 1) {
                    await new Promise(r => setTimeout(r, 250))
                }
            } catch (err) {
                const duration = Date.now() - startTime
                onStepUpdate?.(i, { status: 'error', detail: `${describeCommand(cmd)} — ${err.message}`, duration })
            }
        }

        setRunningStepIndex(-1)
        // Brief linger so user sees the overlay completion
        await new Promise(r => setTimeout(r, 600))
        window.browserAPI.automation.hideOverlay()
    }

    const handleExecuteTask = async () => {
        const task = input.trim()
        if (!task) {
            addMessage('system', 'Type a task description first, then click "Automate"')
            return
        }

        setInput('')
        addMessage('user', `Automate: ${task}`)
        setIsTyping(true)
        setIsAutomating(true)

        try {
            // Step 1: Get page context, interactive elements, AND a screenshot
            const [pageContent, elements, screenshotData] = await Promise.all([
                window.browserAPI.ai.getPageContent(),
                window.browserAPI.automation.findElement({ description: task }),
                captureScreenshot()
            ])
            const elList = (elements.elements || []).slice(0, 40)

            // Step 2: Build a rich element description for the AI including CSS selectors
            const elementDescriptions = elList.map((el, i) => {
                const selectorParts = []
                if (el.id) selectorParts.push(`#${el.id}`)
                else {
                    selectorParts.push(el.tag)
                    if (el.type) selectorParts.push(`[type="${el.type}"]`)
                }
                const selector = selectorParts.join('')
                return `[${i}] <${el.tag}> "${el.text?.substring(0, 60) || ''}" at (${el.x}, ${el.y}) size ${el.width}x${el.height} selector: "${selector}" ${el.href ? 'href=' + el.href : ''}`
            }).join('\n')

            // Step 3: Ask AI to plan actions using our command format (with screenshot for vision)
            const systemPrompt = `You are a browser automation agent controlling a web browser.
You have VISION capability — a screenshot of the current page is attached. Use it to understand the page layout and make better decisions.
You MUST respond with executable commands. Available commands:

CLICK(x, y) — Click at pixel coordinates on the page
CLICK_ELEMENT("css-selector") — Click an element by CSS selector (MORE RELIABLE than coordinates)
TYPE("text") — Type text into the currently focused element
FILL("css-selector", "value") — Focus an input and set its value (MOST RELIABLE for forms)
PRESS("Enter") — Press a key (Enter, Tab, Escape, Backspace, ArrowDown, etc.)
SCROLL(pixels) — Scroll the page (positive = down, negative = up)
NAVIGATE("url") — Navigate to a URL
WAIT(milliseconds) — Wait for page to load

IMPORTANT RULES:
- Prefer CLICK_ELEMENT("selector") or FILL("selector", "value") over CLICK(x,y) when an element has an id or clear selector
- For search boxes: use FILL to enter text, then PRESS("Enter") to submit
- For links/buttons: use CLICK_ELEMENT with the selector or CLICK with coordinates
- Put each command on its own line
- Execute only the MINIMUM commands needed
- Always WAIT(500) after NAVIGATE or important clicks

Example for Google search:
FILL("textarea[name='q']", "AI research papers")
PRESS("Enter")
WAIT(1000)`

            const userMsg = {
                role: 'user',
                content: `Task: ${task}\n\nCurrent page: ${pageContent.title || 'unknown'} (${pageContent.url || 'unknown'})\n\nInteractive elements on page:\n${elementDescriptions}`
            }
            if (screenshotData) userMsg.image = screenshotData

            const result = await window.browserAPI.ai.chat({
                messages: [
                    { role: 'system', content: systemPrompt },
                    userMsg
                ],
                provider: activeProvider
            })

            if (result.error) {
                addMessage('error', `Error: ${result.error}`)
            } else {
                // Step 4: Parse and execute the commands
                const commands = parseCommands(result.content)
                const displayText = cleanMessageText(result.content)
                if (commands.length > 0) {
                    if (displayText) {
                        addMessage('assistant', displayText)
                    }
                    // Build step list
                    const initialSteps = commands.map(cmd => ({
                        detail: describeCommand(cmd),
                        status: 'pending',
                        duration: null
                    }))
                    setAutomationSteps(initialSteps)
                    setLastAutomationCommands(commands)
                    await executeAutomationCommands(commands, (stepIndex, update) => {
                        setAutomationSteps(prev => prev.map((s, i) => i === stepIndex ? { ...s, ...update } : s))
                    })
                } else {
                    addMessage('assistant', result.content)
                    addMessage('system', 'No executable commands found. Try rephrasing your task.')
                }
            }
        } catch (err) {
            addMessage('error', `Error: ${err.message}`)
        } finally {
            setIsTyping(false)
            setIsAutomating(false)
        }
    }

    const handleScreenshot = async () => {
        try {
            const result = await window.browserAPI.automation.screenshot()
            if (result.error) {
                addMessage('error', `Screenshot error: ${result.error}`)
            } else {
                setShowScreenshot(result.data)
                addMessage('system', `Screenshot captured (${result.width}x${result.height})`)
            }
        } catch (err) {
            addMessage('error', `Screenshot error: ${err.message}`)
        }
    }

    const handleGeminiSearch = async () => {
        const query = input.trim()
        if (!query) {
            addMessage('system', 'Type a search query first, then click "Search"')
            return
        }

        setInput('')
        addMessage('user', `Search: ${query}`)
        setIsTyping(true)

        try {
            const result = await window.browserAPI.search.gemini(query)

            if (result.error) {
                addMessage('error', `Error: ${result.error}`)
            } else {
                let content = result.content
                if (result.sources && result.sources.length > 0) {
                    content += '\n\n---\n**Sources:**\n'
                    result.sources.forEach(src => {
                        content += `- [${src.title}](${src.url})\n`
                    })
                }
                addMessage('assistant', content)
            }
        } catch (err) {
            addMessage('error', `Error: ${err.message}`)
        } finally {
            setIsTyping(false)
        }
    }

    const handleStop = useCallback(() => {
        window.browserAPI.ai.stop()
        // Immediate local state reset so UI is responsive even before IPC round-trip
        setIsTyping(false)
        setIsAutomating(false)
        setStreamingContent(prev => {
            if (prev) {
                setMessages(msgs => [...msgs, { role: 'assistant', content: prev + '\n\n*(stopped)*' }])
            } else {
                setMessages(msgs => [...msgs, { role: 'system', content: '⏹ Request stopped.' }])
            }
            return ''
        })
        streamIdRef.current = null
    }, [])

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    // === Library Save/Load Handlers ===

    const handleSaveConversation = async () => {
        const chatMessages = messages.filter(m => m.role !== 'system')
        if (chatMessages.length === 0) { addMessage('system', 'Nothing to save — start a conversation first.'); return }
        setSaveDialogType('conversation')
        // Auto-generate a name from the first user message
        const firstUser = chatMessages.find(m => m.role === 'user')
        setSaveDialogName(firstUser?.content?.substring(0, 60) || 'Untitled Chat')
        setShowSaveDialog(true)
    }

    const handleSaveAutomation = async () => {
        if (!lastAutomationCommands || lastAutomationCommands.length === 0) {
            addMessage('system', 'No automation to save — run an automation first.')
            return
        }
        setSaveDialogType('automation')
        setSaveDialogName('Untitled Automation')
        setShowSaveDialog(true)
    }

    /** Save a single chat message as an automation */
    const handleSaveMessageAsAutomation = async (msg, index) => {
        let commands = []

        if (msg.thinking) {
            commands = parseCommands(msg.thinking)
        }

        if (commands.length === 0) {
            // No commands in thinking — ask AI to generate from conversation context
            const contextMessages = messages
                .slice(Math.max(0, index - 2), index + 1)
                .filter(m => m.role === 'user' || m.role === 'assistant')
                .map(m => ({ role: m.role, content: m.content }))

            try {
                const result = await window.browserAPI.ai.chat({
                    messages: [
                        {
                            role: 'system',
                            content: `Convert this conversation into browser automation commands. Respond ONLY with commands, no explanation.\n\nAvailable commands:\nCLICK(x, y)\nCLICK_ELEMENT("css-selector")\nTYPE("text")\nFILL("css-selector", "value")\nPRESS("key")\nSCROLL(pixels)\nNAVIGATE("url")\nWAIT(milliseconds)\nFIND("css-selector")`
                        },
                        ...contextMessages
                    ],
                    provider: activeProvider
                })
                if (!result.error) {
                    commands = parseCommands(result.content)
                }
            } catch (err) {
                addMessage('error', `Could not generate automation: ${err.message}`)
                return
            }
        }

        if (commands.length === 0) {
            addMessage('system', 'No automation commands could be extracted from this message.')
            return
        }

        setLastAutomationCommands(commands)
        setSaveDialogType('automation')
        const preview = msg.content.substring(0, 50).replace(/\n/g, ' ')
        setSaveDialogName(preview || 'Automation from chat')
        setShowSaveDialog(true)
    }

    /** Toggle multi-select mode */
    const toggleSelectMode = () => {
        setIsSelectMode(v => !v)
        setSelectedMessages(new Set())
    }

    const toggleSelectMessage = (index) => {
        setSelectedMessages(prev => {
            const next = new Set(prev)
            if (next.has(index)) next.delete(index)
            else next.add(index)
            return next
        })
    }

    /** Save all selected messages' commands as one automation */
    const handleSaveSelectedAsAutomation = () => {
        const sortedIndices = [...selectedMessages].sort((a, b) => a - b)
        const allCommands = []

        for (const idx of sortedIndices) {
            const msg = messages[idx]
            if (msg.role !== 'assistant') continue
            if (msg.thinking) {
                allCommands.push(...parseCommands(msg.thinking))
            }
        }

        if (allCommands.length === 0) {
            addMessage('system', 'No automation commands found in selected messages. Select messages that contain automation steps.')
            return
        }

        setLastAutomationCommands(allCommands)
        setSaveDialogType('automation')
        setSaveDialogName(`Combined automation (${sortedIndices.length} messages)`)
        setShowSaveDialog(true)
        setIsSelectMode(false)
        setSelectedMessages(new Set())
    }

    const handleSaveDialogConfirm = async () => {
        if (!saveDialogName.trim()) return
        if (saveDialogType === 'conversation') {
            const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({
                role: m.role, content: m.content
            }))
            await window.browserAPI.library.saveConversation({
                name: saveDialogName.trim(),
                messages: chatMessages,
                provider: activeProvider
            })
            addMessage('system', `Conversation saved as "${saveDialogName.trim()}"`)
        } else {
            await window.browserAPI.library.saveAutomation({
                name: saveDialogName.trim(),
                commands: lastAutomationCommands,
                description: ''
            })
            addMessage('system', `Automation saved as "${saveDialogName.trim()}"`)
        }
        setShowSaveDialog(false)
        setSaveDialogName('')
    }

    const handleLoadConversation = (item) => {
        // Restore saved conversation messages
        const loaded = [
            { role: 'system', content: `Loaded conversation: "${item.name}"` },
            ...item.messages
        ]
        setMessages(loaded)
        if (item.provider) setActiveProvider(item.provider)
    }

    const handleLoadAutomation = (item) => {
        if (!item.commands || item.commands.length === 0) {
            addMessage('system', 'This automation has no commands.')
            return
        }
        addMessage('system', `Running saved automation: "${item.name}"`)
        setLastAutomationCommands(item.commands)
        const initialSteps = item.commands.map(cmd => ({
            detail: describeCommand(cmd),
            status: 'pending',
            duration: null
        }))
        setAutomationSteps(initialSteps)
        setIsAutomating(true)
        // Report metadata for saved automation
        setAutomationName(item.name || 'Saved Automation')
        setAutomationStartTime(Date.now())
        setAutomationThinking(item.description || '')
        setRunningAutomationId(item.id || null)
        setShowReport(true)
        executeAutomationCommands(item.commands, (stepIndex, update) => {
            setAutomationSteps(prev => prev.map((s, i) => i === stepIndex ? { ...s, ...update } : s))
        }).then(() => {
            setIsAutomating(false)
            setRunningAutomationId(null)
        }).catch(err => {
            addMessage('error', `Automation error: ${err.message}`)
            setIsAutomating(false)
            setRunningAutomationId(null)
        })
    }

    const handleRunTestCase = (testCase) => {
        setShowTestCases(false)
        if (!testCase.commands || testCase.commands.length === 0) return
        addMessage('system', `Running test case: "${testCase.name}" — ${testCase.description}`)
        setLastAutomationCommands(testCase.commands)
        const initialSteps = testCase.commands.map(cmd => ({
            detail: describeCommand(cmd),
            status: 'pending',
            duration: null
        }))
        setAutomationSteps(initialSteps)
        setIsAutomating(true)
        // Report metadata
        setAutomationName(`Test: ${testCase.name}`)
        setAutomationStartTime(Date.now())
        setAutomationThinking(testCase.description || '')
        setRunningAutomationId(null)
        setShowReport(true)
        executeAutomationCommands(testCase.commands, (stepIndex, update) => {
            setAutomationSteps(prev => prev.map((s, i) => i === stepIndex ? { ...s, ...update } : s))
        }).then(() => {
            setIsAutomating(false)
            addMessage('system', `Test case "${testCase.name}" completed.`)
        }).catch(err => {
            addMessage('error', `Test case error: ${err.message}`)
            setIsAutomating(false)
        })
    }

    // Drag-to-resize handler for the left edge handle
    const handleResizeMouseDown = useCallback((e) => {
        e.preventDefault()
        const startX = e.clientX
        const startWidth = panelWidth

        const onMouseMove = (e) => {
            // Dragging left = wider, dragging right = narrower
            const delta = startX - e.clientX
            const newWidth = Math.max(260, Math.min(900, startWidth + delta))
            onPanelResize?.(newWidth)
        }

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseup', onMouseUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }

        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)
        document.body.style.cursor = 'ew-resize'
        document.body.style.userSelect = 'none'
    }, [panelWidth, onPanelResize])

    return (
        <div className="ai-panel" style={{ width: panelWidth }}>
            {/* Drag handle on left edge */}
            <div className="ai-panel__resize-handle" onMouseDown={handleResizeMouseDown} />
            <PanelErrorBoundary>
            <div className="ai-panel__header">
                <div className="ai-panel__title">
                    <div className="ai-panel__title-icon">
                        <Sparkles size={12} color="white" />
                    </div>
                    AI Assistant
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button
                        className={`ai-panel__header-btn ${showReport ? 'ai-panel__header-btn--active' : ''}`}
                        onClick={() => { setShowReport(v => !v); setReportCollapsed(false) }}
                        title={showReport ? 'Hide automation report' : 'Show automation report'}
                    >
                        <Activity size={14} />
                    </button>
                    <button
                        className={`ai-panel__header-btn ${isSelectMode ? 'ai-panel__header-btn--active' : ''}`}
                        onClick={toggleSelectMode}
                        title={isSelectMode ? 'Exit select mode' : 'Select messages to save as automation'}
                    >
                        <CheckSquare size={14} />
                    </button>
                    <button
                        className="ai-panel__header-btn"
                        onClick={() => setShowLibrary(true)}
                        title="Library — saved conversations & automations"
                    >
                        <BookOpen size={14} />
                    </button>
                    <button
                        className="ai-panel__header-btn"
                        onClick={handleSaveConversation}
                        title="Save current conversation"
                    >
                        <Save size={14} />
                    </button>
                    <button className="ai-panel__close" onClick={() => {
                        onClose()
                        window.browserAPI.ai.togglePanel(false)
                    }}>
                        <X size={16} />
                    </button>
                </div>
            </div>

            <div className="ai-panel__provider">
                <select value={activeProvider} onChange={handleProviderChange}>
                    {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
            </div>

            {/* Tab bar: Chat | Automations */}
            <div className="ai-panel__tabs">
                <button
                    className={`ai-panel__tab ${activeTab === 'chat' ? 'ai-panel__tab--active' : ''}`}
                    onClick={() => setActiveTab('chat')}
                >
                    Chat
                </button>
                <button
                    className={`ai-panel__tab ${activeTab === 'automations' ? 'ai-panel__tab--active' : ''}`}
                    onClick={() => setActiveTab('automations')}
                >
                    Automations
                </button>
            </div>

            {activeTab === 'chat' && (<>
            <div className="ai-panel__quick-actions">
                <button className="ai-panel__action-btn" onClick={handleSummarize} disabled={isTyping}>
                    <FileText size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    Summarize
                </button>
                <button className="ai-panel__action-btn" onClick={handleExtractData} disabled={isTyping}>
                    <Zap size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    Extract
                </button>
                <button className="ai-panel__action-btn" onClick={handleExecuteTask} disabled={isTyping}>
                    <Sparkles size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    Automate
                </button>
                <button className="ai-panel__action-btn" onClick={handleGeminiSearch} disabled={isTyping}>
                    <Search size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    Search
                </button>
                <button className="ai-panel__action-btn" onClick={handleScreenshot} disabled={isTyping}>
                    <Eye size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    Screenshot
                </button>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                        className={`ai-panel__action-btn ${showTestCases ? 'ai-panel__action-btn--active' : ''}`}
                        onClick={() => setShowTestCases(v => !v)}
                        disabled={isTyping || isAutomating}
                    >
                        <FlaskConical size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        Test Cases
                    </button>
                    {showTestCases && (
                        <>
                            <div className="test-cases-backdrop" onClick={() => setShowTestCases(false)} />
                            <div className="test-cases-dropdown">
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
                                                    onClick={() => handleRunTestCase(tc)}
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
                {lastAutomationCommands && lastAutomationCommands.length > 0 && (
                    <button className="ai-panel__action-btn" onClick={handleSaveAutomation} disabled={isTyping}>
                        <Save size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        Save Auto
                    </button>
                )}
            </div>

            <div className="ai-panel__messages">
                {messages.map((msg, i) => (
                    <div key={i} className={isSelectMode && msg.role === 'assistant' ? 'ai-message-wrap ai-message-wrap--selectable' : 'ai-message-wrap'}>
                        {isSelectMode && msg.role === 'assistant' && (
                            <label className="ai-message-wrap__checkbox" onClick={(e) => e.stopPropagation()}>
                                <input
                                    type="checkbox"
                                    checked={selectedMessages.has(i)}
                                    onChange={() => toggleSelectMessage(i)}
                                />
                            </label>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div className={`ai-message ai-message--${msg.role} ${isSelectMode && selectedMessages.has(i) ? 'ai-message--selected' : ''}`}>
                                {msg.role === 'assistant' ? (
                                    <SafeMarkdown>{msg.content}</SafeMarkdown>
                                ) : (
                                    msg.content
                                )}
                                {msg.hasScreenshot && (
                                    <span className="ai-message__screenshot-badge" title="Screenshot attached to this message">
                                        <Camera size={10} /> screen captured
                                    </span>
                                )}
                                {msg.hasImage && (
                                    <span className="ai-message__image-badge" title="Image attached to this message">
                                        <ImagePlus size={10} /> image attached
                                    </span>
                                )}
                                {/* Per-message save-as-automation button */}
                                {msg.role === 'assistant' && !isSelectMode && (
                                    <button
                                        className="ai-message__save-btn"
                                        onClick={() => handleSaveMessageAsAutomation(msg, i)}
                                        title="Save as automation"
                                    >
                                        <Zap size={11} />
                                    </button>
                                )}
                            </div>
                            {msg.thinking && (
                                <ThinkingBlock content={msg.thinking} />
                            )}
                        </div>
                    </div>
                ))}
                {streamingContent && (
                    <div className="ai-message ai-message--assistant ai-message--streaming">
                        <SafeMarkdown>{cleanMessageText(streamingContent)}</SafeMarkdown>
                        <span className="ai-panel__cursor" />
                    </div>
                )}
                {/* Live automation step log */}
                {isAutomating && automationSteps.length > 0 && (
                    <AutomationLog steps={automationSteps} />
                )}
                {/* Completed automation steps (shown briefly after done) */}
                {!isAutomating && automationSteps.length > 0 && automationSteps.every(s => s.status === 'done' || s.status === 'error') && (
                    <AutomationLog steps={automationSteps} />
                )}
                {showScreenshot && (
                    <div className="ai-panel__screenshot">
                        <img
                            src={showScreenshot}
                            alt="Page screenshot"
                            onClick={() => setShowScreenshot(null)}
                            title="Click to dismiss"
                        />
                    </div>
                )}
                {isTyping && !streamingContent && (
                    <div className="ai-panel__typing">
                        <div className="ai-panel__typing-dot" />
                        <div className="ai-panel__typing-dot" />
                        <div className="ai-panel__typing-dot" />
                        <span style={{ marginLeft: 4, flex: 1 }}>
                            {isAutomating ? 'Executing steps...' : 'AI is thinking...'}
                        </span>
                        <button
                            className="ai-panel__stop-btn"
                            onClick={handleStop}
                            title="Stop generation"
                        >
                            <Square size={10} style={{ marginRight: 3 }} />
                            Stop
                        </button>
                    </div>
                )}
                {/* Floating multi-select action bar */}
                {isSelectMode && selectedMessages.size > 0 && (
                    <div className="ai-select-bar">
                        <span className="ai-select-bar__count">
                            {selectedMessages.size} selected
                        </span>
                        <button className="ai-select-bar__save" onClick={handleSaveSelectedAsAutomation}>
                            <Zap size={12} /> Save as Automation
                        </button>
                        <button className="ai-select-bar__cancel" onClick={toggleSelectMode}>
                            Cancel
                        </button>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="ai-panel__input-area">
                {/* Image preview when attached */}
                {attachedImage && (
                    <div className="ai-panel__image-preview">
                        <img src={attachedImage} alt="Attached" />
                        <button
                            className="ai-panel__image-preview-remove"
                            onClick={() => setAttachedImage(null)}
                            title="Remove image"
                        >
                            <X size={10} />
                        </button>
                    </div>
                )}
                <div className="ai-panel__input-wrap">
                    <textarea
                        ref={inputRef}
                        className="ai-panel__input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything, describe a task to automate..."
                        rows={1}
                    />
                    {/* Mic button for voice input */}
                    <button
                        className={`ai-panel__mic ${isRecording ? 'ai-panel__mic--recording' : ''}`}
                        onClick={handleMicToggle}
                        title={isRecording ? 'Stop recording' : 'Voice input'}
                        disabled={isTyping}
                    >
                        <Mic size={14} />
                    </button>
                    {/* Image attachment button */}
                    <button
                        className="ai-panel__image-btn"
                        onClick={handleImageAttach}
                        title="Attach image (vision: GPT-4o, Claude 3+, Gemini, LLaVA)"
                        disabled={isTyping}
                    >
                        <ImagePlus size={14} />
                    </button>
                    {/* Send/Stop button */}
                    {isTyping ? (
                        <button
                            className="ai-panel__send ai-panel__send--stop"
                            onClick={handleStop}
                            title="Stop generation"
                        >
                            <Square size={14} />
                        </button>
                    ) : (
                        <button
                            className="ai-panel__send"
                            onClick={handleSend}
                            disabled={!input.trim() && !attachedImage}
                        >
                            <Send size={14} />
                        </button>
                    )}
                </div>
            </div>
            {/* Hidden file input for image attachment */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                style={{ display: 'none' }}
                onChange={handleImageSelected}
            />
            </>)}

            {activeTab === 'automations' && (
                <AutomationsTab
                    onRunAutomation={handleLoadAutomation}
                    activeProvider={activeProvider}
                    runningAutomationId={runningAutomationId}
                    runningStepIndex={runningStepIndex}
                    automationSteps={automationSteps}
                />
            )}
        </PanelErrorBoundary>

            {/* Save Dialog */}
            {showSaveDialog && (
                <div className="save-dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSaveDialog(false) }}>
                    <div className="save-dialog">
                        <h3 className="save-dialog__title">
                            {saveDialogType === 'conversation' ? <><Save size={14} /> Save Conversation</> : <><Zap size={14} /> Save Automation</>}
                        </h3>
                        <div className="save-dialog__field">
                            <label>Name</label>
                            <input
                                type="text"
                                value={saveDialogName}
                                onChange={(e) => setSaveDialogName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDialogConfirm() }}
                                placeholder="Enter a name..."
                                autoFocus
                            />
                        </div>
                        <div className="save-dialog__actions">
                            <button className="save-dialog__cancel" onClick={() => setShowSaveDialog(false)}>Cancel</button>
                            <button className="save-dialog__confirm" onClick={handleSaveDialogConfirm} disabled={!saveDialogName.trim()}>
                                <Save size={12} /> Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Library Panel */}
            {showLibrary && (
                <LibraryPanel
                    onClose={() => setShowLibrary(false)}
                    onLoadConversation={handleLoadConversation}
                    onLoadAutomation={handleLoadAutomation}
                />
            )}

            {/* Automation Report Panel */}
            {showReport && automationSteps.length > 0 && (
                <AutomationReport
                    steps={automationSteps}
                    isRunning={isAutomating}
                    automationName={automationName}
                    startTime={automationStartTime}
                    thinking={automationThinking}
                    onClose={() => setShowReport(false)}
                    isCollapsed={reportCollapsed}
                    onToggleCollapse={() => setReportCollapsed(v => !v)}
                />
            )}
        </div>
    )
}
