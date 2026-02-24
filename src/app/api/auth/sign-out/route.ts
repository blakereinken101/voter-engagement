import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true })
  // Clear both session and campaign cookies to prevent cross-account bleed
  response.headers.append('Set-Cookie', 'vc-session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0')
  response.headers.append('Set-Cookie', 'vc-campaign=; Path=/; SameSite=Lax; Max-Age=0')
  return response
}
