// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

// Imported as a type rather than a global `/// <reference>`, so Workers types
// stay scoped to the bindings below. A global reference would override DOM
// types like `fetch` and `Response` in browser code.
import type { KVNamespace } from '@cloudflare/workers-types';

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}

		interface Platform {
			/**
			 * Cloudflare bindings, available in server endpoints as
			 * `event.platform.env`. Configured in wrangler.jsonc, which
			 * adapter-cloudflare also reads during `npm run dev`.
			 *
			 * `platform` is undefined outside the Cloudflare runtime, so always
			 * guard before use — see `$lib/server/platform`.
			 */
			env: {
				USERS_KV: KVNamespace;
				SESSIONS_KV: KVNamespace;
				LOG_KV: KVNamespace;
			};
		}
	}
}

export {};
