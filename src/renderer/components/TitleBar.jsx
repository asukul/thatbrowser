import React from 'react'
import { Minus, Square, X } from 'lucide-react'

export default function TitleBar() {
    return (
        <div className="title-bar">
            <div className="title-bar__brand">
                <div className="title-bar__logo">TB</div>
                <div className="title-bar__name">
                    That Browser
                </div>
            </div>
            <div className="title-bar__controls">
                <button
                    className="title-bar__btn"
                    onClick={() => window.browserAPI.window.minimize()}
                    title="Minimize"
                >
                    <Minus size={14} />
                </button>
                <button
                    className="title-bar__btn"
                    onClick={() => window.browserAPI.window.maximize()}
                    title="Maximize"
                >
                    <Square size={12} />
                </button>
                <button
                    className="title-bar__btn title-bar__btn--close"
                    onClick={() => window.browserAPI.window.close()}
                    title="Close"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    )
}
