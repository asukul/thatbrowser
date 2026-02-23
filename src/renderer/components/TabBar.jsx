import React from 'react'
import { Plus, X } from 'lucide-react'

export default function TabBar({ tabs, activeTabId, onNewTab, onSwitchTab, onCloseTab }) {
    return (
        <div className="tab-bar">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    className={`tab ${tab.id === activeTabId ? 'tab--active' : ''}`}
                    onClick={() => onSwitchTab(tab.id)}
                    title={tab.url}
                >
                    {tab.loading && <div className="tab__loading" />}
                    <span className="tab__title">{tab.title || 'New Tab'}</span>
                    <span
                        className="tab__close"
                        onClick={(e) => {
                            e.stopPropagation()
                            onCloseTab(tab.id)
                        }}
                    >
                        <X size={12} />
                    </span>
                </button>
            ))}
            <button className="tab-bar__new" onClick={onNewTab} title="New Tab">
                <Plus size={16} />
            </button>
        </div>
    )
}
