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

interface AuthContextValue {
  user: AuthUser | null
  memberships: Membership[]
  activeMembership: Membership | null
  campaignConfig: CampaignConfig | null
  isLoading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  switchCampaign: (campaignId: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [activeMembership, setActiveMembership] = useState<Membership | null>(null)
  const [campaignConfig, setCampaignConfig] = useState<CampaignConfig | null>(null)
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
            return null
          }
          throw new Error('Not authenticated')
        })
        .then(data => {
          if (isMounted && data) {
            setUser(data.user)
            setMemberships(data.memberships || [])
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

  const signIn = useCallback(async (email: string, password: string) => {
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
    setUser(data.user)
    setMemberships(data.memberships || [])

    // Auto-select campaign
    if (data.memberships?.length >= 1) {
      const m = data.activeMembership || data.memberships[0]
      setActiveMembership(m)
      document.cookie = `vc-campaign=${m.campaignId}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`
    }
  }, [])

  const signOut = useCallback(async () => {
    await fetch('/api/auth/sign-out', { method: 'POST' })
    setUser(null)
    setMemberships([])
    setActiveMembership(null)
    setCampaignConfig(null)
    document.cookie = 'vc-campaign=; Path=/; SameSite=Lax; Max-Age=0'
    window.location.href = '/sign-in'
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

  return (
    <AuthContext.Provider value={{
      user, memberships, activeMembership, campaignConfig, isLoading, isAdmin,
      signIn, signOut, switchCampaign,
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
