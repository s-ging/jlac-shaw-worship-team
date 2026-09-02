// src/lib/group-assignments.ts

// Instrument display labels
export const INSTRUMENT_LABELS: Record<string, string> = {
  'Drums': '🥁 Drums',
  'Lead': '🎸 Lead Guitar',
  'Rhythm': '🎸 Rhythm Guitar', 
  'Bass': '🎸 Bass',
  // Catch-all for unknown instruments
  'default': '🎸 {instrument}'
}

export function getRoleLabel(slot: string): string {
  // Vocal roles
  const roleMap: Record<string, string> = {
    'Lead Vocal': '1️⃣ Praise Leader',
    'Sub-Lead Vocal': '2️⃣ Second Praise Leader',
    'Secondary Vocal': '3️⃣ Offering Prayer'
  }
  
  if (roleMap[slot]) return roleMap[slot]
  
  // Instrument roles
  if (INSTRUMENT_LABELS[slot]) return INSTRUMENT_LABELS[slot]
  
  // Default: return the slot name with guitar emoji if it looks like an instrument
  if (slot && !slot.includes('Vocal') && slot !== 'Media') {
    return `🎸 ${slot}`
  }
  
  return slot
}

export function getStatusIcon(confirmed: boolean): string {
  return confirmed ? '✅' : '➖'
}