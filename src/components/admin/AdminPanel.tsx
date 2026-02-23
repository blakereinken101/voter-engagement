'use client'

import { useState } from 'react'
import { AdminTab } from '@/types'
import AdminSummary from './AdminSummary'
import VolunteerList from './VolunteerList'
import AdminContacts from './AdminContacts'
import ActivityTimeline from './ActivityTimeline'
import ExportPanel from './ExportPanel'
import Leaderboard from './Leaderboard'
import DataPurge from './DataPurge'
import TeamManagement from './TeamManagement'
import AICampaignContext from './AICampaignContext'
import { BarChart3, Users, Contact, Activity, Trophy, Download, Trash2, UserPlus, Bot } from 'lucide-react'
import clsx from 'clsx'

const TABS: { id: AdminTab; label: string; Icon: typeof BarChart3 }[] = [
  { id: 'summary', label: 'Summary', Icon: BarChart3 },
  { id: 'team', label: 'Team', Icon: UserPlus },
  { id: 'volunteers', label: 'Volunteers', Icon: Users },
  { id: 'contacts', label: 'Contacts', Icon: Contact },
  { id: 'activity', label: 'Activity', Icon: Activity },
  { id: 'leaderboard', label: 'Leaderboard', Icon: Trophy },
  { id: 'export', label: 'Export', Icon: Download },
  { id: 'purge', label: 'Purge', Icon: Trash2 },
  { id: 'ai-context', label: 'AI Coach', Icon: Bot },
]

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>('summary')

  return (
    <div className="p-4">
      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1 mb-6 glass-card p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2.5 rounded-btn text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-vc-purple text-white shadow-glow'
                : 'text-white/60 hover:bg-white/10'
            )}
          >
            <tab.Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="animate-fade-in">
        {activeTab === 'summary' && <AdminSummary />}
        {activeTab === 'team' && <TeamManagement />}
        {activeTab === 'volunteers' && <VolunteerList />}
        {activeTab === 'contacts' && <AdminContacts />}
        {activeTab === 'activity' && <ActivityTimeline />}
        {activeTab === 'leaderboard' && <Leaderboard />}
        {activeTab === 'export' && <ExportPanel />}
        {activeTab === 'purge' && <DataPurge />}
        {activeTab === 'ai-context' && <AICampaignContext />}
      </div>
    </div>
  )
}
