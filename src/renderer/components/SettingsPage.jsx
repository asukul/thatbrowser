import React, { useState, useEffect } from 'react'
import { X, Cloud, HardDrive, Wifi, Loader, CheckCircle, AlertCircle, Mic, ChevronDown, Download, RefreshCw, ExternalLink } from 'lucide-react'

const PROVIDERS = [
    { key: 'openai', name: 'OpenAI', type: 'cloud', defaultModel: 'gpt-4o', hint: 'Get key at platform.openai.com' },
    { key: 'anthropic', name: 'Claude (Anthropic)', type: 'cloud', defaultModel: 'claude-sonnet-4-5-20250929', hint: 'Get key at console.anthropic.com' },
    { key: 'gemini', name: 'Google Gemini', type: 'cloud', defaultModel: 'gemini-2.0-flash', hint: 'Get key at aistudio.google.com' },
    { key: 'openrouter', name: 'OpenRouter', type: 'cloud', defaultModel: 'anthropic/claude-3.5-sonnet', hint: 'Access 100+ models at openrouter.ai' },
    { key: 'ollama', name: 'Ollama', type: 'local', defaultModel: 'llama3.2', hint: 'Run: ollama serve (localhost:11434)' },
    { key: 'lmstudio', name: 'LM Studio', type: 'local', defaultModel: 'local-model', hint: 'Start server in LM Studio → Local Server tab' }
]

