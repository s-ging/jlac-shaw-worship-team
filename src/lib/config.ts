// App-wide constants. Nothing secret lives here.
//
// GOOGLE_API_KEY is a browser-restricted, read-only Calendar key. It ships to the
// client by design and is safe to commit — but it must stay locked to an HTTP
// referrer allowlist in the Google Cloud console. It disappears entirely once
// Phase 6 moves calendar reads server-side behind the dedicated account.

export const APP_NAME = 'Praise Team Scheduler'

export const CALENDAR_ID =
  '9a716d356291248887be20bd495e2f774cf2f47953825b06787fe831744e3709@group.calendar.google.com'

export const GOOGLE_API_KEY = 'AIzaSyBqRCAKtqpCVTCq9yA_HYMontVvX5rGnOo'

/** Display timezone for all dates. Timestamps are stored UTC. */
export const DISPLAY_TIMEZONE = 'Asia/Manila'
