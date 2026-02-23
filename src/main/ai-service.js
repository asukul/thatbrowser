/**
 * AI Service — Unified abstraction for multiple AI providers
 * Supports: OpenAI, Gemini, OpenRouter, Ollama, LMStudio
 * Features: Chat, Streaming, Summarize, Task Execution, Abort/Stop
 */

class AIService {
    constructor(store) {
        this.store = store
        this.settings = store.get('aiSettings')
        this.activeControllers = new Set() // Track all in-flight requests
        this.onLog = null // Dev mode logger callback: (level, category, msg, data) => void
    }

    updateSettings(settings) {
        this.settings = settings
    }

    /** Call this to abort ALL active requests immediately */
    abort() {
        let count = 0
        for (const controller of this.activeControllers) {
            controller.abort()
            count++
        }
        this.activeControllers.clear()
        this._log('warn', 'AI', `Abort called — cancelled ${count} in-flight request(s)`)
        return count
    }

    /** Internal: create a tracked AbortController for a request */
    _makeController(timeoutMs = 120000) {
        const controller = new AbortController()
        this.activeControllers.add(controller)

        // Auto-cleanup when request finishes
        const cleanup = () => this.activeControllers.delete(controller)

        // Optional timeout
        if (timeoutMs > 0) {
            const timer = setTimeout(() => {
                controller.abort()
                cleanup()
                this._log('warn', 'AI', `Request timed out after ${timeoutMs / 1000}s`)
            }, timeoutMs)
            // Clear timer on manual abort
            controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
        }

        controller.signal.addEventListener('abort', cleanup, { once: true })
        return controller
    }

    /** Internal: dev logging helper */
    _log(level, category, message, data) {
        if (this.onLog) {
            try { this.onLog(level, category, message, data) } catch { }
        }
    }

    getProviderConfig(providerName) {
        const name = providerName || this.settings.activeProvider
        return {
            name,
            ...this.settings.providers[name]
        }
    }

    /**
     * Validate that provider has required configuration
     */
    validateProvider(provider) {
        const isLocal = provider.name === 'ollama' || provider.name === 'lmstudio'

        if (!isLocal && !provider.apiKey) {
            throw new Error(
                `No API key configured for ${provider.name}. Please add your API key in Settings.`
            )
        }

        // Extra validation for Anthropic
        if (provider.name === 'anthropic' && provider.apiKey && !provider.apiKey.startsWith('sk-ant-')) {
            this._log('warn', 'AI', 'Anthropic API key should start with sk-ant-')
        }

        if (!provider.baseUrl) {
            throw new Error(
                `No base URL configured for ${provider.name}. Please check Settings.`
            )
        }

        if (!provider.model) {
            throw new Error(
                `No model specified for ${provider.name}. Please check Settings.`
            )
        }
    }

    async chat(messages, providerName) {
        const provider = this.getProviderConfig(providerName)
        this.validateProvider(provider)

        const t0 = Date.now()
        this._log('info', 'AI', `Chat request → ${provider.name} / ${provider.model}`, {
            provider: provider.name,
            model: provider.model,
            messageCount: messages.length
        })

        try {
            let result
            switch (provider.name) {
                case 'gemini':
                    result = await this._chatGemini(messages, provider)
                    break
                case 'anthropic':
                    result = await this._chatAnthropic(messages, provider)
                    break
                case 'ollama':
                    result = await this._chatOllama(messages, provider)
                    break
                default:
                    result = await this._chatOpenAICompatible(messages, provider)
            }

            const elapsed = Date.now() - t0
            this._log('info', 'AI', `Chat response ← ${provider.name} (${elapsed}ms)`, {
                provider: provider.name,
                model: result.model,
                usage: result.usage,
                elapsedMs: elapsed,
                contentLength: result.content?.length
            })
            return result
        } catch (err) {
            if (err.name === 'AbortError') {
                this._log('warn', 'AI', `Chat request aborted (${provider.name})`)
                throw err
            }
            this._log('error', 'AI', `Chat error from ${provider.name}: ${err.message}`, { error: err.message })
            throw err
        }
    }

