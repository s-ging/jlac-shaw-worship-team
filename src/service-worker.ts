/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker'

/**
 * What makes the app work like an installed app, and open with no signal:
 *
 * - The app's own code and static files are cached per deploy and served from
 *   the cache. A new deploy installs a new cache and drops the old one.
 * - Pages and the Google Calendar reads are network first: always fresh when
 *   online, and the last copy you saw when not. That's enough to check who's
 *   on this Sunday from a basement.
 * - The API (/api/*) is never cached: sign-in, RSVPs and saves only mean
 *   something live. Neither are /admin and /dev.
 *
 * Signing out deletes the pages cache (+layout.svelte).
 */

const sw = self as unknown as ServiceWorkerGlobalScope

const ASSETS = `assets-${version}`
const PAGES = 'pages'
const CALENDAR = 'calendar'

// The Google site-verification page is the one static file nobody needs offline.
const PRECACHE = [...build, ...files.filter((f) => !f.endsWith('.html'))]
const precached = new Set(PRECACHE)

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(ASSETS)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => sw.skipWaiting())
  )
})

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('assets-') && key !== ASSETS) await caches.delete(key)
      }
      await sw.clients.claim()
    })()
  )
})

/** Fresh when online; the last good copy (or `fallback`) when not. */
function networkFirst(event: FetchEvent, cacheName: string, fallback?: string): Promise<Response> {
  return (async () => {
    const cache = await caches.open(cacheName)
    try {
      const res = await fetch(event.request)
      // Redirects are sign-in bounces, not pages worth keeping.
      if (res.ok && !res.redirected) event.waitUntil(cache.put(event.request, res.clone()))
      return res
    } catch (err) {
      const hit = (await cache.match(event.request)) ?? (fallback ? await cache.match(fallback) : undefined)
      if (hit) return hit
      throw err
    }
  })()
}

sw.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.origin === sw.location.origin) {
    if (precached.has(url.pathname)) {
      event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)))
      return
    }
    if (/^\/(api|admin|dev)(\/|$)/.test(url.pathname)) return
    if (request.mode === 'navigate') event.respondWith(networkFirst(event, PAGES, '/'))
    else if (url.pathname.endsWith('/__data.json')) event.respondWith(networkFirst(event, PAGES))
    return
  }

  if (url.origin === 'https://www.googleapis.com' && url.pathname.startsWith('/calendar/')) {
    event.respondWith(networkFirst(event, CALENDAR))
  }
})
