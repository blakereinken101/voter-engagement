import { NextResponse } from 'next/server'

/**
 * Sign-up is now invite-only.
 * New accounts are created through /api/invitations/accept.
 * This route remains to return a helpful error message.
 */
export async function POST() {
  return NextResponse.json({
    error: 'Open registration is disabled. Please use an invitation link to create your account.',
  }, { status: 403 })
}
