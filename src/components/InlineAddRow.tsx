'use client'
import { useState, useRef } from 'react'
import { useAppContext } from '@/context/AppContext'
import { RelationshipCategory, AgeRange, Gender } from '@/types'
import { CATEGORIES } from '@/lib/wizard-config'
import clsx from 'clsx'

// Input sanitization — strip anything that isn't a normal character
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

export default function InlineAddRow() {
  const { addPerson } = useAppContext()
  const firstNameRef = useRef<HTMLInputElement>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [city, setCity] = useState('')
  const [age, setAge] = useState('')
  const [phone, setPhone] = useState('203-219-0005')
  const [category, setCategory] = useState<RelationshipCategory>('who-did-we-miss')
  const [showMore, setShowMore] = useState(false)
  const [address, setAddress] = useState('')
  const [zip, setZip] = useState('')
  const [gender, setGender] = useState<Gender>('')
  const [errors, setErrors] = useState<{ firstName?: boolean; lastName?: boolean; city?: boolean; age?: boolean }>({})

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const newErrors: typeof errors = {}
    if (!firstName.trim()) newErrors.firstName = true
    if (!lastName.trim()) newErrors.lastName = true
    if (!city.trim()) newErrors.city = true
    if (!age.trim()) newErrors.age = true
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const ageNum = parseInt(sanitizeNumeric(age))
    if (isNaN(ageNum) || ageNum < 18 || ageNum > 120) {
      setErrors({ age: true })
      return
    }

    addPerson({
      firstName: sanitizeText(firstName),
      lastName: sanitizeText(lastName),
      city: sanitizeText(city),
      age: ageNum,
      ageRange: ageToRange(ageNum),
      phone: phone.trim() || '203-219-0005',
      address: address.trim() ? sanitizeText(address) : undefined,
      zip: zip.trim() ? sanitizeNumeric(zip).slice(0, 5) : undefined,
      gender: (gender || undefined) as Gender | undefined,
      category,
    })

    setFirstName('')
    setLastName('')
    setCity('')
    setAge('')
    setPhone('203-219-0005')
    setAddress('')
    setZip('')
    setGender('')
    setErrors({})
    firstNameRef.current?.focus()
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card p-3">
      <div className="flex gap-2 items-center flex-wrap">
        <input
          ref={firstNameRef}
          type="text"
          placeholder="First name *"
          value={firstName}
          onChange={e => { setFirstName(e.target.value); setErrors(prev => ({ ...prev, firstName: false })) }}
          className={clsx(
            'glass-input px-3 py-2 rounded-btn text-sm font-medium w-32',
            errors.firstName && 'border-vc-coral/60'
          )}
          autoFocus
          maxLength={50}
        />
        <input
          type="text"
          placeholder="Last name *"
          value={lastName}
          onChange={e => { setLastName(e.target.value); setErrors(prev => ({ ...prev, lastName: false })) }}
          className={clsx(
            'glass-input px-3 py-2 rounded-btn text-sm font-medium w-32',
            errors.lastName && 'border-vc-coral/60'
          )}
          maxLength={50}
        />
        <input
          type="text"
          placeholder="City *"
          value={city}
          onChange={e => { setCity(e.target.value); setErrors(prev => ({ ...prev, city: false })) }}
          className={clsx(
            'glass-input px-3 py-2 rounded-btn text-sm font-medium w-28',
            errors.city && 'border-vc-coral/60'
          )}
          maxLength={50}
        />
        <input
          type="number"
          placeholder="Age *"
          value={age}
          onChange={e => { setAge(e.target.value); setErrors(prev => ({ ...prev, age: false })) }}
          className={clsx(
            'glass-input px-3 py-2 rounded-btn text-sm font-medium w-24',
            errors.age && 'border-vc-coral/60'
          )}
          min={18}
          max={120}
        />
        <select
          value={category}
          onChange={e => setCategory(e.target.value as RelationshipCategory)}
          className="glass-input px-3 py-2 rounded-btn text-sm"
        >
          {CATEGORIES.map(c => (
            <option key={c.id} value={c.id}>{c.id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-vc-purple text-white px-5 py-2 rounded-btn text-sm font-bold hover:bg-vc-purple-light transition-colors shadow-glow"
        >
          + Add
        </button>
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          className="text-xs text-white/40 hover:text-white/70 transition-colors py-2"
        >
          {showMore ? '- less' : '+ more'}
        </button>
      </div>

      {showMore && (
        <div className="flex gap-2 items-center flex-wrap mt-2 animate-fade-in">
          <input
            type="tel"
            placeholder="Phone"
            value={phone}
            onChange={e => { if (/^[\d\-() ]*$/.test(e.target.value)) setPhone(e.target.value) }}
            className="glass-input px-3 py-2 rounded-btn text-sm w-36"
            maxLength={15}
          />
          <input
            type="text"
            placeholder="Address"
            value={address}
            onChange={e => setAddress(e.target.value)}
            className="glass-input px-3 py-2 rounded-btn text-sm w-48"
            maxLength={100}
          />
          <input
            type="text"
            placeholder="Zip"
            value={zip}
            onChange={e => setZip(e.target.value)}
            className="glass-input px-3 py-2 rounded-btn text-sm w-20"
            maxLength={5}
          />
          <select
            value={gender}
            onChange={e => setGender(e.target.value as Gender)}
            className="glass-input px-3 py-2 rounded-btn text-sm"
          >
            <option value="">Gender</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </div>
      )}
    </form>
  )
}
