#!/usr/bin/env node
/**
 * Creates the three KV namespaces (production + preview) and writes their ids
 * into wrangler.jsonc.
 *
 * Prerequisite: `npx wrangler login`
 * Usage:        node scripts/setup-kv.mjs
 *
 * Safe to re-run. Namespaces that already exist are reused rather than
 * duplicated, and only REPLACE_ME placeholders are filled in.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const BINDINGS = ['USERS_KV', 'SESSIONS_KV', 'LOG_KV']
const CONFIG = 'wrangler.jsonc'

function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32'
  })
}

/** Existing namespaces, so re-runs don't create duplicates. */
function existingByTitle() {
  const map = new Map()
  try {
    for (const ns of JSON.parse(wrangler(['kv', 'namespace', 'list']))) {
      map.set(ns.title, ns.id)
    }
  } catch {
    console.warn('! Could not list existing namespaces; will create new ones.')
  }
  return map
}

function createNamespace(binding, preview) {
  const args = ['kv', 'namespace', 'create', binding]
  if (preview) args.push('--preview')
  const out = wrangler(args)
  const id = out.match(/"id":\s*"([0-9a-f]{32})"/i)?.[1] ?? out.match(/\b([0-9a-f]{32})\b/i)?.[1]
  if (!id) throw new Error(`Could not parse namespace id from wrangler output:\n${out}`)
  return id
}

function resolve(binding, preview, existing) {
  // Wrangler titles namespaces "<project>-<binding>", with "_preview" appended.
  const suffix = preview ? '_preview' : ''
  for (const [title, id] of existing) {
    const isPreview = title.endsWith('_preview')
    if (title.includes(binding) && isPreview === preview) {
      console.log(`  reusing existing ${binding}${suffix} -> ${id}`)
      return id
    }
  }
  const id = createNamespace(binding, preview)
  console.log(`  created ${binding}${suffix} -> ${id}`)
  return id
}

console.log('Checking wrangler authentication...')
try {
  const who = wrangler(['whoami'])
  if (/not authenticated/i.test(who)) throw new Error('not authenticated')
} catch {
  console.error('\nNot logged in. Run `npx wrangler login` first, then re-run this script.')
  process.exit(1)
}

const existing = existingByTitle()
let config = readFileSync(CONFIG, 'utf8')

for (const binding of BINDINGS) {
  console.log(`\n${binding}:`)
  for (const preview of [false, true]) {
    const placeholder = `REPLACE_ME_${binding}_${preview ? 'PREVIEW_ID' : 'ID'}`
    if (!config.includes(placeholder)) {
      console.log(`  ${placeholder} already filled in, skipping`)
      continue
    }
    config = config.replace(placeholder, resolve(binding, preview, existing))
  }
}

writeFileSync(CONFIG, config)
console.log(`\nDone. ${CONFIG} updated.`)
console.log('Next: npm run dev, then open http://localhost:5173/api/health')
