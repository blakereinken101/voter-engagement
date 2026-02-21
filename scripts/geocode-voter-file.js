#!/usr/bin/env node
/**
 * Geocode the Mecklenburg County voter file using the US Census Bureau Batch Geocoder.
 *
 * FAST MODE: Sends multiple smaller batches (1000 each) in parallel for ~5-10x speedup.
 * The Census Geocoder is free, requires no API key. Smaller batches are faster and more reliable.
 *
 * Input:  data/mecklenburg-voters.json (693K+ records)
 * Output: data/mecklenburg-voters-geo.json (same records + lat/lng fields)
 *
 * Usage: node scripts/geocode-voter-file.js
 *        node scripts/geocode-voter-file.js --parallel=5  (customize concurrency)
 *
 * Census Geocoder API:
 *   https://geocoding.geo.census.gov/geocoder/locations/addressbatch
 *   Input CSV format: UniqueID,StreetAddress,City,State,ZIP (no header row)
 *   Max 10,000 records per batch (we use 1,000 for speed + reliability)
 */

const fs = require('fs')
const path = require('path')
const https = require('https')

const DATA_DIR = path.join(__dirname, '..', 'data')
const INPUT_FILE = path.join(DATA_DIR, 'mecklenburg-voters.json')
const OUTPUT_FILE = path.join(DATA_DIR, 'mecklenburg-voters-geo.json')
const CACHE_FILE = path.join(DATA_DIR, 'geocode-cache.json')

// Smaller batches are faster and more reliable than 10K
const BATCH_SIZE = 1000
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 3000

// Parse --parallel=N flag (default: 5 concurrent requests)
const parallelArg = process.argv.find(a => a.startsWith('--parallel='))
const CONCURRENCY = parallelArg ? parseInt(parallelArg.split('=')[1]) || 5 : 5

// ─── Helpers ───────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`)
}

/**
 * Submit a batch of addresses to the Census Geocoder.
 * Returns the raw response CSV text.
 */
function submitBatch(csvContent, retryCount = 0) {
  return new Promise((resolve, reject) => {
    const boundary = '----CensusBatch' + Date.now() + Math.random().toString(36).slice(2)
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="addressFile"; filename="batch.csv"',
      'Content-Type: text/csv',
      '',
      csvContent,
      `--${boundary}`,
      'Content-Disposition: form-data; name="benchmark"',
      '',
      'Public_AR_Current',
      `--${boundary}--`,
      '',
    ].join('\r\n')

    const options = {
      hostname: 'geocoding.geo.census.gov',
      path: '/geocoder/locations/addressbatch',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 90000, // 90s timeout (smaller batches are faster)
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data)
        } else if (retryCount < MAX_RETRIES) {
          setTimeout(() => {
            submitBatch(csvContent, retryCount + 1).then(resolve).catch(reject)
          }, RETRY_DELAY_MS * (retryCount + 1)) // exponential-ish backoff
        } else {
          reject(new Error(`Census API returned status ${res.statusCode} after ${MAX_RETRIES} retries`))
        }
      })
    })

    req.on('timeout', () => {
      req.destroy()
      if (retryCount < MAX_RETRIES) {
        setTimeout(() => {
          submitBatch(csvContent, retryCount + 1).then(resolve).catch(reject)
        }, RETRY_DELAY_MS * (retryCount + 1))
      } else {
        reject(new Error(`Census API timed out after ${MAX_RETRIES} retries`))
      }
    })

    req.on('error', (err) => {
      if (retryCount < MAX_RETRIES) {
        setTimeout(() => {
          submitBatch(csvContent, retryCount + 1).then(resolve).catch(reject)
        }, RETRY_DELAY_MS * (retryCount + 1))
      } else {
        reject(err)
      }
    })

    req.write(body)
    req.end()
  })
}

/**
 * Parse Census Geocoder response CSV.
 * Coords format: "-80.12345,35.67890" (lng,lat — note the order!)
 */
