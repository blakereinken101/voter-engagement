'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, BellOff, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

const STORAGE_KEY = 'threshold-push-enabled'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default function PushNotificationToggle() {
  const [isSupported, setIsSupported] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window
    setIsSupported(supported)

    if (supported) {
      setPermission(Notification.permission)
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'true') {
        setIsEnabled(true)
      }
    }
  }, [])

  const subscribe = useCallback(async () => {
    setLoading(true)
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        console.error('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set')
        return
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })

      if (res.ok) {
        setIsEnabled(true)
        localStorage.setItem(STORAGE_KEY, 'true')
      } else {
        console.error('[push] Failed to save subscription on server')
      }

      setPermission(Notification.permission)
    } catch (err) {
      console.error('[push] Subscribe error:', err)
      setPermission(Notification.permission)
    } finally {
      setLoading(false)
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    setLoading(true)
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          const endpoint = subscription.endpoint
          await subscription.unsubscribe()

          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint }),
          })
        }
      }

      setIsEnabled(false)
      localStorage.setItem(STORAGE_KEY, 'false')
    } catch (err) {
      console.error('[push] Unsubscribe error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleToggle = useCallback(async () => {
    if (isEnabled) {
      await unsubscribe()
    } else {
      await subscribe()
    }
  }, [isEnabled, subscribe, unsubscribe])

  if (!isSupported) return null

  return (
    <div className="glass-card p-4 overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between hover:opacity-80 transition-opacity text-left"
      >
        <div className="flex items-center gap-2">
          {isEnabled ? (
            <Bell className="w-4 h-4 text-vc-purple-light" />
          ) : (
            <BellOff className="w-4 h-4 text-vc-purple-light" />
          )}
          <span className="text-sm font-bold text-white/70">Push Notifications</span>
          {isEnabled && (
            <span className="text-[10px] bg-vc-purple/30 text-vc-purple-light px-1.5 py-0.5 rounded-full">
              ON
            </span>
          )}
        </div>
        <ChevronDown
          className={clsx(
            'w-4 h-4 text-white/30 transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3 animate-fade-in">
          <p className="text-xs text-white/60">
            Get reminded to follow up with your contacts and stay on top of your outreach goals.
          </p>

          {permission === 'denied' ? (
            <div className="text-xs text-red-400/80 bg-red-500/10 border border-red-500/20 rounded-btn px-3 py-2">
              Notifications are blocked in your browser settings. To enable them, update your
              browser&apos;s notification permissions for this site.
            </div>
          ) : (
            <button
              onClick={handleToggle}
              disabled={loading}
              className={clsx(
                'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-btn text-sm font-bold transition-all',
                isEnabled
                  ? 'glass-dark text-white/60 hover:text-white border border-white/10'
                  : 'bg-vc-purple text-white hover:bg-vc-purple/80 shadow-glow'
              )}
            >
              {loading ? (
                <span className="text-white/60">...</span>
              ) : isEnabled ? (
                <>
                  <BellOff className="w-4 h-4" />
                  Disable Notifications
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  Enable Notifications
                </>
              )}
            </button>
          )}

          {permission !== 'denied' && (
            <p className="text-[10px] text-white/30 text-center">
              Permission: {permission}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
