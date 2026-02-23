/**
 * Predefined test case scenarios for That Browser.
 * Serves as both automated tests and onboarding tutorials.
 */

export const TEST_CATEGORIES = [
    'Navigation & Search',
    'Form Interaction',
    'Page Interaction',
    'Advanced',
]

export const TEST_CASES = [
    // ─── Navigation & Search ─────────────────────────────
    {
        id: 'google-search',
        name: 'Google Search',
        category: 'Navigation & Search',
        description: 'Navigate to Google and search for "Iowa State University"',
        commands: [
            { type: 'navigate', url: 'https://www.google.com' },
            { type: 'wait', ms: 1500 },
            { type: 'fill', selector: 'textarea[name="q"], input[name="q"]', value: 'Iowa State University' },
            { type: 'press', key: 'Enter' },
            { type: 'wait', ms: 2000 },
        ]
    },
    {
        id: 'wikipedia-search',
        name: 'Wikipedia Lookup',
        category: 'Navigation & Search',
        description: 'Navigate to Wikipedia search and look up "Artificial Intelligence"',
        commands: [
            { type: 'navigate', url: 'https://en.wikipedia.org/wiki/Special:Search' },
            { type: 'wait', ms: 1500 },
            { type: 'fill', selector: 'input[name="search"]', value: 'Artificial Intelligence' },
            { type: 'press', key: 'Enter' },
            { type: 'wait', ms: 2000 },
        ]
    },

    // ─── Form Interaction ────────────────────────────────
    {
        id: 'duckduckgo-search',
        name: 'DuckDuckGo Search',
        category: 'Form Interaction',
        description: 'Navigate to DuckDuckGo, fill the search box, and press Enter',
        commands: [
            { type: 'navigate', url: 'https://duckduckgo.com' },
            { type: 'wait', ms: 1500 },
            { type: 'fill', selector: 'input[name="q"]', value: 'AI browser automation' },
            { type: 'wait', ms: 500 },
            { type: 'press', key: 'Enter' },
            { type: 'wait', ms: 2000 },
        ]
    },
    {
        id: 'form-fill-demo',
        name: 'Form Fill Demo',
        category: 'Form Interaction',
        description: 'Navigate to a demo form and fill multiple fields',
        commands: [
            { type: 'navigate', url: 'https://httpbin.org/forms/post' },
            { type: 'wait', ms: 2000 },
            { type: 'fill', selector: 'input[name="custname"]', value: 'Cy the Cardinal' },
            { type: 'wait', ms: 300 },
            { type: 'fill', selector: 'input[name="custtel"]', value: '515-294-4111' },
            { type: 'wait', ms: 300 },
            { type: 'fill', selector: 'input[name="custemail"]', value: 'cy@iastate.edu' },
            { type: 'wait', ms: 300 },
            { type: 'fill', selector: 'textarea[name="comments"]', value: 'Go Cyclones! This is a test of the AI Browser form automation.' },
            { type: 'wait', ms: 500 },
        ]
    },

    // ─── Page Interaction ────────────────────────────────
    {
        id: 'scroll-navigate',
        name: 'Scroll & Navigate',
        category: 'Page Interaction',
        description: 'Navigate to Iowa State University page and scroll through it',
        commands: [
            { type: 'navigate', url: 'https://en.wikipedia.org/wiki/Iowa_State_University' },
            { type: 'wait', ms: 2000 },
            { type: 'scroll', deltaY: 600 },
            { type: 'wait', ms: 1000 },
            { type: 'scroll', deltaY: 600 },
            { type: 'wait', ms: 1000 },
            { type: 'scroll', deltaY: -1200 },
            { type: 'wait', ms: 500 },
        ]
    },
    {
        id: 'bing-search-scroll',
        name: 'Bing Search + Scroll',
        category: 'Page Interaction',
        description: 'Search on Bing and scroll through results',
        commands: [
            { type: 'navigate', url: 'https://www.bing.com' },
            { type: 'wait', ms: 1500 },
            { type: 'fill', selector: '#sb_form_q, textarea[name="q"], input[name="q"]', value: 'Iowa State Cyclones football' },
            { type: 'press', key: 'Enter' },
            { type: 'wait', ms: 2000 },
            { type: 'scroll', deltaY: 400 },
            { type: 'wait', ms: 800 },
            { type: 'scroll', deltaY: 400 },
            { type: 'wait', ms: 800 },
        ]
    },

    // ─── Advanced ────────────────────────────────────────
    {
        id: 'wikipedia-deep-dive',
        name: 'Wikipedia Deep Dive',
        category: 'Advanced',
        description: 'Go directly to Machine Learning article and scroll through it',
        commands: [
            { type: 'navigate', url: 'https://en.wikipedia.org/wiki/Machine_learning' },
            { type: 'wait', ms: 2000 },
            { type: 'scroll', deltaY: 500 },
            { type: 'wait', ms: 1000 },
            { type: 'scroll', deltaY: 500 },
            { type: 'wait', ms: 1000 },
            { type: 'scroll', deltaY: 500 },
            { type: 'wait', ms: 1000 },
            { type: 'scroll', deltaY: -1500 },
            { type: 'wait', ms: 500 },
        ]
    },
    {
        id: 'multi-site-tour',
        name: 'Multi-Site Tour',
        category: 'Advanced',
        description: 'Visit 3 different websites in sequence with waits',
        commands: [
            { type: 'navigate', url: 'https://www.google.com' },
            { type: 'wait', ms: 1500 },
            { type: 'navigate', url: 'https://en.wikipedia.org/wiki/Iowa_State_University' },
            { type: 'wait', ms: 1500 },
            { type: 'navigate', url: 'https://duckduckgo.com' },
            { type: 'wait', ms: 1500 },
            { type: 'navigate', url: 'https://www.iastate.edu' },
            { type: 'wait', ms: 2000 },
            { type: 'scroll', deltaY: 400 },
            { type: 'wait', ms: 800 },
        ]
    },
]
