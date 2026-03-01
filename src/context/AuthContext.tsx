'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Membership, ADMIN_ROLES } from '@/types'
import type { CampaignConfig } from '@/lib/campaign-config'

export type { CampaignConfig }

export interface AuthUser {
  id: string
  email: string
  name: string
  isPlatformAdmin: boolean
  createdAt?: string
}

interface SignInResult {
  requiresVerification?: boolean
}

export interface ProductSubscriptionInfo {
  product: string
  plan: string
  status: string
  organizationId: string
}

interface AuthContextValue {
  user: AuthUser | null
  memberships: Membership[]
  activeMembership: Membership | null
  campaignConfig: CampaignConfig | null
  productSubscriptions: ProductSubscriptionInfo[]
  userProducts: string[]
  organizationSlug: string | null
  isLoading: boolean
  isAdmin: boolean
  hasEventsAccess: boolean
  hasRelationalAccess: boolean
  hasTextingAccess: boolean
  hasEventsSubscription: boolean
  freeEventsUsed: number
  freeEventsRemaining: number
  signIn: (email: string, password: string, product?: string) => Promise<SignInResult | void>
  signOut: () => Promise<void>
  switchCampaign: (campaignId: string) => void
  verifyCode: (code: string) => Promise<string | undefined>
  resendCode: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [activeMembership, setActiveMembership] = useState<Membership | null>(null)
  const [campaignConfig, setCampaignConfig] = useState<CampaignConfig | null>(null)
  const [productSubscriptions, setProductSubscriptions] = useState<ProductSubscriptionInfo[]>([])
  const [userProducts, setUserProducts] = useState<string[]>([])
  const [organizationSlug, setOrganizationSlug] = useState<string | null>(null)
  const [freeEventsUsed, setFreeEventsUsed] = useState(0)
  const [freeEventsRemaining, setFreeEventsRemaining] = useState(2)
  const [isLoading, setIsLoading] = useState(true)

  // Reusable session refresh — fetches /api/auth/me and updates all state
  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        setMemberships(data.memberships || [])
        setProductSubscriptions(data.productSubscriptions || [])
        setUserProducts(data.userProducts || [])
        setOrganizationSlug(data.organizationSlug || null)
        setFreeEventsUsed(data.freeEventsUsed ?? 0)
        setFreeEventsRemaining(data.freeEventsRemaining ?? 2)
        if (data.campaignConfig) {
          setCampaignConfig(data.campaignConfig)
        }
        if (data.activeMembership) {
          setActiveMembership(data.activeMembership)
          document.cookie = `vc-campaign=${data.activeMembership.campaignId}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`
        } else if (data.memberships?.length === 1) {
          const m = data.memberships[0]
          setActiveMembership(m)
          document.cookie = `vc-campaign=${m.campaignId}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`
        }
      } else if (res.status === 401) {
        setUser(null)
        setMemberships([])
        setActiveMembership(null)
        setCampaignConfig(null)
        setProductSubscriptions([])
        setUserProducts([])
        setFreeEventsUsed(0)
        setFreeEventsRemaining(2)
      }
    } catch {
      setUser(null)
      setMemberships([])
      setActiveMembership(null)
      setCampaignConfig(null)
      setProductSubscriptions([])
      setUserProducts([])
      setOrganizationSlug(null)
      setFreeEventsUsed(0)
      setFreeEventsRemaining(2)
    }
  }, [])

  // Check session on mount and periodically
  useEffect(() => {
    let isMounted = true

    refreshSession().finally(() => {
      if (isMounted) setIsLoading(false)
    })

    const interval = setInterval(refreshSession, 30 * 60 * 1000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [refreshSession])

  const signIn = useCallback(async (email: string, password: string, product?: string): Promise<SignInResult | void> => {
    const res = await fetch('/api/auth/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, product }),
    })
    if (!res.ok) {
      let errorMsg = 'Sign in failed'
      try {
        const data = await res.json()
        errorMsg = data.error || errorMsg
      } catch {
        if (res.status === 429) errorMsg = 'Too many attempts. Please wait a moment and try again.'
        else if (res.status >= 500) errorMsg = 'Internal server error'
      }
      throw new Error(errorMsg)
    }
    const data = await res.json()

    // 2FA required — don't set user state yet
    if (data.requiresVerification) {
      return { requiresVerification: true }
    }

    setUser(data.user)
    setMemberships(data.memberships || [])

    // Auto-select campaign
    if (data.memberships?.length >= 1) {
      const m = data.activeMembership || data.memberships[0]
      setActiveMembership(m)
      document.cookie = `vc-campaign=${m.campaignId}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`
    }
  }, [])

  const verifyCode = useCallback(async (code: string): Promise<string | undefined> => {
    const res = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Verification failed' }))
      throw new Error(data.error || 'Verification failed')
    }
    const data = await res.json()

    // Now that vc-session cookie is set, fetch the full session to populate
    // all state (userProducts, productSubscriptions, etc.) — not just user/memberships
    await refreshSession()

    return data.redirect
  }, [refreshSession])

  const resendCode = useCallback(async () => {
    const res = await fetch('/api/auth/resend-code', { method: 'POST' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Failed to resend code' }))
      throw new Error(data.error || 'Failed to resend code')
    }
  }, [])

  const signOut = useCallback(async () => {
    const isEvents = window.location.pathname.startsWith('/events')
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' })
    } catch {
      // Server call failed — still clear client state below
    }
    setUser(null)
    setMemberships([])
    setActiveMembership(null)
    setCampaignConfig(null)
    setProductSubscriptions([])
    setUserProducts([])
    setOrganizationSlug(null)
    setFreeEventsUsed(0)
    setFreeEventsRemaining(2)
    document.cookie = 'vc-campaign=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax'
    window.location.href = isEvents ? '/sign-in?product=events' : '/sign-in'
  }, [])

  const switchCampaign = useCallback((campaignId: string) => {
    const m = memberships.find(mem => mem.campaignId === campaignId)
    if (m) {
      setActiveMembership(m)
      document.cookie = `vc-campaign=${campaignId}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`
      window.location.reload()
    }
  }, [memberships])

  const isAdmin = !!(
    user?.isPlatformAdmin ||
    (activeMembership && ADMIN_ROLES.includes(activeMembership.role))
  )

  const hasEventsAccess = userProducts.includes('events') || !!user?.isPlatformAdmin
  const hasRelationalAccess = userProducts.includes('relational') || !!user?.isPlatformAdmin
  const hasTextingAccess = userProducts.includes('texting') || !!user?.isPlatformAdmin

  const hasEventsSubscription = productSubscriptions.some(
    s => s.product === 'events' && (s.status === 'active' || s.status === 'trialing')
  ) || !!user?.isPlatformAdmin

  return (
    <AuthContext.Provider value={{
      user, memberships, activeMembership, campaignConfig, productSubscriptions, userProducts, organizationSlug,
      isLoading, isAdmin, hasEventsAccess, hasRelationalAccess, hasTextingAccess, hasEventsSubscription, freeEventsUsed, freeEventsRemaining,
      signIn, signOut, switchCampaign, verifyCode, resendCode,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
