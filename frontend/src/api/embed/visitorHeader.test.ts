import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const apiSource = readFileSync(resolve(here, 'index.ts'), 'utf8')
const chatSessionSource = readFileSync(resolve(here, '../../composables/useEmbedChatSession.ts'), 'utf8')

// The embed widget talks to the backend through several endpoints. Every one of
// them must carry the anonymous visitor id, otherwise the server falls back to
// the shared per-IP rate-limit bucket and one noisy visitor throttles the whole
// channel. These assertions guard that invariant without needing a live server.

test('embed api exposes a token-only header helper that carries the visitor id', () => {
  const helper = apiSource.match(/function embedTokenHeaders[\s\S]*?\n}/)
  assert.ok(helper, 'embedTokenHeaders helper is missing')
  assert.match(helper[0], /X-Embed-Visitor/, 'token-only helper must set X-Embed-Visitor')
})

test('session header helper reuses the token helper so session calls keep the visitor id', () => {
  const helper = apiSource.match(/function embedSessionHeaders[\s\S]*?\n}/)
  assert.ok(helper, 'embedSessionHeaders helper is missing')
  assert.match(helper[0], /embedTokenHeaders\(/, 'session helper must delegate to embedTokenHeaders')
})

test('every embed request that accepts a visitor id actually sends it', () => {
  for (const fn of [
    'getEmbedConfig',
    'createEmbedSession',
    'getEmbedChunkById',
    'getEmbedSuggestedQuestions',
    'getEmbedMessageList',
    'stopEmbedSession',
    'relayEmbedWebhookEvent',
  ]) {
    const body = apiSource.match(new RegExp(`export async function ${fn}[\\s\\S]*?\\n}`))
      || apiSource.match(new RegExp(`export function ${fn}[\\s\\S]*?\\n}`))
    assert.ok(body, `${fn} not found in api/embed/index.ts`)
    assert.match(body[0], /visitorId/, `${fn} must accept a visitorId parameter`)
    assert.match(
      body[0],
      /embedTokenHeaders\(|embedSessionHeaders\(/,
      `${fn} must build headers through a helper that appends X-Embed-Visitor`,
    )
  }
})

test('webhook relay is skipped when the channel has no webhook configured', () => {
  assert.match(apiSource, /has_webhook\?: boolean/)
  const relay = chatSessionSource.match(/const relayIfWebhook[\s\S]*?\n  }\n/)
  assert.ok(relay, 'relayIfWebhook wrapper is missing')
  assert.match(relay[0], /hasWebhook/, 'relay must consult the hasWebhook flag')
  assert.match(relay[0], /visitorId\.value/, 'relay must forward the visitor id')
})

test('relay wrapper is used by both message-sent and message-received paths', () => {
  const calls = chatSessionSource.match(/relayIfWebhook\(\{ type: 'message_(sent|received)'/g) || []
  assert.equal(calls.length, 2, `expected both relay call sites to use relayIfWebhook, found ${calls.length}`)
  // relayEmbedWebhookEvent may only appear in the import and inside the wrapper.
  const directCalls = chatSessionSource.match(/relayEmbedWebhookEvent\(/g) || []
  assert.equal(
    directCalls.length,
    1,
    'the relay must only be invoked from the relayIfWebhook wrapper',
  )
})