    /**
     * Streaming chat — sends chunks via callbacks
     */
    async chatStream(messages, providerName, onChunk, onDone, onError) {
        try {
            const provider = this.getProviderConfig(providerName)
            this.validateProvider(provider)

            const t0 = Date.now()
            let chunkCount = 0
            this._log('info', 'AI', `Stream request → ${provider.name} / ${provider.model}`, {
                provider: provider.name,
                model: provider.model,
                messageCount: messages.length
            })

            const wrappedChunk = (chunk) => {
                chunkCount++
                onChunk(chunk)
            }

            const wrappedDone = () => {
                const elapsed = Date.now() - t0
                this._log('info', 'AI', `Stream complete ← ${provider.name} (${elapsed}ms, ${chunkCount} chunks)`, {
                    elapsedMs: elapsed,
                    chunks: chunkCount
                })
                onDone()
            }

            const wrappedError = (err) => {
                if (err.name === 'AbortError') {
                    this._log('warn', 'AI', `Stream aborted by user (${provider.name})`)
                } else {
                    this._log('error', 'AI', `Stream error from ${provider.name}: ${err.message}`, { error: err.message })
                }
                onError(err)
            }

            switch (provider.name) {
                case 'gemini':
                    await this._streamGemini(messages, provider, wrappedChunk, wrappedDone, wrappedError)
                    break
                case 'anthropic':
                    await this._streamAnthropic(messages, provider, wrappedChunk, wrappedDone, wrappedError)
                    break
                case 'ollama':
                    await this._streamOllama(messages, provider, wrappedChunk, wrappedDone, wrappedError)
                    break
                default:
                    await this._streamOpenAICompatible(messages, provider, wrappedChunk, wrappedDone, wrappedError)
                    break
            }
        } catch (err) {
            onError(err)
        }
    }

    async summarize(pageText, pageTitle, pageUrl, providerName) {
        const systemPrompt = `You are an AI research assistant built into That Browser.
Your task is to provide clear, well-structured summaries of web pages.
Format your response in markdown with:
- A brief overview (2-3 sentences)
- Key points as bullet points
- Any important data, dates, or numbers highlighted
- A relevance note if applicable to academic research`

        const userPrompt = `Please summarize the following web page:

**Title:** ${pageTitle}
**URL:** ${pageUrl}

**Content:**
${pageText}`

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ]