export default function SettingsPage({ settings, version, onSave, onClose }) {
    const [aiSettings, setAiSettings] = useState(settings?.aiSettings || {})
    const [adBlockEnabled, setAdBlockEnabled] = useState(settings?.adBlockEnabled ?? true)
    const [homepage, setHomepage] = useState(settings?.homepage || 'https://www.google.com')
    const [theme, setTheme] = useState(settings?.theme || 'dark')

    // Test connection state per provider
    const [testStatus, setTestStatus] = useState({})    // 'loading' | 'success' | 'error'
    const [testError, setTestError] = useState({})       // error message string
    const [modelLists, setModelLists] = useState({})     // string[]

    // Custom model dropdown state
    const [openDropdown, setOpenDropdown] = useState(null) // dropdown id or null

    // Speech-to-Text settings
    const [sttSettings, setSttSettings] = useState(settings?.sttSettings || {
        provider: 'gemini', apiKey: '', baseUrl: '', model: '', language: 'en', keySource: 'custom'
    })

    // STT test connection state
    const [sttTestStatus, setSttTestStatus] = useState(null)
    const [sttTestError, setSttTestError] = useState(null)
    const [sttModelList, setSttModelList] = useState([])

    // Update checker state
    const [updateStatus, setUpdateStatus] = useState(null) // null | 'checking' | 'available' | 'current' | 'error'
    const [updateInfo, setUpdateInfo] = useState(null)      // { latestVersion, releaseName, releaseNotes, downloadUrl, releaseUrl }
    const [updateError, setUpdateError] = useState(null)

    // Listen for auto-update notifications from main process
    useEffect(() => {
        const unsub = window.browserAPI.updater.onUpdateAvailable((data) => {
            setUpdateStatus('available')
            setUpdateInfo(data)
        })
        return () => unsub?.()
    }, [])

    const handleCheckForUpdates = async () => {
        setUpdateStatus('checking')
        setUpdateError(null)
        try {
            const result = await window.browserAPI.updater.check()
            if (result.updateAvailable) {
                setUpdateStatus('available')
                setUpdateInfo(result)
            } else {
                setUpdateStatus('current')
            }
        } catch (err) {
            setUpdateStatus('error')
            setUpdateError(err.message)
        }
    }

    const handleDownloadUpdate = () => {
        window.browserAPI.updater.download()
    }

    const handleOpenReleasePage = () => {
        window.browserAPI.updater.openRelease()
    }

    useEffect(() => {
        if (settings) {
            setAiSettings(settings.aiSettings)
            setAdBlockEnabled(settings.adBlockEnabled)
            setHomepage(settings.homepage)
            setTheme(settings.theme)
            setSttSettings(settings.sttSettings || { provider: 'gemini', apiKey: '', baseUrl: '', model: '', language: 'en', keySource: 'custom' })
        }
    }, [settings])

    const handleProviderChange = (providerKey, field, value) => {
        const updated = {
            ...aiSettings,
            providers: {
                ...aiSettings.providers,
                [providerKey]: {
                    ...aiSettings.providers[providerKey],
                    [field]: value
                }
            }
        }
        setAiSettings(updated)
        onSave('aiSettings', updated)
    }

    const handleSetActiveProvider = (providerKey) => {
        const updated = { ...aiSettings, activeProvider: providerKey }
        setAiSettings(updated)
        onSave('aiSettings', updated)
    }

    const handleTestConnection = async (providerKey) => {
        setTestStatus(s => ({ ...s, [providerKey]: 'loading' }))
        setTestError(s => ({ ...s, [providerKey]: null }))
        try {
            const result = await window.browserAPI.ai.testConnection({ provider: providerKey })
            if (result.error) {
                setTestStatus(s => ({ ...s, [providerKey]: 'error' }))
                setTestError(s => ({ ...s, [providerKey]: result.error }))
            } else {
                setTestStatus(s => ({ ...s, [providerKey]: 'success' }))
                setModelLists(s => ({ ...s, [providerKey]: result.models || [] }))
            }
        } catch (err) {
            setTestStatus(s => ({ ...s, [providerKey]: 'error' }))
            setTestError(s => ({ ...s, [providerKey]: err.message }))
        }
    }

    const handleAdBlockToggle = () => {
        const newVal = !adBlockEnabled
        setAdBlockEnabled(newVal)
        onSave('adBlockEnabled', newVal)
    }

    const handleHomepageChange = (e) => setHomepage(e.target.value)
    const handleHomepageSave = () => onSave('homepage', homepage)

    const handleSttChange = (field, value) => {
        const updated = { ...sttSettings, [field]: value }
        // Reset keySource and test state when provider changes
        if (field === 'provider') {
            updated.keySource = 'custom'
            setSttTestStatus(null)
            setSttTestError(null)
            setSttModelList([])
        }
        setSttSettings(updated)
        onSave('sttSettings', updated)
    }

    const handleTestSttConnection = async () => {
        setSttTestStatus('loading')
        setSttTestError(null)
        try {
            const result = await window.browserAPI.ai.testStt({
                provider: sttSettings.provider,
                keySource: sttSettings.keySource || 'custom',
                apiKey: sttSettings.apiKey || '',
                baseUrl: sttSettings.baseUrl || ''
            })
            if (result.error) {
                setSttTestStatus('error')
                setSttTestError(result.error)
            } else {
                setSttTestStatus('success')
                setSttModelList(result.models || [])
            }
        } catch (err) {
            setSttTestStatus('error')
            setSttTestError(err.message)
        }
    }

    // Get masked key preview for "Use key from" display
    const getProviderKeyPreview = (providerKey) => {
        const key = aiSettings.providers?.[providerKey]?.apiKey || ''
        if (!key) return 'no key set'
        return key.substring(0, 6) + '...' + key.substring(key.length - 4)
    }

    // Render a custom scrollable model dropdown (replaces datalist)
    const renderModelDropdown = (dropdownId, value, models, onChange, placeholder) => {
        const isOpen = openDropdown === dropdownId
        const filterText = (value || '').toLowerCase()
        const filtered = models.filter(m => m.toLowerCase().includes(filterText))
        const displayList = isOpen ? (filtered.length > 0 ? filtered : models) : []

        return (
            <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex' }}>
                    <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        onFocus={() => models.length > 0 && setOpenDropdown(dropdownId)}
                        placeholder={placeholder}
                        style={models.length > 0 ? {
                            borderTopRightRadius: 0,
                            borderBottomRightRadius: isOpen ? 0 : undefined,
                        } : {}}
                    />
                    {models.length > 0 && (
                        <button
                            type="button"
                            className="model-dropdown__toggle"
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setOpenDropdown(isOpen ? null : dropdownId)
                            }}
                            style={isOpen ? { borderBottomRightRadius: 0 } : {}}
                            title={`${models.length} models — click to browse`}
                        >
                            <ChevronDown size={12} style={{
                                transform: isOpen ? 'rotate(180deg)' : 'none',
                                transition: 'transform 150ms'
                            }} />
                        </button>
                    )}
                </div>
                {isOpen && displayList.length > 0 && (
                    <div className="model-dropdown__list">
                        {displayList.map(m => (
                            <div
                                key={m}
                                className={`model-dropdown__item ${m === value ? 'model-dropdown__item--selected' : ''}`}
                                onMouseDown={(e) => {
                                    e.preventDefault()
                                    onChange(m)
                                    setOpenDropdown(null)
                                }}
                            >
                                {m}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="settings-overlay" onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
        }}>
            <div className="settings-panel">
                <div className="settings-panel__header">
                    <h2 className="settings-panel__title">⚙️ Settings</h2>
                    <button className="settings-panel__close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="settings-panel__body" onClick={() => openDropdown && setOpenDropdown(null)}>
                    {/* General Settings */}
                    <div className="settings-section">
                        <h3 className="settings-section__title">General</h3>

                        <div className="settings-field">
                            <label>Homepage</label>
                            <input
                                type="text"
                                value={homepage}
                                onChange={handleHomepageChange}
                                onBlur={handleHomepageSave}
                                placeholder="https://www.google.com"
                            />
                        </div>

                        <div className="settings-toggle">
                            <span className="settings-toggle__label">🛡️ Ad Blocker</span>
                            <button
                                className={`settings-toggle__switch ${adBlockEnabled ? 'settings-toggle__switch--on' : ''}`}
                                onClick={handleAdBlockToggle}
                            />
                        </div>
                    </div>

                    {/* AI Provider Settings */}
                    <div className="settings-section">
                        <h3 className="settings-section__title">AI Providers</h3>

                        {PROVIDERS.map(provider => {
                            const config = aiSettings.providers?.[provider.key] || {}
                            const isActive = aiSettings.activeProvider === provider.key
                            const status = testStatus[provider.key]
                            const models = modelLists[provider.key] || []

                            return (
                                <div
                                    key={provider.key}
                                    className={`provider-card ${isActive ? 'provider-card--active' : ''}`}
                                >
                                    <div className="provider-card__header">
                                        <div className="provider-card__name">
                                            {provider.type === 'cloud'
                                                ? <Cloud size={14} color="var(--brand-gold)" />
                                                : <HardDrive size={14} color="#2ecc71" />
                                            }
                                            {provider.name}
                                            <span className={`provider-card__badge provider-card__badge--${provider.type}`}>
                                                {provider.type === 'cloud' ? 'Cloud' : 'Local'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                            <button
                                                className="ai-panel__action-btn"
                                                onClick={() => handleTestConnection(provider.key)}
                                                disabled={status === 'loading'}
                                                style={{ fontSize: 10, padding: '4px 10px', gap: 4, display: 'flex', alignItems: 'center' }}
                                            >
                                                {status === 'loading' ? (
                                                    <><Loader size={10} className="spinning" /> Testing...</>
                                                ) : status === 'success' ? (
                                                    <><CheckCircle size={10} style={{ color: '#4ade80' }} /> Connected</>
                                                ) : status === 'error' ? (
                                                    <><AlertCircle size={10} style={{ color: '#E8334D' }} /> Failed</>
                                                ) : (
                                                    <><Wifi size={10} /> Test</>
                                                )}
                                            </button>
                                            <button
                                                className={`ai-panel__action-btn`}
                                                style={isActive ? {
                                                    background: 'var(--brand-red)',
                                                    color: 'white',
                                                    borderColor: 'var(--brand-red)'
                                                } : {}}
                                                onClick={() => handleSetActiveProvider(provider.key)}
                                            >
                                                {isActive ? '✓ Active' : 'Set Active'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="provider-card__fields">
                                        {provider.hint && (
                                            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px 0', fontStyle: 'italic' }}>
                                                ℹ️ {provider.hint}
                                            </p>
                                        )}
                                        {provider.type === 'cloud' && (
                                            <div className="settings-field">
                                                <label>API Key</label>
                                                <input
                                                    type="password"
                                                    value={config.apiKey || ''}
                                                    onChange={(e) => handleProviderChange(provider.key, 'apiKey', e.target.value)}
                                                    placeholder={provider.key === 'anthropic' ? 'sk-ant-...' : 'Enter API key'}
                                                />
                                            </div>
                                        )}

                                        <div className="settings-field" onClick={(e) => e.stopPropagation()}>
                                            <label>Model {models.length > 0 && <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 400 }}>({models.length} available)</span>}</label>
                                            {renderModelDropdown(
                                                provider.key,
                                                config.model || provider.defaultModel,
                                                models,
                                                (val) => handleProviderChange(provider.key, 'model', val),
                                                provider.defaultModel
                                            )}
                                        </div>

                                        <div className="settings-field">
                                            <label>Base URL</label>
                                            <input
                                                type="text"
                                                value={config.baseUrl || ''}
                                                onChange={(e) => handleProviderChange(provider.key, 'baseUrl', e.target.value)}
                                                placeholder="API base URL"
                                            />
                                        </div>
                                    </div>

                                    {/* Test result message */}
                                    {status === 'error' && testError[provider.key] && (
                                        <p style={{
                                            fontSize: 11, color: 'var(--brand-red-light)', margin: '0 16px 12px',
                                            padding: '6px 10px', background: 'rgba(200,16,46,0.1)', borderRadius: 6,
                                            lineHeight: 1.4, wordBreak: 'break-word'
                                        }}>
                                            {testError[provider.key]}
                                        </p>
                                    )}
                                    {status === 'success' && (
                                        <p style={{ fontSize: 11, color: '#4ade80', margin: '0 16px 12px' }}>
                                            ✓ Connected — {models.length} model{models.length !== 1 ? 's' : ''} available. Use the dropdown to pick one.
                                        </p>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Speech-to-Text Settings — separate API key from chat */}
                    <div className="settings-section">
                        <h3 className="settings-section__title">
                            <Mic size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                            Speech-to-Text (Voice Input)
                        </h3>

                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                            Configure voice transcription. Use a separate key or reuse your chat provider key.
                            Click the mic button in the AI panel to record, then it transcribes automatically.
                        </p>

                        {/* STT Provider + Test button row */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 14 }}>
                            <div className="settings-field" style={{ flex: 1, marginBottom: 0 }}>
                                <label>Voice Provider</label>
                                <select
                                    value={sttSettings.provider || 'gemini'}
                                    onChange={(e) => handleSttChange('provider', e.target.value)}
                                    style={{
                                        width: '100%', padding: '8px 12px', background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                                        color: 'var(--text-primary)', fontSize: 13
                                    }}
                                >
                                    <option value="gemini">Google Gemini (multimodal audio)</option>
                                    <option value="openai">OpenAI Whisper</option>
                                    <option value="lmstudio">LM Studio (local Whisper)</option>
                                </select>
                            </div>
                            <button
                                className="ai-panel__action-btn"
                                onClick={handleTestSttConnection}
                                disabled={sttTestStatus === 'loading'}
                                style={{ fontSize: 10, padding: '8px 14px', gap: 4, display: 'flex', alignItems: 'center', flexShrink: 0, height: 36 }}
                            >
                                {sttTestStatus === 'loading' ? (
                                    <><Loader size={10} className="spinning" /> Testing...</>
                                ) : sttTestStatus === 'success' ? (
                                    <><CheckCircle size={10} style={{ color: '#4ade80' }} /> Connected</>
                                ) : sttTestStatus === 'error' ? (
                                    <><AlertCircle size={10} style={{ color: '#E8334D' }} /> Failed</>
                                ) : (
                                    <><Wifi size={10} /> Test</>
                                )}
                            </button>
                        </div>

                        {/* STT test result messages */}
                        {sttTestStatus === 'error' && sttTestError && (
                            <p style={{
                                fontSize: 11, color: 'var(--brand-red-light)', marginBottom: 12,
                                padding: '6px 10px', background: 'rgba(200,16,46,0.1)', borderRadius: 6,
                                lineHeight: 1.4, wordBreak: 'break-word'
                            }}>
                                {sttTestError}
                            </p>
                        )}
                        {sttTestStatus === 'success' && (
                            <p style={{ fontSize: 11, color: '#4ade80', marginBottom: 12 }}>
                                ✓ Voice API connected — {sttModelList.length} model{sttModelList.length !== 1 ? 's' : ''} available. Use the dropdown below to pick one.
                            </p>
                        )}

                        {/* API Key Source — reuse from chat or enter custom */}
                        {sttSettings.provider !== 'lmstudio' && (
                            <div className="settings-field">
                                <label>API Key Source</label>
                                <select
                                    value={sttSettings.keySource || 'custom'}
                                    onChange={(e) => handleSttChange('keySource', e.target.value)}
                                    style={{
                                        width: '100%', padding: '8px 12px', background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                                        color: 'var(--text-primary)', fontSize: 13
                                    }}
                                >
                                    <option value="custom">Enter separate Voice API key</option>
                                    <option value="openai">Use OpenAI key from chat ({getProviderKeyPreview('openai')})</option>
                                    <option value="gemini">Use Gemini key from chat ({getProviderKeyPreview('gemini')})</option>
                                </select>
                            </div>
                        )}

                        {/* Voice API Key — editable when custom, read-only when reusing */}
                        {(!sttSettings.keySource || sttSettings.keySource === 'custom') ? (
                            <div className="settings-field">
                                <label>
                                    Voice API Key
                                    {sttSettings.provider === 'lmstudio' && (
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}> (optional for local)</span>
                                    )}
                                </label>
                                <input
                                    type="password"
                                    value={sttSettings.apiKey || ''}
                                    onChange={(e) => handleSttChange('apiKey', e.target.value)}
                                    placeholder={
                                        sttSettings.provider === 'gemini' ? 'Gemini API key (from aistudio.google.com)' :
                                        sttSettings.provider === 'openai' ? 'OpenAI API key (from platform.openai.com)' :
                                        'Optional — leave blank for local'
                                    }
                                />
                            </div>
                        ) : (
                            <div className="settings-field">
                                <label>
                                    Voice API Key
                                    <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 400 }}> — using {sttSettings.keySource === 'openai' ? 'OpenAI' : 'Gemini'} key from chat</span>
                                </label>
                                <input
                                    type="password"
                                    disabled
                                    value={aiSettings.providers?.[sttSettings.keySource]?.apiKey || ''}
                                    style={{ opacity: 0.5, cursor: 'not-allowed' }}
                                />
                            </div>
                        )}

                        {/* Base URL */}
                        <div className="settings-field">
                            <label>
                                Voice API Base URL
                                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}> (leave blank for default)</span>
                            </label>
                            <input
                                type="text"
                                value={sttSettings.baseUrl || ''}
                                onChange={(e) => handleSttChange('baseUrl', e.target.value)}
                                placeholder={
                                    sttSettings.provider === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta' :
                                    sttSettings.provider === 'openai' ? 'https://api.openai.com/v1' :
                                    'http://localhost:1234/v1'
                                }
                            />
                        </div>

                        {/* Voice Model — with scrollable dropdown when models available */}
                        <div className="settings-field" onClick={(e) => e.stopPropagation()}>
                            <label>
                                Voice Model
                                {sttModelList.length > 0 && <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 400 }}> ({sttModelList.length} available)</span>}
                                {!sttModelList.length && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}> (leave blank for default)</span>}
                            </label>
                            {renderModelDropdown(
                                'stt-model',
                                sttSettings.model || '',
                                sttModelList,
                                (val) => handleSttChange('model', val),
                                sttSettings.provider === 'gemini' ? 'gemini-2.0-flash' :
                                sttSettings.provider === 'openai' ? 'whisper-1' :
                                'whisper-1 or your loaded model'
                            )}
                        </div>

                        {/* Language */}
                        <div className="settings-field">
                            <label>Language</label>
                            <select
                                value={sttSettings.language || 'en'}
                                onChange={(e) => handleSttChange('language', e.target.value)}
                                style={{
                                    width: '100%', padding: '8px 12px', background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                                    color: 'var(--text-primary)', fontSize: 13
                                }}
                            >
                                <option value="en">English</option>
                                <option value="es">Spanish</option>
                                <option value="fr">French</option>
                                <option value="de">German</option>
                                <option value="zh">Chinese</option>
                                <option value="ja">Japanese</option>
                                <option value="ko">Korean</option>
                                <option value="th">Thai</option>
                                <option value="vi">Vietnamese</option>
                                <option value="pt">Portuguese</option>
                                <option value="ru">Russian</option>
                                <option value="ar">Arabic</option>
                            </select>
                        </div>

                        {/* Provider guide */}
                        <div style={{
                            fontSize: 10, color: 'var(--text-muted)', marginTop: 8,
                            lineHeight: 1.6, padding: '8px 10px',
                            background: 'rgba(59,130,246,0.05)', borderRadius: 6
                        }}>
                            <strong style={{ color: 'var(--text-secondary)' }}>Voice Provider Guide:</strong><br/>
                            <strong>Google Gemini</strong> — Multimodal audio transcription. Supports many languages.<br/>
                            <strong>OpenAI Whisper</strong> — Dedicated speech-to-text model. Best accuracy for 50+ languages.<br/>
                            <strong>LM Studio</strong> — Run Whisper locally. Load a Whisper model, start the server, no API key needed.
                        </div>
                    </div>

                    {/* Updates */}
                    <div className="settings-section">
                        <h3 className="settings-section__title">
                            <Download size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                            Updates
                        </h3>

                        {/* Update available banner */}
                        {updateStatus === 'available' && updateInfo && (
                            <div style={{
                                padding: '12px 14px', marginBottom: 14, borderRadius: 8,
                                background: 'linear-gradient(135deg, rgba(74,222,128,0.12), rgba(74,222,128,0.04))',
                                border: '1px solid rgba(74,222,128,0.3)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <Download size={16} style={{ color: '#4ade80' }} />
                                    <strong style={{ color: '#4ade80', fontSize: 13 }}>Update Available!</strong>
                                </div>
                                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>
                                    <strong>{updateInfo.releaseName || updateInfo.latestVersion}</strong> is ready to download
                                </p>
                                {updateInfo.releaseNotes && (
                                    <p style={{
                                        fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 10px 0',
                                        maxHeight: 80, overflow: 'auto', lineHeight: 1.5,
                                        padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: 4,
                                        whiteSpace: 'pre-wrap'
                                    }}>
                                        {updateInfo.releaseNotes.substring(0, 300)}{updateInfo.releaseNotes.length > 300 ? '...' : ''}
                                    </p>
                                )}
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        className="ai-panel__action-btn"
                                        onClick={handleDownloadUpdate}
                                        style={{
                                            background: '#4ade80', color: '#000', borderColor: '#4ade80',
                                            fontWeight: 600, fontSize: 11, padding: '6px 14px', gap: 6,
                                            display: 'flex', alignItems: 'center'
                                        }}
                                    >
                                        <Download size={12} /> Download {updateInfo.latestVersion}
                                    </button>
                                    <button
                                        className="ai-panel__action-btn"
                                        onClick={handleOpenReleasePage}
                                        style={{ fontSize: 11, padding: '6px 12px', gap: 6, display: 'flex', alignItems: 'center' }}
                                    >
                                        <ExternalLink size={12} /> Release Notes
                                    </button>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                Current version: <strong>v{version || '2.0.0'}</strong>
                            </span>
                            <button
                                className="ai-panel__action-btn"
                                onClick={handleCheckForUpdates}
                                disabled={updateStatus === 'checking'}
                                style={{ fontSize: 11, padding: '5px 12px', gap: 5, display: 'flex', alignItems: 'center' }}
                            >
                                {updateStatus === 'checking' ? (
                                    <><Loader size={11} className="spinning" /> Checking...</>
                                ) : updateStatus === 'current' ? (
                                    <><CheckCircle size={11} style={{ color: '#4ade80' }} /> Up to date</>
                                ) : updateStatus === 'error' ? (
                                    <><AlertCircle size={11} style={{ color: '#E8334D' }} /> Retry</>
                                ) : (
                                    <><RefreshCw size={11} /> Check for Updates</>
                                )}
                            </button>
                        </div>

                        {updateStatus === 'error' && updateError && (
                            <p style={{
                                fontSize: 11, color: 'var(--brand-red-light)', marginTop: 8,
                                padding: '6px 10px', background: 'rgba(200,16,46,0.1)', borderRadius: 6
                            }}>
                                {updateError}
                            </p>
                        )}
                        {updateStatus === 'current' && (
                            <p style={{ fontSize: 11, color: '#4ade80', marginTop: 6 }}>
                                You're running the latest version.
                            </p>
                        )}
                    </div>

                    {/* About */}
                    <div className="settings-section">
                        <h3 className="settings-section__title">About</h3>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            <p><strong>That Browser</strong></p>
                            <p>Open-source AI-native browser</p>
                            <p>Created by Adisak Sukul</p>
                            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                                Version {version || '2.0.0'} · Built with Electron + React
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
