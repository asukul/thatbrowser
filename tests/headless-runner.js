/**
 * Headless E2E test runner for That Browser.
 *
 * Runs inside Electron (launched via `electron . --run-tests`).
 * Imports TEST_CASES from the renderer module (plain ES data, no React deps)
 * and drives them against the same BrowserAutomation engine the UI uses.
 *
 * Exported entrypoint: runAllTestCases({ BrowserWindow, automation })
 * Returns: { total, passed, failed, durationMs, cases: [...] }
 */

import { TEST_CASES } from '../src/renderer/components/TestCases.js'

const LOAD_TIMEOUT_MS = 15000  // per navigation
const CMD_TIMEOUT_MS = 25000   // absolute ceiling on any single command (race guard)

function now() { return Date.now() }

function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
        promise.then(
            (v) => { clearTimeout(t); resolve(v) },
            (e) => { clearTimeout(t); reject(e) }
        )
    })
}

function waitForLoadStop(webContents, timeoutMs = LOAD_TIMEOUT_MS) {
    return new Promise((resolve) => {
        let done = false
        const finish = (reason) => {
            if (done) return
            done = true
            webContents.removeListener('did-stop-loading', onStop)
            webContents.removeListener('did-fail-load', onFail)
            resolve(reason)
        }
        const onStop = () => finish('stop')
        const onFail = (_e, errorCode, errorDesc) => finish(`fail:${errorCode}:${errorDesc}`)
        webContents.once('did-stop-loading', onStop)
        webContents.once('did-fail-load', onFail)
        setTimeout(() => finish('timeout'), timeoutMs)
    })
}

async function runCommand(automation, webContents, cmd) {
    switch (cmd.type) {
        case 'navigate': {
            const p = waitForLoadStop(webContents)
            webContents.loadURL(cmd.url)
            const reason = await p
            if (reason.startsWith('fail:')) throw new Error(`Navigate failed: ${reason}`)
            return { reason }
        }
        case 'wait':
            await new Promise(r => setTimeout(r, cmd.ms))
            return {}
        case 'fill': {
            const res = await automation.fillInput(webContents, cmd.selector, cmd.value)
            if (res && res.error) throw new Error(res.error)
            return res
        }
        case 'press':
            await automation.pressKey(webContents, cmd.key, cmd.modifiers || [])
            return {}
        case 'scroll':
            await automation.scroll(webContents, cmd.x ?? 0, cmd.y ?? 0, cmd.deltaX ?? 0, cmd.deltaY ?? 0)
            return {}
        case 'click': {
            const res = await automation.clickElement(webContents, cmd.selector)
            if (res && res.error) throw new Error(res.error)
            return res
        }
        default:
            throw new Error(`Unknown command type: ${cmd.type}`)
    }
}

async function runCase(automation, webContents, testCase) {
    const caseStart = now()
    const steps = []

    // Reset state between cases: clear storage (cookies, localStorage, cache) and
    // navigate to about:blank so the next case starts clean. Best-effort — if the
    // reset fails, we log and continue so the next case still runs.
    try {
        await webContents.session.clearStorageData({
            storages: ['cookies', 'localstorage', 'indexdb', 'websql', 'cachestorage', 'serviceworkers', 'shadercache']
        })
    } catch (e) {
        console.error('[e2e]     reset: clearStorageData failed:', e?.message || e)
    }
    try {
        const p = waitForLoadStop(webContents, 5000)
        webContents.loadURL('about:blank')
        await p
    } catch (e) {
        console.error('[e2e]     reset: about:blank failed:', e?.message || e)
    }

    let caseError = null

    for (let i = 0; i < testCase.commands.length; i++) {
        const cmd = testCase.commands[i]
        console.error(`[e2e]     step ${i}: ${cmd.type}${cmd.url ? ' ' + cmd.url : ''}${cmd.selector ? ' ' + cmd.selector : ''}`)
        const stepStart = now()
        let ok = true
        let err = null
        try {
            // Race every command against an absolute 25s ceiling — prevents any hang
            // from stalling the whole suite. If this fires, we record the timeout and
            // move to the next case.
            await withTimeout(
                runCommand(automation, webContents, cmd),
                CMD_TIMEOUT_MS,
                `command ${cmd.type}`
            )
        } catch (e) {
            ok = false
            err = e?.message || String(e)
            caseError = err
        }
        const durationMs = now() - stepStart
        console.error(`[e2e]       ${ok ? 'ok' : 'FAIL'} in ${durationMs}ms${err ? ' — ' + err : ''}`)
        steps.push({ stepIdx: i, type: cmd.type, ok, error: err, durationMs })
        if (!ok) break
    }

    const finalUrl = (() => { try { return webContents.getURL() } catch { return null } })()
    const finalTitle = (() => { try { return webContents.getTitle() } catch { return null } })()

    return {
        id: testCase.id,
        name: testCase.name,
        category: testCase.category,
        passed: caseError === null,
        error: caseError,
        finalUrl,
        finalTitle,
        durationMs: now() - caseStart,
        stepCount: testCase.commands.length,
        steps
    }
}

export async function runAllTestCases({ BrowserWindow, automation }) {
    const suiteStart = now()
    const cases = []

    // One long-lived offscreen window for the entire suite — destroying windows
    // mid-suite triggers window-all-closed and can race app.exit.
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        show: false,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false }
    })
    const webContents = win.webContents

    for (const tc of TEST_CASES) {
        console.error(`[e2e] Running: ${tc.id} (${tc.name})`)
        try {
            const result = await runCase(automation, webContents, tc)
            cases.push(result)
            console.error(`[e2e]   ${result.passed ? 'PASS' : 'FAIL'} — ${result.durationMs}ms${result.error ? ' — ' + result.error : ''}`)
        } catch (e) {
            cases.push({
                id: tc.id,
                name: tc.name,
                category: tc.category,
                passed: false,
                error: `Runner crash: ${e?.message || String(e)}`,
                finalUrl: null,
                finalTitle: null,
                durationMs: 0,
                stepCount: tc.commands.length,
                steps: []
            })
            console.error(`[e2e]   CRASH — ${e?.message}`)
        }
    }

    // Clean up the single window at the end of the suite.
    try { win.destroy() } catch {}

    const passed = cases.filter(c => c.passed).length
    const failed = cases.length - passed

    return {
        startedAt: new Date(suiteStart).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: now() - suiteStart,
        total: cases.length,
        passed,
        failed,
        cases
    }
}
