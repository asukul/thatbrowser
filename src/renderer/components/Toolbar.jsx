import React, { useState, useEffect, useRef } from 'react'
import {
    ArrowLeft, ArrowRight, RotateCw, Home,
    Search, Sparkles, Settings, Shield, Loader, Terminal
} from 'lucide-react'

export default function Toolbar({
    url, canGoBack, canGoForward, isLoading, showAI, showDevMode,
    onNavigate, onBack, onForward, onReload, onHome,
    onToggleAI, onOpenSettings, onToggleDevMode
}) {
    const [inputValue, setInputValue] = useState(url || '')
    const [adBlockCount, setAdBlockCount] = useState(0)
    const inputRef = useRef(null)

    useEffect(() => {
        setInputValue(url || '')
    }, [url])

    // Poll ad block stats
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const stats = await window.browserAPI.adblock.stats()
                setAdBlockCount(stats.totalBlocked)
            } catch { }
        }, 3000)
        return () => clearInterval(interval)
    }, [])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (inputValue.trim()) {
            onNavigate(inputValue.trim())
            inputRef.current?.blur()
        }
    }

    const handleFocus = () => {
        inputRef.current?.select()
    }

    return (
        <div className="toolbar">
            <button
                className="toolbar__btn"
                onClick={onBack}
                disabled={!canGoBack}
                title="Back"
            >
                <ArrowLeft size={16} />
            </button>
            <button
                className="toolbar__btn"
                onClick={onForward}
                disabled={!canGoForward}
                title="Forward"
            >
                <ArrowRight size={16} />
            </button>
            <button
                className="toolbar__btn"
                onClick={onReload}
                title="Reload"
            >
                {isLoading ? <Loader size={16} className="spinning" /> : <RotateCw size={16} />}
            </button>
            <button
                className="toolbar__btn"
                onClick={onHome}
                title="Home"
            >
                <Home size={16} />
            </button>

            <form className="toolbar__url-bar" onSubmit={handleSubmit}>
                <Search size={14} className="toolbar__url-icon" />
                <input
                    ref={inputRef}
                    className="toolbar__url-input"
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={handleFocus}
                    placeholder="Search or enter URL"
                    spellCheck={false}
                />
            </form>

            <button
                className="toolbar__btn"
                title={`Ad Blocker — ${adBlockCount} blocked`}
                style={{ position: 'relative' }}
            >
                <Shield size={16} />
                {adBlockCount > 0 && (
                    <span className="toolbar__adblock-badge">{adBlockCount > 999 ? '999+' : adBlockCount}</span>
                )}
            </button>

            <button
                className={`toolbar__ai-toggle ${showAI ? 'toolbar__ai-toggle--active' : ''}`}
                onClick={onToggleAI}
                title="AI Assistant"
            >
                <Sparkles size={16} className="sparkle-icon" />
            </button>

            <button
                className={`toolbar__btn ${showDevMode ? 'toolbar__btn--dev-active' : ''}`}
                onClick={onToggleDevMode}
                title="Dev Mode (Ctrl+Shift+D)"
                style={{ color: showDevMode ? '#F1BE48' : undefined }}
            >
                <Terminal size={16} />
            </button>

            <button
                className="toolbar__btn"
                onClick={onOpenSettings}
                title="Settings"
            >
                <Settings size={16} />
            </button>
        </div>
    )
}
