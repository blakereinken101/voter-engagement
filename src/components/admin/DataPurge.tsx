'use client'

import { useState } from 'react'
import { Trash2, AlertTriangle, Shield } from 'lucide-react'

interface DataCounts {
  activity_log: number
  action_items: number
  match_results: number
  contacts: number
  users: number
}

export default function DataPurge() {
  const [counts, setCounts] = useState<DataCounts | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [purging, setPurging] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCounts = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/purge')
      if (!res.ok) throw new Error('Failed to load data summary')
      const data = await res.json()
      setCounts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data summary')
    } finally {
      setLoading(false)
    }
  }

  const handlePurge = async () => {
    setPurging(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Purge failed')
      }
      setSuccess(true)
      setCounts(null)
      setConfirmText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purge failed')
    } finally {
      setPurging(false)
    }
  }

  const isConfirmed = confirmText === 'DELETE'
  const totalRecords = counts
    ? counts.activity_log + counts.action_items + counts.match_results + counts.contacts + counts.users
    : 0

  return (
    <div className="max-w-lg">
      <div className="glass-card p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-xl bg-vc-coral/10 flex items-center justify-center">
            <Trash2 className="w-7 h-7 text-vc-coral" />
          </div>
          <div>
            <h3 className="font-display font-bold text-xl text-white">Data Purge</h3>
            <p className="text-sm text-white/60">Danger zone</p>
          </div>
        </div>

        {/* Warning banner */}
        <div className="glass-dark rounded-btn p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-vc-coral shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-vc-coral mb-1">Irreversible Action</p>
              <p className="text-sm text-white/60">
                This will permanently delete all campaign data including contacts, match results,
                action items, and activity logs. Admin accounts will be preserved. This action
                cannot be undone.
              </p>
            </div>
          </div>
        </div>

        {/* Success state */}
        {success && (
          <div className="glass-dark rounded-btn p-4 mb-6">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-green-400" />
              <p className="text-sm text-green-400 font-medium">
                All campaign data purged. Admin accounts preserved.
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="glass-dark rounded-btn p-4 mb-6">
            <p className="text-sm text-vc-coral">{error}</p>
          </div>
        )}

        {/* Load data summary */}
        {!success && (
          <>
            <button
              onClick={loadCounts}
              disabled={loading}
              className="w-full glass-dark hover:bg-white/10 text-white/60 hover:text-white font-medium px-6 py-3 rounded-btn transition-all disabled:opacity-50 mb-4"
            >
              {loading ? 'Loading...' : 'Load Data Summary'}
            </button>

            {/* Data counts */}
            {counts && (
              <div className="glass-dark rounded-btn p-4 mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Activity logs</span>
                  <span className="text-white font-mono">{counts.activity_log.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Action items</span>
                  <span className="text-white font-mono">{counts.action_items.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Match results</span>
                  <span className="text-white font-mono">{counts.match_results.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Contacts</span>
                  <span className="text-white font-mono">{counts.contacts.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Non-admin users</span>
                  <span className="text-white font-mono">{counts.users.toLocaleString()}</span>
                </div>
                <div className="border-t border-white/10 pt-2 mt-2 flex justify-between text-sm font-semibold">
                  <span className="text-white/80">Total records</span>
                  <span className="text-vc-coral font-mono">{totalRecords.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Confirmation input */}
            {counts && totalRecords > 0 && (
              <div className="mb-4">
                <label className="block text-sm text-white/60 mb-2">
                  Type <span className="text-vc-coral font-mono font-bold">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full glass-dark text-white px-4 py-3 rounded-btn border border-white/10 focus:border-vc-coral focus:outline-none placeholder:text-white/30 font-mono"
                />
              </div>
            )}

            {/* Purge button */}
            {counts && totalRecords > 0 && (
              <button
                onClick={handlePurge}
                disabled={!isConfirmed || purging}
                className="w-full bg-vc-coral hover:bg-vc-coral/80 text-white font-bold px-8 py-3 rounded-btn transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {purging ? 'Purging...' : 'Purge All Data'}
              </button>
            )}

            {counts && totalRecords === 0 && (
              <div className="glass-dark rounded-btn p-4 text-center">
                <Shield className="w-6 h-6 text-white/40 mx-auto mb-2" />
                <p className="text-sm text-white/60">No data to purge. All tables are empty.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
