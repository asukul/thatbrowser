import { app, BrowserWindow, ipcMain, WebContentsView, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { AIService } from './ai-service.js'
import { AdBlocker } from './ad-blocker.js'
import { GeminiSearch } from './gemini-search.js'
import { BrowserAutomation } from './browser-automation.js'
import Store from 'electron-store'
import os from 'os'
import { initUpdater, stopUpdater } from './updater.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ============================================================
// DEV MODE LOGGING SYSTEM
// ============================================================
const DEV_LOG_MAX = 600
const devLogs = []
let devLogIdCounter = 0

function devLog(level, category, message, data = null) {
    const entry = {
        id: ++devLogIdCounter,
        ts: Date.now(),
        level,       // 'info' | 'warn' | 'error' | 'debug'
        category,    // 'AI' | 'Browser' | 'Network' | 'Automation' | 'System' | 'IPC'
        message,
        data: data ? (typeof data === 'string' ? data : JSON.stringify(data, null, 2)) : null
    }
    devLogs.push(entry)
    if (devLogs.length > DEV_LOG_MAX) devLogs.shift()

    // Stream to renderer if window is ready
    if (mainWindow && !mainWindow.isDestroyed()) {
        try { mainWindow.webContents.send('devmode:log', entry) } catch { }
    }
    // Also mirror to Node console for terminal debugging
    const prefix = `[${category}]`
    if (level === 'error') console.error(prefix, message, data || '')
    else if (level === 'warn') console.warn(prefix, message, data || '')
    else console.log(prefix, message)
}

const store = new Store({
    encryptionKey: 'ai-browser-isu-2026',
    defaults: {
        aiSettings: {
            activeProvider: 'openai',
            providers: {
                openai: { apiKey: '', model: 'gpt-4o', baseUrl: 'https://api.openai.com/v1' },
                anthropic: { apiKey: '', model: 'claude-sonnet-4-5-20250929', baseUrl: 'https://api.anthropic.com' },
                gemini: { apiKey: '', model: 'gemini-2.0-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
                openrouter: { apiKey: '', model: 'anthropic/claude-3.5-sonnet', baseUrl: 'https://openrouter.ai/api/v1' },
                ollama: { apiKey: '', model: 'llama3.2', baseUrl: 'http://localhost:11434' },
                lmstudio: { apiKey: '', model: 'local-model', baseUrl: 'http://localhost:1234/v1' }
            }
        },
        adBlockEnabled: true,
        theme: 'dark',
        homepage: 'https://www.google.com',
        sttSettings: {
            provider: 'gemini',
            apiKey: '',
            baseUrl: '',
            model: '',
            language: 'en',
            keySource: 'custom'
        },
        bookmarks: [
            { title: 'Google', url: 'https://www.google.com' },
            { title: 'Google Scholar', url: 'https://scholar.google.com' },
            { title: 'Wikipedia', url: 'https://en.wikipedia.org' }
        ],
        library: {
            folders: [],        // { id, name, type: 'conversation'|'automation', createdAt }
            conversations: [],  // { id, name, folderId, messages, provider, createdAt, updatedAt }
            automations: []     // { id, name, folderId, commands, description, createdAt, updatedAt }
        }
    }
})

let mainWindow = null
let aiService = null
let adBlocker = null
let geminiSearch = null
let automation = null

// Tab management
const tabs = new Map()
let activeTabId = null
let tabCounter = 0
let aiPanelWidth = 0 // 0 when closed, 380 when open
let bookmarksBarVisible = true
let automationOverlayActive = false // Track overlay state for re-injection after navigation

// Dynamic chrome height calculation
function getChromeHeight() {
    const titleBar = 36
    const tabBar = 38
    const toolbar = 44
    const bookmarks = bookmarksBarVisible ? 28 : 0
    return titleBar + tabBar + toolbar + bookmarks // 146 with bookmarks, 118 without
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        frame: false,
        titleBarStyle: 'hidden',
        backgroundColor: '#0f0f14',
        webPreferences: {
            preload: path.join(app.getAppPath(), 'out/preload/preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    })

    // Load renderer
    if (process.env.ELECTRON_RENDERER_URL) {
        mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
        mainWindow.loadFile(path.join(app.getAppPath(), 'out/renderer/index.html'))
    }

    // Initialize services
    aiService = new AIService(store)
    adBlocker = new AdBlocker(store)
    geminiSearch = new GeminiSearch(store)
    automation = new BrowserAutomation()

    // Wire dev logger into AI service
    aiService.onLog = devLog

    if (store.get('adBlockEnabled')) {
        adBlocker.enable()
    }

    devLog('info', 'System', `AI Browser started — Electron ${process.versions.electron}, Node ${process.versions.node}`, {
        platform: process.platform,
        arch: process.arch,
        cpus: os.cpus().length,
        totalMemMb: Math.round(os.totalmem() / 1024 / 1024)
    })

    // Create the native overlay view for automation (transparent, stays on top)
    createOverlayView()

    // Create initial tab after renderer is ready
    mainWindow.webContents.on('did-finish-load', () => {
        setTimeout(() => {
            createTab(store.get('homepage'))
        }, 300)
    })

    mainWindow.on('closed', () => {
        mainWindow = null
    })

    mainWindow.on('resize', () => {
        resizeActiveTab()
    })

    mainWindow.on('maximize', () => {
        setTimeout(resizeActiveTab, 100)
    })

    mainWindow.on('unmaximize', () => {
        setTimeout(resizeActiveTab, 100)
    })
}

function createTab(url = 'https://www.google.com') {
    const tabId = `tab-${++tabCounter}`

    const view = new WebContentsView({
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false // Required for CDP debugger (browser automation). Security maintained via contextIsolation + no nodeIntegration
        }
    })

    // Set bounds of the view (below the browser chrome)
    const bounds = mainWindow.getContentBounds()
    const chromeHeight = getChromeHeight()
    view.setBounds({
        x: 0,
        y: chromeHeight,
        width: bounds.width - aiPanelWidth,
        height: bounds.height - chromeHeight
    })

    mainWindow.contentView.addChildView(view)
    view.webContents.loadURL(url)

    // Track navigation events
    view.webContents.on('did-navigate', (e, navUrl) => {
        devLog('info', 'Browser', `Navigate: ${navUrl}`, { tabId })
        if (activeTabId === tabId) {
            mainWindow.webContents.send('tab:url-changed', { tabId, url: navUrl })
        }
        mainWindow.webContents.send('tab:updated', {
            tabId,
            title: view.webContents.getTitle() || navUrl,
            url: navUrl,
            canGoBack: view.webContents.navigationHistory.canGoBack(),
            canGoForward: view.webContents.navigationHistory.canGoForward()
        })
    })

    view.webContents.on('did-navigate-in-page', (e, navUrl) => {
        if (activeTabId === tabId) {
            mainWindow.webContents.send('tab:url-changed', { tabId, url: navUrl })
        }
    })

    view.webContents.on('page-title-updated', (e, title) => {
        mainWindow.webContents.send('tab:updated', {
            tabId,
            title,
            url: view.webContents.getURL(),
            canGoBack: view.webContents.navigationHistory.canGoBack(),
            canGoForward: view.webContents.navigationHistory.canGoForward()
        })
    })

    view.webContents.on('did-start-loading', () => {
        mainWindow.webContents.send('tab:loading', { tabId, loading: true })
    })

    view.webContents.on('did-stop-loading', () => {
        mainWindow.webContents.send('tab:loading', { tabId, loading: false })
    })

    // Open external links in new tab
    view.webContents.setWindowOpenHandler(({ url }) => {
        createTab(url)
        return { action: 'deny' }
    })

    tabs.set(tabId, { view, url })
    devLog('info', 'Browser', `Tab created: ${tabId} → ${url}`)

    // Notify renderer
    mainWindow.webContents.send('tab:created', {
        tabId,
        title: 'New Tab',
        url,
        active: true
    })

    switchTab(tabId)
    return tabId
}

function switchTab(tabId) {
    if (!tabs.has(tabId)) return

    // Hide current active tab
    if (activeTabId && tabs.has(activeTabId)) {
        const currentView = tabs.get(activeTabId).view
        currentView.setVisible(false)
    }

    activeTabId = tabId
    const { view } = tabs.get(tabId)
    view.setVisible(true)

    // Update bounds
    resizeActiveTab()

    const url = view.webContents.getURL()
    const title = view.webContents.getTitle()

    mainWindow.webContents.send('tab:activated', { tabId })
    mainWindow.webContents.send('tab:url-changed', { tabId, url })
    mainWindow.webContents.send('tab:updated', {
        tabId,
        title: title || url,
        url,
        canGoBack: view.webContents.navigationHistory.canGoBack(),
        canGoForward: view.webContents.navigationHistory.canGoForward()
    })
}

function closeTab(tabId) {
    if (!tabs.has(tabId)) return

    const { view } = tabs.get(tabId)
    mainWindow.contentView.removeChildView(view)
    view.webContents.close()
    tabs.delete(tabId)

    mainWindow.webContents.send('tab:closed', { tabId })

    // If closing active tab, switch to another
    if (activeTabId === tabId) {
        const remaining = Array.from(tabs.keys())
        if (remaining.length > 0) {
            switchTab(remaining[remaining.length - 1])
        } else {
            activeTabId = null
            createTab(store.get('homepage'))
        }
    }
}

function resizeActiveTab() {
    if (!mainWindow) return
    const bounds = mainWindow.getContentBounds()
    const chromeHeight = getChromeHeight()
    const newBounds = {
        x: 0,
        y: chromeHeight,
        width: Math.max(bounds.width - aiPanelWidth, 100),
        height: Math.max(bounds.height - chromeHeight, 100)
    }
    // Resize ALL tab views so they have correct bounds when switched to
    for (const [tabId, { view }] of tabs) {
        try {
            view.setBounds(newBounds)
        } catch (err) {
            console.warn(`Failed to resize tab ${tabId}:`, err.message)
        }
    }
    // Also resize overlay if it's active
    if (automationOverlayActive && overlayView) {
        try { overlayView.setBounds(newBounds) } catch {}
    }
}

// Helper to get active WebContentsView
function getActiveView() {
    if (!activeTabId || !tabs.has(activeTabId)) return null
    return tabs.get(activeTabId).view
}

// === IPC Handlers ===

// Window controls
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize()
    } else {
        mainWindow?.maximize()
    }
})
ipcMain.on('window:close', () => mainWindow?.close())