function parseResponse(csvText) {
  const results = new Map()
  const lines = csvText.split('\n')

  for (const line of lines) {
    if (!line.trim()) continue
    const fields = parseCSVLine(line)
    if (fields.length < 6) continue

    const id = fields[0].replace(/"/g, '')
    const matchIndicator = fields[2].replace(/"/g, '').trim()

    if (matchIndicator === 'Match' || matchIndicator === 'Non_Exact') {
      const coords = fields[5].replace(/"/g, '').trim()
      if (coords) {
        const [lngStr, latStr] = coords.split(',')
        const lat = parseFloat(latStr)
        const lng = parseFloat(lngStr)
        if (!isNaN(lat) && !isNaN(lng)) {
          results.set(id, { lat, lng })
        }
      }
    }
  }

  return results
}

function parseCSVLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

function addressKey(address, city, state, zip) {
  return `${address}|${city}|${state}|${zip}`.toLowerCase().trim()
}

/**
 * Process a single batch and return results.
 */
async function processBatch(batchIdx, batch, totalBatches) {
  const csvLines = batch.map(([key, info], idx) => {
    const id = `${batchIdx}-${idx}`
    const addr = info.address.includes(',') ? `"${info.address}"` : info.address
    const city = info.city.includes(',') ? `"${info.city}"` : info.city
    return `${id},${addr},${city},${info.state},${info.zip}`
  })
  const csvContent = csvLines.join('\n')

  const response = await submitBatch(csvContent)
  const results = parseResponse(response)

  // Map results back to address keys
  const batchResults = new Map()
  for (let i = 0; i < batch.length; i++) {
    const [key] = batch[i]
    const id = `${batchIdx}-${i}`
    const coords = results.get(id)
    batchResults.set(key, coords || null)
  }

  return { batchIdx, matched: results.size, total: batch.length, batchResults }
}

/**
 * Run batches with limited concurrency for parallelism.
 */
async function runParallel(batches, concurrency, onBatchDone) {
  let nextIdx = 0
  const totalBatches = batches.length
  const results = []

  async function worker() {
    while (nextIdx < totalBatches) {
      const idx = nextIdx++
      try {
        const result = await processBatch(idx, batches[idx], totalBatches)
        results.push(result)
        onBatchDone(result, idx, totalBatches)
      } catch (err) {
        log(`  ✗ Batch ${idx + 1}/${totalBatches} failed: ${err.message}`)
        // Mark all addresses in failed batch as attempted (null)
        const failedResults = new Map()
        for (const [key] of batches[idx]) {
          failedResults.set(key, null)
        }
        results.push({ batchIdx: idx, matched: 0, total: batches[idx].length, batchResults: failedResults })
      }
    }
  }

  // Launch N workers
  const workers = []
  for (let i = 0; i < Math.min(concurrency, totalBatches); i++) {
    workers.push(worker())
  }
  await Promise.all(workers)

  return results
}

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
  log('=== Threshold Voter File Geocoder (Parallel) ===')
  log(`Batch size: ${BATCH_SIZE} | Concurrency: ${CONCURRENCY}`)
  log('')

  // Load voter file
  log(`Loading voter file: ${INPUT_FILE}`)
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`ERROR: ${INPUT_FILE} not found. Run process-voter-data.js first.`)
    process.exit(1)
  }

  const voters = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'))
  log(`Loaded ${voters.length.toLocaleString()} voter records`)

  // Load cache if it exists (for resuming interrupted runs)
  let cache = new Map()
  if (fs.existsSync(CACHE_FILE)) {
    log(`Loading geocode cache from ${CACHE_FILE}`)
    const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
    cache = new Map(Object.entries(cacheData))
    log(`  ${cache.size.toLocaleString()} cached entries`)
  }

  // Extract unique addresses
  log('Extracting unique addresses...')
  const uniqueAddresses = new Map()

  for (const v of voters) {
    const key = addressKey(v.residential_address, v.city, v.state, v.zip)
    if (!uniqueAddresses.has(key) && !cache.has(key)) {
      uniqueAddresses.set(key, {
        address: v.residential_address,
        city: v.city,
        state: v.state,
        zip: v.zip.slice(0, 5),
      })
    }
  }

  log(`  ${uniqueAddresses.size.toLocaleString()} unique uncached addresses to geocode`)

  if (uniqueAddresses.size === 0) {
    log('All addresses already cached! Skipping geocoding.')
  } else {
    // Build batches of BATCH_SIZE
    const addressList = Array.from(uniqueAddresses.entries())
    const batches = []
    for (let i = 0; i < addressList.length; i += BATCH_SIZE) {
      batches.push(addressList.slice(i, i + BATCH_SIZE))
    }
    log(`  ${batches.length} batches of ${BATCH_SIZE} addresses`)
    log(`  Running ${CONCURRENCY} batches in parallel`)
    log('')

    let totalMatched = 0
    let totalProcessed = 0
    let lastSaveTime = Date.now()
    const startTime = Date.now()

    // Save cache function (throttled to every 5 seconds)
    function saveCache() {
      const cacheObj = {}
      for (const [k, v] of cache) {
        cacheObj[k] = v
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheObj))
      lastSaveTime = Date.now()
    }

    await runParallel(batches, CONCURRENCY, (result, idx, total) => {
      // Merge results into cache
      for (const [key, coords] of result.batchResults) {
        cache.set(key, coords)
      }

      totalMatched += result.matched
      totalProcessed += result.total

      const matchRate = (totalMatched / totalProcessed * 100).toFixed(1)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
      const remaining = totalProcessed > 0
        ? Math.round(((addressList.length - totalProcessed) / totalProcessed) * (Date.now() - startTime) / 1000)
        : '?'
      const completedBatches = Math.floor(totalProcessed / BATCH_SIZE)

      log(`  ✓ Batch done (${totalProcessed.toLocaleString()}/${addressList.length.toLocaleString()}) | ${matchRate}% match | ${elapsed}s elapsed | ~${remaining}s remaining`)

      // Save cache periodically (every 5 seconds)
      if (Date.now() - lastSaveTime > 5000) {
        saveCache()
      }
    })

    // Final cache save
    saveCache()
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    log(`Geocoding complete in ${totalTime}s`)
  }

  // Apply coordinates to voter records
  log('')
  log('Applying coordinates to voter records...')

  let withCoords = 0
  let withoutCoords = 0

  const enrichedVoters = voters.map(v => {
    const key = addressKey(v.residential_address, v.city, v.state, v.zip)
    const coords = cache.get(key)
    if (coords) {
      withCoords++
      return { ...v, lat: coords.lat, lng: coords.lng }
    } else {
      withoutCoords++
      return { ...v, lat: null, lng: null }
    }
  })

  // Write output
  log(`Writing geocoded voter file to ${OUTPUT_FILE}`)
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(enrichedVoters))

  const fileSizeMB = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(1)

  log('')
  log('=== Summary ===')
  log(`Total records:    ${voters.length.toLocaleString()}`)
  log(`With coordinates: ${withCoords.toLocaleString()} (${(withCoords / voters.length * 100).toFixed(1)}%)`)
  log(`Without coords:   ${withoutCoords.toLocaleString()} (${(withoutCoords / voters.length * 100).toFixed(1)}%)`)
  log(`Output file size: ${fileSizeMB} MB`)
  log(`Cache entries:    ${cache.size.toLocaleString()}`)
  log('')
  log('Done! You can now restart the dev server to use geocoded data.')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
