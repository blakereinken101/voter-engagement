import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export interface ParsedRow {
  [key: string]: string
}

export interface ColumnMapping {
  firstName: string | null
  lastName: string | null
  phone: string | null
  city: string | null
  zip: string | null
  age: string | null
  address: string | null
  gender: string | null
}

export function parseCSV(file: File): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || []
        resolve({ headers, rows: results.data as ParsedRow[] })
      },
      error: (err: Error) => reject(err),
    })
  })
}

export async function parseExcel(file: File): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: '' })
  const headers = data.length > 0 ? Object.keys(data[0]) : []
  return { headers, rows: data }
}

export async function parseSpreadsheetFile(file: File): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'csv') return parseCSV(file)
  if (ext === 'xlsx' || ext === 'xls') return parseExcel(file)
  throw new Error(`Unsupported file type: .${ext}`)
}

// Auto-detect column mappings from header names
const COLUMN_PATTERNS: Record<keyof ColumnMapping, RegExp[]> = {
  firstName: [/first.?name/i, /^first$/i, /fname/i, /given.?name/i],
  lastName: [/last.?name/i, /^last$/i, /lname/i, /surname/i, /family.?name/i],
  phone: [/phone/i, /tel/i, /mobile/i, /cell/i],
  city: [/city/i, /town/i],
  zip: [/zip/i, /postal/i, /post.?code/i],
  age: [/^age$/i],
  address: [/address/i, /street/i],
  gender: [/gender/i, /sex/i],
}

export function autoDetectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    firstName: null,
    lastName: null,
    phone: null,
    city: null,
    zip: null,
    age: null,
    address: null,
    gender: null,
  }

  for (const header of headers) {
    for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
      if (patterns.some(p => p.test(header)) && !mapping[field as keyof ColumnMapping]) {
        mapping[field as keyof ColumnMapping] = header
      }
    }
  }

  // If no firstName/lastName found, check for a "Name" column
  if (!mapping.firstName && !mapping.lastName) {
    const nameCol = headers.find(h => /^name$/i.test(h) || /^full.?name$/i.test(h))
    if (nameCol) {
      mapping.firstName = nameCol // Will be split later
    }
  }

  return mapping
}