// Tab management
ipcMain.handle('tab:create', (e, url) => createTab(url))
ipcMain.on('tab:switch', (e, tabId) => switchTab(tabId))
ipcMain.on('tab:close', (e, tabId) => closeTab(tabId))

ipcMain.handle('tab:list', () => {
    const tabList = []
    for (const [tabId, { view }] of tabs) {
        tabList.push({
            tabId,
            title: view.webContents.getTitle(),
            url: view.webContents.getURL(),
            active: tabId === activeTabId
        })
    }
    return tabList
})

// Navigation
ipcMain.on('nav:go', (e, url) => {
    const view = getActiveView()
    if (!view) return
    // Add protocol if missing
    let navigateUrl = url
    if (!/^https?:\/\//i.test(url) && !/^file:\/\//i.test(url)) {
        if (/^[\w-]+(\.[\w-]+)+/.test(url)) {
            navigateUrl = 'https://' + url
        } else {
            navigateUrl = `https://www.google.com/search?q=${encodeURIComponent(url)}`
        }
    }
    view.webContents.loadURL(navigateUrl)
})

ipcMain.on('nav:back', () => {
    const view = getActiveView()
    if (view) view.webContents.navigationHistory.goBack()
})

ipcMain.on('nav:forward', () => {
    const view = getActiveView()
    if (view) view.webContents.navigationHistory.goForward()
})

