import type { PublicUser, UserRoles } from '$lib/types'

/**
 * Access tiers, as the team talks about them. Stored as the role flags in
 * UserRoles; this is only the naming layer on top.
 *
 *   Member      — view the schedule, RSVP for yourself
 *   Admin       — song leaders: edit lineups, RSVP for others, read the log
 *   Superadmin  — everything, plus managing people and their access
 *
 * "Admin" is the `isWorshipLeader` flag. Media is a separate flag, not a tier.
 */
export type Tier = 'member' | 'admin' | 'superadmin'

export const TIER_LABELS: Record<Tier, string> = {
  member: 'Member',
  admin: 'Admin',
  superadmin: 'Superadmin'
}

export function tierOf(roles: UserRoles): Tier {
  if (roles.isSuperAdmin) return 'superadmin'
  if (roles.isWorshipLeader) return 'admin'
  return 'member'
}

/** Superadmins carry the admin flag too, so every "is a leader" check stays one flag. */
export function rolesForTier(tier: Tier, isMedia: boolean): UserRoles {
  return {
    isSuperAdmin: tier === 'superadmin',
    isWorshipLeader: tier !== 'member',
    isMedia,
    isMember: true
  }
}

/** UI gating only — the server checks the flags itself. */
export function canEditSchedule(user: PublicUser | null | undefined): boolean {
  return Boolean(user && (user.roles.isSuperAdmin || user.roles.isWorshipLeader))
}
