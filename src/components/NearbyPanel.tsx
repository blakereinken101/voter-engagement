'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useAppContext } from '@/context/AppContext'
import { SafeVoterRecord } from '@/types'
import { calculateVoteScore, determineSegment } from '@/lib/voter-segments'
import campaignConfig from '@/lib/campaign-config'
import clsx from 'clsx'

const NearbyMap = dynamic(() => import('./NearbyMap'), { ssr: false })

function sanitizeInput(input: string): string {
  return input.replace(/<[^>]*>/g, '').replace(/[^\w\s\-'.,#]/g, '').trim().slice(0, 200)
}

export default function NearbyPanel() {
  const { state, addPerson } = useAppContext()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SafeVoterRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [searchInfo, setSearchInfo] = useState<string>('')
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')

  const addedNames = new Set(
    state.personEntries.map(p => `${p.firstName.toLowerCase()}-${p.lastName.toLowerCase()}`)
  )

  function isZipOnly(input: string): boolean {
    return /^\d{5}$/.test(input.trim())
  }

  async function handleSearch(loadMore = false) {
    const cleaned = sanitizeInput(query)
    if (!cleaned) {
      setError('Enter an address or zip code')
      return
    }

    const nextOffset = loadMore ? offset + 50 : 0

    setIsLoading(true)
    setError(null)
    setSearched(true)

    if (!loadMore) {
      setResults([])
      setOffset(0)
      setTotal(0)
      setHasMore(false)
    }

    try {
      const body: Record<string, unknown> = {
        state: campaignConfig.state,
        limit: 50,
        offset: nextOffset,
      }

      if (isZipOnly(cleaned)) {
        body.zip = cleaned
      } else {
        body.address = cleaned
      }

      const res = await fetch('/api/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Search failed')
      }

      const data = await res.json()
      const newVoters: SafeVoterRecord[] = data.voters || []

      if (loadMore) {
        setResults(prev => [...prev, ...newVoters])
      } else {
        setResults(newVoters)
      }

      setOffset(nextOffset)
      setTotal(data.total ?? newVoters.length)
      setHasMore(data.hasMore ?? false)
      setSearchInfo(
        data.address
          ? `Near "${data.address}"${data.zip ? ` (${data.zip})` : ''}`
          : `Near zip ${data.zip}`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setIsLoading(false)
    }
  }

  function handleAddVoter(voter: SafeVoterRecord) {
    const currentYear = new Date().getFullYear()
    const age = voter.birth_year ? currentYear - parseInt(voter.birth_year) : undefined

    addPerson({
      firstName: voter.first_name,
      lastName: voter.last_name,
      address: voter.residential_address,
      city: voter.city,
      zip: voter.zip,
      age,
      gender: voter.gender === 'U' ? '' : voter.gender,
      category: 'neighbors',
    }, voter)  // Pass voter record to auto-confirm match
  }

  function isAlreadyAdded(voter: SafeVoterRecord): boolean {
    return addedNames.has(`${voter.first_name.toLowerCase()}-${voter.last_name.toLowerCase()}`)
  }

  return (
    <div className="p-4 space-y-4">
      {/* Search bar */}
      <div>
        <label className="block text-xs font-bold text-vc-gray uppercase tracking-wider mb-1.5">
          Search by address or zip code
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="123 Main St, Charlotte 28202 — or just a zip"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-vc-coral"
            maxLength={200}
          />
          <button
            onClick={() => handleSearch()}
            disabled={isLoading}
            className="bg-vc-purple text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-vc-purple-light transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {isLoading ? 'Searching...' : 'Search Nearby'}
          </button>
        </div>
        <p className="text-[10px] text-vc-gray mt-1">Press Enter to search</p>
      </div>

      {error && (
        <p className="text-vc-coral text-sm">{error}</p>
      )}

      {searched && !isLoading && results.length === 0 && !error && (
        <p className="text-vc-gray text-sm">No voters found nearby. Try a different address or zip code.</p>
      )}

      {results.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-vc-gray font-mono">
              Showing {results.length} of {total} voters | {searchInfo}
            </p>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={clsx(
                  'px-3 py-1 text-xs font-bold rounded-md transition-colors',
                  viewMode === 'list'
                    ? 'bg-white text-vc-purple shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={clsx(
                  'px-3 py-1 text-xs font-bold rounded-md transition-colors',
                  viewMode === 'map'
                    ? 'bg-white text-vc-purple shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                Map
              </button>
            </div>
          </div>

          {viewMode === 'list' ? (
            <>
              <div className="max-h-[60vh] overflow-auto border border-gray-200 rounded-lg">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white border-b border-gray-200 z-10">
                    <tr className="text-[10px] font-bold text-vc-gray uppercase tracking-wider">
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-2">Address</th>
                      <th className="py-2 px-2">Party</th>
                      <th className="py-2 px-2 text-center">Vote %</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((voter, i) => {
                      const voteScore = calculateVoteScore(voter)
                      const segment = determineSegment(voteScore)
                      const added = isAlreadyAdded(voter)
                      const segmentColor = segment === 'super-voter' ? 'text-vc-teal' :
                        segment === 'sometimes-voter' ? 'text-vc-gold' : 'text-vc-coral'

                      return (
                        <tr
                          key={i}
                          className={clsx(
                            'border-b border-gray-50 hover:bg-vc-purple/[0.02] transition-colors',
                            added && 'opacity-40'
                          )}
                        >
                          <td className="py-2 px-3">
                            <span className="font-bold text-vc-purple">
                              {voter.first_name} {voter.last_name}
                            </span>
                            {voter.birth_year && (
                              <span className="text-vc-gray text-xs ml-2">
                                ({new Date().getFullYear() - parseInt(voter.birth_year)})
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-xs text-vc-gray max-w-[200px] truncate" title={`${voter.residential_address}, ${voter.city}`}>
                            {voter.residential_address}
                            <span className="text-vc-gray/50 ml-1">{voter.city}</span>
                          </td>
                          <td className="py-2 px-2 text-xs text-vc-gray">
                            {voter.party_affiliation}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className={clsx('font-mono font-bold text-sm', segmentColor)}>
                              {Math.round(voteScore * 100)}%
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            {added ? (
                              <span className="text-[10px] text-vc-teal font-bold">Added</span>
                            ) : (
                              <button
                                onClick={() => handleAddVoter(voter)}
                                className="text-xs bg-vc-purple text-white px-3 py-1.5 rounded-lg font-bold hover:bg-vc-purple-light transition-colors"
                              >
                                + Add
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {hasMore && (
                <button
                  onClick={() => handleSearch(true)}
                  disabled={isLoading}
                  className="w-full mt-3 py-2.5 text-sm font-bold text-vc-purple border border-vc-purple rounded-lg hover:bg-vc-purple hover:text-white transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Loading...' : 'Load Next 50'}
                </button>
              )}
            </>
          ) : (
            <NearbyMap
              voters={results}
              onAddVoter={handleAddVoter}
              isAlreadyAdded={isAlreadyAdded}
              centerLat={35.2271}
              centerLng={-80.8431}
            />
          )}
        </div>
      )}
    </div>
  )
}