ipcMain.on('nav:reload', () => {
    const view = getActiveView()
    if (view) view.webContents.reload()
})

ipcMain.on('nav:home', () => {
    const view = getActiveView()
    if (view) view.webContents.loadURL(store.get('homepage'))
})

ipcMain.handle('app:version', () => app.getVersion())

// ── Stop / Abort AI ────────────────────────────────────────
ipcMain.on('ai:stop', () => {
    const count = aiService?.abort() ?? 0
    devLog('warn', 'AI', `Stop requested by user — aborted ${count} request(s)`)
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ai:stopped', { count })
    }
})

// ── Dev Mode ───────────────────────────────────────────────
ipcMain.handle('devmode:get-logs', () => [...devLogs])
ipcMain.handle('devmode:get-memory', () => {
    const mem = process.memoryUsage()
    const sys = { free: os.freemem(), total: os.totalmem() }
    return {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        external: Math.round(mem.external / 1024 / 1024),
        sysFreeM: Math.round(sys.free / 1024 / 1024),
        sysTotalM: Math.round(sys.total / 1024 / 1024),
        activeRequests: aiService?.activeControllers?.size ?? 0
    }
})
ipcMain.on('devmode:clear-logs', () => {
    devLogs.length = 0
    devLog('info', 'System', 'Dev logs cleared')
})
ipcMain.on('devmode:open-devtools', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.openDevTools({ mode: 'detach' })
        devLog('info', 'System', 'DevTools opened')
    }
})
ipcMain.on('devmode:open-tab-devtools', () => {
    const view = getActiveView()
    if (view) {
        view.webContents.openDevTools({ mode: 'detach' })
        devLog('info', 'System', 'Tab DevTools opened')
    }
})

