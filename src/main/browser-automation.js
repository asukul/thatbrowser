/**
 * Browser Automation — Reliable mouse, keyboard, and element control
 *
 * Uses THREE strategies for maximum reliability:
 * 1. Chrome DevTools Protocol (CDP) via webContents.debugger — most reliable for input
 * 2. executeJavaScript DOM injection — guaranteed for clicks, focus, input values
 * 3. sendInputEvent fallback — for basic mouse/keyboard when CDP unavailable
 *
 * CDP is the same protocol used by Puppeteer and Playwright — it's the gold standard
 * for browser automation and works reliably in Electron.
 */

class BrowserAutomation {
    constructor() {
        this._debuggerAttached = new WeakSet()
    }

    /**
     * Attach CDP debugger to webContents if not already attached
     */
    async _ensureDebugger(webContents) {
        if (this._debuggerAttached.has(webContents)) return true
        try {
            webContents.debugger.attach('1.3')
            this._debuggerAttached.add(webContents)
            webContents.on('destroyed', () => {
                this._debuggerAttached.delete(webContents)
            })
            return true
        } catch (err) {
            // Already attached or can't attach — try anyway
            if (err.message.includes('Already attached')) {
                this._debuggerAttached.add(webContents)
                return true
            }
            console.warn('Could not attach debugger:', err.message)
            return false
        }
    }

    /**
     * Send CDP command
     */
    async _cdp(webContents, method, params = {}) {
        return webContents.debugger.sendCommand(method, params)
    }

    /**
     * Click at coordinates — uses CDP Input.dispatchMouseEvent (most reliable)
     * Falls back to JS-based click via DOM if CDP fails
     */
    async click(webContents, x, y, button = 'left', clickCount = 1) {
        const ix = Math.round(x)
        const iy = Math.round(y)

        const hasCDP = await this._ensureDebugger(webContents)

        if (hasCDP) {
            try {
                // CDP mouse events — exactly what Puppeteer uses
                await this._cdp(webContents, 'Input.dispatchMouseEvent', {
                    type: 'mouseMoved',
                    x: ix,
                    y: iy
                })
                await this._delay(30)

                await this._cdp(webContents, 'Input.dispatchMouseEvent', {
                    type: 'mousePressed',
                    x: ix,
                    y: iy,
                    button,
                    clickCount
                })
                await this._delay(50)

                await this._cdp(webContents, 'Input.dispatchMouseEvent', {
                    type: 'mouseReleased',
                    x: ix,
                    y: iy,
                    button,
                    clickCount
                })
                await this._delay(50)
                return
            } catch (err) {
                console.warn('CDP click failed, falling back to JS:', err.message)
            }
        }

        // Fallback: JavaScript-based click at coordinates
        await webContents.executeJavaScript(`
            (function() {
                const el = document.elementFromPoint(${ix}, ${iy});
                if (el) {
                    // Simulate full mouse event sequence
                    const opts = { bubbles: true, cancelable: true, clientX: ${ix}, clientY: ${iy}, button: 0 };
                    el.dispatchEvent(new MouseEvent('mouseover', opts));
                    el.dispatchEvent(new MouseEvent('mousedown', opts));
                    el.focus && el.focus();
                    el.dispatchEvent(new MouseEvent('mouseup', opts));
                    el.dispatchEvent(new MouseEvent('click', opts));
                    return { tag: el.tagName, text: (el.innerText || '').substring(0, 50) };
                }
                return null;
            })()
        `)
    }

    /**
     * Type text — uses CDP Input.dispatchKeyEvent for each character
     * Falls back to insertText + input events via JS
     */
    async type(webContents, text, delay = 30) {
        const hasCDP = await this._ensureDebugger(webContents)

        if (hasCDP) {
            try {
                for (const char of text) {
                    // For printable characters, use insertText which handles all locales
                    await this._cdp(webContents, 'Input.insertText', {
                        text: char
                    })
                    await this._delay(delay)
                }
                return
            } catch (err) {
                console.warn('CDP type failed, falling back to JS:', err.message)
            }
        }

        // Fallback: JavaScript-based typing
        await webContents.executeJavaScript(`
            (function() {
                const el = document.activeElement;
                if (!el) return false;

                const text = ${JSON.stringify(text)};

                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.contentEditable === 'true') {
                    // For input/textarea, set value and fire events
                    if (el.contentEditable === 'true') {
                        // ContentEditable (like Google search)
                        el.textContent = (el.textContent || '') + text;
                    } else {
                        const start = el.selectionStart || el.value.length;
                        const before = el.value.substring(0, start);
                        const after = el.value.substring(el.selectionEnd || start);
                        el.value = before + text + after;
                        el.selectionStart = el.selectionEnd = start + text.length;
                    }
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
                return false;
            })()
        `)
    }

