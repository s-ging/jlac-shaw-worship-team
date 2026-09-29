/**
 * The colour theme, chosen per device on the Me page. "System" follows the
 * phone's dark mode (navy); AMOLED is only ever picked by hand.
 *
 * Saved in localStorage and applied by the inline script in app.html, which
 * runs before first paint. The colours live in global.css.
 */

export type ThemePref = 'system' | 'light' | 'dark' | 'amoled'

export const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'amoled', label: 'AMOLED' }
]

const KEY = 'theme'

export function getThemePref(): ThemePref {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'amoled') return saved
  } catch {}
  return 'system'
}

export function setThemePref(pref: ThemePref): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {}
  window.__applyTheme?.()
}
