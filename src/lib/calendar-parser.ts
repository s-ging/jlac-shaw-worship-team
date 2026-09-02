// src/lib/calendar-parser.ts

export interface ParsedEvent {
  theme: string
  playlistUrl: string
  assignments: {
    vocalists: { role: string; name: string }[]
    instrumentalists: { instrument: string; name: string }[]
    media: string[]
  }
}

// Centralized instrument mapping
const INSTRUMENT_MAP: Record<string, string> = {
  // Drums
  'Drums': 'Drums',
  'Drum': 'Drums',
  
  // Lead Guitar
  'L. Guitar': 'Lead',
  'L Guitar': 'Lead',
  'Lead Guitar': 'Lead',
  'Lead': 'Lead',
  
  // Rhythm Guitar
  'R. Guitar': 'Rhythm',
  'R Guitar': 'Rhythm',
  'Rhythm Guitar': 'Rhythm',
  'Rhythm': 'Rhythm',
  
  // Bass
  'Bass': 'Bass',
  'Bass Guitar': 'Bass',
}

// Helper: Clean instrument name (remove emojis and normalize)
function cleanInstrumentName(raw: string): string {
  // Remove common emojis
  let cleaned = raw
    .replace(/[🥁🎸]/g, '')
    .trim()
  
  // Check if it matches any known instrument (case-insensitive)
  for (const [key, value] of Object.entries(INSTRUMENT_MAP)) {
    if (cleaned.toLowerCase() === key.toLowerCase()) {
      return value
    }
  }
  
  // If no match, return cleaned version
  return cleaned
}

// Helper: Normalize instrument name with mapping
function normalizeInstrument(raw: string): string {
  // Remove emojis first
  let cleaned = raw.replace(/[🥁🎸]/g, '').trim()
  
  // Check case-insensitive mapping
  const lower = cleaned.toLowerCase()
  for (const [key, value] of Object.entries(INSTRUMENT_MAP)) {
    if (lower === key.toLowerCase()) {
      return value
    }
  }
  
  // Fallback: return cleaned raw name
  return cleaned || raw
}

