# Security Model — `@bdocs/plugin-ask-ai`

Ask AI is a bounded documentation Q&A pipeline, not a general chat proxy. The package assumes public, adversarial input and keeps provider credentials and private prompts on the server.

## Trust boundaries

### Untrusted input

- Browser question text
- Current page path
- Client-supplied page context for serverless adapters
- Request headers, including forwarded-IP headers outside a trusted proxy
- Documentation text, which may contain indirect prompt injection

### Server-only values

- Provider API keys
- `secretKey` / `secretKeyEnv`
- Full system-prompt overrides and per-provider prompt maps
- Private `baseURL` values
- Upstream SDK errors and account metadata

`buildClientMetadata()` uses an explicit allowlist. It never spreads raw plugin options into the browser configuration. Core serializes only each plugin's public `name` and a recursively sanitized `metadata` object; common credential-key names are removed before JSON serialization. Server fields and credential values are not part of that projection.

## Controls

### 1. Request and input caps

| Control | Default | Enforcement |
| --- | ---: | --- |
| `maxRequestBytes` | 65,536 bytes | Streaming byte cap before JSON parsing |
| `maxInputChars` | 2,000 characters | Vite middleware and all serverless adapters |
| `maxOutputTokens` | 600 tokens | OpenAI-compatible completion request |
| `contextChars` | 6,000 characters | Page-context truncation |
| Internal stream timeout | 60 seconds | Abort propagated to provider SDK |

The Vite middleware counts bytes while receiving the body and stops retaining data after the cap. Web, Netlify, and AWS adapters read bounded text before parsing.

### 2. Input policy

`checkInputSafety()` rejects empty/non-string questions, oversized questions, and common deterministic override attempts such as `ignore previous instructions`, `jailbreak`, and system-prompt extraction.

This regex denylist is intentionally small. It is not a complete prompt-injection defense and must not be treated as one.

### 3. Prompt-data boundaries

Page content is wrapped with:

```text
<<<DOCS_START>>>
[Page: /docs/example]
...documentation...
<<<DOCS_END>>>
```

Literal `DOCS_START` and `DOCS_END` tokens inside page content and page labels are neutralized. Newlines and null characters in client-provided page labels are flattened. Persona boundary tokens are also neutralized.

The system prompt explicitly treats the documentation block and user message as data, limits answers to that block, and requires the exact refusal `Not in docs.` when the answer is not grounded.

Prompt interpretation is probabilistic. Keep the default prompt unless you can preserve its scope, refusal, and confidentiality rules.

### 4. Provider routing

Provider presets define the default model, expected environment-variable name, and OpenAI-compatible base URL.

`anthropic`, `gemini`, `azure`, and `custom` require an explicit `baseURL`. `OPENAI_BASE_URL` is consulted only when `provider === 'openai'`, preventing a provider key from being redirected to an unrelated OpenAI-compatible endpoint by a global environment variable.

All supported providers must expose the OpenAI Chat Completions wire format. Native Anthropic and Gemini request shapes are not supported.

### 5. Authorization

If `secretKey` or `secretKeyEnv` is configured, the Vite middleware and adapters require:

```http
x-boltdocs-ask-ai-key: <secret>
```

Secrets in URL query parameters are intentionally rejected. URLs are routinely written to proxy, CDN, analytics, and platform logs.

A reusable shared secret must never be embedded in browser code. For a normal public documentation widget, omit `secretKey` and protect the endpoint with same-origin hosting, platform authentication, or an edge session/challenge.

The Vite middleware compares secrets with `timingSafeEqual`. Standalone Fetch/Web adapter environments may not provide Node's crypto module and use a direct equality check; place a rate-limited/authenticated edge in front when timing resistance is required.

### 6. Rate limiting and client IP

The default limiter is 30 requests per minute per IP and is held in process memory. It is useful for local development and single-instance deployments, but it is not a distributed limiter.

`x-forwarded-for` and `x-real-ip` are client-controlled unless a trusted reverse proxy removes incoming values and writes its own. Multi-region or high-cost deployments should use a shared limiter at the edge (for example, Cloudflare, Upstash, or a gateway-native limiter).

### 7. CORS

Adapter CORS is same-origin by default: no `Access-Control-Allow-Origin` is emitted. Configure `allowedOrigins` with exact trusted origins only. Wildcard access is available only when explicitly configured.

Cross-origin browser requests may send `Content-Type` and `X-Boltdocs-Ask-AI-Key` after a successful preflight.

### 8. Client context

Vite dev/preview resolves page content from the local Boltdocs route tree and ignores client-supplied content.

Serverless adapters have no local docs filesystem. They accept `{ page, content }` only when:

- `allowClientContext: true`, or
- the request has a valid secret.

Client context is still untrusted prompt data. It is truncated, marker-hardened, and scoped by the system prompt, but public deployments should prefer a server-owned context source.

The client can provide context through `context` or `getContext()` when composing a custom widget.

### 9. Public errors and logging

The provider handler does not return raw SDK error messages. Public codes include:

- `AI_NOT_CONFIGURED`
- `AI_PROVIDER_ERROR`
- `AI_TIMEOUT`
- `UNAUTHORIZED`
- `RATE_LIMITED`
- `REQUEST_TOO_LARGE`
- `QUESTION_BLOCKED_BY_POLICY`

The browser does not log raw error payloads. The middleware does not log question text, context, credentials, or caught error messages. If you add wrapper logging, apply the same redaction policy.

## Production checklist

1. Keep provider keys in the hosting platform's secret manager.
2. Prefer `secretKeyEnv` over committing a literal shared secret.
3. Never place a shared secret in URL parameters or browser code.
4. Use same-origin hosting whenever possible.
5. Put authentication and a shared rate limiter in front of public endpoints.
6. Ensure the proxy overwrites forwarded-IP headers.
7. Keep `maxRequestBytes`, `maxInputChars`, and `maxOutputTokens` conservative.
8. Use server-owned page context for serverless deployments when possible.
9. Keep `devMode: false` in production to avoid exposing token-usage metadata.
10. Review custom `systemPrompt` overrides against the default scope and refusal rules.
11. Monitor provider usage and set account-level billing limits.
12. Treat documentation and issue text as attacker-controlled data.

## Reporting vulnerabilities

Email `jesusalcalarojas@gmail.com` or open a private advisory through GitHub Security Advisories on the Boltdocs repository.