// Periodic memory logging for dev mode
setInterval(() => {
    const mem = process.memoryUsage()
    devLog('debug', 'System', `Memory: heap ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB, RSS ${Math.round(mem.rss / 1024 / 1024)}MB`, {
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        rssMb: Math.round(mem.rss / 1024 / 1024),
        activeRequests: aiService?.activeControllers?.size ?? 0
    })
}, 15000)

ipcMain.on('ai:panel-toggle', (e, open) => {
    aiPanelWidth = open ? 380 : 0
    resizeActiveTab()
    // Delayed re-resize to ensure the view settles after React renders the panel
    setTimeout(resizeActiveTab, 50)
    setTimeout(resizeActiveTab, 200)
})

ipcMain.on('ai:panel-resize', (e, width) => {
    const clamped = Math.max(260, Math.min(900, Math.round(width)))
    aiPanelWidth = clamped
    resizeActiveTab()
})

ipcMain.on('overlay:toggle', (e, open) => {
    const view = getActiveView()
    if (view) view.setVisible(!open)
})

// AI Service
ipcMain.handle('ai:chat', async (e, { messages, provider }) => {
    try {
        return await aiService.chat(messages, provider)
    } catch (err) {
        return { error: err.message }
    }
})

// AI streaming chat
ipcMain.handle('ai:chat-stream', async (e, { messages, provider }) => {
    devLog('info', 'IPC', `ai:chat-stream — provider: ${provider || 'default'}, messages: ${messages?.length}`)
    try {
        const streamId = `stream-${Date.now()}`
        aiService.chatStream(messages, provider, (chunk) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('ai:stream-chunk', { streamId, chunk })
            }
        }, () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('ai:stream-end', { streamId })
            }
        }, (error) => {
            if (error.name === 'AbortError') {
                devLog('warn', 'IPC', `Stream ${streamId} aborted`)
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('ai:stream-error', { streamId, error: 'Request stopped by user', aborted: true })
                }
            } else {
                devLog('error', 'IPC', `Stream ${streamId} error: ${error.message}`)
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('ai:stream-error', { streamId, error: error.message })
                }
            }
        })
        return { streamId }
    } catch (err) {
        devLog('error', 'IPC', `ai:chat-stream threw: ${err.message}`)
        return { error: err.message }
    }
})

// Test connection + list available models for a provider
ipcMain.handle('ai:test-connection', async (e, { provider }) => {
    try {
        const result = await aiService.listModels(provider)
        devLog('info', 'AI', `Connection test OK for ${provider} — ${result.models.length} models`)
        return result
    } catch (err) {
        devLog('error', 'AI', `Connection test FAILED for ${provider}: ${err.message}`)
        return { error: err.message }
    }
})

// Speech-to-Text transcription
ipcMain.handle('ai:transcribe', async (e, { audioData, mimeType }) => {
    try {
        const sttSettings = store.get('sttSettings') || {}
        // Resolve API key from keySource
        let resolvedSettings = { ...sttSettings }
        if (sttSettings.keySource && sttSettings.keySource !== 'custom') {
            const aiSettings = store.get('aiSettings')
            resolvedSettings.apiKey = aiSettings.providers?.[sttSettings.keySource]?.apiKey || ''
        }
        const buffer = Buffer.from(audioData, 'base64')
        const result = await aiService.transcribeAudio(buffer, mimeType, resolvedSettings)
        devLog('info', 'AI', `STT transcription complete: "${(result.text || '').substring(0, 50)}..."`)
        return result
    } catch (err) {
        devLog('error', 'AI', `STT error: ${err.message}`)
        return { error: err.message }
    }
})

