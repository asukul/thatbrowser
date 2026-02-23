/**
 * Gemini Search — Real-time verified search via Google Gemini API
 */

class GeminiSearch {
    constructor(store) {
        this.store = store
    }

    async search(query) {
        const settings = this.store.get('aiSettings')
        const geminiConfig = settings.providers.gemini

        if (!geminiConfig.apiKey) {
            throw new Error('Gemini API key is required for Gemini Search. Please configure it in Settings.')
        }

        // Use Gemini with grounding (Google Search)
        const url = `${geminiConfig.baseUrl}/models/${geminiConfig.model}:generateContent?key=${geminiConfig.apiKey}`

        const body = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: query }]
                }
            ],
            tools: [
                {
                    googleSearch: {}
                }
            ],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 4096
            },
            systemInstruction: {
                parts: [{
                    text: `You are a research search assistant for That Browser.
Provide accurate, well-sourced answers using real-time web information.
Always cite your sources with URLs when possible.
Format your response in markdown with clear sections.
Prioritize academic and authoritative sources.`
                }]
            }
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })

        if (!response.ok) {
            const errBody = await response.text()
            throw new Error(`Gemini Search error (${response.status}): ${errBody}`)
        }

        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No results found.'

        // Extract grounding metadata if available
        const groundingMetadata = data.candidates?.[0]?.groundingMetadata
        const sources = groundingMetadata?.groundingChunks?.map(chunk => ({
            title: chunk.web?.title || 'Source',
            url: chunk.web?.uri || ''
        })) || []

        return {
            content: text,
            sources,
            model: geminiConfig.model,
            query
        }
    }
}

export { GeminiSearch }
