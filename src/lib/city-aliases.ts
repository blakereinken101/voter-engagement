/**
 * Smart city/neighborhood matching for metro areas.
 * Handles borough→city (Queens→NYC), neighborhood→borough (Forest Hills→Queens→NYC),
 * and zip-prefix fallback for when city names differ but zip codes confirm proximity.
 */

// Maps metro-area canonical name → all known neighborhoods/boroughs/aliases
const CITY_ALIASES: Record<string, string[]> = {
  'new york': [
    'manhattan', 'brooklyn', 'queens', 'bronx', 'staten island',
    'forest hills', 'astoria', 'williamsburg', 'harlem', 'flushing',
    'jackson heights', 'ozone park', 'bay ridge', 'bushwick', 'flatbush',
    'park slope', 'long island city', 'corona', 'elmhurst', 'sunset park',
    'east new york', 'bedstuy', 'bed stuy', 'bed-stuy', 'crown heights',
    'prospect heights', 'greenpoint', 'ridgewood', 'woodside', 'sunnyside',
    'kew gardens', 'rego park', 'jamaica', 'bayside', 'whitestone',
    'college point', 'fresh meadows', 'woodhaven', 'richmond hill',
    'south ozone park', 'howard beach', 'far rockaway', 'rockaway',
    'riverdale', 'morrisania', 'mott haven', 'tremont', 'fordham',
    'pelham bay', 'throgs neck', 'castle hill', 'parkchester',
    'washington heights', 'inwood', 'upper east side', 'upper west side',
    'lower east side', 'tribeca', 'soho', 'chelsea', 'gramercy',
    'murray hill', 'midtown', 'hells kitchen', 'east harlem',
    'new york city', 'nyc', 'ny', 'new york ny',
  ],
  'los angeles': [
    'hollywood', 'venice', 'silverlake', 'silver lake', 'echo park',
    'koreatown', 'westwood', 'brentwood', 'encino', 'van nuys',
    'north hollywood', 'noho', 'studio city', 'sherman oaks',
    'tarzana', 'reseda', 'canoga park', 'woodland hills', 'chatsworth',
    'san pedro', 'wilmington', 'harbor city', 'watts', 'south la',
    'south los angeles', 'boyle heights', 'eagle rock', 'highland park',
    'glassell park', 'atwater village', 'los feliz', 'east la',
    'east los angeles', 'la', 'l.a.',
  ],
  'chicago': [
    'wicker park', 'lincoln park', 'hyde park', 'pilsen', 'logan square',
    'lakeview', 'uptown', 'rogers park', 'edgewater', 'andersonville',
    'bridgeport', 'chinatown', 'bronzeville', 'south loop', 'west loop',
    'old town', 'gold coast', 'streeterville', 'river north', 'humboldt park',
    'austin', 'garfield park', 'englewood', 'chatham', 'pullman',
    'beverly', 'mount greenwood', 'edison park', 'norwood park',
  ],
  'houston': [
    'the heights', 'montrose', 'midtown', 'rice village', 'river oaks',
    'memorial', 'galleria', 'upper kirby', 'bellaire', 'meyerland',
    'third ward', 'east end', 'fifth ward', 'spring branch', 'katy',
  ],
  'philadelphia': [
    'fishtown', 'manayunk', 'northern liberties', 'old city',
    'center city', 'south philly', 'north philly', 'west philly',
    'kensington', 'port richmond', 'roxborough', 'chestnut hill',
    'germantown', 'mt airy', 'mount airy', 'university city',
    'fairmount', 'brewerytown', 'point breeze', 'passyunk',
    'philly', 'phila',
  ],
  'phoenix': [
    'arcadia', 'ahwatukee', 'desert ridge', 'south mountain',
    'laveen', 'maryvale', 'north mountain',
  ],
  'san antonio': [
    'alamo heights', 'stone oak', 'medical center', 'southtown',
    'king william',
  ],
  'san diego': [
    'pacific beach', 'ocean beach', 'mission beach', 'la jolla',
    'north park', 'hillcrest', 'university heights', 'normal heights',
    'city heights', 'east village', 'gaslamp', 'old town',
    'point loma', 'clairemont', 'mira mesa', 'rancho bernardo',
  ],
  'dallas': [
    'deep ellum', 'bishop arts', 'uptown', 'oak lawn', 'oak cliff',
    'lakewood', 'lower greenville', 'design district',
  ],
  'san francisco': [
    'soma', 'mission', 'castro', 'haight', 'noe valley', 'bernal heights',
    'sunset', 'richmond district', 'marina', 'pacific heights', 'nob hill',
    'tenderloin', 'north beach', 'chinatown', 'potrero hill',
    'bayview', 'hunters point', 'excelsior', 'outer sunset', 'inner sunset',
    'sf', 's.f.',
  ],
  'seattle': [
    'capitol hill', 'ballard', 'fremont', 'wallingford', 'university district',
    'queen anne', 'beacon hill', 'columbia city', 'rainier beach',
    'west seattle', 'georgetown', 'sodo', 'pioneer square',
  ],
  'denver': [
    'lodo', 'rino', 'capitol hill', 'five points', 'park hill',
    'wash park', 'washington park', 'cherry creek', 'highlands',
    'baker', 'congress park', 'city park',
  ],
  'boston': [
    'back bay', 'south end', 'beacon hill', 'north end', 'charlestown',
    'south boston', 'southie', 'dorchester', 'roxbury', 'jamaica plain',
    'allston', 'brighton', 'fenway', 'east boston', 'eastie',
    'mattapan', 'roslindale', 'west roxbury', 'hyde park',
  ],
  'atlanta': [
    'buckhead', 'midtown', 'virginia highland', 'inman park',
    'old fourth ward', 'east atlanta', 'grant park', 'decatur',
    'west end', 'downtown', 'atl',
  ],
  'detroit': [
    'midtown', 'corktown', 'downtown', 'eastern market',
    'mexicantown', 'rivertown', 'indian village', 'palmer park',
    'university district', 'rosedale park',
  ],
  'miami': [
    'little havana', 'wynwood', 'brickell', 'coconut grove',
    'little haiti', 'overtown', 'liberty city', 'coral way',
    'design district', 'edgewater', 'downtown',
  ],
  'minneapolis': [
    'uptown', 'northeast', 'north loop', 'loring park', 'whittier',
    'powderhorn', 'longfellow', 'nokomis', 'southwest', 'phillips',
  ],
  'portland': [
    'pearl district', 'nw portland', 'se portland', 'ne portland',
    'hawthorne', 'alberta', 'division', 'mississippi', 'sellwood',
    'st johns', 'foster-powell',
  ],
  'washington': [
    'georgetown', 'dupont circle', 'adams morgan', 'capitol hill',
    'columbia heights', 'shaw', 'u street', 'h street', 'petworth',
    'anacostia', 'navy yard', 'foggy bottom', 'dc', 'd.c.',
    'washington dc', 'washington d.c.',
  ],
  'pittsburgh': [
    'squirrel hill', 'shadyside', 'lawrenceville', 'strip district',
    'south side', 'oakland', 'point breeze', 'bloomfield',
    'east liberty', 'highland park', 'brookline', 'dormont',
    'pgh',
  ],
  'raleigh': [
    'north raleigh', 'downtown raleigh', 'five points', 'oakwood',
    'boylan heights', 'cameron village',
  ],
  'charlotte': [
    'noda', 'plaza midwood', 'south end', 'uptown', 'dilworth',
    'myers park', 'elizabeth', 'fourth ward',
  ],
}