// Speech-to-Text test connection + list available models
ipcMain.handle('ai:test-stt', async (e, { provider, apiKey, keySource, baseUrl }) => {
    try {
        // Resolve API key from keySource
        let resolvedKey = apiKey || ''
        if (keySource && keySource !== 'custom') {
            const aiSettings = store.get('aiSettings')
            resolvedKey = aiSettings.providers?.[keySource]?.apiKey || ''
        }
        const result = await aiService.listSttModels(provider, resolvedKey, baseUrl)
        devLog('info', 'AI', `STT connection test OK for ${provider} — ${result.models.length} models`)
        return result
    } catch (err) {
        devLog('error', 'AI', `STT connection test FAILED for ${provider}: ${err.message}`)
        return { error: err.message }
    }
})

ipcMain.handle('ai:summarize', async (e, { provider }) => {
    try {
        const view = getActiveView()
        if (!view) return { error: 'No active tab' }

        const pageText = await view.webContents.executeJavaScript(`
      (function() {
        const el = document.body.cloneNode(true);
        const scripts = el.querySelectorAll('script, style, nav, footer, header, [aria-hidden="true"]');
        scripts.forEach(s => s.remove());
        return el.innerText.substring(0, 15000);
      })()
    `)
        const pageUrl = view.webContents.getURL()
        const pageTitle = view.webContents.getTitle()
        return await aiService.summarize(pageText, pageTitle, pageUrl, provider)
    } catch (err) {
        return { error: err.message }
    }
})

ipcMain.handle('ai:execute-task', async (e, { task, provider }) => {
    try {
        return await aiService.executeTask(task, provider)
    } catch (err) {
        return { error: err.message }
    }
})

ipcMain.handle('ai:get-page-content', async () => {
    try {
        const view = getActiveView()
        if (!view) return { error: 'No active tab' }

        const content = await view.webContents.executeJavaScript(`
      (function() {
        const el = document.body.cloneNode(true);
        const scripts = el.querySelectorAll('script, style');
        scripts.forEach(s => s.remove());
        return {
          text: el.innerText.substring(0, 20000),
          title: document.title,
          url: window.location.href
        };
      })()
    `)
        return content
    } catch (err) {
        return { error: err.message }
    }
})

// === AI Control Overlay (Native WebContentsView) =============================
// Previous approach: inject DOM into active tab — fails because page navigation
// destroys the injected element before user can see it.
// New approach: a transparent WebContentsView layered ON TOP of tab views.
// This survives page navigation because it's a separate native surface.

const OVERLAY_HTML = `<!DOCTYPE html><html><head><style>
*{margin:0;padding:0}html,body{background:transparent!important;overflow:hidden;width:100%;height:100%}
.f{position:fixed;inset:0;border:4px solid #3b82f6;pointer-events:none;
  animation:glow 2s ease-in-out infinite;
  background:rgba(59,130,246,0.03)}
.b{position:absolute;top:14px;left:50%;transform:translateX(-50%);
  background:rgba(10,12,20,.95);border:2px solid rgba(59,130,246,.9);
  color:#fff;padding:10px 24px 10px 16px;border-radius:30px;
  font:700 14px/1 system-ui,-apple-system,sans-serif;display:flex;align-items:center;gap:10px;
  box-shadow:0 4px 30px rgba(0,0,0,.6),0 0 20px rgba(59,130,246,.4);
  pointer-events:none;white-space:nowrap}
.d{width:12px;height:12px;border-radius:50%;background:#3b82f6;
  animation:pulse 1.2s ease-in-out infinite;box-shadow:0 0 12px #3b82f6}
@keyframes glow{
  0%,100%{border-color:rgba(59,130,246,.7);box-shadow:inset 0 0 20px rgba(59,130,246,.06),0 0 24px 4px rgba(59,130,246,.2)}
  50%{border-color:rgba(59,130,246,1);box-shadow:inset 0 0 40px rgba(59,130,246,.12),0 0 36px 10px rgba(59,130,246,.45)}}
@keyframes pulse{0%,100%{opacity:.3;transform:scale(.7)}50%{opacity:1;transform:scale(1)}}
</style></head><body><div class="f"><div class="b"><span class="d"></span>AI is in control</div></div></body></html>`

let overlayView = null

