// src/lib/group-assignments.ts
import type { Assignment } from './types'

export function getRoleLabel(slot: string): string {
  const map: Record<string, string> = {
    'Lead Vocal': '1️⃣ Praise Leader',
    'Sub-Lead Vocal': '2️⃣ Second Praise Leader',
    'Secondary Vocal': '3️⃣ Offering Prayer',
    'Drums': '🥁 Drums',
    'Guitar': '🎸 Lead',
    'Bass': '🎸 Bass'
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
    'Bass': '🎸'
  }
  return map[slot] || '🎵'
}