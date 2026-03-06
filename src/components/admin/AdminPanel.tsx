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
import VanIntegration from './VanIntegration'
import PdiIntegration from './PdiIntegration'
import PetitionDashboard from './PetitionDashboard'
import { BarChart3, Users, Contact, Activity, Trophy, Download, Trash2, UserPlus, Sparkles, Link2, FileSignature } from 'lucide-react'
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
  { id: 'ai-context', label: 'AI Coach', Icon: Sparkles },
  { id: 'integrations', label: 'Integrations', Icon: Link2 },
  { id: 'petitions', label: 'Petitions', Icon: FileSignature },
]

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>('summary')
  const [activeCrm, setActiveCrm] = useState<'van' | 'pdi'>('van')

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
        {activeTab === 'integrations' && (
          <div className="space-y-6">
            {/* CRM selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveCrm('van')}
                className={clsx(
                  'px-5 py-2.5 rounded-btn text-sm font-semibold transition-all border',
                  activeCrm === 'van'
                    ? 'bg-vc-purple/20 border-vc-purple/40 text-white'
                    : 'border-white/10 text-white/50 hover:border-white/20'
                )}
              >
                NGP VAN
              </button>
              <button
                onClick={() => setActiveCrm('pdi')}
                className={clsx(
                  'px-5 py-2.5 rounded-btn text-sm font-semibold transition-all border',
                  activeCrm === 'pdi'
                    ? 'bg-blue-500/20 border-blue-500/40 text-white'
                    : 'border-white/10 text-white/50 hover:border-white/20'
                )}
              >
                PDI
              </button>
            </div>

            {activeCrm === 'van' && <VanIntegration />}
            {activeCrm === 'pdi' && <PdiIntegration />}
          </div>
        )}
        {activeTab === 'petitions' && <PetitionDashboard />}
      </div>
    </div>
  )
}
