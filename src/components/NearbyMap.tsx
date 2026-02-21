'use client'

import { useEffect, useState, useMemo } from 'react'
import { SafeVoterRecord } from '@/types'
import { calculateVoteScore, determineSegment } from '@/lib/voter-segments'
import clsx from 'clsx'

// NOTE: Leaflet CSS must be imported in globals.css:
// @import 'leaflet/dist/leaflet.css';

interface Props {
  voters: SafeVoterRecord[]
  onAddVoter: (voter: SafeVoterRecord) => void
  isAlreadyAdded: (voter: SafeVoterRecord) => boolean
  centerLat?: number
  centerLng?: number
}

const PARTY_COLORS: Record<string, string> = {
  DEM: '#2563eb',  // blue-600
  REP: '#dc2626',  // red-600
  IND: '#7c3aed',  // violet-600
  LIB: '#f59e0b',  // amber-500
  GRN: '#16a34a',  // green-600
  UNR: '#6b7280',  // gray-500
  OTH: '#6b7280',  // gray-500
}

// Generate deterministic jitter for a voter based on name hash
function jitterPosition(
  voter: SafeVoterRecord,
  centerLat: number,
  centerLng: number,
  index: number
): [number, number] {
  const nameHash = `${voter.first_name}${voter.last_name}${voter.residential_address}`.split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)

  // Spread voters within ~0.01 degrees (~1km radius) of center
  const angle = ((nameHash + index * 137) % 360) * (Math.PI / 180)
  const radius = (((nameHash * 7 + index * 31) % 100) / 100) * 0.01

  return [
    centerLat + radius * Math.cos(angle),
    centerLng + radius * Math.sin(angle),
  ]
}

export default function NearbyMap(props: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="h-[60vh] bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
        <span className="text-sm text-gray-400">Loading map...</span>
      </div>
    )
  }

  return <MapInner {...props} />
}

function MapInner({ voters, onAddVoter, isAlreadyAdded, centerLat, centerLng }: Props) {
  // Dynamic require since we know we're client-side (avoids SSR issues with Leaflet)
  const { MapContainer, TileLayer, CircleMarker, Popup } = require('react-leaflet')

  const center: [number, number] = [centerLat ?? 35.2271, centerLng ?? -80.8431]

  const voterPositions = useMemo(() => {
    return voters
      .map((voter, i) => ({
        voter,
        // Use real coordinates if available, fall back to jitter
        position: (voter.lat != null && voter.lng != null)
          ? [voter.lat, voter.lng] as [number, number]
          : jitterPosition(voter, center[0], center[1], i),
        hasRealCoords: voter.lat != null && voter.lng != null,
      }))
  }, [voters, center[0], center[1]])

  return (
    <div className="h-[60vh] rounded-lg overflow-hidden border border-gray-200">
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {voterPositions.map(({ voter, position, hasRealCoords }, i) => {
          const voteScore = calculateVoteScore(voter)
          const segment = determineSegment(voteScore)
          const partyColor = PARTY_COLORS[voter.party_affiliation] ?? PARTY_COLORS.OTH
          const added = isAlreadyAdded(voter)
          const currentYear = new Date().getFullYear()
          const age = voter.birth_year ? currentYear - parseInt(voter.birth_year) : null

          return (
            <CircleMarker
              key={`${voter.first_name}-${voter.last_name}-${voter.residential_address}-${i}`}
              center={position}
              radius={8}
              pathOptions={{
                color: partyColor,
                fillColor: partyColor,
                fillOpacity: added ? 0.2 : hasRealCoords ? 0.7 : 0.35,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-sm min-w-[200px]">
                  <p className="font-bold text-rally-navy text-base">
                    {voter.first_name} {voter.last_name}
                    {age && <span className="text-gray-400 text-xs ml-1">({age})</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {voter.residential_address}, {voter.city}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span
                      className="text-xs font-bold px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${partyColor}15`,
                        color: partyColor,
                      }}
                    >
                      {voter.party_affiliation}
                    </span>
                    <span
                      className={clsx(
                        'text-xs font-mono font-bold',
                        segment === 'super-voter' && 'text-green-600',
                        segment === 'sometimes-voter' && 'text-yellow-600',
                        segment === 'rarely-voter' && 'text-red-600'
                      )}
                    >
                      {Math.round(voteScore * 100)}% vote score
                    </span>
                  </div>
                  <div className="mt-2">
                    {added ? (
                      <span className="text-[10px] text-green-600 font-bold">
                        Already Added
                      </span>
                    ) : (
                      <button
                        onClick={() => onAddVoter(voter)}
                        className="text-xs bg-rally-navy text-white px-3 py-1 rounded font-bold hover:bg-rally-navy-light transition-colors w-full"
                      >
                        + Add to Contacts
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2 px-1">
        {Object.entries(PARTY_COLORS)
          .filter(([key]) => voters.some(v => v.party_affiliation === key))
          .map(([party, color]) => (
            <div key={party} className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px] text-gray-500 font-medium">{party}</span>
            </div>
          ))}
      </div>
    </div>
  )
}
