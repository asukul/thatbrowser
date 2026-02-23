import React, { useState, useEffect } from 'react'
import {
    X, MessageSquare, Zap, FolderPlus, Folder, FolderOpen,
    MoreVertical, Trash2, Copy, Edit3, ChevronRight, ChevronDown,
    Save, Clock, Search
} from 'lucide-react'

/**
 * LibraryPanel — Modal showing saved conversations & automations
 * organized in folders with full CRUD support.
 */
export default function LibraryPanel({ onClose, onLoadConversation, onLoadAutomation }) {
    const [activeTab, setActiveTab] = useState('conversation') // 'conversation' | 'automation'
    const [library, setLibrary] = useState({ folders: [], conversations: [], automations: [] })
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedFolders, setExpandedFolders] = useState(new Set())
    const [editingId, setEditingId] = useState(null)       // item or folder id being renamed
    const [editingName, setEditingName] = useState('')
    const [menuOpen, setMenuOpen] = useState(null)          // item id with open menu
    const [showNewFolder, setShowNewFolder] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')

    // Load library on mount
    useEffect(() => {
        loadLibrary()
    }, [])

    const loadLibrary = async () => {
        const data = await window.browserAPI.library.get()
        setLibrary(data || { folders: [], conversations: [], automations: [] })
    }

    // Get items for the active tab
    const items = activeTab === 'conversation' ? library.conversations : library.automations
    const folders = library.folders.filter(f => f.type === activeTab)

    // Filter by search
    const filteredItems = searchQuery
        ? items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : items

    // Group items by folder
    const itemsByFolder = {}
    const unfiledItems = []
    filteredItems.forEach(item => {
        if (item.folderId && folders.some(f => f.id === item.folderId)) {
            if (!itemsByFolder[item.folderId]) itemsByFolder[item.folderId] = []
            itemsByFolder[item.folderId].push(item)
        } else {
            unfiledItems.push(item)
        }
    })

    // Sort: most recent first
    const sortByDate = (a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)
    unfiledItems.sort(sortByDate)
    Object.values(itemsByFolder).forEach(arr => arr.sort(sortByDate))

    const toggleFolder = (folderId) => {
        setExpandedFolders(prev => {
            const next = new Set(prev)
            if (next.has(folderId)) next.delete(folderId)
            else next.add(folderId)
            return next
        })
    }

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return
        await window.browserAPI.library.createFolder({ name: newFolderName.trim(), type: activeTab })
        setNewFolderName('')
        setShowNewFolder(false)
        await loadLibrary()
    }

    const handleRenameFolder = async (folderId) => {
        if (!editingName.trim()) { setEditingId(null); return }
        await window.browserAPI.library.renameFolder({ id: folderId, name: editingName.trim() })
        setEditingId(null)
        await loadLibrary()
    }

    const handleDeleteFolder = async (folderId) => {
        await window.browserAPI.library.deleteFolder({ id: folderId })
        await loadLibrary()
    }

    const handleRenameItem = async (itemId) => {
        if (!editingName.trim()) { setEditingId(null); return }
        await window.browserAPI.library.updateItem({ id: itemId, type: activeTab, updates: { name: editingName.trim() } })
        setEditingId(null)
        await loadLibrary()
    }

    const handleDeleteItem = async (itemId) => {
        await window.browserAPI.library.deleteItem({ id: itemId, type: activeTab })
        setMenuOpen(null)
        await loadLibrary()
    }

    const handleDuplicateItem = async (itemId) => {
        await window.browserAPI.library.duplicateItem({ id: itemId, type: activeTab })
        setMenuOpen(null)
        await loadLibrary()
    }

    const handleMoveItem = async (itemId, folderId) => {
        await window.browserAPI.library.updateItem({ id: itemId, type: activeTab, updates: { folderId } })
        setMenuOpen(null)
        await loadLibrary()
    }

    const handleOpenItem = (item) => {
        if (activeTab === 'conversation') {
            onLoadConversation?.(item)
        } else {
            onLoadAutomation?.(item)
        }
        onClose()
    }

    const formatDate = (ts) => {
        if (!ts) return ''
        const d = new Date(ts)
        const now = new Date()
        const diff = now - d
        if (diff < 60000) return 'just now'
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
        return d.toLocaleDateString()
    }

    // Render a single item row
    const renderItem = (item) => {
        const isEditing = editingId === item.id
        const isMenuOpen = menuOpen === item.id
        const Icon = activeTab === 'conversation' ? MessageSquare : Zap

        return (
            <div key={item.id} className="library-item">
                <div className="library-item__main" onClick={() => !isEditing && handleOpenItem(item)}>
                    <Icon size={13} className="library-item__icon" />
                    {isEditing ? (
                        <input
                            className="library-item__rename-input"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => handleRenameItem(item.id)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameItem(item.id)
                                if (e.key === 'Escape') setEditingId(null)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                        />
                    ) : (
                        <>
                            <span className="library-item__name">{item.name}</span>
                            <span className="library-item__date">
                                <Clock size={9} /> {formatDate(item.updatedAt || item.createdAt)}
                            </span>
                        </>
                    )}
                </div>
                <div className="library-item__actions">
                    <button
                        className="library-item__menu-btn"
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(isMenuOpen ? null : item.id) }}
                    >
                        <MoreVertical size={13} />
                    </button>
                    {isMenuOpen && (
                        <div className="library-item__menu" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => handleOpenItem(item)}>
                                <ChevronRight size={11} /> Open
                            </button>
                            <button onClick={() => { setEditingId(item.id); setEditingName(item.name); setMenuOpen(null) }}>
                                <Edit3 size={11} /> Rename
                            </button>
                            <button onClick={() => handleDuplicateItem(item.id)}>
                                <Copy size={11} /> Duplicate
                            </button>
                            {/* Move to folder submenu */}
                            {folders.length > 0 && (
                                <div className="library-item__menu-divider" />
                            )}
                            {item.folderId && (
                                <button onClick={() => handleMoveItem(item.id, null)}>
                                    <FolderPlus size={11} /> Move to root
                                </button>
                            )}
                            {folders.filter(f => f.id !== item.folderId).map(f => (
                                <button key={f.id} onClick={() => handleMoveItem(item.id, f.id)}>
                                    <Folder size={11} /> Move to {f.name}
                                </button>
                            ))}
                            <div className="library-item__menu-divider" />
                            <button className="library-item__menu-btn--danger" onClick={() => handleDeleteItem(item.id)}>
                                <Trash2 size={11} /> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Render a folder
    const renderFolder = (folder) => {
        const isExpanded = expandedFolders.has(folder.id)
        const isEditing = editingId === folder.id
        const folderItems = itemsByFolder[folder.id] || []
        const FolderIcon = isExpanded ? FolderOpen : Folder

        return (
            <div key={folder.id} className="library-folder">
                <div className="library-folder__header" onClick={() => !isEditing && toggleFolder(folder.id)}>
                    <span className="library-folder__chevron">
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                    <FolderIcon size={14} className="library-folder__icon" />
                    {isEditing ? (
                        <input
                            className="library-item__rename-input"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => handleRenameFolder(folder.id)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameFolder(folder.id)
                                if (e.key === 'Escape') setEditingId(null)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                        />
                    ) : (
                        <span className="library-folder__name">{folder.name}</span>
                    )}
                    <span className="library-folder__count">{folderItems.length}</span>
                    <div className="library-folder__actions" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="library-folder__action-btn"
                            onClick={() => { setEditingId(folder.id); setEditingName(folder.name) }}
                            title="Rename folder"
                        >
                            <Edit3 size={11} />
                        </button>
                        <button
                            className="library-folder__action-btn library-folder__action-btn--danger"
                            onClick={() => handleDeleteFolder(folder.id)}
                            title="Delete folder (items moved to root)"
                        >
                            <Trash2 size={11} />
                        </button>
                    </div>
                </div>
                {isExpanded && (
                    <div className="library-folder__children">
                        {folderItems.length === 0 ? (
                            <div className="library-folder__empty">Empty folder</div>
                        ) : (
                            folderItems.map(item => renderItem(item))
                        )}
                    </div>
                )}
            </div>
        )
    }

    const totalItems = items.length
    const totalFiltered = filteredItems.length

    return (
        <div className="settings-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="library-panel" onClick={() => menuOpen && setMenuOpen(null)}>
                <div className="library-panel__header">
                    <h2 className="library-panel__title">
                        <Save size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                        Library
                    </h2>
                    <button className="settings-panel__close" onClick={onClose}><X size={18} /></button>
                </div>

                {/* Tab bar */}
                <div className="library-panel__tabs">
                    <button
                        className={`library-panel__tab ${activeTab === 'conversation' ? 'library-panel__tab--active' : ''}`}
                        onClick={() => { setActiveTab('conversation'); setSearchQuery(''); setMenuOpen(null) }}
                    >
                        <MessageSquare size={13} /> Conversations
                        <span className="library-panel__tab-count">{library.conversations.length}</span>
                    </button>
                    <button
                        className={`library-panel__tab ${activeTab === 'automation' ? 'library-panel__tab--active' : ''}`}
                        onClick={() => { setActiveTab('automation'); setSearchQuery(''); setMenuOpen(null) }}
                    >
                        <Zap size={13} /> Automations
                        <span className="library-panel__tab-count">{library.automations.length}</span>
                    </button>
                </div>

                {/* Toolbar: search + new folder */}
                <div className="library-panel__toolbar">
                    <div className="library-panel__search">
                        <Search size={13} />
                        <input
                            type="text"
                            placeholder={`Search ${activeTab === 'conversation' ? 'conversations' : 'automations'}...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button
                        className="ai-panel__action-btn"
                        onClick={() => setShowNewFolder(true)}
                        style={{ fontSize: 11, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                    >
                        <FolderPlus size={12} /> New Folder
                    </button>
                </div>

                {/* New folder input */}
                {showNewFolder && (
                    <div className="library-panel__new-folder">
                        <Folder size={14} style={{ color: 'var(--brand-gold)', flexShrink: 0 }} />
                        <input
                            type="text"
                            placeholder="Folder name..."
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateFolder()
                                if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName('') }
                            }}
                            autoFocus
                        />
                        <button className="library-panel__new-folder-save" onClick={handleCreateFolder}>Create</button>
                        <button className="library-panel__new-folder-cancel" onClick={() => { setShowNewFolder(false); setNewFolderName('') }}>
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="library-panel__content">
                    {totalItems === 0 ? (
                        <div className="library-panel__empty">
                            <div className="library-panel__empty-icon">
                                {activeTab === 'conversation' ? <MessageSquare size={32} /> : <Zap size={32} />}
                            </div>
                            <p>No saved {activeTab === 'conversation' ? 'conversations' : 'automations'} yet.</p>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                {activeTab === 'conversation'
                                    ? 'Use the save button in the AI panel to save a chat.'
                                    : 'Save an automation after running it.'}
                            </p>
                        </div>
                    ) : (
                        <>
                            {searchQuery && totalFiltered !== totalItems && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 16px' }}>
                                    Showing {totalFiltered} of {totalItems} items
                                </div>
                            )}
                            {/* Folders */}
                            {!searchQuery && folders.map(folder => renderFolder(folder))}
                            {/* Unfiled items */}
                            {unfiledItems.map(item => renderItem(item))}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
