/**
 * Simple vCard 3.0/4.0 parser for importing contacts.
 * Handles the most common fields: name, phone, email, address.
 */

export interface ParsedVCardContact {
  firstName: string
  lastName: string
  fullName: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  zip?: string
}

/**
 * Parse a vCard string (possibly containing multiple vCards) into contacts.
 */
export function parseVCards(vcfString: string): ParsedVCardContact[] {
  if (!vcfString || typeof vcfString !== 'string') return []

  const contacts: ParsedVCardContact[] = []

  // Split into individual vCards
  const blocks = vcfString.split(/END:VCARD/i)

  for (const block of blocks) {
    if (!block.includes('BEGIN:VCARD')) continue

    // Unfold continuation lines (RFC 2425: lines starting with space/tab are continuations)
    const unfolded = block.replace(/\r?\n[ \t]/g, '')
    const lines = unfolded.split(/\r?\n/).filter(l => l.trim())

    let firstName = ''
    let lastName = ''
    let fullName = ''
    let phone: string | undefined
    let email: string | undefined
    let address: string | undefined
    let city: string | undefined
    let state: string | undefined
    let zip: string | undefined

    for (const line of lines) {
      const colonIdx = line.indexOf(':')
      if (colonIdx < 0) continue

      const propertyPart = line.slice(0, colonIdx).toUpperCase()
      const value = line.slice(colonIdx + 1).trim()
      // Get the property name (before any parameters like ;TYPE=WORK)
      const propName = propertyPart.split(';')[0]

      switch (propName) {
        case 'FN':
          fullName = sanitize(value)
          break

        case 'N': {
          // N:Last;First;Middle;Prefix;Suffix
          const parts = value.split(';')
          lastName = sanitize(parts[0] || '')
          firstName = sanitize(parts[1] || '')
          break
        }

        case 'TEL':
          if (!phone) {
            // Strip non-phone characters but keep digits, +, -, (, ), spaces
            phone = value.replace(/[^0-9+\-() ]/g, '').trim()
          }
          break

        case 'EMAIL':
          if (!email) {
            email = sanitize(value)
          }
          break

        case 'ADR': {
          // ADR:;;Street;City;State;ZIP;Country
          const addrParts = value.split(';')
          const street = sanitize(addrParts[2] || '')
          const addrCity = sanitize(addrParts[3] || '')
          const addrState = sanitize(addrParts[4] || '')
          const addrZip = sanitize(addrParts[5] || '')

          if (street) address = street
          if (addrCity) city = addrCity
          if (addrState) state = addrState
          if (addrZip) zip = addrZip.replace(/[^0-9]/g, '').slice(0, 5)
          break
        }
      }
    }

    // If we only have FN but no N field, try to split FN into first/last
    if (fullName && !firstName && !lastName) {
      const nameParts = fullName.split(/\s+/)
      firstName = nameParts[0] || ''
      lastName = nameParts.slice(1).join(' ') || ''
    }

    // If we only have N but no FN
    if (!fullName && (firstName || lastName)) {
      fullName = `${firstName} ${lastName}`.trim()
    }

    // Skip contacts without at least a name
    if (!firstName && !lastName) continue

    contacts.push({
      firstName,
      lastName,
      fullName,
      phone,
      email,
      address,
      city,
      state,
      zip,
    })
  }

  return contacts
}

function sanitize(input: string): string {
  return input
    .replace(/\\n/g, ' ')   // vCard escaped newlines
    .replace(/\\,/g, ',')   // vCard escaped commas
    .replace(/\\;/g, ';')   // vCard escaped semicolons
    .replace(/\\\\/g, '\\') // vCard escaped backslashes
    .replace(/<[^>]*>/g, '') // Strip HTML
    .trim()
}
