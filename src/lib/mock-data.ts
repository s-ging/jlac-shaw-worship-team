// Use when Supabase is down or during development
export const mockWeeks = [
  {
    id: '1',
    service_date: '2026-09-06',
    theme: 'Beige',
    playlist_url: 'https://youtube.com/playlist...',
    worship_leader: { id: '1', nickname: 'Marian', name: 'Marian Alocillo' },
    assignments: [
      { id: 'a1', profile: { nickname: 'Marian' }, instrument_slot: 'Praise Leader', confirmed: true },
      { id: 'a2', profile: { nickname: 'Ezra' }, instrument_slot: 'Second Praise Leader', confirmed: false },
      // ...
    ]
  }
  // ... 4 weeks
]