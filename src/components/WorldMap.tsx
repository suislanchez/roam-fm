'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { fetchStationsByTag } from '../utils/fetchStations';

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

// Dynamically load Globe on client only
const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

export default function WorldMap({ tag }: WorldMapProps) {
  const [stations, setStations] = useState<Station[]>([]);
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
  const globeRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0
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
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.3;
    }
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    // Add resize listener
    window.addEventListener('resize', handleResize);
    
    // Initial size
    handleResize();

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-screen h-screen">
      {/* Debug UI */}
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

      {/* 3D Globe */}
      {!error && stations.length > 0 && (
        <div className="w-full h-full">
          <Globe
            ref={globeRef}
            width={dimensions.width}
            height={dimensions.height}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
            backgroundColor="rgba(0,0,0,0)"
            pointsData={stations}
            pointLat="latitude"
            pointLng="longitude"
            pointColor={() => '#00ff00'}
            pointRadius={0.5}
            onPointClick={p => console.log('Globe point clicked:', p)}
            enablePointerInteraction={true}
            animateIn={true}
            pointAltitude={0.1}
            pointRadius={dimensions.width < 768 ? 0.3 : 0.5}
          />
        </div>
      )}
    </div>
  );
}