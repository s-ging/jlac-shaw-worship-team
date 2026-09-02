// src/lib/group-assignments.ts
import type { Assignment } from './types'

export function getRoleLabel(slot: string): string {
  const map: Record<string, string> = {
    // Vocalists
    'Lead Vocal': '1️⃣ Praise Leader',
    'Sub-Lead Vocal': '2️⃣ Second Praise Leader',
    'Secondary Vocal': '3️⃣ Offering Prayer',
    
    // Instrumentalists
    'Drums': '🥁 Drums',
    'Guitar': '🎸 Guitar',
    'Lead': '🎸 Lead Guitar',     // Added
    'Rhythm': '🎸 Rhythm Guitar', // Added
    'Bass': '🎸 Bass',
    'L. Guitar': '🎸 L. Guitar',
    'Lead Guitar': '🎸 Lead Guitar',
    'Rhythm Guitar': '🎸 Rhythm Guitar',
    
    // Media
    'Media': '📹 Media'
  }
  return map[slot] || slot
}

export function getStatusIcon(confirmed: boolean | null): string {
  if (confirmed === true) return '✅'
  if (confirmed === false) return '❎'
  return '➖'
}

export function getInstrumentEmoji(slot: string): string {
  const map: Record<string, string> = {
    'Lead Vocal': '🎤',
    'Sub-Lead Vocal': '🎤',
    'Secondary Vocal': '🎤',
    'Drums': '🥁',
    'Guitar': '🎸',
    'Bass': '🎸',
    'L. Guitar': '🎸',
    'Lead Guitar': '🎸',
    'Rhythm Guitar': '🎸',
    'Media': '📹'
  }
  return map[slot] || '🎵'
}