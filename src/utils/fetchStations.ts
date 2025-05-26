export async function fetchStationsByTag(tag: string) {
  try {
    console.log('Fetching stations for tag:', tag);
    const res = await fetch(
      `https://de1.api.radio-browser.info/json/stations/bytag/${tag}`
    );
    
    if (!res.ok) {
      console.error('API Error:', res.status, res.statusText);
      throw new Error(`Radio API error: ${res.status}`);
    }
    
    const data = await res.json();
    console.log(`Found ${data.length} stations for tag "${tag}"`);
    return data;
  } catch (error) {
    console.error('Error fetching stations:', error);
    throw error;
  }
}