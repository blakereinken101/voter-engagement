'use client'

import { useEffect } from 'react'
import { persistGclid } from '@/lib/google-ads'

export default function GclidCapture() {
  useEffect(() => {
    persistGclid()
  }, [])

  return null
}