    /**
     * Press a key (Enter, Tab, Escape, Backspace, etc.)
     * Uses CDP Input.dispatchKeyEvent
     */
    async pressKey(webContents, key, modifiers = []) {
        const hasCDP = await this._ensureDebugger(webContents)

        // Map key names to CDP key codes
        const keyMap = {
            'Enter': { key: 'Enter', code: 'Enter', keyCode: 13, windowsVirtualKeyCode: 13, text: '\r' },
            'Tab': { key: 'Tab', code: 'Tab', keyCode: 9, windowsVirtualKeyCode: 9 },
            'Escape': { key: 'Escape', code: 'Escape', keyCode: 27, windowsVirtualKeyCode: 27 },
            'Backspace': { key: 'Backspace', code: 'Backspace', keyCode: 8, windowsVirtualKeyCode: 8 },
            'Delete': { key: 'Delete', code: 'Delete', keyCode: 46, windowsVirtualKeyCode: 46 },
            'ArrowDown': { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, windowsVirtualKeyCode: 40 },
            'ArrowUp': { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, windowsVirtualKeyCode: 38 },
            'ArrowLeft': { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, windowsVirtualKeyCode: 37 },
            'ArrowRight': { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, windowsVirtualKeyCode: 39 },
            'Space': { key: ' ', code: 'Space', keyCode: 32, windowsVirtualKeyCode: 32, text: ' ' },
            'Home': { key: 'Home', code: 'Home', keyCode: 36, windowsVirtualKeyCode: 36 },
            'End': { key: 'End', code: 'End', keyCode: 35, windowsVirtualKeyCode: 35 },
            'PageUp': { key: 'PageUp', code: 'PageUp', keyCode: 33, windowsVirtualKeyCode: 33 },
            'PageDown': { key: 'PageDown', code: 'PageDown', keyCode: 34, windowsVirtualKeyCode: 34 },
        }

        // Build modifier flags
        let modifierFlags = 0
        if (modifiers.includes('shift')) modifierFlags |= 8
        if (modifiers.includes('ctrl') || modifiers.includes('control')) modifierFlags |= 2
        if (modifiers.includes('alt')) modifierFlags |= 1
        if (modifiers.includes('meta') || modifiers.includes('cmd')) modifierFlags |= 4

        if (hasCDP) {
            try {
                const keyInfo = keyMap[key] || {
                    key: key,
                    code: `Key${key.toUpperCase()}`,
                    keyCode: key.charCodeAt(0),
                    windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0)
                }

                await this._cdp(webContents, 'Input.dispatchKeyEvent', {
                    type: 'keyDown',
                    modifiers: modifierFlags,
                    ...keyInfo
                })
                await this._delay(30)

                // Send char event for keys that produce text
                if (keyInfo.text) {
                    await this._cdp(webContents, 'Input.dispatchKeyEvent', {
                        type: 'char',
                        modifiers: modifierFlags,
                        text: keyInfo.text,
                        unmodifiedText: keyInfo.text,
                        ...keyInfo
                    })
                    await this._delay(10)
                }

                await this._cdp(webContents, 'Input.dispatchKeyEvent', {
                    type: 'keyUp',
                    modifiers: modifierFlags,
                    ...keyInfo
                })
                await this._delay(30)
                return
            } catch (err) {
                console.warn('CDP pressKey failed, falling back to JS:', err.message)
            }
        }

