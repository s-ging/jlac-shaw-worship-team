import type { ParamMatcher } from '@sveltejs/kit'
import { isKvNamespace } from '$lib/kv-namespaces'

/** `[ns=kvns]` only matches the four binding names; anything else is a 404. */
export const match = ((param: string) => isKvNamespace(param)) satisfies ParamMatcher
