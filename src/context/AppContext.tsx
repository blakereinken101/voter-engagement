'use client'

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'
import { AppState, AppStep, PersonEntry, MatchResult, ActionPlanItem, OutreachMethod, ContactOutcome, SafeVoterRecord } from '@/types'
import { calculateVoteScore, determineSegment } from '@/lib/voter-segments'
import campaignConfig from '@/lib/campaign-config'
import { useAuth } from '@/context/AuthContext'

function generateUserId(): string {
  return `vc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const INITIAL_STATE: AppState = {
  userId: '',
  campaignId: campaignConfig.id,
  selectedState: campaignConfig.state,
  currentStep: 'landing',
  personEntries: [],
  currentCategoryIndex: 0,
  matchResults: [],
  actionPlanState: [],
  isLoading: false,
  error: null,
}

type AppAction =
  | { type: 'SET_STATE'; payload: string }
  | { type: 'SET_STEP'; payload: AppStep }
  | { type: 'ADD_PERSON'; payload: PersonEntry }
  | { type: 'UPDATE_PERSON'; payload: PersonEntry }
  | { type: 'REMOVE_PERSON'; payload: string }
  | { type: 'SET_CATEGORY_INDEX'; payload: number }
  | { type: 'SET_MATCH_RESULTS'; payload: MatchResult[] }
  | { type: 'CONFIRM_MATCH'; payload: { personId: string; voterRecord: SafeVoterRecord } }
  | { type: 'REJECT_MATCH'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'TOGGLE_CONTACTED'; payload: { personId: string; method?: OutreachMethod } }
  | { type: 'SET_OUTREACH_METHOD'; payload: { personId: string; method: OutreachMethod } }
  | { type: 'SET_CONTACT_OUTCOME'; payload: { personId: string; outcome: ContactOutcome } }
  | { type: 'CLEAR_CONTACT'; payload: string }
  | { type: 'UPDATE_ACTION_NOTE'; payload: { personId: string; notes: string } }
  | { type: 'BATCH_MATCH_RESULTS'; payload: MatchResult[] }
  | { type: 'SET_VOLUNTEER_PROSPECT'; payload: { personId: string; isProspect: boolean } }
  | { type: 'SET_SURVEY_RESPONSES'; payload: { personId: string; responses: Record<string, string> } }
  | { type: 'HYDRATE'; payload: Partial<AppState> }
  | { type: 'RESET' }

// Helper: create a stub ActionPlanItem for a person (pre-match outcome support)
function createStubActionItem(personId: string, personEntries: PersonEntry[]): ActionPlanItem | null {
  const person = personEntries.find(p => p.id === personId)
  if (!person) return null
  return {
    matchResult: {
      personEntry: person,
      status: 'pending',
      candidates: [],
    },
    contacted: false,
  }
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, selectedState: action.payload }
    case 'SET_STEP':
      return { ...state, currentStep: action.payload }
    case 'ADD_PERSON':
      return { ...state, personEntries: [...state.personEntries, action.payload] }
    case 'UPDATE_PERSON':
      return { ...state, personEntries: state.personEntries.map(p => p.id === action.payload.id ? action.payload : p) }
    case 'REMOVE_PERSON':
      return {
        ...state,
        personEntries: state.personEntries.filter(p => p.id !== action.payload),
        matchResults: state.matchResults.filter(r => r.personEntry.id !== action.payload),
        actionPlanState: state.actionPlanState.filter(a => a.matchResult.personEntry.id !== action.payload),
      }
    case 'SET_CATEGORY_INDEX':
      return { ...state, currentCategoryIndex: action.payload }
    case 'SET_MATCH_RESULTS': {
      // ALL people enter the action plan — matched and unmatched alike
      // Preserve pre-existing action plan data (pre-match outcomes)
      const items: ActionPlanItem[] = action.payload.map(r => {
        const existing = state.actionPlanState.find(a => a.matchResult.personEntry.id === r.personEntry.id)
        if (existing) {
          return { ...existing, matchResult: r }
        }
        return { matchResult: r, contacted: false }
      })
      return { ...state, matchResults: action.payload, actionPlanState: items }
    }
    case 'CONFIRM_MATCH': {
      const voteScore = calculateVoteScore(action.payload.voterRecord)
      const segment = determineSegment(voteScore)
      const newResults = state.matchResults.map(r =>
        r.personEntry.id === action.payload.personId
          ? { ...r, status: 'confirmed' as const, bestMatch: action.payload.voterRecord, voteScore, segment, userConfirmed: true }
          : r
      )
      const newItems: ActionPlanItem[] = newResults.map(r => {
        const existing = state.actionPlanState.find(a => a.matchResult.personEntry.id === r.personEntry.id)
        return existing ? { ...existing, matchResult: r } : { matchResult: r, contacted: false }
      })
      return { ...state, matchResults: newResults, actionPlanState: newItems }
    }
    case 'REJECT_MATCH': {
      const newResults = state.matchResults.map(r =>
        r.personEntry.id === action.payload
          ? { ...r, status: 'unmatched' as const, bestMatch: undefined, segment: undefined, voteScore: undefined }
          : r
      )
      const newItems: ActionPlanItem[] = newResults.map(r => {
        const existing = state.actionPlanState.find(a => a.matchResult.personEntry.id === r.personEntry.id)
        return existing ? { ...existing, matchResult: r } : { matchResult: r, contacted: false }
      })
      return { ...state, matchResults: newResults, actionPlanState: newItems }
    }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'TOGGLE_CONTACTED': {
      const existingItem = state.actionPlanState.find(a => a.matchResult.personEntry.id === action.payload.personId)
      if (existingItem) {
        return {
          ...state,
          actionPlanState: state.actionPlanState.map(item =>
            item.matchResult.personEntry.id === action.payload.personId
              ? {
                ...item,
                contacted: !item.contacted,
                contactedDate: !item.contacted ? new Date().toISOString() : undefined,
                outreachMethod: !item.contacted ? (action.payload.method ?? item.outreachMethod) : item.outreachMethod,
              }
              : item
          ),
        }
      }
      // Pre-match: create stub action item
      const stub = createStubActionItem(action.payload.personId, state.personEntries)
      if (!stub) return state
      return {
        ...state,
        actionPlanState: [...state.actionPlanState, {
          ...stub,
          contacted: true,
          contactedDate: new Date().toISOString(),
          outreachMethod: action.payload.method,
        }],
      }
    }
    case 'SET_OUTREACH_METHOD': {
      const existingItem2 = state.actionPlanState.find(a => a.matchResult.personEntry.id === action.payload.personId)
      if (existingItem2) {
        return {
          ...state,
          actionPlanState: state.actionPlanState.map(item =>
            item.matchResult.personEntry.id === action.payload.personId
              ? { ...item, outreachMethod: action.payload.method }
              : item
          ),
        }
      }
      const stub2 = createStubActionItem(action.payload.personId, state.personEntries)
      if (!stub2) return state
      return {
        ...state,
        actionPlanState: [...state.actionPlanState, { ...stub2, outreachMethod: action.payload.method }],
      }
    }
    case 'SET_CONTACT_OUTCOME': {
      const existingItem3 = state.actionPlanState.find(a => a.matchResult.personEntry.id === action.payload.personId)
      if (existingItem3) {
        return {
          ...state,
          actionPlanState: state.actionPlanState.map(item =>
            item.matchResult.personEntry.id === action.payload.personId
              ? { ...item, contactOutcome: action.payload.outcome }
              : item
          ),
        }
      }
      // Pre-match: create stub and set outcome immediately
      const stub3 = createStubActionItem(action.payload.personId, state.personEntries)
      if (!stub3) return state
      return {
        ...state,
        actionPlanState: [...state.actionPlanState, { ...stub3, contactOutcome: action.payload.outcome }],
      }
    }
    case 'CLEAR_CONTACT':
      return {
        ...state,
        actionPlanState: state.actionPlanState.map(item =>
          item.matchResult.personEntry.id === action.payload
            ? { ...item, contacted: false, contactedDate: undefined, outreachMethod: undefined, contactOutcome: undefined }
            : item
        ),
      }
    case 'UPDATE_ACTION_NOTE': {
      const existingNote = state.actionPlanState.find(a => a.matchResult.personEntry.id === action.payload.personId)
      if (existingNote) {
        return {
          ...state,
          actionPlanState: state.actionPlanState.map(item =>
            item.matchResult.personEntry.id === action.payload.personId
              ? { ...item, notes: action.payload.notes }
              : item
          ),
        }
      }
      const stubNote = createStubActionItem(action.payload.personId, state.personEntries)
      if (!stubNote) return state
      return {
        ...state,
        actionPlanState: [...state.actionPlanState, { ...stubNote, notes: action.payload.notes }],
      }
    }
    case 'BATCH_MATCH_RESULTS': {
      const mergedResults = [...state.matchResults]
      for (const incoming of action.payload) {
        const idx = mergedResults.findIndex(r => r.personEntry.id === incoming.personEntry.id)
        if (idx >= 0) {
          mergedResults[idx] = incoming
        } else {
          mergedResults.push(incoming)
        }
      }
      const mergedItems: ActionPlanItem[] = mergedResults.map(r => {
        const existing = state.actionPlanState.find(a => a.matchResult.personEntry.id === r.personEntry.id)
        return existing ? { ...existing, matchResult: r } : { matchResult: r, contacted: false }
      })
      return { ...state, matchResults: mergedResults, actionPlanState: mergedItems }
    }
    case 'SET_VOLUNTEER_PROSPECT': {
      const existingVP = state.actionPlanState.find(a => a.matchResult.personEntry.id === action.payload.personId)
      if (existingVP) {
        return {
          ...state,
          actionPlanState: state.actionPlanState.map(item =>
            item.matchResult.personEntry.id === action.payload.personId
              ? {
                ...item,
                isVolunteerProspect: action.payload.isProspect,
                recruitedDate: action.payload.isProspect ? new Date().toISOString() : undefined,
              }
              : item
          ),
        }
      }
      const stubVP = createStubActionItem(action.payload.personId, state.personEntries)
      if (!stubVP) return state
      return {
        ...state,
        actionPlanState: [...state.actionPlanState, {
          ...stubVP,
          isVolunteerProspect: action.payload.isProspect,
          recruitedDate: action.payload.isProspect ? new Date().toISOString() : undefined,
        }],
      }
    }
    case 'SET_SURVEY_RESPONSES': {
      const existingSR = state.actionPlanState.find(a => a.matchResult.personEntry.id === action.payload.personId)
      if (existingSR) {
        return {
          ...state,
          actionPlanState: state.actionPlanState.map(item =>
            item.matchResult.personEntry.id === action.payload.personId
              ? { ...item, surveyResponses: action.payload.responses }
              : item
          ),
        }
      }
      const stubSR = createStubActionItem(action.payload.personId, state.personEntries)
      if (!stubSR) return state
      return {
        ...state,
        actionPlanState: [...state.actionPlanState, { ...stubSR, surveyResponses: action.payload.responses }],
      }
    }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'HYDRATE':
      return { ...state, ...action.payload }
    case 'RESET':
      return { ...INITIAL_STATE, userId: state.userId }
    default:
      return state
  }
}

const STORAGE_KEY = `threshold-${campaignConfig.id}`
const STORAGE_VERSION = 1

interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  addPerson: (person: Omit<PersonEntry, 'id'>, autoMatchVoter?: SafeVoterRecord) => void
  confirmMatch: (personId: string, voterRecord: SafeVoterRecord) => void
  rejectMatch: (personId: string) => void
  toggleContacted: (personId: string, method?: OutreachMethod) => void
  setOutreachMethod: (personId: string, method: OutreachMethod) => void
  setContactOutcome: (personId: string, outcome: ContactOutcome) => void
  clearContact: (personId: string) => void
  updateNote: (personId: string, notes: string) => void
  runMatching: () => Promise<void>
  runMatchingForUnmatched: () => Promise<void>
  setVolunteerProspect: (personId: string, isProspect: boolean) => void
  setSurveyResponses: (personId: string, responses: Record<string, string>) => void
  removePerson: (personId: string) => void
}

const AppContext = createContext<AppContextValue | null>(null)

// Server sync helper (fire-and-forget)
function syncToServer(path: string, method: string, body?: unknown) {
  fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).catch(err => console.warn('[sync] Server sync failed:', err.message))
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE)
  const { user } = useAuth()
  const hydratedFromServer = useRef(false)

  // Hydrate from server when user is authenticated
  useEffect(() => {
    if (user && !hydratedFromServer.current) {
      hydratedFromServer.current = true
      fetch('/api/contacts')
        .then(res => {
          if (!res.ok) throw new Error('Failed to load contacts')
          return res.json()
        })
        .then(data => {
          dispatch({
            type: 'HYDRATE',
            payload: {
              userId: user.id,
              personEntries: data.personEntries || [],
              matchResults: data.matchResults || [],
              actionPlanState: data.actionPlanState || [],
            },
          })
        })
        .catch(() => {
          // Fall back to localStorage
          try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) {
              const { _version, ...data } = JSON.parse(stored)
              dispatch({ type: 'HYDRATE', payload: { ...data, userId: user.id } })
            } else {
              dispatch({ type: 'HYDRATE', payload: { userId: user.id } })
            }
          } catch { /* ignore */ }
        })
    } else if (!user && !hydratedFromServer.current) {
      // No user — hydrate from localStorage (unauthenticated browsing)
      try {
        let stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) {
          stored = sessionStorage.getItem('threshold-state')
          if (stored) {
            localStorage.setItem(STORAGE_KEY, stored)
            sessionStorage.removeItem('threshold-state')
          }
        }
        if (stored) {
          const parsed = JSON.parse(stored)
          const { _version, ...data } = parsed
          dispatch({ type: 'HYDRATE', payload: data })
        }
        if (!stored || !JSON.parse(stored || '{}').userId) {
          dispatch({ type: 'HYDRATE', payload: { userId: generateUserId() } })
        }
      } catch { /* ignore */ }
    }
  }, [user])

  // Persist to localStorage on state change (cache/fallback)
  useEffect(() => {
    if (!state.userId) return
    try {
      const { isLoading, error, ...persistable } = state
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...persistable, _version: STORAGE_VERSION }))
    } catch { /* quota exceeded or private browsing */ }
  }, [state])

  const addPerson = useCallback((person: Omit<PersonEntry, 'id'>, autoMatchVoter?: SafeVoterRecord) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const entry = { ...person, id, phone: person.phone || '203-219-0005', createdAt: Date.now() }
    dispatch({ type: 'ADD_PERSON', payload: entry })
    if (user) syncToServer('/api/contacts', 'POST', entry)

    // Auto-confirm match when voter record is already known (e.g. added from Nearby)
    if (autoMatchVoter) {
      const voteScore = calculateVoteScore(autoMatchVoter)
      const segment = determineSegment(voteScore)
      dispatch({ type: 'CONFIRM_MATCH', payload: { personId: id, voterRecord: autoMatchVoter } })
      if (user) {
        syncToServer(`/api/contacts/${id}/match`, 'PUT', {
          action: 'confirm', voterRecord: autoMatchVoter, voteScore, segment,
        })
      }
    }
  }, [user])

  const confirmMatch = useCallback((personId: string, voterRecord: SafeVoterRecord) => {
    dispatch({ type: 'CONFIRM_MATCH', payload: { personId, voterRecord } })
    if (user) {
      const voteScore = calculateVoteScore(voterRecord)
      const segment = determineSegment(voteScore)
      syncToServer(`/api/contacts/${personId}/match`, 'PUT', {
        action: 'confirm', voterRecord, voteScore, segment,
      })
    }
  }, [user])

  const rejectMatch = useCallback((personId: string) => {
    dispatch({ type: 'REJECT_MATCH', payload: personId })
    if (user) syncToServer(`/api/contacts/${personId}/match`, 'PUT', { action: 'reject' })
  }, [user])

  const toggleContacted = useCallback((personId: string, method?: OutreachMethod) => {
    dispatch({ type: 'TOGGLE_CONTACTED', payload: { personId, method } })
    if (user) {
      const item = state.actionPlanState.find(a => a.matchResult.personEntry.id === personId)
      const newContacted = !item?.contacted
      syncToServer(`/api/contacts/${personId}/action`, 'PUT', {
        contacted: newContacted,
        ...(newContacted && method ? { outreachMethod: method } : {}),
      })
    }
  }, [user, state.actionPlanState])

  const setOutreachMethod = useCallback((personId: string, method: OutreachMethod) => {
    dispatch({ type: 'SET_OUTREACH_METHOD', payload: { personId, method } })
    if (user) syncToServer(`/api/contacts/${personId}/action`, 'PUT', { outreachMethod: method })
  }, [user])

  const setContactOutcome = useCallback((personId: string, outcome: ContactOutcome) => {
    dispatch({ type: 'SET_CONTACT_OUTCOME', payload: { personId, outcome } })
    if (user) syncToServer(`/api/contacts/${personId}/action`, 'PUT', { contactOutcome: outcome })
  }, [user])

  const clearContact = useCallback((personId: string) => {
    dispatch({ type: 'CLEAR_CONTACT', payload: personId })
    if (user) syncToServer(`/api/contacts/${personId}/action`, 'PUT', {
      contacted: false, outreachMethod: null, contactOutcome: null,
    })
  }, [user])

  const updateNote = useCallback((personId: string, notes: string) => {
    dispatch({ type: 'UPDATE_ACTION_NOTE', payload: { personId, notes } })
    if (user) syncToServer(`/api/contacts/${personId}/action`, 'PUT', { notes })
  }, [user])

  const setVolunteerProspect = useCallback((personId: string, isProspect: boolean) => {
    dispatch({ type: 'SET_VOLUNTEER_PROSPECT', payload: { personId, isProspect } })
    if (user) syncToServer(`/api/contacts/${personId}/action`, 'PUT', { isVolunteerProspect: isProspect })
  }, [user])

  const setSurveyResponses = useCallback((personId: string, responses: Record<string, string>) => {
    dispatch({ type: 'SET_SURVEY_RESPONSES', payload: { personId, responses } })
    if (user) syncToServer(`/api/contacts/${personId}/action`, 'PUT', { surveyResponses: responses })
  }, [user])

  const removePerson = useCallback((personId: string) => {
    dispatch({ type: 'REMOVE_PERSON', payload: personId })
    if (user) syncToServer(`/api/contacts?contactId=${personId}`, 'DELETE')
  }, [user])

  const runMatching = useCallback(async () => {
    if (!state.selectedState || state.personEntries.length === 0) return
    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })

    try {
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ people: state.personEntries, state: state.selectedState }),
      })
      if (!response.ok) throw new Error(`Matching failed: ${response.statusText}`)
      const data = await response.json()
      dispatch({ type: 'SET_MATCH_RESULTS', payload: data.results })

      // Sync match results to server
      if (user) {
        for (const result of data.results) {
          syncToServer(`/api/contacts/${result.personEntry.id}/match`, 'PUT', {
            action: 'set_results',
            status: result.status,
            bestMatch: result.bestMatch,
            candidates: result.candidates,
            voteScore: result.voteScore,
            segment: result.segment,
            userConfirmed: result.userConfirmed,
          })
        }
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Matching failed' })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [state.selectedState, state.personEntries, user])

  const runMatchingForUnmatched = useCallback(async () => {
    if (!state.selectedState) return
    const matchedIds = new Set(state.matchResults.map(r => r.personEntry.id))
    const unmatched = state.personEntries.filter(p => !matchedIds.has(p.id))
    if (unmatched.length === 0) return

    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })

    try {
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ people: unmatched, state: state.selectedState }),
      })
      if (!response.ok) throw new Error(`Matching failed: ${response.statusText}`)
      const data = await response.json()
      dispatch({ type: 'BATCH_MATCH_RESULTS', payload: data.results })

      // Sync match results to server
      if (user) {
        for (const result of data.results) {
          syncToServer(`/api/contacts/${result.personEntry.id}/match`, 'PUT', {
            action: 'set_results',
            status: result.status,
            bestMatch: result.bestMatch,
            candidates: result.candidates,
            voteScore: result.voteScore,
            segment: result.segment,
            userConfirmed: result.userConfirmed,
          })
        }
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Matching failed' })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [state.selectedState, state.personEntries, state.matchResults, user])

  return (
    <AppContext.Provider value={{
      state, dispatch, addPerson, confirmMatch, rejectMatch,
      toggleContacted, setOutreachMethod, setContactOutcome, clearContact, updateNote, runMatching, runMatchingForUnmatched, setVolunteerProspect, setSurveyResponses, removePerson
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
