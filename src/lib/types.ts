export interface Profile {
  id: string
  name: string
  nickname: string
  email: string
  instruments: string[]
  is_superadmin: boolean
  is_worship_leader: boolean
  is_media: boolean
  created_at: string
}

export interface Week {
  id: string
  service_date: string // YYYY-MM-DD
  theme: string
  playlist_url: string
  worship_leader_id: string | null
  is_published: boolean
  /** The Sunday service event for this date, the one the lineup editor writes to. */
  google_event_id: string | null
  /** That event's raw description, for the lineup editor. */
  service_description?: string
  created_at: string
  updated_at: string
}

export interface Assignment {
  id: string
  week_id: string
  profile_id: string
  instrument_slot: string
  is_primary: boolean
  confirmed: boolean
  created_at: string
  profile?: Profile
}

export interface WeekWithDetails extends Week {
  worship_leader: Profile | null
  assignments: (Assignment & { profile: Profile })[]
}
// ---- KV-backed records (V1) ----

export interface UserRoles {
  isSuperAdmin: boolean
  isWorshipLeader: boolean
  isMedia: boolean
  isMember: boolean
}

export interface UserRecord {
  email: string
  name: string
  nickname?: string
  /** Self-describing PBKDF2 string; see $lib/server/crypto. Never sent to the client. */
  passwordHash: string
  roles: UserRoles
  instruments: string[]
  /** First names as they appear in Calendar descriptions, for name resolution. */
  aliases: string[]
  /** What they mainly do: a part key from $lib/parts (`leadvocal`, `drums`…) or `media`. Unset until a superadmin picks it. */
  primaryRole?: string
  createdAt: string
  updatedAt: string
  active: boolean
  /**
   * Set when someone else chose the password: a new account on the team's
   * shared starting password, or a reset. The app sends them to /me to pick
   * their own before anything else.
   */
  mustChangePassword?: boolean
}

/** A user record with secrets stripped. This is the only shape the client sees. */
export type PublicUser = Omit<UserRecord, 'passwordHash'>

export interface SessionRecord {
  token: string
  email: string
  createdAt: string
  expiresAt: string
  userAgent?: string
}

export type RsvpStatus = 'yes' | 'maybe' | 'no'

export interface RsvpRecord {
  weekId: string
  email: string
  status: RsvpStatus
  updatedAt: string
  /** Email of whoever set it — a leader may answer on someone's behalf. */
  updatedBy: string
}

/** Who an RSVP responder is, in the names the calendar uses. */
export interface RsvpPerson {
  /** How the calendar writes them: "Jean". */
  name: string
  /** Every name that means them, lowercased (see `namesOf`). */
  names: string[]
}

/** One changelog line. Written by $lib/server/log. */
export interface LogEntry {
  id: string
  at: string
  actorEmail: string
  actorName: string
  /** Dotted verb, e.g. `lineup.updated`, `user.created`. */
  action: string
  /** Sentence tail, read after the actor's name: "updated the lineup for Sun, Oct 4: …" */
  summary: string
}