function createOverlayView() {
    overlayView = new WebContentsView({
        webPreferences: { contextIsolation: true, nodeIntegration: false }
    })
    overlayView.setBackgroundColor('#00000000')
    overlayView.webContents.loadURL(`data:text/html;base64,${Buffer.from(OVERLAY_HTML).toString('base64')}`)
    // Don't add to window yet — only shown when automation is active
}

function showAutomationOverlay() {
    if (!overlayView || !mainWindow) return
    automationOverlayActive = true
    const bounds = mainWindow.getContentBounds()
    const chromeHeight = getChromeHeight()
    overlayView.setBounds({
        x: 0,
        y: chromeHeight,
        width: Math.max(bounds.width - aiPanelWidth, 100),
        height: Math.max(bounds.height - chromeHeight, 100)
    })
    try { mainWindow.contentView.addChildView(overlayView) } catch {}
    devLog('info', 'Automation', 'Overlay ON — native view shown')
}

function hideAutomationOverlay() {
    if (!overlayView || !mainWindow) return
    automationOverlayActive = false
    try { mainWindow.contentView.removeChildView(overlayView) } catch {}
    devLog('info', 'Automation', 'Overlay OFF — native view hidden')
}

ipcMain.on('automation:overlay-show', () => showAutomationOverlay())
ipcMain.on('automation:overlay-hide', () => hideAutomationOverlay())

// === Browser Automation IPC Handlers ===

ipcMain.handle('automation:screenshot', async () => {
    try {
        const view = getActiveView()
        if (!view) return { error: 'No active tab' }
        const image = await view.webContents.capturePage()
        return { data: image.toDataURL(), width: image.getSize().width, height: image.getSize().height }
    } catch (err) {
        return { error: err.message }
    }
})

ipcMain.handle('automation:click', async (e, { x, y, button = 'left', clickCount = 1 }) => {
    try {
        const view = getActiveView()
        if (!view) return { error: 'No active tab' }
        // Show visual highlight where we're clicking
        await automation.highlightElement(view.webContents, x, y)
        await new Promise(r => setTimeout(r, 150))
        await automation.click(view.webContents, x, y, button, clickCount)
        return { success: true }
    } catch (err) {
        return { error: err.message }
    }
})

ipcMain.handle('automation:type', async (e, { text, delay = 50 }) => {
    try {
        const view = getActiveView()
        if (!view) return { error: 'No active tab' }
        await automation.type(view.webContents, text, delay)
        return { success: true }
    } catch (err) {
        return { error: err.message }
    }
})

ipcMain.handle('automation:press-key', async (e, { key, modifiers = [] }) => {
    try {
        const view = getActiveView()
        if (!view) return { error: 'No active tab' }
        await automation.pressKey(view.webContents, key, modifiers)
        return { success: true }
    } catch (err) {
        return { error: err.message }
    }
})

ipcMain.handle('automation:scroll', async (e, { x = 0, y = 0, deltaX = 0, deltaY = 0 }) => {
    try {
        const view = getActiveView()
        if (!view) return { error: 'No active tab' }
        await automation.scroll(view.webContents, x, y, deltaX, deltaY)
        return { success: true }
    } catch (err) {
        return { error: err.message }
    }
})

ipcMain.handle('automation:get-elements', async (e, { selector }) => {
    try {
        const view = getActiveView()
        if (!view) return { error: 'No active tab' }
        const elements = await view.webContents.executeJavaScript(`
      (function() {
        const els = document.querySelectorAll(${JSON.stringify(selector)});
        return Array.from(els).slice(0, 50).map((el, i) => {
          const rect = el.getBoundingClientRect();
          return {
            index: i,
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            className: el.className || null,
            text: el.innerText?.substring(0, 200) || '',
            value: el.value || null,
            href: el.href || null,
            placeholder: el.placeholder || null,
            type: el.type || null,
            ariaLabel: el.getAttribute('aria-label') || null,
            x: Math.round(rect.x + rect.width / 2),
            y: Math.round(rect.y + rect.height / 2),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            visible: rect.width > 0 && rect.height > 0
          };
        });
      })()
    `)
        return { elements }
    } catch (err) {
        return { error: err.message }
    }
})

