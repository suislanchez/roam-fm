'use client';
import 'leaflet/dist/leaflet.css';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { LatLngExpression } from 'leaflet';
import L from 'leaflet';
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
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: #00ff00;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 2px solid #ffffff;
      box-shadow: 0 0 15px #00ff00;
      animation: pulse 2s infinite;
    "></div>
    <style>
      @keyframes pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(0, 255, 0, 0.7);
        }
        70% {
          box-shadow: 0 0 0 10px rgba(0, 255, 0, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(0, 255, 0, 0);
        }
      }
    </style>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
};

export default function WorldMap({ tag }: WorldMapProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [MapComponents, setMapComponents] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
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
    <div className="relative w-screen h-screen">
      {/* Hamburger Menu Button */}
      <button 
        onClick={() => setShowDebug(!showDebug)}
        className="absolute top-4 right-4 z-50 bg-gray-900/80 p-2 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors"
      >
        <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Debug Panel */}
      {showDebug && (
        <div className="absolute top-16 right-4 bg-gray-900/90 text-gray-300 p-4 rounded-lg z-50 text-xs font-mono border border-gray-700 max-w-xs overflow-auto max-h-[80vh]">
          <h3 className="font-bold mb-2 text-green-400">Debug Info</h3>
          <div>Map Loaded: {debugInfo.mapLoaded ? '✅' : '❌'}</div>
          <div>Total Stations: {debugInfo.stationsCount}</div>
          <div>Valid Stations: {debugInfo.validStationsCount}</div>
          <div>Last Update: {debugInfo.lastUpdate}</div>
          <div>Current Tag: {tag}</div>
          <div>Loading: {isLoading ? '✅' : '❌'}</div>
          {error && <div className="text-red-400">Error: {error}</div>}
          <div className="mt-2">
            <div>Sample Station Data:</div>
            <pre className="whitespace-pre-wrap text-gray-400 text-[10px]">
              {JSON.stringify(debugInfo.rawStations, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Loading and Error States */}
      {isLoading && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-900/80 text-green-400 px-4 py-2 rounded-lg z-50">
          Loading stations for {tag}...
        </div>
      )}
      
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-900/80 text-red-400 px-4 py-2 rounded-lg z-50">
          {error}
        </div>
      )}

      {/* Map */}
      {!error && (
        <div className="w-full h-full">
          {!MapComponents ? (
            <div className="flex items-center justify-center h-full text-green-400">Loading map...</div>
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

              return (
                <MapContainer
                  center={center}
                  zoom={2}
                  className="w-full h-full"
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  />
                  {validStations.map((s, i) => (
                    <Marker 
                      key={i} 
                      position={[s.latitude, s.longitude]}
                      icon={createGreenMarkerIcon()}
                      eventHandlers={{
                        click: () => {
                          console.log('Marker clicked:', s);
                        }
                      }}
                    >
                      <Popup className="dark-popup">
                        <div className="p-3 bg-gray-900 text-white rounded-lg">
                          <strong className="text-lg text-green-400">{s.name}</strong>
                          <div className="text-sm text-gray-400 mt-1">
                            Lat: {s.latitude}, Lng: {s.longitude}
                          </div>
                          {s.url_resolved && (
                            <audio controls src={s.url_resolved} className="w-full mt-2 bg-gray-800 rounded" />
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}