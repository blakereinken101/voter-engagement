'use client'

import { useState, useRef, useCallback } from 'react'
import { useAppContext } from '@/context/AppContext'
import { RelationshipCategory, AgeRange, Gender } from '@/types'
import { parseSpreadsheetFile, autoDetectColumns, ColumnMapping, ParsedRow } from '@/lib/csv-parser'
import clsx from 'clsx'

const PERSON_FIELDS = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'city', label: 'City' },
  { key: 'zip', label: 'Zip' },
  { key: 'phone', label: 'Phone' },
  { key: 'age', label: 'Age' },
  { key: 'address', label: 'Address' },
  { key: 'gender', label: 'Gender' },
] as const

type MappableField = typeof PERSON_FIELDS[number]['key']

function sanitizeText(input: string): string {
  return input.replace(/<[^>]*>/g, '').replace(/[^\w\s\-'.(),#]/g, '').trim()
}

function sanitizeNumeric(input: string): string {
  return input.replace(/[^0-9]/g, '')
}

function ageToRange(ageNum: number): AgeRange | undefined {
  if (ageNum < 25) return 'under-25'
  if (ageNum < 35) return '25-34'
  if (ageNum < 45) return '35-44'
  if (ageNum < 55) return '45-54'
  if (ageNum < 65) return '55-64'
  return '65+'
}

export default function BulkImportPanel() {
  const { addPerson } = useAppContext()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    firstName: null,
    lastName: null,
    phone: null,
    city: null,
    zip: null,
    age: null,
    address: null,
    gender: null,
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [showPreview, setShowPreview] = useState(false)

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      setError('Unsupported file type. Please use .csv, .xlsx, or .xls files.')
      return
    }

    setError(null)
    setIsLoading(true)
    setImportedCount(0)

    try {
      const result = await parseSpreadsheetFile(file)

      if (result.headers.length === 0 || result.rows.length === 0) {
        setError('The file appears to be empty or has no data rows.')
        setIsLoading(false)
        return
      }

      setFileName(file.name)
      setHeaders(result.headers)
      setRows(result.rows)

      const detected = autoDetectColumns(result.headers)
      setColumnMapping(detected)
      setShowPreview(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file. Please check the format.')
    } finally {
      setIsLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [])

  const handleMappingChange = useCallback((field: MappableField, headerValue: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: headerValue || null,
    }))
  }, [])

  const getValidRows = useCallback(() => {
    return rows.filter(row => {
      const firstNameCol = columnMapping.firstName
      const lastNameCol = columnMapping.lastName
      if (!firstNameCol) return false
      const firstName = row[firstNameCol]?.trim()
      if (!firstName) return false
      // If we have a separate lastName column, require it
      if (lastNameCol && !row[lastNameCol]?.trim()) {
        // If firstName column might contain full name, that is ok
        if (!firstName.includes(' ')) return false
      }
      return true
    })
  }, [rows, columnMapping])

  const handleImport = useCallback(() => {
    const validRows = getValidRows()
    let count = 0

    for (const row of validRows) {
      const firstNameCol = columnMapping.firstName
      const lastNameCol = columnMapping.lastName

      let firstName = ''
      let lastName = ''

      if (firstNameCol) {
        const raw = row[firstNameCol]?.trim() || ''
        if (lastNameCol && row[lastNameCol]?.trim()) {
          firstName = sanitizeText(raw)
          lastName = sanitizeText(row[lastNameCol].trim())
        } else {
          // Try to split full name
          const parts = raw.split(/\s+/)
          firstName = sanitizeText(parts[0] || '')
          lastName = sanitizeText(parts.slice(1).join(' ') || '')
        }
      }

      if (!firstName || !lastName) continue

      const cityCol = columnMapping.city
      const city = cityCol ? sanitizeText(row[cityCol]?.trim() || '') : undefined

      const zipCol = columnMapping.zip
      const zip = zipCol ? sanitizeNumeric(row[zipCol]?.trim() || '').slice(0, 5) || undefined : undefined

      const phoneCol = columnMapping.phone
      const phone = phoneCol ? row[phoneCol]?.trim().replace(/[^0-9+\-() ]/g, '') || undefined : undefined

      const ageCol = columnMapping.age
      let age: number | undefined
      let ageRange: AgeRange | undefined
      if (ageCol) {
        const ageNum = parseInt(sanitizeNumeric(row[ageCol]?.trim() || ''))
        if (!isNaN(ageNum) && ageNum >= 18 && ageNum <= 120) {
          age = ageNum
          ageRange = ageToRange(ageNum)
        }
      }

      const addressCol = columnMapping.address
      const address = addressCol ? sanitizeText(row[addressCol]?.trim() || '') || undefined : undefined

      const genderCol = columnMapping.gender
      let gender: Gender | undefined
      if (genderCol) {
        const raw = row[genderCol]?.trim().toUpperCase()
        if (raw === 'M' || raw === 'MALE') gender = 'M'
        else if (raw === 'F' || raw === 'FEMALE') gender = 'F'
      }

      addPerson({
        firstName,
        lastName,
        city,
        zip,
        phone,
        age,
        ageRange,
        address,
        gender,
        category: 'who-did-we-miss' as RelationshipCategory,
      })
      count++
    }

    setImportedCount(count)
    if (count > 0) {
      setShowPreview(false)
      setRows([])
      setHeaders([])
      setFileName(null)
      setColumnMapping({
        firstName: null,
        lastName: null,
        phone: null,
        city: null,
        zip: null,
        age: null,
        address: null,
        gender: null,
      })
    }
  }, [rows, columnMapping, addPerson, getValidRows])

  const handleReset = useCallback(() => {
    setShowPreview(false)
    setRows([])
    setHeaders([])
    setFileName(null)
    setError(null)
    setImportedCount(0)
    setColumnMapping({
      firstName: null,
      lastName: null,
      phone: null,
      city: null,
      zip: null,
      age: null,
      address: null,
      gender: null,
    })
  }, [])

  const validCount = getValidRows().length
  const previewRows = rows.slice(0, 10)

  return (
    <div className="p-4 space-y-4">
      {/* File upload area */}
      {!showPreview && (
        <div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className={clsx(
              'w-full flex items-center gap-3 px-4 py-5 border-2 border-dashed rounded-lg transition-all text-left',
              isLoading
                ? 'bg-vc-purple/5 border-vc-purple/10 cursor-wait'
                : 'bg-vc-purple/5 border-vc-purple/20 hover:bg-vc-purple/10 hover:border-vc-purple/30 cursor-pointer'
            )}
          >
            <span className="text-2xl">{isLoading ? '...' : '\u{1F4CA}'}</span>
            <div>
              <p className="text-sm font-bold text-vc-purple">
                {isLoading ? 'Parsing file...' : 'Import CSV or Excel File'}
              </p>
              <p className="text-[10px] text-vc-gray">
                Upload .csv, .xlsx, or .xls with contact data
              </p>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-vc-coral/10 text-vc-coral px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-vc-coral hover:text-vc-coral-light font-bold ml-2"
          >
            x
          </button>
        </div>
      )}

      {/* Success message */}
      {importedCount > 0 && !showPreview && (
        <div className="bg-vc-teal/10 text-vc-teal px-4 py-2 rounded-lg text-sm font-bold">
          Imported {importedCount} {importedCount === 1 ? 'contact' : 'contacts'} to your list!
        </div>
      )}

      {/* Column mapping + preview */}
      {showPreview && (
        <div className="space-y-4 animate-fade-in">
          {/* File info header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-vc-purple">{fileName}</p>
              <p className="text-[10px] text-vc-gray font-mono">
                {rows.length} rows | {headers.length} columns
              </p>
            </div>
            <button
              onClick={handleReset}
              className="text-xs text-vc-gray hover:text-vc-coral transition-colors"
            >
              Clear
            </button>
          </div>

          {/* Column mapping UI */}
          <div className="bg-vc-purple/5 rounded-lg p-3 space-y-2">
            <p className="text-xs font-bold text-vc-gray uppercase tracking-wider mb-2">
              Column Mapping
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PERSON_FIELDS.map(field => (
                <div key={field.key} className="flex items-center gap-2">
                  <label className="text-xs text-vc-slate font-medium w-20 shrink-0 text-right">
                    {field.label}
                  </label>
                  <select
                    value={columnMapping[field.key as keyof ColumnMapping] || ''}
                    onChange={e => handleMappingChange(field.key, e.target.value)}
                    className={clsx(
                      'flex-1 px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-vc-coral',
                      columnMapping[field.key as keyof ColumnMapping]
                        ? 'border-vc-teal/40 bg-vc-teal-pale/30'
                        : 'border-gray-200'
                    )}
                  >
                    <option value="">-- skip --</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {!columnMapping.firstName && (
              <p className="text-[10px] text-vc-coral mt-1">
                A First Name (or Name) column is required to import.
              </p>
            )}
          </div>

          {/* Preview table */}
          <div>
            <p className="text-xs font-bold text-vc-gray uppercase tracking-wider mb-1">
              Preview (first {Math.min(10, rows.length)} rows)
            </p>
            <div className="max-h-[280px] overflow-auto border border-gray-200 rounded-lg">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white border-b border-gray-200">
                  <tr className="text-[10px] font-bold text-vc-gray uppercase tracking-wider">
                    {headers.slice(0, 8).map(h => {
                      const mappedTo = Object.entries(columnMapping).find(([, v]) => v === h)
                      return (
                        <th key={h} className="py-2 px-2 whitespace-nowrap">
                          <span>{h}</span>
                          {mappedTo && (
                            <span className="block text-vc-teal font-mono text-[8px] normal-case">
                              {'\u2192'} {mappedTo[0]}
                            </span>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-vc-purple/[0.02]">
                      {headers.slice(0, 8).map(h => (
                        <td key={h} className="py-1.5 px-2 text-xs text-vc-slate truncate max-w-[140px]">
                          {row[h] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 10 && (
              <p className="text-[10px] text-vc-gray font-mono mt-1">
                ...and {rows.length - 10} more rows
              </p>
            )}
          </div>

          {/* Import button */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <p className="text-xs text-vc-gray font-mono">
              {validCount} of {rows.length} rows ready
              {validCount < rows.length && (
                <span className="text-vc-coral"> ({rows.length - validCount} missing required name)</span>
              )}
            </p>
            <button
              onClick={handleImport}
              disabled={validCount === 0}
              className={clsx(
                'px-5 py-2 rounded text-sm font-bold transition-colors',
                validCount > 0
                  ? 'bg-vc-coral text-white hover:bg-vc-coral-light'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              Import {validCount} {validCount === 1 ? 'Contact' : 'Contacts'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
