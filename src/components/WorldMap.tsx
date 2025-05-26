'use client';
import 'leaflet/dist/leaflet.css';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { LatLngExpression } from 'leaflet';
import { fetchStationsByTag } from '../utils/fetchStations';

const center: LatLngExpression = [20, 0];

// Add a type interface for WorldMapProps
interface WorldMapProps {
  tag: string;
}

interface Station {
  name: string;
  latitude: number;
  longitude: number;
  url_resolved?: string;
}

// Custom green marker icon
const createGreenMarkerIcon = () => {
  return {
    className: 'custom-marker',
    html: `<div style="
      background-color: #00ff00;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 3px solid #ffffff;
      box-shadow: 0 0 10px rgba(0,0,0,0.5);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  };
};

export default function WorldMap({ tag }: WorldMapProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [MapComponents, setMapComponents] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState({
    mapLoaded: false,
    stationsCount: 0,
    validStationsCount: 0,
    lastUpdate: new Date().toISOString(),
    rawStations: [] as any[]
  });

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    
    console.log('Fetching stations for tag:', tag);
    fetchStationsByTag(tag)
      .then(data => {
        console.log('Raw API response:', data);
        if (!Array.isArray(data) || data.length === 0) {
          setError('No stations found for this tag');
          setStations([]);
        } else {
          // Log the first few stations to check their structure
          console.log('Sample stations:', data.slice(0, 3));
          
          // Remove duplicates and ensure coordinates are numbers
          const uniqueStations = data.reduce((acc: Station[], current) => {
            // Convert coordinates to numbers if they're strings
            const lat = parseFloat(current.latitude || current.geo_lat);
            const lng = parseFloat(current.longitude || current.geo_long);
            
            const isDuplicate = acc.some(station => 
              station.name === current.name && 
              station.latitude === lat && 
              station.longitude === lng
            );
            
            if (!isDuplicate && !isNaN(lat) && !isNaN(lng)) {
              acc.push({
                ...current,
                latitude: lat,
                longitude: lng
              });
            }
            return acc;
          }, []);

          console.log('Processed stations:', uniqueStations);
          setStations(uniqueStations.slice(0, 10));
          setDebugInfo(prev => ({
            ...prev,
            stationsCount: data.length,
            validStationsCount: uniqueStations.length,
            lastUpdate: new Date().toISOString(),
            rawStations: data.slice(0, 3)
          }));
        }
      })
      .catch(error => {
        console.error('Error fetching stations:', error);
        setError('Failed to load stations. Please try again.');
        setStations([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [tag]);

  useEffect(() => {
    // Dynamically import react-leaflet components on the client
    import('react-leaflet').then((module) => {
      console.log('Map components loaded successfully');
      setMapComponents(module);
      setDebugInfo(prev => ({
        ...prev,
        mapLoaded: true,
        lastUpdate: new Date().toISOString()
      }));
    }).catch(error => {
      console.error('Error loading map components:', error);
      setError('Failed to load map components');
    });

    // Initialize Leaflet marker icon on the client side
    import('leaflet').then((L) => {
      console.log('Leaflet loaded successfully');
      // Set default icon for any markers that might use it
      const defaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });
      L.Marker.prototype.options.icon = defaultIcon;
    });
  }, []);

  return (
    <div className="flex flex-col h-full relative">
      {/* Debug Panel */}
      <div className="absolute top-4 right-4 bg-black/80 text-white p-4 rounded-lg z-50 text-sm font-mono">
        <h3 className="font-bold mb-2">Debug Info</h3>
        <div>Map Loaded: {debugInfo.mapLoaded ? '✅' : '❌'}</div>
        <div>Total Stations: {debugInfo.stationsCount}</div>
        <div>Valid Stations: {debugInfo.validStationsCount}</div>
        <div>Last Update: {debugInfo.lastUpdate}</div>
        <div>Current Tag: {tag}</div>
        <div>Loading: {isLoading ? '✅' : '❌'}</div>
        {error && <div className="text-red-400">Error: {error}</div>}
        <div className="mt-2 text-xs">
          <div>Sample Station Data:</div>
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(debugInfo.rawStations, null, 2)}
          </pre>
        </div>
      </div>

      {/* Loading and Error States */}
      {isLoading && (
        <div className="bg-blue-100 p-4 text-center">
          Loading stations for {tag}...
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 p-4 text-center text-red-700">
          {error}
        </div>
      )}

      {/* Station List */}
      {!isLoading && !error && stations.length > 0 && (
        <div className="bg-gray-50 p-4 border-b">
          <h2 className="text-lg font-semibold mb-2">Found {stations.length} stations:</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {stations.map((station, index) => (
              <div key={index} className="p-2 bg-white rounded shadow">
                <div className="font-medium">{station.name}</div>
                <div className="text-xs text-gray-500">
                  Lat: {station.latitude}, Lng: {station.longitude}
                </div>
                {station.url_resolved && (
                  <audio controls src={station.url_resolved} className="w-full mt-1" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Map */}
      {!error && (
        <div style={{ height: 'calc(100vh - 200px)', width: '100%' }}>
          {!MapComponents ? (
            <div className="text-center p-4">Loading map...</div>
          ) : (
            (() => {
              const { MapContainer, TileLayer, Marker, Popup } = MapComponents;
              
              // Filter out stations with invalid coordinates
              const validStations = stations.filter(
                station => 
                  typeof station.latitude === 'number' && 
                  typeof station.longitude === 'number' &&
                  !isNaN(station.latitude) && 
                  !isNaN(station.longitude) &&
                  station.latitude !== 0 && 
                  station.longitude !== 0
              );

              console.log('Rendering map with stations:', validStations);

              return (
                <MapContainer
                  center={center}
                  zoom={2}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                  />
                  {validStations.map((s, i) => {
                    console.log('Creating marker for station:', s);
                    return (
                      <Marker 
                        key={i} 
                        position={[s.latitude, s.longitude]}
                        eventHandlers={{
                          click: () => {
                            console.log('Marker clicked:', s);
                          }
                        }}
                      >
                        <Popup>
                          <div className="p-2">
                            <strong className="text-lg">{s.name}</strong>
                            <div className="text-sm text-gray-600 mt-1">
                              Lat: {s.latitude}, Lng: {s.longitude}
                            </div>
                            {s.url_resolved && (
                              <audio controls src={s.url_resolved} className="w-full mt-2" />
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}