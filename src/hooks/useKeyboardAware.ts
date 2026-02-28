'use client'

import { useState, useEffect } from 'react'

/**
 * Detects mobile virtual keyboard open/close using the visualViewport API.
 * Returns whether the keyboard is open and its approximate height.
 */
export function useKeyboardAware() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    // Threshold: if viewport shrinks by more than 100px, keyboard is likely open
    const THRESHOLD = 100

    const onResize = () => {
      const heightDiff = window.innerHeight - vv.height
      const open = heightDiff > THRESHOLD
      setIsKeyboardOpen(open)
      setKeyboardHeight(open ? heightDiff : 0)
    }

    vv.addEventListener('resize', onResize)
    // Run once to set initial state
    onResize()

    return () => vv.removeEventListener('resize', onResize)
  }, [])

  return { isKeyboardOpen, keyboardHeight }
}