        // Fallback: JavaScript keyboard event dispatch
        const kInfo = keyMap[key] || { key, keyCode: key.charCodeAt(0) }
        await webContents.executeJavaScript(`
            (function() {
                const el = document.activeElement || document.body;
                const opts = {
                    key: ${JSON.stringify(kInfo.key || key)},
                    code: ${JSON.stringify(kInfo.code || key)},
                    keyCode: ${kInfo.keyCode || 0},
                    which: ${kInfo.keyCode || 0},
                    bubbles: true,
                    cancelable: true,
                    shiftKey: ${modifiers.includes('shift')},
                    ctrlKey: ${modifiers.includes('ctrl') || modifiers.includes('control')},
                    altKey: ${modifiers.includes('alt')},
                    metaKey: ${modifiers.includes('meta') || modifiers.includes('cmd')}
                };
                el.dispatchEvent(new KeyboardEvent('keydown', opts));
                el.dispatchEvent(new KeyboardEvent('keypress', opts));
                el.dispatchEvent(new KeyboardEvent('keyup', opts));

                // Special handling for Enter on forms
                if (${JSON.stringify(key)} === 'Enter') {
                    const form = el.closest && el.closest('form');
                    if (form) {
                        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                    }
                }
                return true;
            })()
        `)
    }

    /**
     * Scroll at position — uses CDP Input.dispatchMouseEvent with type mouseWheel
     */
    async scroll(webContents, x, y, deltaX, deltaY) {
        const hasCDP = await this._ensureDebugger(webContents)

        if (hasCDP) {
            try {
                await this._cdp(webContents, 'Input.dispatchMouseEvent', {
                    type: 'mouseWheel',
                    x: Math.round(x),
                    y: Math.round(y),
                    deltaX: Math.round(deltaX),
                    deltaY: Math.round(deltaY)
                })
                await this._delay(100)
                return
            } catch (err) {
                console.warn('CDP scroll failed, falling back to JS:', err.message)
            }
        }

        // Fallback: JS scroll
        await webContents.executeJavaScript(`
            window.scrollBy(${Math.round(deltaX)}, ${Math.round(deltaY)});
        `)
        await this._delay(100)
    }

    /**
     * Click on an element by CSS selector.
     * Strategy: JS to find element + get viewport coords, then CDP for real click.
     * This is the most reliable approach for anchor tags / navigation links.
     */
    async clickElement(webContents, selector) {
        // Step 1: Find element via JS, scroll into view, get exact viewport center
        const info = await webContents.executeJavaScript(`
            (function() {
                const el = document.querySelector(${JSON.stringify(selector)});
                if (!el) return { error: 'Element not found: ' + ${JSON.stringify(selector)} };

                // Scroll instantly so getBoundingClientRect is accurate immediately
                el.scrollIntoView({ behavior: 'instant', block: 'center' });

                const rect = el.getBoundingClientRect();
                return {
                    x: Math.round(rect.x + rect.width / 2),
                    y: Math.round(rect.y + rect.height / 2),
                    tag: el.tagName.toLowerCase(),
                    href: el.href || null,
                    visible: rect.width > 0 && rect.height > 0
                };
            })()
        `)

        if (!info || info.error) return { error: info?.error || 'Element not found' }
        if (!info.visible) return { error: `Element "${selector}" is not visible or has zero size` }

        // Short delay for scroll to settle
        await this._delay(150)

        const hasCDP = await this._ensureDebugger(webContents)

        if (hasCDP) {
            try {
                // Use CDP Input.dispatchMouseEvent — the same method Puppeteer/Playwright use.
                // This dispatches real, trusted input events that trigger link navigation.
                await this._cdp(webContents, 'Input.dispatchMouseEvent', {
                    type: 'mouseMoved', x: info.x, y: info.y, modifiers: 0
                })
                await this._delay(20)
                await this._cdp(webContents, 'Input.dispatchMouseEvent', {
                    type: 'mousePressed', x: info.x, y: info.y,
                    button: 'left', clickCount: 1, modifiers: 0
                })
                await this._delay(50)
                await this._cdp(webContents, 'Input.dispatchMouseEvent', {
                    type: 'mouseReleased', x: info.x, y: info.y,
                    button: 'left', clickCount: 1, modifiers: 0
                })
                return { success: true, tag: info.tag, x: info.x, y: info.y }
            } catch (err) {
                console.warn('CDP clickElement failed, falling back to JS:', err.message)
            }
        }

        // JS fallback — dispatch mouse events and navigate anchors directly
        await webContents.executeJavaScript(`
            (function() {
                const el = document.querySelector(${JSON.stringify(selector)});
                if (!el) return;
                const rect = el.getBoundingClientRect();
                const cx = Math.round(rect.x + rect.width / 2);
                const cy = Math.round(rect.y + rect.height / 2);
                const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0 };
                el.dispatchEvent(new MouseEvent('mouseover', opts));
                el.dispatchEvent(new MouseEvent('mousedown', opts));
                el.focus && el.focus();
                el.dispatchEvent(new MouseEvent('mouseup', opts));
                el.dispatchEvent(new MouseEvent('click', opts));
                // For anchor tags: navigate directly as backup
                if (el.tagName === 'A' && el.href && !el.href.startsWith('javascript:')) {
                    window.location.href = el.href;
                }
            })()
        `)
        return { success: true, tag: info.tag, x: info.x, y: info.y }
    }

    /**
     * Focus and fill an input element by selector
     */
    async fillInput(webContents, selector, value) {
        // Step 1: JS — find element, scroll into view, focus, and clear
        const prep = await webContents.executeJavaScript(`
            (function() {
                const el = document.querySelector(${JSON.stringify(selector)});
                if (!el) return { error: 'Element not found: ' + ${JSON.stringify(selector)} };
                el.scrollIntoView({ behavior: 'instant', block: 'center' });
                el.focus();
                el.click();
                // Select all + delete to clear
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.select();
                }
                return { success: true, tag: el.tagName.toLowerCase() };
            })()
        `)
        if (prep?.error) return prep

        // Step 2: Try CDP typing (most reliable — generates trusted KeyboardEvents)
        try {
            const hasDebugger = await this._ensureDebugger(webContents)
            if (hasDebugger) {
                // Clear existing content with select-all + delete
                await webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
                    type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 /* Ctrl */
                })
                await webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
                    type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65
                })
                await webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
                    type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8
                })
                await webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
                    type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8
                })

                // Type each character via CDP insertText (fast + triggers all JS events)
                await webContents.debugger.sendCommand('Input.insertText', { text: value })
                return { success: true, method: 'cdp' }
            }
        } catch (err) {
            // CDP failed — fall through to JS fallback
            console.warn('[Automation] CDP fillInput failed, using JS fallback:', err.message)
        }

        // Step 3: JS fallback — native value setter (works for React etc.)
        return webContents.executeJavaScript(`
            (function() {
                const el = document.querySelector(${JSON.stringify(selector)});
                if (!el) return { error: 'Element not found (fallback)' };

                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
                )?.set;

                if (nativeInputValueSetter) {
                    nativeInputValueSetter.call(el, ${JSON.stringify(value)});
                } else {
                    el.value = ${JSON.stringify(value)};
                }

                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return { success: true, method: 'js-fallback' };
            })()
        `)
    }

    /**
     * Highlight an element briefly to show what's being interacted with
     */
    async highlightElement(webContents, x, y) {
        await webContents.executeJavaScript(`
            (function() {
                // Remove any existing highlight
                const old = document.getElementById('__ai_browser_highlight__');
                if (old) old.remove();

                const dot = document.createElement('div');
                dot.id = '__ai_browser_highlight__';
                dot.style.cssText = 'position:fixed;z-index:999999;pointer-events:none;' +
                    'width:24px;height:24px;border-radius:50%;' +
                    'background:rgba(200,16,46,0.5);border:2px solid #F1BE48;' +
                    'left:${x - 12}px;top:${y - 12}px;' +
                    'animation:__ai_pulse__ 0.6s ease-out forwards;';

                // Add animation keyframes
                if (!document.getElementById('__ai_browser_styles__')) {
                    const style = document.createElement('style');
                    style.id = '__ai_browser_styles__';
                    style.textContent = \`
                        @keyframes __ai_pulse__ {
                            0% { transform: scale(0.5); opacity: 1; }
                            100% { transform: scale(2); opacity: 0; }
                        }
                    \`;
                    document.head.appendChild(style);
                }

                document.body.appendChild(dot);
                setTimeout(() => dot.remove(), 700);
            })()
        `)
    }

    /**
     * Move mouse to coordinates (hover)
     */
    async moveMouse(webContents, x, y) {
        const hasCDP = await this._ensureDebugger(webContents)
        if (hasCDP) {
            try {
                await this._cdp(webContents, 'Input.dispatchMouseEvent', {
                    type: 'mouseMoved',
                    x: Math.round(x),
                    y: Math.round(y)
                })
                return
            } catch (err) { /* fallback below */ }
        }

        await webContents.executeJavaScript(`
            (function() {
                const el = document.elementFromPoint(${Math.round(x)}, ${Math.round(y)});
                if (el) {
                    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: ${x}, clientY: ${y} }));
                    el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: ${x}, clientY: ${y} }));
                }
            })()
        `)
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}

export { BrowserAutomation }