export function parseEventDescription(description: string): ParsedEvent {
  const result: ParsedEvent = {
    theme: '',
    playlistUrl: '',
    assignments: {
      vocalists: [],
      instrumentalists: [],
      media: []
    }
  }
  
  if (!description) return result
  
  // STEP 1: Clean HTML tags
  let cleanText = description
    .replace(/<\/?b>/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/g, ' ')
  
  // STEP 2: Split into lines
  let lines = cleanText.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
  
  // STEP 3: Extract YouTube playlist URL
  const playlistMatch = description.match(/(?:href=")?(https?:\/\/(?:www\.)?youtube\.com\/playlist\?list=[^\s&"']+)/i)
  if (playlistMatch) {
    result.playlistUrl = playlistMatch[1]
  } else {
    const youtubeMatch = description.match(/(https?:\/\/(?:www\.)?youtu\.be\/[^\s&"']+)/i)
    if (youtubeMatch) {
      result.playlistUrl = youtubeMatch[1]
    }
  }
  
  // STEP 4: Try single-line parsing (the working approach)
  if (lines.length === 1) {
    const text = lines[0]
    
    // Find section boundaries
    const vocalistsIndex = text.search(/Vocalists/i)
    const instrumentalistsIndex = text.search(/Instrumentalists/i)
    const mediaIndex = text.search(/Media/i)
    
    let vocalistsText = ''
    let instrumentalistsText = ''
    let mediaText = ''
    let themeText = ''
    
    // Get theme (everything before "Vocalists")
    if (vocalistsIndex > 0) {
      themeText = text.substring(0, vocalistsIndex).trim()
    }
    
    // Get vocalists (between "Vocalists" and "Instrumentalists")
    if (vocalistsIndex >= 0 && instrumentalistsIndex > vocalistsIndex) {
      vocalistsText = text.substring(vocalistsIndex, instrumentalistsIndex).trim()
    }
    
    // Get instrumentalists (between "Instrumentalists" and "Media")
    if (instrumentalistsIndex >= 0 && mediaIndex > instrumentalistsIndex) {
      instrumentalistsText = text.substring(instrumentalistsIndex, mediaIndex).trim()
    }
    
    // Get media (after "Media")
    if (mediaIndex >= 0) {
      mediaText = text.substring(mediaIndex).trim()
    }
    
    // Parse theme
    if (themeText) {
      let theme = themeText.replace(/^Theme:\s*/i, '').trim()
      const devotionIndex = theme.search(/Devotion Time/i)
      if (devotionIndex > 0) {
        theme = theme.substring(0, devotionIndex).trim()
      }
      result.theme = theme
    }
    
    // Parse vocalists
    if (vocalistsText) {
      const textWithoutHeader = vocalistsText.replace(/^Vocalists\s*/i, '')
      const vocalistMatches = textWithoutHeader.match(/([0-9]️⃣)\s*([^:]+?)\s*[-–—]\s*([^(]+?)(?=\s*(?:[0-9]️⃣|Instrumentalists|$))/g)
      if (vocalistMatches) {
        for (const match of vocalistMatches) {
          const parsed = match.match(/([0-9]️⃣)\s*([^:]+?)\s*[-–—]\s*([^(]+)/)
          if (parsed) {
            const [, number, role, fullName] = parsed
            const name = fullName.replace(/\([^)]*\)/g, '').trim()
            result.assignments.vocalists.push({
              role: role.trim(),
              name: name
            })
          }
        }
      }
    }
    
    // Parse instrumentalists - USING NORMALIZED INSTRUMENT NAMES
    if (instrumentalistsText) {
      const textWithoutHeader = instrumentalistsText.replace(/^Instrumentalists\s*/i, '')
      // Split by newlines
      const instLines = textWithoutHeader.split(/\n/).filter(line => line.trim())
      
      for (const line of instLines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        
        // Remove any emoji at the start
        const cleanLine = trimmed.replace(/^[^\w\s]+/, '').trim()
        
        // Find the dash separator
        const dashIndex = cleanLine.search(/[-–—]/)
        if (dashIndex === -1) continue
        
        // Everything before the dash is the instrument (including emoji)
        let rawInstrument = cleanLine.substring(0, dashIndex).trim()
        const name = cleanLine.substring(dashIndex + 1).trim()
        
        // Normalize the instrument name using the mapping
        const normalizedInstrument = normalizeInstrument(rawInstrument)
        
        if (name) {
          result.assignments.instrumentalists.push({
            instrument: normalizedInstrument,
            name: name
          })
        }
      }
    }
    
    // Parse media
    if (mediaText) {
      const textWithoutHeader = mediaText.replace(/^Media\s*/i, '')
      const names = textWithoutHeader
        .split(/[,&]|\band\b/)
        .map(n => n.trim())
        .filter(n => n && n.length > 0 && !n.toLowerCase().includes('media'))
      result.assignments.media.push(...names)
    }
    
    return result
  }
  
  // STEP 5: Normal multi-line parsing (fallback for well-formatted text)
  let currentSection: 'vocalists' | 'instrumentalists' | 'media' | null = null
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    
    // Detect theme (look for "Theme:" or "Motif:")
    if (trimmed.match(/^Theme:/i) || trimmed.match(/^Motif:/i)) {
      const match = trimmed.match(/(?:Theme|Motif):\s*(.+)/i)
      if (match) {
        result.theme = match[1].trim()
      }
      continue
    }
    
    // Detect sections
    if (trimmed.match(/^Vocalists/i)) {
      currentSection = 'vocalists'
      continue
    }
    if (trimmed.match(/^Instrumentalists/i)) {
      currentSection = 'instrumentalists'
      continue
    }
    if (trimmed.match(/^Media/i)) {
      currentSection = 'media'
      continue
    }
    
    // Parse based on section
    switch (currentSection) {
      case 'vocalists': {
        const vocalMatch = trimmed.match(/([0-9]️⃣)\s*(.+?)\s*[-–—]\s*(.+)/)
        if (vocalMatch) {
          const [, number, role, fullName] = vocalMatch
          const name = fullName.replace(/\([^)]*\)/g, '').trim()
          result.assignments.vocalists.push({
            role: role.trim(),
            name: name
          })
        }
        break
      }
      case 'instrumentalists': {
        // Find the dash separator
        const dashIndex = trimmed.search(/[-–—]/)
        if (dashIndex === -1) break
        
        const rawInstrument = trimmed.substring(0, dashIndex).trim()
        const name = trimmed.substring(dashIndex + 1).trim()
        
        // Normalize the instrument name
        const normalizedInstrument = normalizeInstrument(rawInstrument)
        
        if (name) {
          result.assignments.instrumentalists.push({
            instrument: normalizedInstrument,
            name: name
          })
        }
        break
      }
      case 'media': {
        const names = trimmed
          .split(/[,&]|\band\b/)
          .map(n => n.trim())
          .filter(n => n && n.length > 0 && !n.toLowerCase().includes('media'))
        result.assignments.media.push(...names)
        break
      }
    }
  }
  
  return result
}

// Helper: Convert parsed data to app's assignment format
export function parsedToAssignments(parsed: ParsedEvent, eventId: string) {
  const assignments: any[] = []
  
  // Map vocal roles to instrument slots
  const roleMap: Record<string, string> = {
    'Praise Leader': 'Lead Vocal',
    'Second Praise Leader': 'Sub-Lead Vocal',
    'Offering Prayer': 'Secondary Vocal'
  }
  
  for (const v of parsed.assignments.vocalists) {
    const slot = roleMap[v.role] || 'Secondary Vocal'
    assignments.push({
      id: `assign-${eventId}-${v.name}`,
      profile_id: `profile-${v.name}`,
      instrument_slot: slot,
      is_primary: true,
      confirmed: false,
      profile: {
        id: `profile-${v.name}`,
        name: v.name,
        nickname: v.name,
        email: '',
        instruments: [slot],
        is_superadmin: false,
        is_worship_leader: v.role === 'Praise Leader',
        is_media: false,
        created_at: new Date().toISOString()
      }
    })
  }
  
  // Map instrumentalists (using the centralized mapping)
  for (const i of parsed.assignments.instrumentalists) {
    // The instrument should already be normalized, but just in case
    const slot = INSTRUMENT_MAP[i.instrument] || i.instrument
    assignments.push({
      id: `assign-${eventId}-${i.name}`,
      profile_id: `profile-${i.name}`,
      instrument_slot: slot,
      is_primary: true,
      confirmed: false,
      profile: {
        id: `profile-${i.name}`,
        name: i.name,
        nickname: i.name,
        email: '',
        instruments: [slot],
        is_superadmin: false,
        is_worship_leader: false,
        is_media: false,
        created_at: new Date().toISOString()
      }
    })
  }
  
  // Map media
  for (const m of parsed.assignments.media) {
    assignments.push({
      id: `assign-${eventId}-${m}`,
      profile_id: `profile-${m}`,
      instrument_slot: 'Media',
      is_primary: true,
      confirmed: false,
      profile: {
        id: `profile-${m}`,
        name: m,
        nickname: m,
        email: '',
        instruments: ['Media'],
        is_superadmin: false,
        is_worship_leader: false,
        is_media: true,
        created_at: new Date().toISOString()
      }
    })
  }
  
  return assignments
}