'use client'

import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

interface Props {
  startTime: string
}

export default function EventCountdown({ startTime }: Props) {
  const [timeLeft, setTimeLeft] = useState('')
  const [show, setShow] = useState(false)

  useEffect(() => {
    function update() {
      const now = new Date().getTime()
      const target = new Date(startTime).getTime()
      const diff = target - now

      if (diff <= 0) {
        setShow(false)
        return
      }

      // Only show within 7 days
      if (diff > 7 * 24 * 60 * 60 * 1000) {
        setShow(false)
        return
      }

      setShow(true)

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`)
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`)
      } else {
        setTimeLeft(`${minutes}m`)
      }
    }

    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [startTime])

  if (!show) return null

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-vc-teal/10 border border-vc-teal/20 text-vc-teal text-sm font-medium animate-pulse-slow">
      <Clock className="w-4 h-4" />
      <span>Starts in {timeLeft}</span>
    </div>
  )
}
