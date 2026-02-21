import { VoterRecord, VoteValue } from '@/types'
import fs from 'fs'
import path from 'path'

// =============================================
// REAL VOTER DATA LOADER
// =============================================

const voterFileCache = new Map<string, VoterRecord[]>()

function loadRealVoterData(state: string): VoterRecord[] | null {
  if (state !== 'NC') return null

  // Prefer geocoded file, fall back to original
  const geoPath = path.join(process.cwd(), 'data', 'mecklenburg-voters-geo.json')
  const origPath = path.join(process.cwd(), 'data', 'mecklenburg-voters.json')
  const dataPath = fs.existsSync(geoPath) ? geoPath : origPath

  if (!fs.existsSync(dataPath)) {
    console.warn('[voter-data] Real voter data not found at', origPath)
    console.warn('[voter-data] Run: node scripts/process-voter-data.js')
    return null
  }

  const hasGeo = dataPath === geoPath
  console.log(`[voter-data] Loading real Mecklenburg County voter data${hasGeo ? ' (geocoded)' : ''}...`)
  const start = Date.now()
  const raw = fs.readFileSync(dataPath, 'utf-8')
  const data = JSON.parse(raw) as VoterRecord[]
  const elapsed = Date.now() - start
  console.log(`[voter-data] Loaded ${data.length.toLocaleString()} real voter records in ${elapsed}ms`)
  return data
}

export function getVoterFile(state: string): VoterRecord[] {
  const key = state.toUpperCase()
  if (voterFileCache.has(key)) return voterFileCache.get(key)!

  // Try loading real data first
  const realData = loadRealVoterData(key)
  if (realData) {
    voterFileCache.set(key, realData)
    return realData
  }

  // Fall back to mock data for non-NC states
  const mockData = generateMockVoterFile(key, 750)
  voterFileCache.set(key, mockData)
  return mockData
}

// =============================================
// MOCK DATA GENERATOR (fallback for non-NC states)
// =============================================

class SeededRandom {
  private seed: number
  constructor(seed: number) { this.seed = seed }
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0xffffffff
    return (this.seed >>> 0) / 0xffffffff
  }
  pick<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length)] }
  int(min: number, max: number): number { return Math.floor(this.next() * (max - min + 1)) + min }
}

const FIRST_NAMES_M = ['James', 'Robert', 'John', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Kenneth', 'Joshua', 'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Edward', 'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin', 'Samuel', 'Raymond', 'Frank', 'Gregory', 'Alexander', 'Patrick', 'Jack', 'Dennis', 'Jerry']

const FIRST_NAMES_F = ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Dorothy', 'Kimberly', 'Emily', 'Donna', 'Michelle', 'Carol', 'Amanda', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura', 'Cynthia', 'Kathleen', 'Amy', 'Angela', 'Shirley', 'Anna', 'Brenda', 'Pamela', 'Emma', 'Nicole', 'Helen', 'Samantha', 'Katherine', 'Christine', 'Debra', 'Rachel', 'Carolyn', 'Janet', 'Catherine', 'Maria', 'Heather']

const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes']

const CITIES_BY_STATE: Record<string, string[]> = {
  AL: ['Birmingham', 'Montgomery', 'Huntsville', 'Mobile', 'Tuscaloosa'],
  AK: ['Anchorage', 'Fairbanks', 'Juneau', 'Sitka', 'Ketchikan'],
  AZ: ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale', 'Glendale', 'Tempe'],
  AR: ['Little Rock', 'Fort Smith', 'Fayetteville', 'Springdale', 'Jonesboro'],
  CA: ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento', 'San Jose', 'Oakland', 'Long Beach', 'Fresno'],
  CO: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Boulder', 'Lakewood'],
  CT: ['Hartford', 'New Haven', 'Stamford', 'Bridgeport', 'Waterbury'],
  DE: ['Wilmington', 'Dover', 'Newark', 'Middletown', 'Smyrna'],
  FL: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'St. Petersburg', 'Fort Lauderdale', 'Tallahassee'],
  GA: ['Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Athens', 'Macon'],
  HI: ['Honolulu', 'Hilo', 'Kailua', 'Pearl City', 'Waipahu'],
  ID: ['Boise', 'Nampa', 'Meridian', 'Idaho Falls', 'Pocatello'],
  IL: ['Chicago', 'Aurora', 'Naperville', 'Rockford', 'Springfield', 'Peoria'],
  IN: ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel'],
  IA: ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City', 'Iowa City'],
  KS: ['Wichita', 'Overland Park', 'Kansas City', 'Olathe', 'Topeka'],
  KY: ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro', 'Covington'],
  LA: ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette', 'Lake Charles'],
  ME: ['Portland', 'Lewiston', 'Bangor', 'South Portland', 'Auburn'],
  MD: ['Baltimore', 'Frederick', 'Rockville', 'Gaithersburg', 'Annapolis'],
  MA: ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell'],
  MI: ['Detroit', 'Grand Rapids', 'Ann Arbor', 'Lansing', 'Flint', 'Kalamazoo'],
  MN: ['Minneapolis', 'Saint Paul', 'Duluth', 'Rochester', 'Bloomington', 'Plymouth', 'Brooklyn Park', 'Maple Grove'],
  MS: ['Jackson', 'Gulfport', 'Hattiesburg', 'Biloxi', 'Meridian'],
  MO: ['Kansas City', 'St. Louis', 'Springfield', 'Columbia', 'Independence'],
  MT: ['Billings', 'Missoula', 'Great Falls', 'Bozeman', 'Helena'],
  NE: ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island', 'Kearney'],
  NV: ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks'],
  NH: ['Manchester', 'Nashua', 'Concord', 'Derry', 'Dover'],
  NJ: ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Trenton'],
  NM: ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe', 'Roswell'],
  NY: ['New York', 'Buffalo', 'Rochester', 'Syracuse', 'Albany'],
  NC: ['Charlotte', 'Raleigh', 'Durham', 'Greensboro', 'Winston-Salem', 'Fayetteville'],
  ND: ['Fargo', 'Bismarck', 'Grand Forks', 'Minot', 'West Fargo'],
  OH: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton'],
  OK: ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow', 'Edmond'],
  OR: ['Portland', 'Salem', 'Eugene', 'Gresham', 'Hillsboro', 'Bend'],
  PA: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading', 'Harrisburg'],
  RI: ['Providence', 'Cranston', 'Warwick', 'Pawtucket', 'East Providence'],
  SC: ['Charleston', 'Columbia', 'Greenville', 'North Charleston', 'Mount Pleasant'],
  SD: ['Sioux Falls', 'Rapid City', 'Aberdeen', 'Brookings', 'Watertown'],
  TN: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville'],
  TX: ['Houston', 'Dallas', 'San Antonio', 'Austin', 'Fort Worth', 'El Paso', 'Arlington'],
  UT: ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan', 'Orem'],
  VT: ['Burlington', 'South Burlington', 'Rutland', 'Barre', 'Montpelier'],
  VA: ['Virginia Beach', 'Norfolk', 'Richmond', 'Arlington', 'Chesapeake'],
  WA: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Olympia'],
  WV: ['Charleston', 'Huntington', 'Morgantown', 'Parkersburg', 'Wheeling'],
  WI: ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine', 'Appleton'],
  WY: ['Cheyenne', 'Casper', 'Laramie', 'Gillette', 'Rock Springs'],
  DC: ['Washington'],
}

