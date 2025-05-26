'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { fetchStationsByTag } from '../utils/fetchStations';

// Add a type interface for WorldMapProps
interface WorldMapProps {
  tag: string;
  onTagChange: (tag: string) => void;
}

interface Station {
  name: string;
  latitude: number;
  longitude: number;
  url_resolved?: string;
  favicon?: string;
  country?: string;
}

// Dynamically load Globe on client only
const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

export default function WorldMap({ tag, onTagChange }: WorldMapProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [hoveredStation, setHoveredStation] = useState<Station | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  const genres = [
    { value: 'jazz', label: 'Jazz' },
    { value: 'rock', label: 'Rock' },
    { value: 'classical', label: 'Classical' },
    { value: 'electronic', label: 'Electronic' },
    { value: 'lofi', label: 'Lofi' }
  ];

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
      globeRef.current.controls().enableZoom = true;
      globeRef.current.controls().enablePan = true;
      globeRef.current.controls().enableRotate = true;
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

  // Add mouse move event listener
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setMousePosition({ x: event.clientX, y: event.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleStationClick = (station: Station) => {
    setSelectedStation(station);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = station.url_resolved || '';
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const filteredStations = stations.filter(station => 
    station.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative w-screen h-screen">
      {/* Hover Info UI */}
      {hoveredStation && (
        <div 
          className="fixed z-50 bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg p-3 shadow-xl pointer-events-none"
          style={{
            left: mousePosition.x + 15,
            top: mousePosition.y + 15,
            maxWidth: '300px'
          }}
        >
          <div className="flex items-center space-x-3">
            {hoveredStation.favicon ? (
              <img 
                src={hoveredStation.favicon} 
                alt={hoveredStation.name}
                className="w-8 h-8 rounded"
              />
            ) : (
              <div className="w-8 h-8 bg-white/10 rounded flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
            )}
            <div>
              <h4 className="text-white font-medium text-sm">{hoveredStation.name}</h4>
              {hoveredStation.country && (
                <p className="text-white/60 text-xs">{hoveredStation.country}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stations..."
            className="w-full bg-black/80 text-white px-4 py-2 rounded-full border border-white/20 focus:outline-none focus:border-white/40"
          />
          <svg 
            className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

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
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-lg z-50">
          Loading stations...
        </div>
      )}
      
      {error && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-lg z-50">
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
            pointsData={filteredStations}
            pointLat="latitude"
            pointLng="longitude"
            pointColor={() => '#ffffff'}
            pointRadius={dimensions.width < 768 ? 0.3 : 0.5}
            onPointClick={(point: any) => {
              console.log('Point clicked:', point);
              handleStationClick(point as Station);
            }}
            onPointHover={(point: any, prevPoint: any) => {
              if (point) {
                setHoveredStation(point as Station);
              } else {
                setHoveredStation(null);
              }
            }}
            enablePointerInteraction={true}
            animateIn={true}
            pointAltitude={0.1}
            pointsMerge={false}
            pointLabel={(point: any) => (point as Station).name}
            pointsTransitionDuration={300}
          />
        </div>
      )}

      {/* Floating Player UI */}
      {selectedStation && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
          <div className={`bg-black/90 backdrop-blur-sm border border-white/20 rounded-2xl shadow-xl transition-all duration-300 ${isExpanded ? 'w-[400px]' : 'w-[400px]'}`}>
            <div className="p-4">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  {selectedStation.favicon ? (
                    <img 
                      src={selectedStation.favicon} 
                      alt={selectedStation.name}
                      className="w-12 h-12 rounded-lg"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <h3 className="text-white font-medium truncate">{selectedStation.name}</h3>
                  {selectedStation.country && (
                    <p className="text-white/60 text-sm truncate">{selectedStation.country}</p>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={togglePlayback}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    {isPlaying ? (
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <svg 
                      className={`w-6 h-6 text-white transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-white/60 text-sm mb-2">Genre</label>
                      <div className="grid grid-cols-2 gap-2">
                        {genres.map((genre) => (
                          <button
                            key={genre.value}
                            onClick={() => onTagChange(genre.value)}
                            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                              tag === genre.value
                                ? 'bg-white text-black'
                                : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                          >
                            {genre.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <audio ref={audioRef} className="hidden" />
        </div>
      )}
    </div>
  );
}