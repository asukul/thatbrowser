/**
 * Ad Blocker — Blocks ads via Electron session.webRequest
 * Uses a curated domain blocklist + EasyList pattern matching
 */

import { session } from 'electron'

// Common ad/tracking domains
const AD_DOMAINS = new Set([
    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
    'google-analytics.com', 'googletagmanager.com', 'googletagservices.com',
    'facebook.net', 'fbcdn.net', 'analytics.facebook.com',
    'ads.twitter.com', 'ads-api.twitter.com',
    'adservice.google.com', 'pagead2.googlesyndication.com',
    'securepubads.g.doubleclick.net', 'tpc.googlesyndication.com',
    'ad.doubleclick.net', 'stats.g.doubleclick.net',
    'amazon-adsystem.com', 'aax.amazon-adsystem.com',
    'adsserver.com', 'adnxs.com', 'adsrvr.org',
    'outbrain.com', 'taboola.com', 'revcontent.com',
    'criteo.com', 'criteo.net', 'moatads.com',
    'scorecardresearch.com', 'quantserve.com', 'bluekai.com',
    'rubiconproject.com', 'pubmatic.com', 'openx.net',
    'casalemedia.com', 'sharethrough.com', 'smartadserver.com',
    'advertising.com', 'adform.net', 'bidswitch.net',
    'mathtag.com', 'serving-sys.com', 'eyeota.net',
    'narrative.io', 'crwdcntrl.net', 'demdex.net',
    'exelator.com', 'turn.com', 'admob.com',
    'inmobi.com', 'appsflyer.com', 'adjust.com',
    'branch.io', 'kochava.com', 'singular.net',
    'mixpanel.com', 'amplitude.com', 'segment.io',
    'hotjar.com', 'mouseflow.com', 'fullstory.com',
    'crazyegg.com', 'clicktale.com', 'luckyorange.com',
    'newrelic.com', 'nr-data.net', 'omtrdc.net',
    '2mdn.net', 'adcolony.com', 'unity3d.com',
    'chartboost.com', 'vungle.com', 'ironsrc.com',
    'mopub.com', 'millennialmedia.com', 'flurry.com',
    'bugsnag.com', 'sentry.io', 'rollbar.com',
    'zedo.com', 'contextweb.com', 'yieldmo.com',
    'teads.tv', 'triplelift.com', 'sovrn.com',
    'lijit.com', 'districtm.io', 'indexexchange.com',
    'spotxchange.com', 'springserve.com', 'connatix.com'
])

// URL patterns to block
const AD_PATTERNS = [
    /\/ads\//i,
    /\/ad\//i,
    /\/adserver/i,
    /\/advert/i,
    /[?&]ad[_=]/i,
    /\/banner[s]?\//i,
    /\/pop(up|under)/i,
    /\/tracking\//i,
    /\/pixel\//i,
    /\/beacon\//i,
    /\.gif\?.*click/i,
    /\/doubleclick\//i,
    /\/pagead\//i,
    /\/sponsor/i,
    /\/analytics\.js/i,
    /\/gtag\/js/i,
    /\/gtm\.js/i
]

class AdBlocker {
    constructor(store) {
        this.store = store
        this.enabled = false
        this.blockedCount = 0
        this.blockedPerTab = new Map()
        this._handler = null
    }

    enable() {
        if (this.enabled) return

        this._handler = (details, callback) => {
            const url = details.url
            const shouldBlock = this._shouldBlock(url)

            if (shouldBlock) {
                this.blockedCount++
                callback({ cancel: true })
            } else {
                callback({ cancel: false })
            }
        }

        session.defaultSession.webRequest.onBeforeRequest(
            { urls: ['*://*/*'] },
            this._handler
        )

        this.enabled = true
        console.log('[AdBlocker] Enabled — blocking ads and trackers')
    }

    disable() {
        if (!this.enabled) return

        // Remove the handler by setting it to null
        session.defaultSession.webRequest.onBeforeRequest(null)
        this.enabled = false
        console.log('[AdBlocker] Disabled')
    }

    _shouldBlock(url) {
        try {
            const parsed = new URL(url)
            const hostname = parsed.hostname

            // Check domain blocklist
            for (const adDomain of AD_DOMAINS) {
                if (hostname === adDomain || hostname.endsWith('.' + adDomain)) {
                    return true
                }
            }

            // Check URL patterns
            for (const pattern of AD_PATTERNS) {
                if (pattern.test(url)) {
                    return true
                }
            }

            return false
        } catch {
            return false
        }
    }

    getStats() {
        return {
            enabled: this.enabled,
            totalBlocked: this.blockedCount
        }
    }
}

export { AdBlocker }