ipcMain.handle('automation:find-element', async (e, { description }) => {
    try {
        const view = getActiveView()
        if (!view) return { error: 'No active tab' }
        // Get interactive elements for AI to find the right one
        const elements = await view.webContents.executeJavaScript(`
      (function() {
        const selectors = 'a, button, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [onclick], [tabindex]';
        const els = document.querySelectorAll(selectors);
        return Array.from(els).slice(0, 100).map((el, i) => {
          const rect = el.getBoundingClientRect();
          return {
            index: i,
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            text: (el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || '').substring(0, 100),
            type: el.type || null,
            href: el.href || null,
            x: Math.round(rect.x + rect.width / 2),
            y: Math.round(rect.y + rect.height / 2),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            visible: rect.width > 0 && rect.height > 0 && rect.y >= 0 && rect.y < window.innerHeight
          };
        }).filter(el => el.visible);
      })()
    `)
        return { elements }
    } catch (err) {
        return { error: err.message }
    }
})

ipcMain.handle('automation:click-element', async (e, { selector }) => {
    try {
        const view = getActiveView()
        if (!view) return { error: 'No active tab' }
        const result = await automation.clickElement(view.webContents, selector)
        if (result?.error) return { error: result.error }
        // Show visual highlight at element position
        if (result?.x && result?.y) {
            await automation.highlightElement(view.webContents, result.x, result.y)
        }
        return { success: true, ...result }
    } catch (err) {
        return { error: err.message }
    }
})

ipcMain.handle('automation:fill-input', async (e, { selector, value }) => {
    try {
        const view = getActiveView()
        if (!view) return { error: 'No active tab' }
        const result = await automation.fillInput(view.webContents, selector, value)
        if (result?.error) return { error: result.error }
        return { success: true }
    } catch (err) {
        return { error: err.message }
    }
})

ipcMain.handle('automation:eval', async (e, { code }) => {
    try {
        const view = getActiveView()
        if (!view) return { error: 'No active tab' }
        const result = await view.webContents.executeJavaScript(code)
        return { result }
    } catch (err) {
        return { error: err.message }
    }
})

ipcMain.handle('automation:navigate', async (e, { url }) => {
    try {
        const view = getActiveView()
        if (!view) return { error: 'No active tab' }
        await view.webContents.loadURL(url)
        return { success: true }
    } catch (err) {
        return { error: err.message }
    }
})

ipcMain.handle('automation:wait', async (e, { ms = 1000 }) => {
    await new Promise(resolve => setTimeout(resolve, Math.min(ms, 10000)))
    return { success: true }
})

// Gemini Search
ipcMain.handle('search:gemini', async (e, query) => {
    try {
        return await geminiSearch.search(query)
    } catch (err) {
        return { error: err.message }
    }
})

// ── Library: Saved Conversations & Automations ──────────────────────
ipcMain.handle('library:get', () => {
    return store.get('library') || { folders: [], conversations: [], automations: [] }
})

ipcMain.handle('library:save-conversation', (e, { name, folderId, messages, provider }) => {
    const library = store.get('library') || { folders: [], conversations: [], automations: [] }
    const item = {
        id: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: name || 'Untitled Chat',
        folderId: folderId || null,
        messages,
        provider: provider || '',
        createdAt: Date.now(),
        updatedAt: Date.now()
    }
    library.conversations.push(item)
    store.set('library', library)
    devLog('info', 'Library', `Saved conversation: "${item.name}" (${item.id})`)
    return item
})

