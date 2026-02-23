import React from 'react'
import { Globe } from 'lucide-react'

export default function BookmarksBar({ bookmarks, onBookmarkClick, version }) {
    if (!bookmarks || bookmarks.length === 0) return null

    return (
        <div className="bookmarks-bar">
            {bookmarks.map((bm, index) => (
                <button
                    key={index}
                    className="bookmark-item"
                    onClick={() => onBookmarkClick(bm.url)}
                    title={bm.url}
                >
                    <Globe size={12} className="bookmark-item__icon" />
                    {bm.title}
                </button>
            ))}
            {version && <span className="app-version">v{version}</span>}
        </div>
    )
}