const STREET_NAMES = ['Oak', 'Maple', 'Cedar', 'Pine', 'Elm', 'Washington', 'Lake', 'Hill', 'Park', 'Main', 'River', 'Forest', 'Sunset', 'Highland', 'Meadow']
const STREET_TYPES = ['St', 'Ave', 'Blvd', 'Dr', 'Ln', 'Ct', 'Way', 'Rd']
const PARTIES: VoterRecord['party_affiliation'][] = ['DEM', 'REP', 'IND', 'UNR', 'OTH']

const ELECTION_TURNOUT = {
  VH2024G: 0.65,
  VH2022G: 0.45,
  VH2020G: 0.70,
  VH2024P: 0.30,
  VH2022P: 0.20,
  VH2020P: 0.35,
}

function generateVoteHistory(rng: SeededRandom, baseEngagement: number): Record<keyof typeof ELECTION_TURNOUT, VoteValue> {
  const result = {} as Record<keyof typeof ELECTION_TURNOUT, VoteValue>
  for (const [election, baseTurnout] of Object.entries(ELECTION_TURNOUT)) {
    const probability = baseTurnout * baseEngagement
    const roll = rng.next()
    if (roll < probability * 0.1) {
      result[election as keyof typeof ELECTION_TURNOUT] = 'A'
    } else if (roll < probability * 0.15) {
      result[election as keyof typeof ELECTION_TURNOUT] = 'E'
    } else if (roll < probability) {
      result[election as keyof typeof ELECTION_TURNOUT] = 'Y'
    } else {
      result[election as keyof typeof ELECTION_TURNOUT] = 'N'
    }
  }
  return result
}

export function generateMockVoterFile(state: string, count: number = 750): VoterRecord[] {
  const rng = new SeededRandom(state.charCodeAt(0) * 31 + state.charCodeAt(1))
  const cities = CITIES_BY_STATE[state] ?? ['Capital City', 'Riverside', 'Lakewood', 'Hillcrest', 'Maplewood']
  const records: VoterRecord[] = []

  for (let i = 0; i < count; i++) {
    const gender = rng.next() > 0.5 ? 'M' : 'F'
    const firstName = gender === 'M' ? rng.pick(FIRST_NAMES_M) : rng.pick(FIRST_NAMES_F)
    const lastName = rng.pick(LAST_NAMES)
    const city = rng.pick(cities)

    const engagementRoll = rng.next()
    const baseEngagement = engagementRoll < 0.2
      ? rng.next() * 0.3 + 0.7   // super: 0.7-1.0
      : engagementRoll < 0.7
        ? rng.next() * 0.4 + 0.3  // sometimes: 0.3-0.7
        : rng.next() * 0.3        // rarely: 0.0-0.3

    const birthYear = rng.int(1940, 2005)
    const birthMonth = String(rng.int(1, 12)).padStart(2, '0')
    const birthDay = String(rng.int(1, 28)).padStart(2, '0')

    const regYear = Math.max(birthYear + 18, rng.int(1980, 2024))
    const regMonth = String(rng.int(1, 12)).padStart(2, '0')
    const regDay = String(rng.int(1, 28)).padStart(2, '0')

    const voteHistory = generateVoteHistory(rng, baseEngagement)

    records.push({
      voter_id: `${state}-${String(i + 1).padStart(7, '0')}`,
      first_name: firstName,
      last_name: lastName,
      date_of_birth: `${birthYear}-${birthMonth}-${birthDay}`,
      gender: gender as 'M' | 'F',
      residential_address: `${rng.int(100, 9999)} ${rng.pick(STREET_NAMES)} ${rng.pick(STREET_TYPES)}`,
      city,
      state,
      zip: String(rng.int(10000, 99999)),
      party_affiliation: rng.pick(PARTIES),
      registration_date: `${regYear}-${regMonth}-${regDay}`,
      voter_status: rng.next() < 0.88 ? 'Active' : rng.next() < 0.5 ? 'Inactive' : 'Purged',
      ...voteHistory,
    })
  }

  return records
}
