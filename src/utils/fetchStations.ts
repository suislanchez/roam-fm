// List of Radio Browser API servers to try
const RADIO_BROWSER_SERVERS = [
  'https://de1.api.radio-browser.info',
  'https://fi1.api.radio-browser.info',
  'https://de2.api.radio-browser.info',
  'https://fr1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info'
]

async function tryFetchFromServer(server: string, tag: string) {
  try {
    const res = await fetch(`${server}/json/stations/bytag/${tag}`, {
      // Add a timeout to prevent hanging on slow servers
      signal: AbortSignal.timeout(5000)
    })
    
    if (!res.ok) {
      throw new Error(`Server ${server} returned ${res.status}`)
    }
    
    const data = await res.json()
    return data
  } catch (error) {
    console.warn(`Failed to fetch from ${server}:`, error)
    return null
  }
}

export async function fetchStationsByTag(tag: string) {
  // Try each server in sequence until one works
  for (const server of RADIO_BROWSER_SERVERS) {
    console.log(`Trying server: ${server}`)
    const data = await tryFetchFromServer(server, tag)
    
    if (data) {
      console.log(`Successfully fetched ${data.length} stations from ${server}`)
      return data
    }
  }
  
  // If we get here, all servers failed
  throw new Error('All Radio Browser API servers failed to respond')
}