// Build a reverse lookup: neighborhood → canonical metro name
const NEIGHBORHOOD_TO_METRO: Map<string, string> = new Map()
for (const [metro, aliases] of Object.entries(CITY_ALIASES)) {
  for (const alias of aliases) {
    NEIGHBORHOOD_TO_METRO.set(alias.toLowerCase(), metro)
  }
  // The metro itself maps to itself
  NEIGHBORHOOD_TO_METRO.set(metro, metro)
}

// Zip prefix (first 3 digits) → metro area. Covers major metros.
const ZIP_TO_METRO: Record<string, string> = {
  // NYC area
  '100': 'new york', '101': 'new york', '102': 'new york', '103': 'new york', '104': 'new york',
  '110': 'new york', '111': 'new york', '112': 'new york', '113': 'new york', '114': 'new york',
  // LA area
  '900': 'los angeles', '901': 'los angeles', '902': 'los angeles', '903': 'los angeles', '904': 'los angeles',
  '910': 'los angeles', '911': 'los angeles', '912': 'los angeles', '913': 'los angeles', '914': 'los angeles',
  // Chicago
  '606': 'chicago', '607': 'chicago', '608': 'chicago',
  // Houston
  '770': 'houston', '771': 'houston', '772': 'houston', '773': 'houston', '774': 'houston', '775': 'houston',
  // Philadelphia
  '190': 'philadelphia', '191': 'philadelphia',
  // Phoenix
  '850': 'phoenix', '851': 'phoenix', '852': 'phoenix', '853': 'phoenix',
  // San Antonio
  '782': 'san antonio',
  // San Diego
  '919': 'san diego', '920': 'san diego', '921': 'san diego',
  // Dallas
  '750': 'dallas', '751': 'dallas', '752': 'dallas', '753': 'dallas',
  // San Francisco
  '941': 'san francisco', '940': 'san francisco',
  // Seattle
  '981': 'seattle', '980': 'seattle',
  // Denver
  '802': 'denver', '800': 'denver', '801': 'denver',
  // Boston
  '021': 'boston', '022': 'boston', '020': 'boston',
  // Atlanta
  '303': 'atlanta', '300': 'atlanta', '301': 'atlanta',
  // Detroit
  '481': 'detroit', '482': 'detroit',
  // Miami
  '331': 'miami', '330': 'miami', '332': 'miami', '333': 'miami',
  // Minneapolis
  '554': 'minneapolis', '553': 'minneapolis',
  // Portland
  '972': 'portland', '970': 'portland', '971': 'portland',
  // DC
  '200': 'washington', '201': 'washington', '202': 'washington', '203': 'washington', '204': 'washington', '205': 'washington',
  // Pittsburgh
  '152': 'pittsburgh', '150': 'pittsburgh', '151': 'pittsburgh',
  // Raleigh
  '276': 'raleigh', '275': 'raleigh', '277': 'raleigh',
  // Charlotte
  '282': 'charlotte', '280': 'charlotte', '281': 'charlotte',
}

