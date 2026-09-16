import { error } from '@sveltejs/kit'

/**
 * Cloudflare bindings are only present when the app runs inside the Workers
 * runtime. Under a bare `vite dev` (no Wrangler proxy) `platform` is undefined,
 * which is a configuration problem, not a user error — so fail loudly rather
 * than silently degrading.
 */
export function requireEnv(platform: App.Platform | undefined): App.Platform['env'] {
  if (!platform?.env) {
    throw error(
      500,
      'Cloudflare bindings unavailable. Run `npm run dev` (which proxies Wrangler) ' +
        'or check the KV namespace bindings for this environment.'
    )
  }
  return platform.env
}
