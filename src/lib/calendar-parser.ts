export interface ParsedEvent {
  theme: string
  playlistUrl: string
  assignments: {
    vocalists: { role: string; name: string }[]
    instrumentalists: { instrument: string; name: string }[]
    media: string[]
  }
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
  
  // 🔍 DEBUG: Log raw description
  console.log('='.repeat(80))
  console.log('📝 RAW DESCRIPTION:')
  console.log(description)
  console.log('-'.repeat(80))
  
  // STEP 1: Clean HTML tags - replace <br> with newlines, remove <b>
  let cleanText = description
    .replace(/<\/?b>/g, '')           // Remove <b> and </b>
    .replace(/<br\s*\/?>/gi, '\n')    // Replace <br> with newline
    .replace(/&nbsp;/g, ' ')          // Replace &nbsp; with space
  
  // 🔍 DEBUG: Log cleaned text
  console.log('🧹 CLEANED TEXT:')
  console.log(cleanText)
  console.log('-'.repeat(80))
  
  // STEP 2: Split into lines and clean each line
  let lines = cleanText.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
  
  // 🔍 DEBUG: Log lines
  console.log('📄 LINES (count: ' + lines.length + '):')
  lines.forEach((line, i) => {
    console.log(`  [${i}]: "${line}"`)
  })
  console.log('-'.repeat(80))
  
  // STEP 3: Extract YouTube playlist URL (check in raw description first)
  const playlistMatch = description.match(/(?:href=")?(https?:\/\/(?:www\.)?youtube\.com\/playlist\?list=[^\s&"']+)/i)
  if (playlistMatch) {
    result.playlistUrl = playlistMatch[1]
    console.log('✅ PLAYLIST URL FOUND:', result.playlistUrl)
  } else {
    const youtubeMatch = description.match(/(https?:\/\/(?:www\.)?youtu\.be\/[^\s&"']+)/i)
    if (youtubeMatch) {
      result.playlistUrl = youtubeMatch[1]
      console.log('✅ YOUTUBE URL FOUND:', result.playlistUrl)
    } else {
      console.log('❌ NO PLAYLIST URL FOUND')
    }
  }
  console.log('-'.repeat(80))
  
  // STEP 4: Check which parsing path we're taking
  console.log('🔀 PARSING PATH: ' + (lines.length === 1 ? 'SINGLE LINE' : 'MULTI-LINE'))
  
  // STEP 5: Try to find section markers in the raw text
  const hasVocalists = /Vocalists/i.test(cleanText)
  const hasInstrumentalists = /Instrumentalists/i.test(cleanText)
  const hasMedia = /Media/i.test(cleanText)
  console.log('📌 SECTION MARKERS:')
  console.log(`  Vocalists: ${hasVocalists ? '✅' : '❌'}`)
  console.log(`  Instrumentalists: ${hasInstrumentalists ? '✅' : '❌'}`)
  console.log(`  Media: ${hasMedia ? '✅' : '❌'}`)
  console.log('-'.repeat(80))
  
  // STEP 6: Find positions of section markers
  const vocalistsIndex = cleanText.search(/Vocalists/i)
  const instrumentalistsIndex = cleanText.search(/Instrumentalists/i)
  const mediaIndex = cleanText.search(/Media/i)
  
  console.log('📌 SECTION POSITIONS:')
  console.log(`  Vocalists at index: ${vocalistsIndex}`)
  console.log(`  Instrumentalists at index: ${instrumentalistsIndex}`)
  console.log(`  Media at index: ${mediaIndex}`)
  console.log('-'.repeat(80))
  
  // STEP 7: If we have only 1 line, try to split by known section markers
  if (lines.length === 1) {
    // Split by "Vocalists", "Instrumentalists", "Media" markers
    const text = lines[0]
    
    // Find section boundaries
    const vocalistsIndexLocal = text.search(/Vocalists/i)
    const instrumentalistsIndexLocal = text.search(/Instrumentalists/i)
    const mediaIndexLocal = text.search(/Media/i)
    
    // Extract sections
    let vocalistsText = ''
    let instrumentalistsText = ''
    let mediaText = ''
    let themeText = ''
    
    // Get theme (everything before "Vocalists")
    if (vocalistsIndexLocal > 0) {
      themeText = text.substring(0, vocalistsIndexLocal).trim()
    }
    
    // Get vocalists (between "Vocalists" and "Instrumentalists")
    if (vocalistsIndexLocal >= 0 && instrumentalistsIndexLocal > vocalistsIndexLocal) {
      vocalistsText = text.substring(vocalistsIndexLocal, instrumentalistsIndexLocal).trim()
    }
    
    // Get instrumentalists (between "Instrumentalists" and "Media")
    if (instrumentalistsIndexLocal >= 0 && mediaIndexLocal > instrumentalistsIndexLocal) {
      instrumentalistsText = text.substring(instrumentalistsIndexLocal, mediaIndexLocal).trim()
    }
    
    // Get media (after "Media")
    if (mediaIndexLocal >= 0) {
      mediaText = text.substring(mediaIndexLocal).trim()
    }
    
    // Parse theme
    if (themeText) {
      // Remove "Theme:" prefix if present
      let theme = themeText.replace(/^Theme:\s*/i, '').trim()
      // Remove "Devotion Time" and everything after
      const devotionIndex = theme.search(/Devotion Time/i)
      if (devotionIndex > 0) {
        theme = theme.substring(0, devotionIndex).trim()
      }
      result.theme = theme
    }
    
    // Parse vocalists from vocalistsText
    if (vocalistsText) {
      // Remove "Vocalists" header
      const textWithoutHeader = vocalistsText.replace(/^Vocalists\s*/i, '')
      // Split by numbered items (1️⃣, 2️⃣, 3️⃣)
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
    
    // Parse instrumentalists - KEEP IT SIMPLE
    if (instrumentalistsText) {
      const textWithoutHeader = instrumentalistsText.replace(/^Instrumentalists\s*/i, '')
      
      // Split by newlines or find all lines with a dash
      const instLines = textWithoutHeader.split(/\n/).filter(line => line.includes('-') || line.includes('–') || line.includes('—'))
      
      for (const line of instLines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        
        // Remove any emoji at the start
        const cleanLine = trimmed.replace(/^[^\w\s]+/, '').trim()
        
        // Split by dash
        const parts = cleanLine.split(/\s*[-–—]\s*/)
        if (parts.length === 2) {
          result.assignments.instrumentalists.push({
            instrument: parts[0].trim(),
            name: parts[1].trim()
          })
        }
      }
    }
    
    // Parse media from mediaText
    if (mediaText) {
      const textWithoutHeader = mediaText.replace(/^Media\s*/i, '')
      const names = textWithoutHeader
        .split(/[,&]|\band\b/)
        .map(n => n.trim())
        .filter(n => n && n.length > 0 && !n.toLowerCase().includes('media'))
      result.assignments.media.push(...names)
    }
    
    // At the very end, log what was parsed
    console.log('📊 PARSED RESULT:')
    console.log(JSON.stringify(result, null, 2))
    console.log('='.repeat(80))
    
    return result
  }
  
  // STEP 8: Normal multi-line parsing (fallback for well-formatted text)
  let currentSection: 'vocalists' | 'instrumentalists' | 'media' | null = null
  let themeLines: string[] = []
  
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
        // Simple parsing for multi-line too
        const cleanLine = trimmed.replace(/^[^\w\s]+/, '').trim()
        const parts = cleanLine.split(/\s*[-–—]\s*/)
        if (parts.length === 2) {
          result.assignments.instrumentalists.push({
            instrument: parts[0].trim(),
            name: parts[1].trim()
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
  
  // At the very end, log what was parsed
  console.log('📊 PARSED RESULT:')
  console.log(JSON.stringify(result, null, 2))
  console.log('='.repeat(80))
  
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
  
  // Map instrumentalists
  const instMap: Record<string, string> = {
    'Drums': 'Drums',
    'L. Guitar': 'Lead',
    'Lead Guitar': 'Lead',
    'Rhythm Guitar': 'Rhythm',
    'R. Guiter': 'Rhythm',
    'Bass': 'Bass'
  }
  
  for (const i of parsed.assignments.instrumentalists) {
    const slot = instMap[i.instrument] || i.instrument
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