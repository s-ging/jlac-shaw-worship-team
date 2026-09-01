import { supabase } from './supabase'
import type { WeekWithDetails } from './types'

export async function fetchMonthWeeks(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  
  const { data, error } = await supabase
    .from('weeks')
    .select(`
      *,
      worship_leader:profiles!worship_leader_id (
        id,
        name,
        nickname,
        email,
        instruments,
        is_superadmin,
        is_worship_leader,
        is_media
      ),
      assignments:assignments (
        *,
        profile:profiles (
          id,
          name,
          nickname,
          email,
          instruments,
          is_superadmin,
          is_worship_leader,
          is_media
        )
      )
    `)
    .gte('service_date', startDate)
    .lte('service_date', endDate)
    .order('service_date', { ascending: true })
  
  if (error) {
    console.error('Error fetching weeks:', error)
    return null
  }
  
  return data as WeekWithDetails[]
}