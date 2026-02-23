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
  organizationSlug: string | null
  isLoading: boolean
  isAdmin: boolean
  hasEventsSubscription: boolean
  signIn: (email: string, password: string) => Promise<SignInResult | void>
  signOut: () => Promise<void>
  switchCampaign: (campaignId: string) => void
  verifyCode: (code: string) => Promise<void>
  resendCode: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [activeMembership, setActiveMembership] = useState<Membership | null>(null)
  const [campaignConfig, setCampaignConfig] = useState<CampaignConfig | null>(null)
  const [productSubscriptions, setProductSubscriptions] = useState<ProductSubscriptionInfo[]>([])
  const [organizationSlug, setOrganizationSlug] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check session on mount and periodically verify token is still valid
  useEffect(() => {
    let isMounted = true

    function checkSession() {
      fetch('/api/auth/me')
        .then(res => {
          if (!isMounted) return
          if (res.ok) return res.json()
          if (res.status === 401) {
            setUser(null)
            setMemberships([])
            setActiveMembership(null)
            setCampaignConfig(null)
            setProductSubscriptions([])
            return null
          }
          throw new Error('Not authenticated')
        })
        .then(data => {
          if (isMounted && data) {
            setUser(data.user)
            setMemberships(data.memberships || [])
            setProductSubscriptions(data.productSubscriptions || [])
            setOrganizationSlug(data.organizationSlug || null)
            if (data.campaignConfig) {
              setCampaignConfig(data.campaignConfig)
            }
            if (data.activeMembership) {
              setActiveMembership(data.activeMembership)
            } else if (data.memberships?.length === 1) {
              // Auto-select if only one campaign
              const m = data.memberships[0]
              setActiveMembership(m)
              document.cookie = `vc-campaign=${m.campaignId}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`
            }
          }
        })
        .catch(() => {
          if (isMounted) {
            setUser(null)
            setMemberships([])
            setActiveMembership(null)
            setCampaignConfig(null)
            setProductSubscriptions([])
            setOrganizationSlug(null)
          }
        })
        .finally(() => {
          if (isMounted) setIsLoading(false)
        })
    }

    checkSession()

    const interval = setInterval(checkSession, 30 * 60 * 1000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult | void> => {
    const res = await fetch('/api/auth/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
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

  const verifyCode = useCallback(async (code: string) => {
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
    setUser(data.user)
    setMemberships(data.memberships || [])

    if (data.memberships?.length >= 1) {
      const m = data.activeMembership || data.memberships[0]
      setActiveMembership(m)
      document.cookie = `vc-campaign=${m.campaignId}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`
    }
  }, [])

  const resendCode = useCallback(async () => {
    const res = await fetch('/api/auth/resend-code', { method: 'POST' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Failed to resend code' }))
      throw new Error(data.error || 'Failed to resend code')
    }
  }, [])

  const signOut = useCallback(async () => {
    const isEvents = window.location.pathname.startsWith('/events')
    await fetch('/api/auth/sign-out', { method: 'POST' })
    setUser(null)
    setMemberships([])
    setActiveMembership(null)
    setCampaignConfig(null)
    setProductSubscriptions([])
    setOrganizationSlug(null)
    document.cookie = 'vc-campaign=; Path=/; SameSite=Lax; Max-Age=0'
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

  const hasEventsSubscription = productSubscriptions.some(
    s => s.product === 'events' && (s.status === 'active' || s.status === 'trialing')
  ) || !!user?.isPlatformAdmin

  return (
    <AuthContext.Provider value={{
      user, memberships, activeMembership, campaignConfig, productSubscriptions, organizationSlug,
      isLoading, isAdmin, hasEventsSubscription,
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
