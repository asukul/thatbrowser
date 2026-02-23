/**
 * That Browser — Auto-Update Checker
 * Checks GitHub Releases API for new versions and notifies the renderer.
 */

import { app, ipcMain, shell } from 'electron'

const GITHUB_REPO = 'asukul/thatbrowser'
const CHECK_INTERVAL = 4 * 60 * 60 * 1000 // 4 hours

let latestRelease = null
let mainWindow = null
let checkTimer = null

function devLog(level, tag, message) {
    const prefix = `[Updater][${tag}]`
    if (level === 'error') console.error(prefix, message)
    else console.log(prefix, message)
}

/**
 * Compare two semver strings. Returns:
 *  1  if a > b
 *  0  if a === b
 * -1  if a < b
 */
function compareSemver(a, b) {
    const pa = a.replace(/^v/, '').split('.').map(Number)
    const pb = b.replace(/^v/, '').split('.').map(Number)
    for (let i = 0; i < 3; i++) {
        const na = pa[i] || 0
        const nb = pb[i] || 0
        if (na > nb) return 1
        if (na < nb) return -1
    }
    return 0
}

/**
 * Fetch the latest release from GitHub
 */
async function fetchLatestRelease() {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
    devLog('info', 'Check', `Fetching ${url}`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    try {
        const res = await fetch(url, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'That-Browser-Updater'
            },
            signal: controller.signal
        })
        clearTimeout(timeout)

        if (!res.ok) {
            if (res.status === 404) {
                devLog('info', 'Check', 'No releases found yet')
                return null
            }
            throw new Error(`GitHub API returned ${res.status}`)
        }

        const data = await res.json()
        return {
            version: data.tag_name,
            name: data.name || data.tag_name,
            body: data.body || '',
            url: data.html_url,
            publishedAt: data.published_at,
            assets: (data.assets || []).map(a => ({
                name: a.name,
                url: a.browser_download_url,
                size: a.size
            }))
        }
    } catch (err) {
        clearTimeout(timeout)
        if (err.name === 'AbortError') {
            devLog('error', 'Check', 'Request timed out')
        } else {
            devLog('error', 'Check', err.message)
        }
        return null
    }
}

/**
 * Pick the correct download asset for the current platform
 */
function getDownloadUrl(release) {
    if (!release || !release.assets || release.assets.length === 0) {
        return release?.url || `https://github.com/${GITHUB_REPO}/releases/latest`
    }

    const platform = process.platform
    const arch = process.arch

    for (const asset of release.assets) {
        const name = asset.name.toLowerCase()
        if (platform === 'win32' && (name.endsWith('.exe') || name.includes('setup'))) {
            return asset.url
        }
        if (platform === 'darwin' && name.endsWith('.dmg')) {
            // Prefer arm64 on Apple Silicon
            if (arch === 'arm64' && name.includes('arm64')) return asset.url
            if (arch === 'x64' && !name.includes('arm64')) return asset.url
        }
        if (platform === 'linux' && name.endsWith('.appimage')) {
            return asset.url
        }
    }

    // Fallback: first matching platform asset or release page
    for (const asset of release.assets) {
        const name = asset.name.toLowerCase()
        if (platform === 'win32' && name.endsWith('.exe')) return asset.url
        if (platform === 'darwin' && name.endsWith('.dmg')) return asset.url
        if (platform === 'linux' && (name.endsWith('.appimage') || name.endsWith('.deb'))) return asset.url
    }

    return release.url || `https://github.com/${GITHUB_REPO}/releases/latest`
}

/**
 * Check for updates and notify renderer if available
 */
async function checkForUpdates() {
    const currentVersion = app.getVersion()
    devLog('info', 'Check', `Current version: v${currentVersion}`)

    const release = await fetchLatestRelease()
    if (!release) return { updateAvailable: false, currentVersion }

    latestRelease = release
    const cmp = compareSemver(release.version, currentVersion)
    const updateAvailable = cmp > 0

    devLog('info', 'Check', `Latest: ${release.version}, Current: v${currentVersion}, Update: ${updateAvailable}`)

    if (updateAvailable && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:update-available', {
            currentVersion,
            latestVersion: release.version,
            releaseName: release.name,
            releaseNotes: release.body,
            releaseUrl: release.url,
            downloadUrl: getDownloadUrl(release),
            publishedAt: release.publishedAt
        })
    }

    return {
        updateAvailable,
        currentVersion,
        latestVersion: release.version,
        releaseName: release.name,
        releaseNotes: release.body,
        releaseUrl: release.url,
        downloadUrl: getDownloadUrl(release),
        publishedAt: release.publishedAt
    }
}

/**
 * Initialize the updater — call from main.js after app.whenReady()
 */
export function initUpdater(win) {
    mainWindow = win

    // IPC: manual check from renderer
    ipcMain.handle('updater:check', async () => {
        return checkForUpdates()
    })

    // IPC: open download URL in system browser
    ipcMain.handle('updater:download', async () => {
        const downloadUrl = latestRelease ? getDownloadUrl(latestRelease) : `https://github.com/${GITHUB_REPO}/releases/latest`
        shell.openExternal(downloadUrl)
        return { success: true }
    })

    // IPC: open release page
    ipcMain.handle('updater:open-release', async () => {
        const url = latestRelease?.url || `https://github.com/${GITHUB_REPO}/releases/latest`
        shell.openExternal(url)
        return { success: true }
    })

    // Initial check after a short delay (let the app finish loading)
    setTimeout(() => {
        checkForUpdates().catch(err => devLog('error', 'Init', err.message))
    }, 5000)

    // Periodic check
    checkTimer = setInterval(() => {
        checkForUpdates().catch(err => devLog('error', 'Periodic', err.message))
    }, CHECK_INTERVAL)

    devLog('info', 'Init', `Updater initialized (check interval: ${CHECK_INTERVAL / 1000 / 60}min)`)
}

/**
 * Cleanup — call on app quit
 */
export function stopUpdater() {
    if (checkTimer) {
        clearInterval(checkTimer)
        checkTimer = null
    }
}
