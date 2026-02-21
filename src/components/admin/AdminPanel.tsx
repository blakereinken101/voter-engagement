'use client'

import { useState } from 'react'
import { AdminTab } from '@/types'
import AdminSummary from './AdminSummary'
import VolunteerList from './VolunteerList'
import AdminContacts from './AdminContacts'
import ActivityTimeline from './ActivityTimeline'
import ExportPanel from './ExportPanel'
import Leaderboard from './Leaderboard'
import clsx from 'clsx'

const TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: 'summary', label: 'Summary', icon: '📊' },
  { id: 'volunteers', label: 'Volunteers', icon: '👥' },
  { id: 'contacts', label: 'Contacts', icon: '📇' },
  { id: 'activity', label: 'Activity', icon: '📋' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
  { id: 'export', label: 'Export', icon: '📥' },
]

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>('summary')

  return (
    <div className="p-4">
      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1 mb-6 bg-white rounded-xl p-1 shadow-sm border border-gray-100">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-rally-navy text-white shadow-sm'
                : 'text-rally-slate-light hover:bg-rally-navy/5'
            )}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="animate-fade-in">
        {activeTab === 'summary' && <AdminSummary />}
        {activeTab === 'volunteers' && <VolunteerList />}
        {activeTab === 'contacts' && <AdminContacts />}
        {activeTab === 'activity' && <ActivityTimeline />}
        {activeTab === 'leaderboard' && <Leaderboard />}
        {activeTab === 'export' && <ExportPanel />}
      </div>
    </div>
  )
}