/**
 * Resolve a city name to its metro area canonical name.
 * Falls back to zip prefix if city name isn't recognized.
 */
export function getMetroArea(city: string, zip?: string): string | null {
  const normalized = city.toLowerCase().trim()

  // Direct lookup
  const metro = NEIGHBORHOOD_TO_METRO.get(normalized)
  if (metro) return metro

  // Zip prefix fallback
  if (zip && zip.length >= 3) {
    const prefix = zip.slice(0, 3)
    const zipMetro = ZIP_TO_METRO[prefix]
    if (zipMetro) return zipMetro
  }

  return null
}

/**
 * Check if two cities are in the same metro area.
 */
export function citiesMatch(city1: string, city2: string, zip1?: string, zip2?: string): boolean {
  const metro1 = getMetroArea(city1, zip1)
  const metro2 = getMetroArea(city2, zip2)

  if (metro1 && metro2 && metro1 === metro2) return true

  // Exact match fallback
  if (city1.toLowerCase().trim() === city2.toLowerCase().trim()) return true

  return false
}

/**
 * Get a 0–1 city match score.
 * 1.0  = exact city name match
 * 0.95 = same metro area (e.g., Queens + NYC)
 * 0.85 = same metro via zip prefix only
 * 0.5  = same zip prefix but no metro mapping
 * 0.0  = no match at all
 *
 * Also integrates Jaro-Winkler for partial string matching
 * on cities that aren't in our alias table.
 */
export function getCityMatchScore(
  city1: string,
  city2: string,
  zip1?: string,
  zip2?: string,
  jaroWinkler?: (s1: string, s2: string) => number
): number {
  const c1 = city1.toLowerCase().trim()
  const c2 = city2.toLowerCase().trim()

  // Exact string match
  if (c1 === c2) return 1.0

  // Same metro area via alias table
  const metro1 = NEIGHBORHOOD_TO_METRO.get(c1)
  const metro2 = NEIGHBORHOOD_TO_METRO.get(c2)

  if (metro1 && metro2 && metro1 === metro2) return 0.95

  // One is the metro, the other is a neighborhood
  if (metro1 && c2 === metro1) return 0.95
  if (metro2 && c1 === metro2) return 0.95

  // Same zip prefix → likely same area even without alias mapping
  if (zip1 && zip2 && zip1.length >= 3 && zip2.length >= 3) {
    const prefix1 = zip1.slice(0, 3)
    const prefix2 = zip2.slice(0, 3)

    if (prefix1 === prefix2) {
      // Same zip prefix, check if metro helps
      const zipMetro1 = ZIP_TO_METRO[prefix1]
      const zipMetro2 = ZIP_TO_METRO[prefix2]
      if (zipMetro1 && zipMetro2 && zipMetro1 === zipMetro2) return 0.85
      return 0.5 // Same prefix, no metro info — still decent
    }

    // Different prefix but maybe same metro via zip
    const zipMetro1 = ZIP_TO_METRO[prefix1]
    const zipMetro2 = ZIP_TO_METRO[prefix2]
    if (zipMetro1 && zipMetro2 && zipMetro1 === zipMetro2) return 0.80
  }

  // Exact zip match (5-digit) = strong proximity signal
  if (zip1 && zip2 && zip1.trim() === zip2.trim()) return 0.85

  // Fall back to Jaro-Winkler string similarity on the city names themselves
  if (jaroWinkler) {
    const jwScore = jaroWinkler(c1, c2)
    if (jwScore > 0.92) return jwScore * 0.9 // High string similarity (e.g. typos)
    if (jwScore > 0.80) return jwScore * 0.7
  }

  return 0.0
}
