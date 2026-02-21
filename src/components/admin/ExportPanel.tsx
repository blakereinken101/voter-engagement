'use client'

import { useState } from 'react'

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
      <div className="bg-white rounded-xl border border-gray-100 p-8 shadow-sm text-center">
        <div className="text-4xl mb-4">📥</div>
        <h3 className="font-display font-bold text-xl mb-2">Export All Data</h3>
        <p className="text-sm text-rally-slate-light mb-6">
          Download a CSV file containing all contacts, match results, and conversation outcomes across all volunteers.
        </p>
        <button
          onClick={handleExport}
          disabled={downloading}
          className="bg-rally-navy hover:bg-rally-navy-light text-white font-bold px-8 py-3 rounded-lg transition-all disabled:opacity-50"
        >
          {downloading ? 'Downloading...' : 'Download CSV'}
        </button>
      </div>
    </div>
  )
}
