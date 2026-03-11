import { vi } from 'vitest'

export const sendVerificationCode = vi.fn().mockResolvedValue(undefined)
export const sendPasswordResetCode = vi.fn().mockResolvedValue(undefined)
export const sendInvitationEmail = vi.fn().mockResolvedValue(undefined)
