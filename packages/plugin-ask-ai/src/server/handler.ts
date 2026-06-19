import { info, warn } from '@bdocs/dui'

export interface StreamLLMResponseOptions {
  provider: string
  model: string
  systemPrompt: string
  question: string
  context: string[]
  env: Record<string, string | undefined>
  debug?: boolean
}

export async function streamLLMResponse(
  options: StreamLLMResponseOptions,
  onChunk: (text: string) => void,
): Promise<void> {
  const { provider, model, systemPrompt, question, context, env, debug } = options

  // Format context for LLM
  const contextString = context && context.length > 0
    ? `Documentation Context:\n${context.map((c, i) => `[Doc ${i + 1}]: ${c}`).join('\n\n')}`
    : 'No direct documentation context was found for this query.'

  const fullPrompt = `${contextString}\n\nUser Question: ${question}`

  if (debug) {
    info(`[Ask AI]   Full prompt length: ${fullPrompt.length} chars`)
    info(`[Ask AI]   System prompt: ${systemPrompt.slice(0, 120)}...`)
  }

  if (provider === 'anthropic') {
    const apiKey = env.ANTHROPIC_API_KEY
    if (!apiKey) {
      onChunk('**Error**: `ANTHROPIC_API_KEY` is not set in the environment variables. Please add it to your `.env` file.')
      return
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages: [{ role: 'user', content: fullPrompt }],
        max_tokens: 1500,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      if (debug) warn(`[Ask AI]   Anthropic API error: ${response.status} - ${errorText}`)
      throw new Error(`Anthropic API returned error: ${response.status} - ${errorText}`)
    }

    if (!response.body) {
      throw new Error('No response body returned from Anthropic API')
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
        const cleaned = line.trim()
        if (cleaned.startsWith('data:')) {
          try {
            const dataStr = cleaned.slice(5).trim()
            if (dataStr === '[DONE]') continue
            const data = JSON.parse(dataStr)
            if (data.type === 'content_block_delta' && data.delta?.text) {
              if (debug) info(`[Ask AI]   Chunk: ${data.delta.text.slice(0, 80)}`)
              onChunk(data.delta.text)
            }
          } catch (e) {
            if (debug) warn(`[Ask AI]   Parse error: ${e}`)
          }
        }
      }
    }
  } else if (provider === 'openai' || provider === 'custom') {
    const apiKey = env.OPENAI_API_KEY
    const baseURL = env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

    if (!apiKey && provider === 'openai') {
      onChunk('**Error**: `OPENAI_API_KEY` is not set in the environment variables. Please add it to your `.env` file.')
      return
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: fullPrompt },
        ],
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      if (debug) warn(`[Ask AI]   API error: ${response.status} - ${errorText}`)
      throw new Error(`OpenAI-compatible API returned error: ${response.status} - ${errorText}`)
    }

    if (!response.body) {
      throw new Error('No response body returned from OpenAI-compatible API')
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
        const cleaned = line.trim()
        if (cleaned.startsWith('data:')) {
          const dataStr = cleaned.slice(5).trim()
          if (dataStr === '[DONE]') continue
          try {
            const data = JSON.parse(dataStr)
            const content = data.choices?.[0]?.delta?.content
            if (content) {
              if (debug) info(`[Ask AI]   Chunk: ${content.slice(0, 80)}`)
              onChunk(content)
            }
          } catch (e) {
            if (debug) warn(`[Ask AI]   Parse error: ${e}`)
          }
        }
      }
    }
  } else {
    throw new Error(`Unsupported AI provider: ${provider}`)
  }
}
