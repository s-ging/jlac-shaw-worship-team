import { parseEventDescription, parsedToAssignments } from './calendar-parser'

const CALENDAR_ID = '9a716d356291248887be20bd495e2f774cf2f47953825b06787fe831744e3709@group.calendar.google.com'
const API_KEY = 'AIzaSyBqRCAKtqpCVTCq9yA_HYMontVvX5rGnOo'

export async function fetchMonthEvents(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0)
  
  const timeMin = startDate.toISOString()
  const timeMax = endDate.toISOString()
  
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?key=${API_KEY}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`
  
  try {
    console.log('📡 Fetching calendar events...')
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.error) {
      console.error('❌ Calendar API error:', data.error)
      return []
    }
    
    return data.items || []
  } catch (error) {
    console.error('❌ Failed to fetch calendar:', error)
    return []
  }
}
export function processEvent(event: any) {
  const description = event.description || ''
  console.log('📝 Raw description:', description.substring(0, 200) + '...')
  
  const parsed = parseEventDescription(description)
  console.log('📊 Parsed result:', {
    theme: parsed.theme,
    playlistUrl: parsed.playlistUrl,
    vocalists: parsed.assignments.vocalists,
    instrumentalists: parsed.assignments.instrumentalists,
    media: parsed.assignments.media
  })
  
  const assignments = parsedToAssignments(parsed, event.id)
  console.log(`📋 Generated ${assignments.length} assignments`)
  
  return {
    id: event.id,
    summary: event.summary || '',
    start: event.start?.dateTime || event.start?.date,
    theme: parsed.theme,
    playlistUrl: parsed.playlistUrl,
    assignments
  }
}

// Get monthly theme from the month-long event
export function extractMonthlyTheme(events: any[]) {
  for (const event of events) {
    const start = event.start?.date || event.start?.dateTime
    const end = event.end?.date || event.end?.dateTime
    
    if (!start || !end) continue
    
    const startDate = new Date(start)
    const endDate = new Date(end)
    const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    
    // Month-long event (duration > 7 days)
    if (duration > 7) {
      const description = event.description || ''
      const parsed = parseEventDescription(description)
      return parsed.theme || event.summary || ''
    }
  }
  return ''
}