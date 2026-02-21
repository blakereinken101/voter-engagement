'use client'
import { useState, useEffect, useRef } from 'react'
import { useAppContext } from '@/context/AppContext'
import { RelationshipCategory, AgeRange } from '@/types'
import { parseVCards } from '@/lib/vcard-parser'
import BulkImportPanel from './BulkImportPanel'
import clsx from 'clsx'

// Sanitize input text
function sanitize(input: string): string {
  return input.replace(/<[^>]*>/g, '').replace(/[^\w\s\-'.(),#]/g, '').trim()
}

interface ParsedContact {
  firstName: string
  lastName: string
  city: string
  age: number | null
  phone?: string
  email?: string
  valid: boolean
  raw: string
  source: 'paste' | 'vcf' | 'picker'
}

function ageToRange(ageNum: number): AgeRange | undefined {
  if (ageNum < 25) return 'under-25'
  if (ageNum < 35) return '25-34'
  if (ageNum < 45) return '35-44'
  if (ageNum < 55) return '45-54'
  if (ageNum < 65) return '55-64'
  return '65+'
}

function parseContactLine(line: string): ParsedContact {
  const trimmed = line.trim()
  if (!trimmed) return { firstName: '', lastName: '', city: '', age: null, valid: false, raw: line, source: 'paste' }

  // Try "First Last, City, Age" format
  const commaParts = trimmed.split(',').map(s => s.trim())
  if (commaParts.length >= 2) {
    const nameParts = commaParts[0].split(/\s+/)
    const firstName = sanitize(nameParts[0] || '')
    const lastName = sanitize(nameParts.slice(1).join(' ') || '')
    const city = commaParts.length >= 3 ? sanitize(commaParts[1]) : sanitize(commaParts[1])
    const ageStr = commaParts.length >= 3 ? commaParts[2] : ''
    const age = ageStr ? parseInt(ageStr) : null

    return {
      firstName,
      lastName,
      city: commaParts.length >= 3 ? city : '',
      age: age && age >= 18 && age <= 120 ? age : null,
      valid: Boolean(firstName && lastName),
      raw: line,
      source: 'paste',
    }
  }

  // Try space-separated "First Last City Age"
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) {
    const firstName = sanitize(parts[0])
    const lastName = sanitize(parts[1])
    const remaining = parts.slice(2)

    let age: number | null = null
    const cityParts: string[] = []

    for (const part of remaining) {
      const num = parseInt(part)
      if (!isNaN(num) && num >= 18 && num <= 120 && !age) {
        age = num
      } else {
        cityParts.push(sanitize(part))
      }
    }
    const city = cityParts.join(' ')

    return { firstName, lastName, city, age, valid: Boolean(firstName && lastName), raw: line, source: 'paste' }
  }

  return { firstName: sanitize(trimmed), lastName: '', city: '', age: null, valid: false, raw: line, source: 'paste' }
}

// TypeScript type for Contact Picker API (not yet in lib.dom.d.ts)
interface ContactPickerContact {
  name?: string[]
  tel?: string[]
  email?: string[]
  address?: Array<{
    city?: string
    region?: string
    postalCode?: string
    streetAddress?: string
  }>
}

export default function ContactsPanel() {
  const { addPerson } = useAppContext()
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<ParsedContact[]>([])
  const [showParsed, setShowParsed] = useState(false)
  const [addedCount, setAddedCount] = useState(0)
  const [hasContactPicker, setHasContactPicker] = useState(false)
  const [pickerStatus, setPickerStatus] = useState<string>('')
  const [showBulkImport, setShowBulkImport] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check for Contact Picker API support
  useEffect(() => {
    if (typeof window !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window) {
      setHasContactPicker(true)
    }
  }, [])

  // ── Contact Picker API (Android Chrome, iOS with flag) ──
  async function handlePickContacts() {
    try {
      setPickerStatus('Opening contacts...')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any
      const props = await nav.contacts.getProperties()
      const requestedProps = ['name']
      if (props.includes('tel')) requestedProps.push('tel')
      if (props.includes('address')) requestedProps.push('address')

      const contacts: ContactPickerContact[] = await nav.contacts.select(requestedProps, { multiple: true })

      if (!contacts || contacts.length === 0) {
        setPickerStatus('No contacts selected')
        return
      }

      const newParsed: ParsedContact[] = contacts.map(c => {
        const fullName = c.name?.[0] || ''
        const nameParts = fullName.split(/\s+/)
        const firstName = sanitize(nameParts[0] || '')
        const lastName = sanitize(nameParts.slice(1).join(' ') || '')
        const phone = c.tel?.[0]?.replace(/[^0-9+\-() ]/g, '') || undefined
        const addr = c.address?.[0]
        const city = addr?.city || ''
        const zip = addr?.postalCode?.replace(/[^0-9]/g, '').slice(0, 5) || undefined

        return {
          firstName,
          lastName,
          city: sanitize(city),
          age: null,
          phone,
          email: undefined,
          valid: Boolean(firstName && lastName),
          raw: fullName,
          source: 'picker' as const,
        }
      })

      setParsed(newParsed)
      setShowParsed(true)
      setAddedCount(0)
      setPickerStatus(`${newParsed.length} contacts loaded`)
    } catch (err) {
      if (err instanceof Error && err.name === 'InvalidStateError') {
        setPickerStatus('Contact picker was cancelled')
      } else {
        setPickerStatus('Could not access contacts')
        console.warn('Contact Picker error:', err)
      }
    }
  }

  // ── VCF File Import ──
  function handleVcfFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'vcf') {
      setPickerStatus('Please select a .vcf (vCard) file')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const vcfContent = event.target?.result as string
      if (!vcfContent) return

      const vcardContacts = parseVCards(vcfContent)
      const newParsed: ParsedContact[] = vcardContacts.map(c => ({
        firstName: c.firstName,
        lastName: c.lastName,
        city: c.city || '',
        age: null,
        phone: c.phone,
        email: c.email,
        valid: Boolean(c.firstName && c.lastName),
        raw: c.fullName,
        source: 'vcf' as const,
      }))

      setParsed(newParsed)
      setShowParsed(true)
      setAddedCount(0)
      setPickerStatus(`${newParsed.length} contacts imported from ${file.name}`)
    }
    reader.readAsText(file)

    // Reset file input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Paste-based parsing ──
  function handleParse() {
    const lines = rawText.split('\n').filter(l => l.trim())
    const contacts = lines.map(parseContactLine)
    setParsed(contacts)
    setShowParsed(true)
    setAddedCount(0)
  }

  function handleUpdateField(index: number, field: keyof ParsedContact, value: string) {
    setParsed(prev => prev.map((c, i) => {
      if (i !== index) return c
      if (field === 'age') {
        const num = parseInt(value)
        return { ...c, age: isNaN(num) ? null : num, valid: Boolean(c.firstName && c.lastName) }
      }
      return { ...c, [field]: sanitize(value), valid: Boolean(field === 'firstName' ? value : c.firstName) && Boolean(field === 'lastName' ? value : c.lastName) }
    }))
  }

  function handleAddAll() {
    let count = 0
    for (const contact of parsed) {
      if (!contact.valid || !contact.firstName || !contact.lastName) continue
      if (!contact.city || !contact.age) continue

      addPerson({
        firstName: contact.firstName,
        lastName: contact.lastName,
        city: contact.city,
        age: contact.age,
        ageRange: ageToRange(contact.age),
        category: 'who-did-we-miss' as RelationshipCategory,
      })
      count++
    }
    setAddedCount(count)
    if (count > 0) {
      setParsed([])
      setShowParsed(false)
      setRawText('')
    }
  }

  function handleAddSingle(index: number) {
    const contact = parsed[index]
    if (!contact.valid || !contact.firstName || !contact.lastName || !contact.city || !contact.age) return

    addPerson({
      firstName: contact.firstName,
      lastName: contact.lastName,
      city: contact.city,
      age: contact.age,
      ageRange: ageToRange(contact.age),
      category: 'who-did-we-miss' as RelationshipCategory,
    })

    setParsed(prev => prev.filter((_, i) => i !== index))
    setAddedCount(prev => prev + 1)
  }

  const readyCount = parsed.filter(c => c.valid && c.city && c.age).length
  const needsEdit = parsed.filter(c => c.valid && (!c.city || !c.age)).length

  return (
    <div className="p-4 space-y-4">
      {/* Import methods */}
      <div className="space-y-3">
        {/* Contact Picker (Android Chrome + iOS w/ flag) */}
        {hasContactPicker && (
          <button
            onClick={handlePickContacts}
            className="w-full flex items-center gap-3 px-4 py-3 bg-rally-navy/5 border-2 border-dashed border-rally-navy/20 rounded-lg hover:bg-rally-navy/10 hover:border-rally-navy/30 transition-all text-left"
          >
            <span className="text-2xl">📱</span>
            <div>
              <p className="text-sm font-bold text-rally-navy">Pick from Contacts</p>
              <p className="text-[10px] text-rally-slate-light">Select contacts from your phone</p>
            </div>
          </button>
        )}

        {/* VCF File Import */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-3 px-4 py-3 bg-rally-navy/5 border-2 border-dashed border-rally-navy/20 rounded-lg hover:bg-rally-navy/10 hover:border-rally-navy/30 transition-all text-left"
        >
          <span className="text-2xl">📎</span>
          <div>
            <p className="text-sm font-bold text-rally-navy">Import .vcf File</p>
            <p className="text-[10px] text-rally-slate-light">Import contacts from a vCard file</p>
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="text/vcard,.vcf,text/x-vcard"
          onChange={handleVcfFileSelect}
          className="hidden"
        />

        {/* Spreadsheet / Bulk Import */}
        <button
          onClick={() => setShowBulkImport(prev => !prev)}
          className="w-full flex items-center gap-3 px-4 py-3 bg-rally-navy/5 border-2 border-dashed border-rally-navy/20 rounded-lg hover:bg-rally-navy/10 hover:border-rally-navy/30 transition-all text-left"
        >
          <span className="text-2xl">📊</span>
          <div>
            <p className="text-sm font-bold text-rally-navy">Import Spreadsheet</p>
            <p className="text-[10px] text-rally-slate-light">Import from CSV or Excel files</p>
          </div>
        </button>

        {showBulkImport && <BulkImportPanel />}

        {/* Status message */}
        {pickerStatus && (
          <p className="text-xs text-rally-slate-light font-mono px-1">{pickerStatus}</p>
        )}
      </div>

      {/* Paste area */}
      <div>
        <label className="block text-xs font-bold text-rally-slate-light uppercase tracking-wider mb-1">
          Or paste contacts (one per line)
        </label>
        <textarea
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          placeholder={"John Smith, Raleigh, 34\nJane Doe, Durham, 28\nBob Jones, Charlotte, 45"}
          className="w-full px-3 py-2 border border-gray-200 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rally-red min-h-[100px] resize-y"
          maxLength={5000}
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-[10px] text-rally-slate-light">
            Format: Name, City, Age (one per line)
          </p>
          <button
            onClick={handleParse}
            disabled={!rawText.trim()}
            className="bg-rally-navy text-white px-5 py-2 rounded text-sm font-bold hover:bg-rally-navy-light transition-colors disabled:opacity-50"
          >
            Parse Contacts
          </button>
        </div>
      </div>

      {/* Success message */}
      {addedCount > 0 && !showParsed && (
        <div className="bg-rally-green/10 text-rally-green px-4 py-2 rounded-lg text-sm font-bold">
          Added {addedCount} {addedCount === 1 ? 'contact' : 'contacts'} to your list!
        </div>
      )}

      {/* Parsed preview */}
      {showParsed && parsed.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-rally-slate-light font-mono">
              {readyCount} ready to add{needsEdit > 0 ? ` | ${needsEdit} need city/age` : ''}
            </p>
            {readyCount > 0 && (
              <button
                onClick={handleAddAll}
                className="bg-rally-red text-white px-4 py-1.5 rounded text-sm font-bold hover:bg-rally-red-light transition-colors"
              >
                Add All ({readyCount})
              </button>
            )}
          </div>

          <div className="max-h-[350px] overflow-auto border border-gray-200 rounded-lg">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white border-b border-gray-200">
                <tr className="text-[10px] font-bold text-rally-slate-light uppercase tracking-wider">
                  <th className="py-2 px-3">First</th>
                  <th className="py-2 px-2">Last</th>
                  <th className="py-2 px-2">City *</th>
                  <th className="py-2 px-2">Age *</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((contact, i) => {
                  const missingCity = !contact.city
                  const missingAge = !contact.age
                  const canAdd = contact.valid && contact.city && contact.age

                  return (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-1.5 px-3">
                        <input
                          type="text"
                          value={contact.firstName}
                          onChange={e => handleUpdateField(i, 'firstName', e.target.value)}
                          className="w-full px-1 py-0.5 border border-transparent hover:border-gray-200 focus:border-rally-red rounded text-xs focus:outline-none"
                          maxLength={50}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={contact.lastName}
                          onChange={e => handleUpdateField(i, 'lastName', e.target.value)}
                          className="w-full px-1 py-0.5 border border-transparent hover:border-gray-200 focus:border-rally-red rounded text-xs focus:outline-none"
                          maxLength={50}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={contact.city}
                          onChange={e => handleUpdateField(i, 'city', e.target.value)}
                          placeholder="Required"
                          className={clsx(
                            'w-full px-1 py-0.5 border rounded text-xs focus:outline-none focus:border-rally-red',
                            missingCity ? 'border-rally-red/50 bg-rally-red/5' : 'border-transparent hover:border-gray-200'
                          )}
                          maxLength={50}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="number"
                          value={contact.age ?? ''}
                          onChange={e => handleUpdateField(i, 'age', e.target.value)}
                          placeholder="Req"
                          className={clsx(
                            'w-16 px-1 py-0.5 border rounded text-xs focus:outline-none focus:border-rally-red',
                            missingAge ? 'border-rally-red/50 bg-rally-red/5' : 'border-transparent hover:border-gray-200'
                          )}
                          min={18}
                          max={120}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        {canAdd ? (
                          <button
                            onClick={() => handleAddSingle(i)}
                            className="text-xs bg-rally-navy text-white px-2 py-0.5 rounded font-bold hover:bg-rally-navy-light transition-colors"
                          >
                            +
                          </button>
                        ) : (
                          <span className="text-[10px] text-rally-red">
                            {!contact.valid ? 'Need name' : 'Fill fields'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