ipcMain.handle('library:save-automation', (e, { name, folderId, commands, description }) => {
    const library = store.get('library') || { folders: [], conversations: [], automations: [] }
    const item = {
        id: `auto-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: name || 'Untitled Automation',
        folderId: folderId || null,
        commands: commands || [],
        description: description || '',
        createdAt: Date.now(),
        updatedAt: Date.now()
    }
    library.automations.push(item)
    store.set('library', library)
    devLog('info', 'Library', `Saved automation: "${item.name}" (${item.id})`)
    return item
})

ipcMain.handle('library:update-item', (e, { id, type, updates }) => {
    const library = store.get('library') || { folders: [], conversations: [], automations: [] }
    const list = type === 'conversation' ? library.conversations : library.automations
    const idx = list.findIndex(i => i.id === id)
    if (idx === -1) return { error: 'Item not found' }
    list[idx] = { ...list[idx], ...updates, updatedAt: Date.now() }
    store.set('library', library)
    devLog('info', 'Library', `Updated ${type}: "${list[idx].name}" (${id})`)
    return list[idx]
})

ipcMain.handle('library:delete-item', (e, { id, type }) => {
    const library = store.get('library') || { folders: [], conversations: [], automations: [] }
    if (type === 'conversation') {
        library.conversations = library.conversations.filter(i => i.id !== id)
    } else {
        library.automations = library.automations.filter(i => i.id !== id)
    }
    store.set('library', library)
    devLog('info', 'Library', `Deleted ${type}: ${id}`)
    return { success: true }
})

ipcMain.handle('library:duplicate-item', (e, { id, type }) => {
    const library = store.get('library') || { folders: [], conversations: [], automations: [] }
    const list = type === 'conversation' ? library.conversations : library.automations
    const original = list.find(i => i.id === id)
    if (!original) return { error: 'Item not found' }
    const clone = {
        ...JSON.parse(JSON.stringify(original)),
        id: `${type === 'conversation' ? 'conv' : 'auto'}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: original.name + ' (Copy)',
        createdAt: Date.now(),
        updatedAt: Date.now()
    }
    list.push(clone)
    store.set('library', library)
    devLog('info', 'Library', `Duplicated ${type}: "${original.name}" → "${clone.name}"`)
    return clone
})

ipcMain.handle('library:create-folder', (e, { name, type }) => {
    const library = store.get('library') || { folders: [], conversations: [], automations: [] }
    const folder = {
        id: `folder-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: name || 'New Folder',
        type, // 'conversation' or 'automation'
        createdAt: Date.now()
    }
    library.folders.push(folder)
    store.set('library', library)
    devLog('info', 'Library', `Created folder: "${folder.name}" (${type})`)
    return folder
})

ipcMain.handle('library:rename-folder', (e, { id, name }) => {
    const library = store.get('library') || { folders: [], conversations: [], automations: [] }
    const folder = library.folders.find(f => f.id === id)
    if (!folder) return { error: 'Folder not found' }
    folder.name = name
    store.set('library', library)
    devLog('info', 'Library', `Renamed folder: "${name}" (${id})`)
    return folder
})

ipcMain.handle('library:delete-folder', (e, { id }) => {
    const library = store.get('library') || { folders: [], conversations: [], automations: [] }
    const folder = library.folders.find(f => f.id === id)
    if (!folder) return { error: 'Folder not found' }
    // Move items in this folder to root (unfiled)
    library.conversations.forEach(c => { if (c.folderId === id) c.folderId = null })
    library.automations.forEach(a => { if (a.folderId === id) a.folderId = null })
    library.folders = library.folders.filter(f => f.id !== id)
    store.set('library', library)
    devLog('info', 'Library', `Deleted folder: "${folder.name}" — items moved to root`)
    return { success: true }
})

// Settings
ipcMain.handle('settings:get', () => {
    return {
        aiSettings: store.get('aiSettings'),
        adBlockEnabled: store.get('adBlockEnabled'),
        theme: store.get('theme'),
        homepage: store.get('homepage'),
        bookmarks: store.get('bookmarks'),
        sttSettings: store.get('sttSettings'),
        library: store.get('library')
    }
})

ipcMain.handle('settings:set', (e, { key, value }) => {
    store.set(key, value)
    if (key === 'adBlockEnabled') {
        if (value) {
            adBlocker.enable()
        } else {
            adBlocker.disable()
        }
    }
    if (key === 'aiSettings') {
        aiService.updateSettings(value)
    }
    return true
})

// Ad Blocker
ipcMain.handle('adblock:stats', () => {
    return adBlocker.getStats()
})

// Bookmarks
ipcMain.handle('bookmarks:get', () => store.get('bookmarks'))
ipcMain.handle('bookmarks:add', (e, bookmark) => {
    const bookmarks = store.get('bookmarks')
    bookmarks.push(bookmark)
    store.set('bookmarks', bookmarks)
    return bookmarks
})

ipcMain.handle('bookmarks:remove', (e, url) => {
    const bookmarks = store.get('bookmarks').filter(b => b.url !== url)
    store.set('bookmarks', bookmarks)
    return bookmarks
})

// External links
ipcMain.on('shell:open', (e, url) => {
    shell.openExternal(url)
})

app.whenReady().then(() => {
    createWindow()
    // Initialize auto-update checker
    initUpdater(mainWindow)

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    stopUpdater()
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
