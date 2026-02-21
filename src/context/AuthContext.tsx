'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'volunteer' | 'admin'
  campaignId: string
  createdAt?: string
}

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check session on mount and periodically verify token is still valid
  useEffect(() => {
    let isMounted = true

    function checkSession() {
      fetch('/api/auth/me')
        .then(res => {
          if (!isMounted) return
          if (res.ok) return res.json()
          // Token expired or invalid — sign out
          if (res.status === 401) {
            setUser(null)
            return null
          }
          throw new Error('Not authenticated')
        })
        .then(data => {
          if (isMounted && data) setUser(data.user)
        })
        .catch(() => {
          if (isMounted) setUser(null)
        })
        .finally(() => {
          if (isMounted) setIsLoading(false)
        })
    }

    checkSession()

    // Re-check session every 30 minutes to catch token expiry
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
      const data = await res.json()
      throw new Error(data.error || 'Sign in failed')
    }
    const data = await res.json()
    setUser(data.user)
  }, [])

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const res = await fetch('/api/auth/sign-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Sign up failed')
    }
    const data = await res.json()
    setUser(data.user)
  }, [])

  const signOut = useCallback(async () => {
    await fetch('/api/auth/sign-out', { method: 'POST' })
    setUser(null)
    window.location.href = '/sign-in'
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
