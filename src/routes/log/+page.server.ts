import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

/** The changelog moved into the Admin tab. Old links and bookmarks land there. */
export const load: PageServerLoad = () => {
  throw redirect(308, '/admin/log')
}
