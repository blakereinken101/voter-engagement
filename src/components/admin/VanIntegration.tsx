'use client'

import { useState, useEffect } from 'react'
import { Save, CheckCircle, AlertCircle, Link2, Wifi, WifiOff, RefreshCw } from 'lucide-react'

interface SyncLogEntry {
  id: string
  entity_type: string
  entity_id: string
  van_endpoint: string
  sync_status: string
  error_message: string | null
  van_id: number | null
  created_at: string
}

export default function VanIntegration() {
  const [enabled, setEnabled] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [mode, setMode] = useState<0 | 1>(1)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  // Load config
  useEffect(() => {
    fetch('/api/campaign/van-config')
      .then(res => res.json())
      .then(data => {
        const vc = data.vanConfig
        if (vc) {
          setEnabled(vc.enabled || false)
          setMode(vc.mode ?? 1)
          setHasApiKey(vc.hasApiKey || false)
        }
      })
      .catch(() => setError('Failed to load VAN configuration'))
      .finally(() => setLoading(false))
  }, [])

  // Load sync logs
  const loadSyncLogs = () => {
    setLogsLoading(true)
    fetch('/api/campaign/van-sync-log')
      .then(res => res.json())
      .then(data => setSyncLogs(data.logs || []))
      .catch(() => {})
      .finally(() => setLogsLoading(false))
  }

  useEffect(() => { loadSyncLogs() }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)

    try {
      const vanConfig: Record<string, unknown> = {
        enabled,
        mode,
      }
      // Only send apiKey if user typed a new one
      if (apiKey.trim()) {
        vanConfig.apiKey = apiKey.trim()
      }

      const res = await fetch('/api/campaign/van-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vanConfig }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save')
      }

      setSaved(true)
      setApiKey('')
      if (apiKey.trim()) setHasApiKey(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const res = await fetch('/api/campaign/van-config', { method: 'POST' })
      const data = await res.json()
      setTestResult({ success: data.success, message: data.message })
    } catch {
      setTestResult({ success: false, message: 'Network error' })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-white/40 text-sm animate-pulse">Loading VAN settings...</span>
      </div>
    )
  }

  const inputClass = 'glass-input w-full rounded-btn px-4 py-3 text-sm focus:ring-2 focus:ring-vc-purple/30 focus:border-vc-purple outline-none transition-all'
  const labelClass = 'block text-sm font-semibold text-white/70 mb-2'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-vc-purple/20 ring-2 ring-vc-purple/40 flex items-center justify-center">
          <Link2 className="w-5 h-5 text-vc-purple-light" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">VAN Integration</h3>
          <p className="text-xs text-white/40">Connect to NGP VAN / EveryAction to sync contacts, outreach, and events</p>
        </div>
      </div>

      {/* Status messages */}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/20 text-red-300 text-sm px-4 py-3 rounded-lg border border-red-500/30">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 bg-vc-teal/20 text-vc-teal text-sm px-4 py-3 rounded-lg border border-vc-teal/30">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          VAN configuration saved
        </div>
      )}

      {/* Enable toggle */}
      <div className="glass-card p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-semibold text-white">Enable VAN Sync</label>
            <p className="text-xs text-white/40 mt-0.5">When enabled, contacts, outreach, events, and RSVPs sync to VAN instantly</p>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-vc-teal' : 'bg-white/20'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : ''}`}
            />
          </button>
        </div>

        {/* API Key */}
        <div>
          <label className={labelClass}>
            VAN API Key
            {hasApiKey && <span className="text-vc-teal/60 font-normal ml-2">(configured)</span>}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={hasApiKey ? 'Enter new key to replace existing' : 'Paste your VAN API key'}
            className={inputClass}
          />
          <p className="text-xs text-white/30 mt-1">
            Per-campaign key from your VAN account. Each campaign needs its own key.
          </p>
        </div>

        {/* Mode */}
        <div>
          <label className={labelClass}>Database Mode</label>
          <div className="flex gap-3">
            <button
              onClick={() => setMode(0)}
              className={`flex-1 px-4 py-2.5 rounded-btn text-sm font-medium transition-all border ${
                mode === 0
                  ? 'bg-vc-purple/20 border-vc-purple/40 text-white'
                  : 'border-white/10 text-white/50 hover:border-white/20'
              }`}
            >
              My Voters (0)
            </button>
            <button
              onClick={() => setMode(1)}
              className={`flex-1 px-4 py-2.5 rounded-btn text-sm font-medium transition-all border ${
                mode === 1
                  ? 'bg-vc-purple/20 border-vc-purple/40 text-white'
                  : 'border-white/10 text-white/50 hover:border-white/20'
              }`}
            >
              My Campaign (1)
            </button>
          </div>
          <p className="text-xs text-white/30 mt-1">
            Mode 0 matches against the voter file. Mode 1 is the CRM where you can create new records.
          </p>
        </div>

        {/* Test Connection */}
        {hasApiKey && (
          <div>
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-btn text-sm font-medium bg-white/10 text-white/70 hover:bg-white/20 transition-all disabled:opacity-50"
            >
              {testing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Wifi className="w-4 h-4" />
              )}
              Test Connection
            </button>
            {testResult && (
              <div className={`flex items-center gap-2 mt-2 text-sm px-3 py-2 rounded-lg ${
                testResult.success
                  ? 'bg-vc-teal/20 text-vc-teal border border-vc-teal/30'
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}>
                {testResult.success ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                {testResult.message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-3 rounded-btn text-sm font-semibold bg-vc-purple text-white hover:bg-vc-purple-light transition-all shadow-glow disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {saving ? 'Saving...' : 'Save VAN Settings'}
      </button>

      {/* Sync Activity Log */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-white">Recent Sync Activity</h4>
          <button
            onClick={loadSyncLogs}
            disabled={logsLoading}
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {syncLogs.length === 0 ? (
          <p className="text-sm text-white/30">No sync activity yet. Syncs will appear here once VAN is enabled and contacts/events are created.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {syncLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between text-xs py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${log.sync_status === 'success' ? 'bg-vc-teal' : 'bg-red-400'}`} />
                  <span className="text-white/60 truncate">
                    {log.entity_type} &middot; {log.van_endpoint}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  {log.van_id && <span className="text-white/30">VAN #{log.van_id}</span>}
                  <span className="text-white/25">
                    {new Date(log.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
