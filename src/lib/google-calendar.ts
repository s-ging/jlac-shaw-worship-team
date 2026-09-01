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
    
    console.log(`✅ Found ${data.items?.length || 0} events`)
    return data.items || []
  } catch (error) {
    console.error('❌ Failed to fetch calendar:', error)
    return []
  }
}

export function parseEventToAssignment(event: any) {
  const summary = event.summary || ''
  const attendees = event.attendees || []
  
  let instrumentSlot = 'Secondary Vocal'
  let profileName = summary
  
  if (summary.includes('🥁')) { instrumentSlot = 'Drums' }
  else if (summary.includes('🎸 Lead')) { instrumentSlot = 'Guitar' }
  else if (summary.includes('🎸 Bass')) { instrumentSlot = 'Bass' }
  else if (summary.includes('1️⃣')) { instrumentSlot = 'Lead Vocal' }
  else if (summary.includes('2️⃣')) { instrumentSlot = 'Sub-Lead Vocal' }
  else if (summary.includes('3️⃣')) { instrumentSlot = 'Secondary Vocal' }
  
  const match = summary.match(/[️⃣🥁🎸]+\s*(.+)/)
  if (match) {
    profileName = match[1].trim()
  }
  
  const attendee = attendees.find((a: any) => a.email && a.email.includes('@'))
  const confirmed = attendee?.responseStatus === 'accepted'
  
  return {
    id: `cal-assign-${event.id || Date.now()}`,
    profile_id: `cal-profile-${profileName}`,
    instrument_slot: instrumentSlot,
    is_primary: true,
    confirmed: confirmed || false,
    profile: {
      id: `cal-profile-${profileName}`,
      name: profileName,
      nickname: profileName,
      email: attendee?.email || '',
      instruments: [instrumentSlot],
      is_superadmin: false,
      is_worship_leader: false,
      is_media: false,
      created_at: new Date().toISOString()
    }
  }
}