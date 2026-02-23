import React, { useState, useEffect, useCallback } from 'react'
import TitleBar from './components/TitleBar'
import TabBar from './components/TabBar'
import Toolbar from './components/Toolbar'
import BookmarksBar from './components/BookmarksBar'
import AIPanel from './components/AIPanel'
import SettingsPage from './components/SettingsPage'
import DevModePanel from './components/DevModePanel'

export default function App() {
    const [tabs, setTabs] = useState([])
    const [activeTabId, setActiveTabId] = useState(null)
    const [currentUrl, setCurrentUrl] = useState('')
    const [canGoBack, setCanGoBack] = useState(false)
    const [canGoForward, setCanGoForward] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [showAI, setShowAI] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [showDevMode, setShowDevMode] = useState(false)
    const [settings, setSettings] = useState(null)
    const [bookmarks, setBookmarks] = useState([])
    const [aiPanelWidth, setAiPanelWidth] = useState(380)
    const [aiAutomating, setAiAutomating] = useState(false)
    const [version, setVersion] = useState('')

    useEffect(() => {
        window.browserAPI.app.getVersion().then(setVersion)
    }, [])

    // Load initial settings
    useEffect(() => {
        window.browserAPI.settings.get().then(s => {
            setSettings(s)
            setBookmarks(s.bookmarks || [])
        })
    }, [])

    // Tab event listeners
    useEffect(() => {
        const unsubs = []

        unsubs.push(window.browserAPI.tabs.onCreated((data) => {
            setTabs(prev => [...prev, {
                id: data.tabId,
                title: data.title,
                url: data.url,
                loading: false
            }])
            if (data.active) {
                setActiveTabId(data.tabId)
                setCurrentUrl(data.url)
            }
        }))

        unsubs.push(window.browserAPI.tabs.onActivated((data) => {
            setActiveTabId(data.tabId)
        }))

        unsubs.push(window.browserAPI.tabs.onUpdated((data) => {
            setTabs(prev => prev.map(tab =>
                tab.id === data.tabId
                    ? { ...tab, title: data.title, url: data.url }
                    : tab
            ))
            setCanGoBack(data.canGoBack)
            setCanGoForward(data.canGoForward)
            if (data.url) {
                setCurrentUrl(data.url)
            }
        }))

        unsubs.push(window.browserAPI.tabs.onClosed((data) => {
            setTabs(prev => prev.filter(tab => tab.id !== data.tabId))
        }))

        unsubs.push(window.browserAPI.tabs.onUrlChanged((data) => {
            setCurrentUrl(data.url)
        }))

        unsubs.push(window.browserAPI.tabs.onLoading((data) => {
            setIsLoading(data.loading)
            setTabs(prev => prev.map(tab =>
                tab.id === data.tabId
                    ? { ...tab, loading: data.loading }
                    : tab
            ))
        }))

        return () => unsubs.forEach(unsub => unsub?.())
    }, [])

    const handleNewTab = useCallback(() => {
        window.browserAPI.tabs.create('https://www.google.com')
    }, [])

    const handleSwitchTab = useCallback((tabId) => {
        window.browserAPI.tabs.switch(tabId)
    }, [])

    const handleCloseTab = useCallback((tabId) => {
        window.browserAPI.tabs.close(tabId)
    }, [])

    const handleNavigate = useCallback((url) => {
        window.browserAPI.nav.go(url)
    }, [])

    const handleBack = useCallback(() => window.browserAPI.nav.back(), [])
    const handleForward = useCallback(() => window.browserAPI.nav.forward(), [])
    const handleReload = useCallback(() => window.browserAPI.nav.reload(), [])
    const handleHome = useCallback(() => window.browserAPI.nav.home(), [])

    const handleBookmarkClick = useCallback((url) => {
        window.browserAPI.nav.go(url)
    }, [])

    const handleToggleAI = useCallback(() => {
        const newState = !showAI
        setShowAI(newState)
        window.browserAPI.ai.togglePanel(newState)
    }, [showAI])

    const handlePanelResize = useCallback((newWidth) => {
        setAiPanelWidth(newWidth)
        window.browserAPI.ai.resizePanel(newWidth)
    }, [])

    const handleToggleDevMode = useCallback(() => {
        setShowDevMode(v => !v)
    }, [])

    // Keyboard shortcut: Ctrl+Shift+D toggles Dev Mode
    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
                e.preventDefault()
                setShowDevMode(v => !v)
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const handleSettingsSave = useCallback(async (key, value) => {
        await window.browserAPI.settings.set(key, value)
        const updated = await window.browserAPI.settings.get()
        setSettings(updated)
        if (key === 'bookmarks') {
            setBookmarks(value)
        }
    }, [])

    return (
        <>
            <TitleBar />
            <TabBar
                tabs={tabs}
                activeTabId={activeTabId}
                onNewTab={handleNewTab}
                onSwitchTab={handleSwitchTab}
                onCloseTab={handleCloseTab}
            />
            <Toolbar
                url={currentUrl}
                canGoBack={canGoBack}
                canGoForward={canGoForward}
                isLoading={isLoading}
                showAI={showAI}
                showDevMode={showDevMode}
                onNavigate={handleNavigate}
                onBack={handleBack}
                onForward={handleForward}
                onReload={handleReload}
                onHome={handleHome}
                onToggleAI={handleToggleAI}
                onToggleDevMode={handleToggleDevMode}
                onOpenSettings={() => {
                    setShowSettings(true)
                    window.browserAPI.overlay.toggle(true)
                }}
            />
            <BookmarksBar
                bookmarks={bookmarks}
                onBookmarkClick={handleBookmarkClick}
                version={version}
            />
            <div className="main-content">
                <div className="browser-area">
                    {tabs.length === 0 && (
                        <div className="welcome-placeholder">
                            <div className="welcome-placeholder__logo">AI</div>
                            <div className="welcome-placeholder__text">
                                <h2>That Browser</h2>
                                <p>Your AI-powered browser companion</p>
                            </div>
                        </div>
                    )}
                    {/* AI control overlay — shown while the assistant is automating */}
                    {aiAutomating && (
                        <div className="browser-ai-overlay">
                            <div className="browser-ai-overlay__badge">
                                <span className="browser-ai-overlay__dot" />
                                AI is in control
                            </div>
                        </div>
                    )}
                </div>
                {showAI && (
                    <AIPanel
                        settings={settings}
                        onClose={() => setShowAI(false)}
                        panelWidth={aiPanelWidth}
                        onPanelResize={handlePanelResize}
                        onAutomationChange={setAiAutomating}
                    />
                )}
            </div>
            {showDevMode && (
                <DevModePanel onClose={() => setShowDevMode(false)} />
            )}
            {showSettings && (
                <SettingsPage
                    settings={settings}
                    version={version}
                    onSave={handleSettingsSave}
                    onClose={() => {
                        setShowSettings(false)
                        window.browserAPI.overlay.toggle(false)
                    }}
                />
            )}
        </>
    )
}
