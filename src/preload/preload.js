import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('browserAPI', {
    // Window controls
    window: {
        minimize: () => ipcRenderer.send('window:minimize'),
        maximize: () => ipcRenderer.send('window:maximize'),
        close: () => ipcRenderer.send('window:close')
    },
    app: {
        getVersion: () => ipcRenderer.invoke('app:version')
    },

    // Tab management
    tabs: {
        create: (url) => ipcRenderer.invoke('tab:create', url),
        switch: (tabId) => ipcRenderer.send('tab:switch', tabId),
        close: (tabId) => ipcRenderer.send('tab:close', tabId),
        list: () => ipcRenderer.invoke('tab:list'),
        onCreated: (callback) => {
            const handler = (e, data) => callback(data)
            ipcRenderer.on('tab:created', handler)
            return () => ipcRenderer.removeListener('tab:created', handler)
        },
        onActivated: (callback) => {
            const handler = (e, data) => callback(data)
            ipcRenderer.on('tab:activated', handler)
            return () => ipcRenderer.removeListener('tab:activated', handler)
        },
        onUpdated: (callback) => {
            const handler = (e, data) => callback(data)
            ipcRenderer.on('tab:updated', handler)
            return () => ipcRenderer.removeListener('tab:updated', handler)
        },
        onClosed: (callback) => {
            const handler = (e, data) => callback(data)
            ipcRenderer.on('tab:closed', handler)
            return () => ipcRenderer.removeListener('tab:closed', handler)
        },
        onUrlChanged: (callback) => {
            const handler = (e, data) => callback(data)
            ipcRenderer.on('tab:url-changed', handler)
            return () => ipcRenderer.removeListener('tab:url-changed', handler)
        },
        onLoading: (callback) => {
            const handler = (e, data) => callback(data)
            ipcRenderer.on('tab:loading', handler)
            return () => ipcRenderer.removeListener('tab:loading', handler)
        }
    },

    // Navigation
    nav: {
        go: (url) => ipcRenderer.send('nav:go', url),
        back: () => ipcRenderer.send('nav:back'),
        forward: () => ipcRenderer.send('nav:forward'),
        reload: () => ipcRenderer.send('nav:reload'),
        home: () => ipcRenderer.send('nav:home')
    },

    // Overlay control (hide web view when modal overlays are open)
    overlay: {
        toggle: (open) => ipcRenderer.send('overlay:toggle', open)
    },

    // AI
    ai: {
        chat: (params) => ipcRenderer.invoke('ai:chat', params),
        chatStream: (params) => ipcRenderer.invoke('ai:chat-stream', params),
        summarize: (params) => ipcRenderer.invoke('ai:summarize', params),
        executeTask: (params) => ipcRenderer.invoke('ai:execute-task', params),
        getPageContent: () => ipcRenderer.invoke('ai:get-page-content'),
        togglePanel: (open) => ipcRenderer.send('ai:panel-toggle', open),
        resizePanel: (width) => ipcRenderer.send('ai:panel-resize', width),
        stop: () => ipcRenderer.send('ai:stop'),
        testConnection: (params) => ipcRenderer.invoke('ai:test-connection', params),
        testStt: (params) => ipcRenderer.invoke('ai:test-stt', params),
        transcribe: (params) => ipcRenderer.invoke('ai:transcribe', params),
        // Stream event listeners
        onStreamChunk: (callback) => {
            const handler = (e, data) => callback(data)
            ipcRenderer.on('ai:stream-chunk', handler)
            return () => ipcRenderer.removeListener('ai:stream-chunk', handler)
        },
        onStreamEnd: (callback) => {
            const handler = (e, data) => callback(data)
            ipcRenderer.on('ai:stream-end', handler)
            return () => ipcRenderer.removeListener('ai:stream-end', handler)
        },
        onStreamError: (callback) => {
            const handler = (e, data) => callback(data)
            ipcRenderer.on('ai:stream-error', handler)
            return () => ipcRenderer.removeListener('ai:stream-error', handler)
        },
        onStopped: (callback) => {
            const handler = (e, data) => callback(data)
            ipcRenderer.on('ai:stopped', handler)
            return () => ipcRenderer.removeListener('ai:stopped', handler)
        }
    },

    // Dev Mode
    devmode: {
        getLogs: () => ipcRenderer.invoke('devmode:get-logs'),
        getMemory: () => ipcRenderer.invoke('devmode:get-memory'),
        clearLogs: () => ipcRenderer.send('devmode:clear-logs'),
        openDevTools: () => ipcRenderer.send('devmode:open-devtools'),
        openTabDevTools: () => ipcRenderer.send('devmode:open-tab-devtools'),
        onLog: (callback) => {
            const handler = (e, data) => callback(data)
            ipcRenderer.on('devmode:log', handler)
            return () => ipcRenderer.removeListener('devmode:log', handler)
        }
    },

    // Gemini Search
    search: {
        gemini: (query) => ipcRenderer.invoke('search:gemini', query)
    },

    // Settings
    settings: {
        get: () => ipcRenderer.invoke('settings:get'),
        set: (key, value) => ipcRenderer.invoke('settings:set', { key, value })
    },

    // Ad Blocker
    adblock: {
        stats: () => ipcRenderer.invoke('adblock:stats')
    },

    // Bookmarks
    bookmarks: {
        get: () => ipcRenderer.invoke('bookmarks:get'),
        add: (bookmark) => ipcRenderer.invoke('bookmarks:add', bookmark),
        remove: (url) => ipcRenderer.invoke('bookmarks:remove', url)
    },

    // Library: Saved Conversations & Automations
    library: {
        get: () => ipcRenderer.invoke('library:get'),
        saveConversation: (data) => ipcRenderer.invoke('library:save-conversation', data),
        saveAutomation: (data) => ipcRenderer.invoke('library:save-automation', data),
        updateItem: (data) => ipcRenderer.invoke('library:update-item', data),
        deleteItem: (data) => ipcRenderer.invoke('library:delete-item', data),
        duplicateItem: (data) => ipcRenderer.invoke('library:duplicate-item', data),
        createFolder: (data) => ipcRenderer.invoke('library:create-folder', data),
        renameFolder: (data) => ipcRenderer.invoke('library:rename-folder', data),
        deleteFolder: (data) => ipcRenderer.invoke('library:delete-folder', data),
    },

    // Browser Automation
    automation: {
        showOverlay: () => ipcRenderer.send('automation:overlay-show'),
        hideOverlay: () => ipcRenderer.send('automation:overlay-hide'),
        screenshot: () => ipcRenderer.invoke('automation:screenshot'),
        click: (params) => ipcRenderer.invoke('automation:click', params),
        type: (params) => ipcRenderer.invoke('automation:type', params),
        pressKey: (params) => ipcRenderer.invoke('automation:press-key', params),
        scroll: (params) => ipcRenderer.invoke('automation:scroll', params),
        getElements: (params) => ipcRenderer.invoke('automation:get-elements', params),
        findElement: (params) => ipcRenderer.invoke('automation:find-element', params),
        clickElement: (params) => ipcRenderer.invoke('automation:click-element', params),
        fillInput: (params) => ipcRenderer.invoke('automation:fill-input', params),
        eval: (params) => ipcRenderer.invoke('automation:eval', params),
        navigate: (params) => ipcRenderer.invoke('automation:navigate', params),
        wait: (params) => ipcRenderer.invoke('automation:wait', params)
    },

    // Auto-Updater
    updater: {
        check: () => ipcRenderer.invoke('updater:check'),
        download: () => ipcRenderer.invoke('updater:download'),
        openRelease: () => ipcRenderer.invoke('updater:open-release'),
        onUpdateAvailable: (callback) => {
            const handler = (e, data) => callback(data)
            ipcRenderer.on('updater:update-available', handler)
            return () => ipcRenderer.removeListener('updater:update-available', handler)
        }
    }
})
