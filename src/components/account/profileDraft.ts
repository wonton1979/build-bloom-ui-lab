import type { CurrentUser, UpdateCurrentUser } from '../../features/auth/api'

export type ProfileDraft = { firstName: string; lastName: string; phone: string }

export const draftFromUser = (user: CurrentUser): ProfileDraft => ({
  firstName: user.firstName ?? '',
  lastName: user.lastName ?? '',
  phone: user.phone ?? '',
})

export const profilePatchFromDraft = (draft: ProfileDraft): UpdateCurrentUser => {
  const firstName = draft.firstName.trim()
  const lastName = draft.lastName.trim()
  return { ...(firstName ? { firstName } : {}), ...(lastName ? { lastName } : {}), phone: draft.phone.trim() }
}
