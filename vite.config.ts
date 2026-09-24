import { readFile } from 'node:fs/promises';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

/**
 * Serves scripts/roster.tsv to /dev/preview under `vite dev` only. The roster
 * holds personal emails and is gitignored, so it must never reach a build:
 * `apply: 'serve'` keeps this plugin out of `vite build` entirely.
 */
const devRoster: Plugin = {
	name: 'dev-roster',
	apply: 'serve',
	configureServer(server) {
		server.middlewares.use('/__dev/roster', async (_req, res) => {
			try {
				res.setHeader('content-type', 'text/tab-separated-values; charset=utf-8');
				res.end(await readFile('scripts/roster.tsv', 'utf8'));
			} catch {
				res.statusCode = 404;
				res.end('');
			}
		});
	}
};

export default defineConfig({
	plugins: [devRoster, sveltekit()]
});
