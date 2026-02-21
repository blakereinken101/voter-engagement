'use client'
import { useState } from 'react'
import { useAppContext } from '@/context/AppContext'
import { PersonEntry, RelationshipCategory, AgeRange, Gender } from '@/types'
import clsx from 'clsx'

interface PersonInputProps {
  category: RelationshipCategory
  mode: 'add' | 'edit'
  person?: PersonEntry
}

export default function PersonInput({ category, mode, person }: PersonInputProps) {
  const { addPerson, dispatch } = useAppContext()
  const [firstName, setFirstName] = useState(person?.firstName ?? '')
  const [lastName, setLastName] = useState(person?.lastName ?? '')
  const [address, setAddress] = useState(person?.address ?? '')
  const [city, setCity] = useState(person?.city ?? '')
  const [zip, setZip] = useState(person?.zip ?? '')
  const [age, setAge] = useState(person?.age?.toString() ?? '')
  const [gender, setGender] = useState<Gender>(person?.gender ?? '')
  const [phone, setPhone] = useState(person?.phone ?? '')
  const [isExpanded, setIsExpanded] = useState(mode === 'add')
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({})

  function ageToRange(ageNum: number): AgeRange | undefined {
    if (ageNum < 25) return 'under-25'
    if (ageNum < 35) return '25-34'
    if (ageNum < 45) return '35-44'
    if (ageNum < 55) return '45-54'
    if (ageNum < 65) return '55-64'
    return '65+'
  }

  function validate(): boolean {
    const newErrors: typeof errors = {}
    if (!firstName.trim()) newErrors.firstName = 'Required'
    if (!lastName.trim()) newErrors.lastName = 'Required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const ageNum = age ? parseInt(age) : undefined
    const entry = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      zip: zip.trim() || undefined,
      age: ageNum && ageNum >= 18 && ageNum < 120 ? ageNum : undefined,
      ageRange: ageNum ? ageToRange(ageNum) : undefined,
      gender: (gender || undefined) as Gender | undefined,
      phone: phone.trim() || undefined,
      category,
    }

    if (mode === 'add') {
      addPerson(entry)
      setFirstName('')
      setLastName('')
      setAddress('')
      setCity('')
      setZip('')
      setAge('')
      setGender('')
      setPhone('')
    } else if (person) {
      dispatch({ type: 'UPDATE_PERSON', payload: { ...person, ...entry } })
      setIsExpanded(false)
    }
  }

  function handleRemove() {
    if (person) dispatch({ type: 'REMOVE_PERSON', payload: person.id })
  }

  // Collapsed edit view
  if (mode === 'edit' && !isExpanded) {
    return (
      <div className="flex items-center justify-between glass-card px-4 py-3 animate-fade-in">
        <div className="min-w-0 flex-1">
          <span className="font-bold text-white">
            {person?.firstName} {person?.lastName}
          </span>
          {(person?.address || person?.city || person?.age || person?.gender || person?.phone) && (
            <span className="text-white/40 font-normal text-xs ml-2">
              {[
                person?.address,
                person?.city,
                person?.zip,
                person?.age ? `age ${person.age}` : null,
                person?.gender === 'M' ? 'Male' : person?.gender === 'F' ? 'Female' : null,
                person?.phone,
              ].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
        <div className="flex gap-3 flex-shrink-0 ml-2">
          <button onClick={() => setIsExpanded(true)} className="text-white/40 text-sm hover:text-vc-purple-light transition-colors">edit</button>
          <button onClick={handleRemove} className="text-vc-coral/50 text-sm hover:text-vc-coral transition-colors">remove</button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={clsx(
      'rounded-card p-4 animate-fade-in',
      mode === 'add'
        ? 'border-2 border-dashed border-white/15 bg-white/5'
        : 'glass-card'
    )}>
      {/* Row 1: Name */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <input
            type="text"
            placeholder="First name *"
            value={firstName}
            onChange={e => { setFirstName(e.target.value); setErrors({}) }}
            className={clsx(
              'glass-input w-full p-2.5 rounded-btn text-sm font-medium focus:outline-none focus:ring-2 focus:ring-vc-purple/30',
              errors.firstName && 'border-vc-coral/60'
            )}
            autoFocus={mode === 'add'}
          />
        </div>
        <div>
          <input
            type="text"
            placeholder="Last name *"
            value={lastName}
            onChange={e => { setLastName(e.target.value); setErrors({}) }}
            className={clsx(
              'glass-input w-full p-2.5 rounded-btn text-sm font-medium focus:outline-none focus:ring-2 focus:ring-vc-purple/30',
              errors.lastName && 'border-vc-coral/60'
            )}
          />
        </div>
      </div>

      {/* Row 2: Address */}
      <div className="mb-2">
        <input
          type="text"
          placeholder="Street address (e.g. 1234 Oak St)"
          value={address}
          onChange={e => setAddress(e.target.value)}
          className="glass-input w-full p-2.5 rounded-btn text-sm focus:outline-none focus:ring-2 focus:ring-vc-purple/30"
        />
      </div>

      {/* Row 3: City + Zip */}
      <div className="grid grid-cols-4 gap-2 mb-2">
        <div className="col-span-3">
          <input
            type="text"
            placeholder="City"
            value={city}
            onChange={e => setCity(e.target.value)}
            className="glass-input w-full p-2.5 rounded-btn text-sm focus:outline-none focus:ring-2 focus:ring-vc-purple/30"
          />
        </div>
        <input
          type="text"
          placeholder="Zip"
          value={zip}
          onChange={e => setZip(e.target.value)}
          className="glass-input w-full p-2.5 rounded-btn text-sm focus:outline-none focus:ring-2 focus:ring-vc-purple/30"
          maxLength={5}
        />
      </div>

      {/* Row 4: Age + Gender + Phone + Submit */}
      <div className="grid grid-cols-5 gap-2">
        <input
          type="number"
          placeholder="Age"
          value={age}
          onChange={e => setAge(e.target.value)}
          className="glass-input w-full p-2.5 rounded-btn text-sm focus:outline-none focus:ring-2 focus:ring-vc-purple/30"
          min={18}
          max={120}
        />
        <select
          value={gender}
          onChange={e => setGender(e.target.value as Gender)}
          className="glass-input w-full p-2.5 rounded-btn text-sm focus:outline-none focus:ring-2 focus:ring-vc-purple/30"
        >
          <option value="">Gender (optional)</option>
          <option value="M">Male</option>
          <option value="F">Female</option>
        </select>
        <input
          type="tel"
          placeholder="Phone"
          value={phone}
          onChange={e => {
            const val = e.target.value
            if (/^[\d\-() ]*$/.test(val)) setPhone(val)
          }}
          className="glass-input w-full p-2.5 rounded-btn text-sm focus:outline-none focus:ring-2 focus:ring-vc-purple/30"
          maxLength={15}
        />
        <button
          type="submit"
          className="col-span-2 bg-vc-purple text-white px-4 py-2.5 rounded-btn text-sm font-bold hover:bg-vc-purple-light transition-colors shadow-glow"
        >
          {mode === 'add' ? 'Add Person' : 'Save'}
        </button>
      </div>

      {mode === 'edit' && (
        <div className="flex justify-end mt-2">
          <button type="button" onClick={() => setIsExpanded(false)} className="px-4 py-2 text-white/40 text-sm hover:text-white transition-colors">
            Cancel
          </button>
        </div>
      )}

      {mode === 'add' && (
        <p className="text-[11px] text-white/40 mt-2">
          The more details you provide, the better we can match. Address and age help the most.
        </p>
      )}
    </form>
  )
}
