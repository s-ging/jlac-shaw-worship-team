// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

// Imported as a type rather than a global `/// <reference>`, so Workers types
// stay scoped to the bindings below. A global reference would override DOM
// types like `fetch` and `Response` in browser code.
import type { KVNamespace } from '@cloudflare/workers-types';

declare global {
	namespace App {
		// interface Error {}

		interface Locals {
			/** Signed-in user for this request, populated in hooks.server.ts. */
			user: import('$lib/types').UserRecord | null;
		}
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
				RSVP_KV: KVNamespace;
				LOG_KV: KVNamespace;
				/**
				 * Set temporarily to create the first superadmin, then deleted.
				 * Absent in normal operation, which disables the bootstrap path.
				 */
				BOOTSTRAP_SECRET?: string;
				/**
				 * OAuth credentials for the dedicated calendar account, which
				 * performs lineup edits. Set by `npm run google:auth`. Without
				 * them the app still reads the schedule; editing returns 503.
				 */
				GOOGLE_CLIENT_ID?: string;
				GOOGLE_CLIENT_SECRET?: string;
				GOOGLE_REFRESH_TOKEN?: string;
			};
		}
	}
}

export {};
