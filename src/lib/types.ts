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
  google_event_id: string | null
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

export interface WeekWithDetails extends Week {
  worship_leader: Profile | null
  assignments: (Assignment & { profile: Profile })[]
}