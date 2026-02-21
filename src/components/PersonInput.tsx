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
      <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-gray-200 animate-fade-in">
        <div className="min-w-0 flex-1">
          <span className="font-bold text-rally-navy">
            {person?.firstName} {person?.lastName}
          </span>
          {(person?.address || person?.city || person?.age || person?.gender || person?.phone) && (
            <span className="text-rally-slate-light font-normal text-xs ml-2">
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
          <button onClick={() => setIsExpanded(true)} className="text-rally-slate-light text-sm hover:text-rally-navy transition-colors">edit</button>
          <button onClick={handleRemove} className="text-rally-red/50 text-sm hover:text-rally-red transition-colors">remove</button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={clsx(
      'rounded-lg p-4 animate-fade-in',
      mode === 'add'
        ? 'bg-rally-navy/5 border-2 border-dashed border-rally-navy/20'
        : 'bg-white border border-gray-200'
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
              'w-full p-2.5 border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rally-red',
              errors.firstName ? 'border-rally-red' : 'border-gray-200'
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
              'w-full p-2.5 border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rally-red',
              errors.lastName ? 'border-rally-red' : 'border-gray-200'
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
          className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rally-red"
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
            className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rally-red"
          />
        </div>
        <input
          type="text"
          placeholder="Zip"
          value={zip}
          onChange={e => setZip(e.target.value)}
          className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rally-red"
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
          className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rally-red"
          min={18}
          max={120}
        />
        <select
          value={gender}
          onChange={e => setGender(e.target.value as Gender)}
          className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rally-red bg-white"
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
          className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rally-red"
          maxLength={15}
        />
        <button
          type="submit"
          className="col-span-2 bg-rally-navy text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-rally-navy-light transition-colors"
        >
          {mode === 'add' ? 'Add Person' : 'Save'}
        </button>
      </div>

      {mode === 'edit' && (
        <div className="flex justify-end mt-2">
          <button type="button" onClick={() => setIsExpanded(false)} className="px-4 py-2 text-rally-slate-light text-sm hover:text-rally-navy transition-colors">
            Cancel
          </button>
        </div>
      )}

      {mode === 'add' && (
        <p className="text-[11px] text-rally-slate-light mt-2">
          The more details you provide, the better we can match. Address and age help the most.
        </p>
      )}
    </form>
  )
}