        return this.chat(messages, providerName)
    }

    async executeTask(taskDescription, providerName) {
        const systemPrompt = `You are an AI task execution assistant in That Browser.
You can control the browser to automate tasks. You have access to these automation commands:
- CLICK(x, y) — Click at screen coordinates
- TYPE("text") — Type text into the focused element
- PRESS("key") — Press a key (Enter, Tab, Escape, etc.)
- SCROLL(deltaY) — Scroll the page (negative = up, positive = down)
- NAVIGATE("url") — Go to a URL
- WAIT(ms) — Wait for milliseconds
- FIND("selector") — Find elements on the page

Break down the task into clear, actionable steps using these commands.
For each step, explain what you're doing and provide the exact command.
Format commands in code blocks so they can be parsed and executed.`

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Please help me execute this task: ${taskDescription}` }
        ]

        return this.chat(messages, providerName)
    }

    // === Provider Implementations ===

    /** Helper to detect and clarify connection-refused errors from local servers */
    _enrichFetchError(err, provider) {
        const isLocal = provider.name === 'ollama' || provider.name === 'lmstudio'
        if (isLocal && (err.message === 'fetch failed' || err.cause?.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNRESET')) {
            const app = provider.name === 'lmstudio' ? 'LM Studio (open LM Studio → Local Server tab → Start Server)' : 'Ollama (run: ollama serve)'
            throw new Error(`Cannot connect to ${provider.name} at ${provider.baseUrl}. Please start ${app} and try again.`)
        }
        throw err
    }

    /** Convert a message to OpenAI-compatible format (supports vision) */
    _toOpenAIMessage(msg) {
        if (msg.image) {
            return {
                role: msg.role,
                content: [
                    { type: 'text', text: msg.content },
                    { type: 'image_url', image_url: { url: msg.image, detail: 'low' } }
                ]
            }
        }
        return { role: msg.role, content: msg.content }
    }

    async _chatOpenAICompatible(messages, provider) {
        const controller = this._makeController()
        const headers = { 'Content-Type': 'application/json' }

        if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`
        if (provider.name === 'openrouter') {
            headers['HTTP-Referer'] = 'https://github.com/asukul/thatbrowser'
            headers['X-Title'] = 'That Browser'
        }

        this._log('info', 'Network', `POST ${provider.baseUrl}/chat/completions`)

        try {
            const response = await fetch(`${provider.baseUrl}/chat/completions`, {
                method: 'POST',
                headers,
                signal: controller.signal,
                body: JSON.stringify({
                    model: provider.model,
                    messages: messages.map(m => this._toOpenAIMessage(m)),
                    temperature: 0.7,
                    max_tokens: 4096
                })
            })

            if (!response.ok) {
                const errBody = await response.text()
                throw new Error(`${provider.name} API error (${response.status}): ${errBody}`)
            }

            const data = await response.json()
            return {
                content: data.choices[0].message.content,
                model: data.model,
                provider: provider.name,
                usage: data.usage
            }
        } catch (err) {
            this._enrichFetchError(err, provider)
        }
    }

    async _streamOpenAICompatible(messages, provider, onChunk, onDone, onError) {
        const controller = this._makeController()
        const headers = { 'Content-Type': 'application/json' }

        if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`
        if (provider.name === 'openrouter') {
            headers['HTTP-Referer'] = 'https://github.com/asukul/thatbrowser'
            headers['X-Title'] = 'That Browser'
        }

        this._log('info', 'Network', `POST ${provider.baseUrl}/chat/completions (stream)`)

        try {
            let response
            try {
                response = await fetch(`${provider.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers,
                    signal: controller.signal,
                    body: JSON.stringify({
                        model: provider.model,
                        messages: messages.map(m => this._toOpenAIMessage(m)),
                        temperature: 0.7,
                        max_tokens: 4096,
                        stream: true
                    })
                })
            } catch (fetchErr) {
                this._enrichFetchError(fetchErr, provider)
            }

            if (!response.ok) {
                const errBody = await response.text()
                throw new Error(`${provider.name} API error (${response.status}): ${errBody}`)
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    const trimmed = line.trim()
                    if (!trimmed || !trimmed.startsWith('data: ')) continue
                    const data = trimmed.slice(6)
                    if (data === '[DONE]') {
                        onDone()
                        return
                    }
                    try {
                        const json = JSON.parse(data)
                        const content = json.choices?.[0]?.delta?.content
                        if (content) onChunk(content)
                    } catch { }
                }
            }
            onDone()
        } catch (err) {
            onError(err)
        }
    }

    // ── Anthropic (Claude) ──────────────────────────────────────────────

    /** Build Anthropic messages array — separates system prompt per API spec, supports vision */
    _buildAnthropicMessages(messages) {
        let systemContent = null
        const anthropicMessages = []
        for (const msg of messages) {
            if (msg.role === 'system') {
                systemContent = (systemContent ? systemContent + '\n' : '') + msg.content
            } else if (msg.image) {
                const base64 = msg.image.replace(/^data:image\/\w+;base64,/, '')
                anthropicMessages.push({
                    role: msg.role,
                    content: [
                        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64 } },
                        { type: 'text', text: msg.content }
                    ]
                })
            } else {
                anthropicMessages.push({ role: msg.role, content: msg.content })
            }
        }
        return { systemContent, anthropicMessages }
    }

    async _chatAnthropic(messages, provider) {
        const controller = this._makeController()
        const { systemContent, anthropicMessages } = this._buildAnthropicMessages(messages)

        const body = {
            model: provider.model,
            max_tokens: 4096,
            messages: anthropicMessages
        }
        if (systemContent) body.system = systemContent

        this._log('info', 'Network', `POST ${provider.baseUrl}/v1/messages (Anthropic)`)

        const response = await fetch(`${provider.baseUrl}/v1/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': provider.apiKey,
                'anthropic-version': '2023-06-01'
            },
            signal: controller.signal,
            body: JSON.stringify(body)
        })

        if (!response.ok) {
            const errBody = await response.text()
            throw new Error(`Anthropic API error (${response.status}): ${errBody}`)
        }

        const data = await response.json()
        return {
            content: data.content[0].text,
            model: data.model,
            provider: 'anthropic',
            usage: data.usage
        }
    }

    async _streamAnthropic(messages, provider, onChunk, onDone, onError) {
        const controller = this._makeController()
        const { systemContent, anthropicMessages } = this._buildAnthropicMessages(messages)

        const body = {
            model: provider.model,
            max_tokens: 4096,
            messages: anthropicMessages,
            stream: true
        }
        if (systemContent) body.system = systemContent

        this._log('info', 'Network', `POST ${provider.baseUrl}/v1/messages (Anthropic, stream)`)

        try {
            const response = await fetch(`${provider.baseUrl}/v1/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': provider.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                signal: controller.signal,
                body: JSON.stringify(body)
            })

            if (!response.ok) {
                const errBody = await response.text()
                throw new Error(`Anthropic API error (${response.status}): ${errBody}`)
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    const trimmed = line.trim()
                    if (!trimmed || !trimmed.startsWith('data: ')) continue
                    try {
                        const json = JSON.parse(trimmed.slice(6))
                        // content_block_delta carries the text deltas
                        if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
                            onChunk(json.delta.text)
                        }
                        // message_stop signals end of stream
                        if (json.type === 'message_stop') {
                            onDone()
                            return
                        }
                    } catch { }
                }
            }
            onDone()
        } catch (err) {
            onError(err)
        }
    }

    // ── Gemini ─────────────────────────────────────────────────────────

    /** Build Gemini parts array for a message (supports vision) */
    _toGeminiParts(msg) {
        const parts = [{ text: msg.content }]
        if (msg.image) {
            const base64 = msg.image.replace(/^data:image\/\w+;base64,/, '')
            parts.push({ inlineData: { mimeType: 'image/png', data: base64 } })
        }
        return parts
    }

    async _chatGemini(messages, provider) {
        const controller = this._makeController()
        const contents = []
        let systemInstruction = null

        for (const msg of messages) {
            if (msg.role === 'system') {
                systemInstruction = msg.content
            } else {
                contents.push({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: this._toGeminiParts(msg)
                })
            }
        }

        const body = {
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
        }
        if (systemInstruction) {
            body.systemInstruction = { parts: [{ text: systemInstruction }] }
        }

        const url = `${provider.baseUrl}/models/${provider.model}:generateContent?key=${provider.apiKey}`
        this._log('info', 'Network', `POST Gemini generateContent`)

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify(body)
        })

        if (!response.ok) {
            const errBody = await response.text()
            throw new Error(`Gemini API error (${response.status}): ${errBody}`)
        }

        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.'
        return { content: text, model: provider.model, provider: 'gemini', usage: data.usageMetadata }
    }

    async _streamGemini(messages, provider, onChunk, onDone, onError) {
        const controller = this._makeController()
        const contents = []
        let systemInstruction = null

        for (const msg of messages) {
            if (msg.role === 'system') {
                systemInstruction = msg.content
            } else {
                contents.push({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: this._toGeminiParts(msg)
                })
            }
        }

        const body = {
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
        }
        if (systemInstruction) {
            body.systemInstruction = { parts: [{ text: systemInstruction }] }
        }

        const url = `${provider.baseUrl}/models/${provider.model}:streamGenerateContent?alt=sse&key=${provider.apiKey}`
        this._log('info', 'Network', `POST Gemini streamGenerateContent`)

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify(body)
            })

            if (!response.ok) {
                const errBody = await response.text()
                throw new Error(`Gemini API error (${response.status}): ${errBody}`)
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    const trimmed = line.trim()
                    if (!trimmed || !trimmed.startsWith('data: ')) continue
                    try {
                        const json = JSON.parse(trimmed.slice(6))
                        const text = json.candidates?.[0]?.content?.parts?.[0]?.text
                        if (text) onChunk(text)
                    } catch { }
                }
            }
            onDone()
        } catch (err) {
            onError(err)
        }
    }

    /** Convert message to Ollama format (supports vision via images field) */
    _toOllamaMessage(msg) {
        const out = { role: msg.role, content: msg.content }
        if (msg.image) {
            out.images = [msg.image.replace(/^data:image\/\w+;base64,/, '')]
        }
        return out
    }

    async _chatOllama(messages, provider) {
        const controller = this._makeController()
        this._log('info', 'Network', `POST ${provider.baseUrl}/api/chat`)

        try {
            const response = await fetch(`${provider.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    model: provider.model,
                    messages: messages.map(m => this._toOllamaMessage(m)),
                    stream: false
                })
            })

            if (!response.ok) {
                const errBody = await response.text()
                throw new Error(`Ollama API error (${response.status}): ${errBody}`)
            }

            const data = await response.json()
            return {
                content: data.message.content,
                model: data.model,
                provider: 'ollama',
                usage: { prompt_tokens: data.prompt_eval_count, completion_tokens: data.eval_count }
            }
        } catch (err) {
            this._enrichFetchError(err, provider)
        }
    }

    async _streamOllama(messages, provider, onChunk, onDone, onError) {
        const controller = this._makeController()
        this._log('info', 'Network', `POST ${provider.baseUrl}/api/chat (stream)`)

        try {
            const response = await fetch(`${provider.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    model: provider.model,
                    messages: messages.map(m => this._toOllamaMessage(m)),
                    stream: true
                })
            })

            if (!response.ok) {
                const errBody = await response.text()
                throw new Error(`Ollama API error (${response.status}): ${errBody}`)
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (!line.trim()) continue
                    try {
                        const json = JSON.parse(line)
                        if (json.message?.content) onChunk(json.message.content)
                        if (json.done) { onDone(); return }
                    } catch { }
                }
            }
            onDone()
        } catch (err) {
            onError(err)
        }
    }
    // ═══════════════════════════════════════════════════════════════
    // Model Listing — used by "Test Connection" to verify API key
    // and populate available models dropdown
    // ═══════════════════════════════════════════════════════════════

    async listModels(providerName) {
        const provider = this.getProviderConfig(providerName)
        const controller = this._makeController(15000)
        this._log('info', 'AI', `Listing models for ${provider.name}...`)

        try {
            switch (provider.name) {
                case 'openai':
                case 'openrouter':
                case 'lmstudio': {
                    const headers = { 'Content-Type': 'application/json' }
                    if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`
                    if (provider.name === 'openrouter') {
                        headers['HTTP-Referer'] = 'https://github.com/asukul/thatbrowser'
                        headers['X-Title'] = 'That Browser'
                    }
                    const res = await fetch(`${provider.baseUrl}/models`, {
                        headers, signal: controller.signal
                    })
                    if (!res.ok) {
                        const body = await res.text().catch(() => '')
                        throw new Error(`${provider.name} API error (${res.status}): ${body.substring(0, 200)}`)
                    }
                    const data = await res.json()
                    const models = (data.data || []).map(m => m.id).sort()
                    this._log('info', 'AI', `${provider.name}: ${models.length} models found`)
                    return { models }
                }
                case 'anthropic': {
                    const res = await fetch(`${provider.baseUrl}/v1/models`, {
                        headers: {
                            'x-api-key': provider.apiKey,
                            'anthropic-version': '2023-06-01',
                            'Content-Type': 'application/json'
                        },
                        signal: controller.signal
                    })
                    if (!res.ok) {
                        const body = await res.text().catch(() => '')
                        throw new Error(`Anthropic API error (${res.status}): ${body.substring(0, 200)}`)
                    }
                    const data = await res.json()
                    const models = (data.data || []).map(m => m.id).sort()
                    this._log('info', 'AI', `Anthropic: ${models.length} models found`)
                    return { models }
                }
                case 'gemini': {
                    if (!provider.apiKey) throw new Error('Gemini API key is required')
                    const res = await fetch(
                        `${provider.baseUrl}/models?key=${provider.apiKey}`,
                        { signal: controller.signal }
                    )
                    if (!res.ok) {
                        const body = await res.text().catch(() => '')
                        throw new Error(`Gemini API error (${res.status}): ${body.substring(0, 200)}`)
                    }
                    const data = await res.json()
                    const models = (data.models || [])
                        .map(m => m.name.replace(/^models\//, ''))
                        .filter(n => n.startsWith('gemini'))
                        .sort()
                    this._log('info', 'AI', `Gemini: ${models.length} models found`)
                    return { models }
                }
                case 'ollama': {
                    const res = await fetch(`${provider.baseUrl}/api/tags`, {
                        signal: controller.signal
                    })
                    if (!res.ok) {
                        const body = await res.text().catch(() => '')
                        throw new Error(`Ollama API error (${res.status}): ${body.substring(0, 200)}`)
                    }
                    const data = await res.json()
                    const models = (data.models || []).map(m => m.name).sort()
                    this._log('info', 'AI', `Ollama: ${models.length} models found`)
                    return { models }
                }
                default:
                    throw new Error(`Unknown provider: ${provider.name}`)
            }
        } catch (err) {
            this._enrichFetchError(err, provider)
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // STT Model Listing — lists models available for voice/STT
    // Uses the STT-specific API key & base URL (separate from chat)
    // ═══════════════════════════════════════════════════════════════

    async listSttModels(provider, apiKey, baseUrl) {
        const controller = this._makeController(15000)
        this._log('info', 'AI', `Listing STT models for ${provider}...`)

        try {
            switch (provider) {
                case 'openai': {
                    if (!apiKey) throw new Error('OpenAI API key is required for STT test')
                    const url = baseUrl || 'https://api.openai.com/v1'
                    const res = await fetch(`${url}/models`, {
                        headers: { 'Authorization': `Bearer ${apiKey}` },
                        signal: controller.signal
                    })
                    if (!res.ok) {
                        const body = await res.text().catch(() => '')
                        throw new Error(`OpenAI API error (${res.status}): ${body.substring(0, 200)}`)
                    }
                    const data = await res.json()
                    const models = (data.data || []).map(m => m.id)
                        .filter(id => id.includes('whisper') || id.includes('tts'))
                        .sort()
                    this._log('info', 'AI', `OpenAI STT: ${models.length} voice models found`)
                    return { models }
                }
                case 'gemini': {
                    if (!apiKey) throw new Error('Gemini API key is required for STT test')
                    const url = baseUrl || 'https://generativelanguage.googleapis.com/v1beta'
                    const res = await fetch(`${url}/models?key=${apiKey}`, { signal: controller.signal })
                    if (!res.ok) {
                        const body = await res.text().catch(() => '')
                        throw new Error(`Gemini API error (${res.status}): ${body.substring(0, 200)}`)
                    }
                    const data = await res.json()
                    const models = (data.models || [])
                        .map(m => m.name.replace(/^models\//, ''))
                        .filter(n => n.startsWith('gemini'))
                        .sort()
                    this._log('info', 'AI', `Gemini STT: ${models.length} models found`)
                    return { models }
                }
                case 'lmstudio': {
                    const url = baseUrl || 'http://localhost:1234/v1'
                    const res = await fetch(`${url}/models`, { signal: controller.signal })
                    if (!res.ok) {
                        const body = await res.text().catch(() => '')
                        throw new Error(`LM Studio API error (${res.status}): ${body.substring(0, 200)}`)
                    }
                    const data = await res.json()
                    const models = (data.data || []).map(m => m.id).sort()
                    this._log('info', 'AI', `LM Studio STT: ${models.length} models found`)
                    return { models }
                }
                default:
                    throw new Error(`Unknown STT provider: ${provider}`)
            }
        } catch (err) {
            if (err.message === 'fetch failed' || err.cause?.code === 'ECONNREFUSED') {
                throw new Error(`Cannot connect to ${provider} STT API. Please check the server is running and the base URL is correct.`)
            }
            throw err
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Speech-to-Text — transcribes audio via configured STT provider
    // Voice API has its OWN separate API key & base URL (not shared with chat)
    // ═══════════════════════════════════════════════════════════════

    /** Build a multipart/form-data body for Whisper-compatible STT APIs */
    _buildWhisperMultipart(audioBuffer, mimeType, model, language) {
        const boundary = '----STTBoundary' + Date.now()
        const parts = []
        parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="recording.webm"\r\nContent-Type: ${mimeType}\r\n\r\n`)
        parts.push(audioBuffer)
        parts.push('\r\n')
        parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n`)
        parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${language}\r\n`)
        parts.push(`--${boundary}--\r\n`)
        const bodyParts = parts.map(p => typeof p === 'string' ? Buffer.from(p) : p)
        return { body: Buffer.concat(bodyParts), boundary }
    }

    async transcribeAudio(audioBuffer, mimeType, sttSettings = {}) {
        const sttProvider = sttSettings.provider || 'openai'
        const language = sttSettings.language || 'en'
        const apiKey = sttSettings.apiKey || ''
        const baseUrl = sttSettings.baseUrl || ''
        const model = sttSettings.model || ''
        this._log('info', 'AI', `STT transcription via ${sttProvider} (lang: ${language})`)

        switch (sttProvider) {
            case 'openai': {
                if (!apiKey) throw new Error('No API key for OpenAI Whisper. Configure it in Settings → Speech-to-Text.')
                const url = baseUrl || 'https://api.openai.com/v1'
                const whisperModel = model || 'whisper-1'
                const controller = this._makeController(30000)

                const { body, boundary } = this._buildWhisperMultipart(audioBuffer, mimeType, whisperModel, language)

                const res = await fetch(`${url}/audio/transcriptions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': `multipart/form-data; boundary=${boundary}`
                    },
                    body,
                    signal: controller.signal
                })

                if (!res.ok) {
                    const errBody = await res.text().catch(() => '')
                    throw new Error(`Whisper API error (${res.status}): ${errBody.substring(0, 200)}`)
                }
                const data = await res.json()
                this._log('info', 'AI', `STT result: "${(data.text || '').substring(0, 60)}..."`)
                return { text: data.text || '' }
            }
            case 'gemini': {
                if (!apiKey) throw new Error('No API key for Gemini STT. Configure it in Settings → Speech-to-Text.')
                const url = baseUrl || 'https://generativelanguage.googleapis.com/v1beta'
                const geminiModel = model || 'gemini-2.0-flash'
                const controller = this._makeController(30000)

                const base64Audio = audioBuffer.toString('base64')
                const res = await fetch(`${url}/models/${geminiModel}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: 'Transcribe this audio recording. Return ONLY the transcribed text, nothing else. No explanations, no formatting.' },
                                { inlineData: { mimeType, data: base64Audio } }
                            ]
                        }]
                    }),
                    signal: controller.signal
                })

                if (!res.ok) {
                    const errBody = await res.text().catch(() => '')
                    throw new Error(`Gemini STT error (${res.status}): ${errBody.substring(0, 200)}`)
                }
                const data = await res.json()
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
                this._log('info', 'AI', `STT result: "${text.substring(0, 60)}..."`)
                return { text }
            }
            case 'lmstudio': {
                // LM Studio supports OpenAI-compatible Whisper endpoint
                const url = baseUrl || 'http://localhost:1234/v1'
                const lmModel = model || 'whisper-1'
                const controller = this._makeController(30000)

                const { body, boundary } = this._buildWhisperMultipart(audioBuffer, mimeType, lmModel, language)

                const res = await fetch(`${url}/audio/transcriptions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': `multipart/form-data; boundary=${boundary}`,
                        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
                    },
                    body,
                    signal: controller.signal
                })

                if (!res.ok) {
                    const errBody = await res.text().catch(() => '')
                    throw new Error(`LM Studio STT error (${res.status}): ${errBody.substring(0, 200)}`)
                }
                const data = await res.json()
                this._log('info', 'AI', `STT result: "${(data.text || '').substring(0, 60)}..."`)
                return { text: data.text || '' }
            }
            default:
                throw new Error(`Unknown STT provider: ${sttProvider}. Supported: openai, gemini, lmstudio`)
        }
    }
}

export { AIService }
