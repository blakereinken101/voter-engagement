import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
const mockPool = {
  query: mockQuery,
  connect: vi.fn(),
  end: vi.fn(),
}

vi.mock('@/lib/db', () => ({
  getPool: vi.fn(() => mockPool),
  getDb: vi.fn(async () => mockPool),
  logActivity: vi.fn(),
}))

import {
  queryVotersForMatch,
  queryVotersByMetaphone,
  queryVotersByZip,
  getDatasetForCampaign,
} from '../voter-db'

describe('queryVotersForMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })
  })

  it('returns empty for empty last names', async () => {
    const result = await queryVotersForMatch('ds-1', [])
    expect(result).toEqual([])
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('queries with dataset_id and last names', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        voter_id: 'v1', first_name: 'John', last_name: 'Smith',
        date_of_birth: '1990-01-01', gender: 'M',
        residential_address: '123 Main', city: 'Boston', state: 'MA', zip: '02101',
        party_affiliation: 'DEM', registration_date: '2020-01-01', voter_status: 'Active',
        vh2024g: 'Y', vh2022g: '', vh2020g: '', vh2024p: '', vh2022p: '', vh2020p: '',
        lat: null, lng: null,
        congressional_district: '5', state_senate_district: null, state_house_district: null,
      }],
      rowCount: 1,
    })

    const result = await queryVotersForMatch('ds-1', ['smith'])
    expect(result).toHaveLength(1)
    expect(result[0].voter_id).toBe('v1')
    expect(result[0].first_name).toBe('John')

    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('last_name_normalized = ANY($2)')
    expect(params[0]).toBe('ds-1')
    expect(params[1]).toEqual(['smith'])
  })

  it('appends geo filter for congressional district', async () => {
    await queryVotersForMatch('ds-1', ['smith'], { congressional: '5' })

    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('congressional_district = $3')
    expect(params).toEqual(['ds-1', ['smith'], '5'])
  })

  it('handles multi-value geo filter with ANY', async () => {
    await queryVotersForMatch('ds-1', ['smith'], { city: 'Boston,Cambridge' })

    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('city = ANY($3)')
    expect(params[2]).toEqual(['Boston', 'Cambridge'])
  })
})

describe('queryVotersByMetaphone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })
  })

  it('returns empty for empty codes', async () => {
    const result = await queryVotersByMetaphone('ds-1', [])
    expect(result).toEqual([])
  })

  it('filters out empty codes before querying', async () => {
    await queryVotersByMetaphone('ds-1', ['SM0', '', 'XMT'])

    const [, params] = mockQuery.mock.calls[0]
    expect(params[1]).toEqual(['SM0', 'XMT'])
  })
})

describe('queryVotersByZip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })
  })

  it('queries with truncated zip and active filter', async () => {
    await queryVotersByZip('ds-1', '02101-1234', true)

    const [sql, params] = mockQuery.mock.calls[0]
    expect(params[1]).toBe('02101')
    expect(sql).toContain("voter_status = 'Active'")
  })

  it('omits active filter when false', async () => {
    await queryVotersByZip('ds-1', '02101', false)

    const [sql] = mockQuery.mock.calls[0]
    expect(sql).not.toContain("voter_status = 'Active'")
  })
})

describe('getDatasetForCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })
  })

  it('returns null when no dataset found', async () => {
    const result = await getDatasetForCampaign('campaign-1')
    expect(result).toBeNull()
  })

  it('returns dataset with filters', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        dataset_id: 'ds-1',
        filter_congressional: '5',
        filter_state_senate: null,
        filter_state_house: '91',
        filter_city: null,
        filter_zip: null,
      }],
      rowCount: 1,
    })

    const result = await getDatasetForCampaign('campaign-1')
    expect(result).toEqual({
      datasetId: 'ds-1',
      filters: {
        congressional: '5',
        stateSenate: null,
        stateHouse: '91',
        city: null,
        zip: null,
      },
    })
  })
})
