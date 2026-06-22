import { describe, it, expect } from 'vitest'
import http from 'node:http'
import { streamLLMResponse } from '../src/server/handler'

const OLLAMA_HOST = 'localhost'
const OLLAMA_PORT = 11434
const OLLAMA_BASE_URL = `http://${OLLAMA_HOST}:${OLLAMA_PORT}/v1`
const OLLAMA_MODEL = 'qwen2.5-coder:0.5b'

function checkOllama(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: OLLAMA_HOST,
        port: OLLAMA_PORT,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: 3000,
      },
      (res) => {
        let body = ''
        res.on('data', (chunk) => (body += chunk))
        res.on('end', () => resolve(res.statusCode === 200))
      },
    )
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    req.write(
      JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: 'user', content: 'ping' }],
        stream: false,
      }),
    )
    req.end()
  })
}

describe('Ollama integration', () => {
  it('responds to a simple prompt via OpenAI-compatible API', async () => {
    const available = await checkOllama()
    if (!available) {
      console.log('Ollama not available, skipping')
      return
    }

    const res = await fetch(`${OLLAMA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: 'user', content: 'Say hello in one word' }],
        stream: false,
      }),
    })

    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data.choices).toBeDefined()
    expect(data.choices.length).toBeGreaterThan(0)
    expect(data.choices[0].message.content).toBeTruthy()
  })

  it('streams responses in SSE format', async () => {
    const available = await checkOllama()
    if (!available) {
      console.log('Ollama not available, skipping')
      return
    }

    const res = await fetch(`${OLLAMA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: 'user', content: 'Say hi' }],
        stream: true,
      }),
    })

    expect(res.ok).toBe(true)
    expect(res.body).toBeTruthy()

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let chunkCount = 0
    let receivedContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const cleaned = line.trim()
        if (!cleaned.startsWith('data:')) continue
        const dataStr = cleaned.slice(5).trim()
        if (dataStr === '[DONE]') continue

        const parsed = JSON.parse(dataStr)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) {
          chunkCount++
          receivedContent += content
        }
      }
    }

    expect(chunkCount).toBeGreaterThan(0)
    expect(receivedContent.length).toBeGreaterThan(0)
  })

  it('streamLLMResponse works end-to-end with Ollama', async () => {
    const available = await checkOllama()
    if (!available) {
      console.log('Ollama not available, skipping')
      return
    }

    const receivedChunks: string[] = []

    await streamLLMResponse(
      {
        provider: 'custom',
        model: OLLAMA_MODEL,
        systemPrompt: 'You are a helpful assistant. Reply concisely.',
        question: 'What is 2 + 2?',
        context: [],
        env: {
          OPENAI_BASE_URL: OLLAMA_BASE_URL,
        },
      },
      (chunk) => {
        receivedChunks.push(chunk)
      },
    )

    const fullResponse = receivedChunks.join('')
    expect(fullResponse.length).toBeGreaterThan(0)
    expect(fullResponse).toContain('4')
  })

  it('streamLLMResponse handles context in prompt', async () => {
    const available = await checkOllama()
    if (!available) {
      console.log('Ollama not available, skipping')
      return
    }

    const receivedChunks: string[] = []

    await streamLLMResponse(
      {
        provider: 'custom',
        model: OLLAMA_MODEL,
        systemPrompt: 'Answer based on the context provided.',
        question: 'What is the capital of France?',
        context: [
          'Title: Geography\nPath: /docs/geo\nContent: The capital of France is Paris.',
        ],
        env: {
          OPENAI_BASE_URL: OLLAMA_BASE_URL,
        },
      },
      (chunk) => {
        receivedChunks.push(chunk)
      },
    )

    const fullResponse = receivedChunks.join('')
    expect(fullResponse.length).toBeGreaterThan(0)
  })
})
