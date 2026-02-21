'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'

export default function ExportPanel() {
  const [downloading, setDownloading] = useState(false)

  const handleExport = async () => {
    setDownloading(true)
    try {
      const res = await fetch('/api/admin/export')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `votecircle-export-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <div className="glass-card p-8 text-center">
        <div className="w-14 h-14 rounded-xl bg-vc-purple/10 flex items-center justify-center mx-auto mb-4">
          <Download className="w-7 h-7 text-vc-purple" />
        </div>
        <h3 className="font-display font-bold text-xl mb-2 text-white">Export All Data</h3>
        <p className="text-sm text-white/50 mb-6">
          Download a CSV file containing all contacts, match results, and conversation outcomes across all volunteers.
        </p>
        <button
          onClick={handleExport}
          disabled={downloading}
          className="bg-vc-purple hover:bg-vc-purple-light text-white font-bold px-8 py-3 rounded-btn transition-all disabled:opacity-50 flex items-center gap-2 mx-auto"
        >
          <Download className="w-4 h-4" />
          {downloading ? 'Downloading...' : 'Download CSV'}
        </button>
      </div>
    </div>
  )
}
