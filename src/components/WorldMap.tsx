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
  mood?: string;
}

// Replace countries with moods
const moods = [
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'energetic', label: 'Energetic' },
  { value: 'focused', label: 'Focused' },
  { value: 'chill', label: 'Chill' },
  { value: 'party', label: 'Party' }
]

// Dynamically load Globe on client only
const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

export default function WorldMap({ tag, onTagChange }: WorldMapProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [hoveredStation, setHoveredStation] = useState<Station | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
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
  const [focusedStation, setFocusedStation] = useState<Station | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [ringsData, setRingsData] = useState<any[]>([]);

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
          setStations(uniqueStations.slice(0, 500));
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

  // Add function to focus on station
  const focusOnStation = (station: Station) => {
    if (globeRef.current) {
      const { latitude, longitude } = station;
      globeRef.current.pointOfView({
        lat: latitude,
        lng: longitude,
        altitude: 2
      }, 1000); // 1 second animation
    }
  };

  // Modify handleStationClick to include focus
  const handleStationClick = (station: Station) => {
    setSelectedStation(station);
    setFocusedStation(station);
    focusOnStation(station);
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

  const filteredStations = stations.filter(station => {
    const matchesSearch = station.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMood = !selectedMood || station.mood === selectedMood;
    return matchesSearch && matchesMood;
  });

  const handleRandomStation = () => {
    if (filteredStations.length > 0) {
      const randomIndex = Math.floor(Math.random() * filteredStations.length);
      const randomStation = filteredStations[randomIndex];
      handleStationClick(randomStation);
    }
  };

  // Add click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add function to create ring data for a station
  const createRingData = (station: Station) => {
    return {
      lat: station.latitude,
      lng: station.longitude,
      maxR: 5, // Maximum radius
      propagationSpeed: 2, // Speed of the ripple effect
      repeatPeriod: 1300, // Time between ripples in ms
      color: () => '#4ECDC4',
      altitude: 0.1 // Match the point altitude
    };
  };

  // Update rings when selected station changes
  useEffect(() => {
    if (selectedStation) {
      console.log('Creating ring for station:', selectedStation);
      const ring = createRingData(selectedStation);
      console.log('Ring data:', ring);
      setRingsData([ring]);
    } else {
      setRingsData([]);
    }
  }, [selectedStation]);

  return (
    <div className="relative w-screen h-screen">
      {/* Top Controls Bar */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-4xl px-4">
        <div className="flex flex-col space-y-3">
          {/* Search Bar */}
          <div className="relative" ref={searchRef}>
            <div className="relative bg-black/80 backdrop-blur-sm rounded-full border border-white/20 shadow-lg">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
                placeholder="Search stations..."
                className="w-full bg-transparent text-white px-6 py-3 rounded-full focus:outline-none focus:border-white/40"
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="p-1 rounded-full hover:bg-white/10 transition-colors"
                  title={showFilters ? "Hide Filters" : "Show Filters"}
                >
                  <svg 
                    className={`w-5 h-5 text-white/60 transform transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <svg 
                  className="w-5 h-5 text-white/60" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Search Dropdown */}
            {showSearchDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-black/90 backdrop-blur-sm border border-white/20 rounded-xl shadow-xl p-4 animate-fadeIn">
                <div className="space-y-4">
                  {/* Search Results Preview */}
                  {searchQuery && (
                    <div>
                      <h4 className="text-white/60 text-sm font-medium mb-2">Search Results</h4>
                      <div className="space-y-2">
                        {filteredStations.slice(0, 5).map((station) => (
                          <button
                            key={station.name}
                            onClick={() => {
                              handleStationClick(station);
                              setShowSearchDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg text-sm bg-white/10 text-white hover:bg-white/20 transition-colors"
                          >
                            <div className="flex items-center space-x-2">
                              {station.favicon ? (
                                <img 
                                  src={station.favicon} 
                                  alt={station.name}
                                  className="w-4 h-4 rounded"
                                />
                              ) : (
                                <div className="w-4 h-4 bg-white/10 rounded" />
                              )}
                              <span className="truncate">{station.name}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Filters Bar */}
          {showFilters && (
            <div className="flex space-x-3 animate-fadeIn">
              {/* Genre Selector */}
              <div className="flex-1 bg-black/80 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg p-3">
                <h4 className="text-white/60 text-sm font-medium mb-2">Genres</h4>
                <div className="flex flex-wrap gap-2">
                  {genres.map((genre) => (
                    <button
                      key={genre.value}
                      onClick={() => onTagChange(genre.value)}
                      className={`group relative px-4 py-2 rounded-lg text-sm transition-all duration-300 transform hover:scale-105 ${
                        tag === genre.value
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      <span className="flex items-center space-x-2">
                        {tag === genre.value && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        )}
                        {genre.value === 'jazz' && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        )}
                        {genre.value === 'rock' && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                          </svg>
                        )}
                        {genre.value === 'classical' && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        )}
                        {genre.value === 'electronic' && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        )}
                        {genre.value === 'lofi' && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        )}
                        <span>{genre.label}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood Selector */}
              <div className="flex-1 bg-black/80 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg p-3">
                <h4 className="text-white/60 text-sm font-medium mb-2">Moods</h4>
                <div className="flex flex-wrap gap-2">
                  {moods.map((mood) => (
                    <button
                      key={mood.value}
                      onClick={() => {
                        setSelectedMood(selectedMood === mood.value ? null : mood.value);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm transition-all duration-300 transform hover:scale-105 ${
                        selectedMood === mood.value
                          ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      {mood.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

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
            pointColor={(point: any) => {
              const station = point as Station;
              if (station === focusedStation) return '#FF6B6B';
              if (station === selectedStation) return '#4ECDC4';
              return '#ffffff';
            }}
            pointRadius={(point: any) => {
              const station = point as Station;
              if (station === focusedStation) return dimensions.width < 768 ? 0.6 : 0.8;
              if (station === selectedStation) return dimensions.width < 768 ? 0.4 : 0.6;
              return dimensions.width < 768 ? 0.3 : 0.5;
            }}
            ringsData={ringsData}
            ringColor={() => '#4ECDC4'}
            ringMaxRadius="maxR"
            ringPropagationSpeed="propagationSpeed"
            ringRepeatPeriod="repeatPeriod"
            ringAltitude="altitude"
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
          <div 
            className={`bg-black/90 backdrop-blur-sm border border-white/20 rounded-2xl shadow-xl transition-all duration-500 ease-in-out ${
              isExpanded ? 'w-[500px]' : 'w-[400px]'
            }`}
          >
            <div className="p-4">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  {selectedStation.favicon ? (
                    <img 
                      src={selectedStation.favicon} 
                      alt={selectedStation.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
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
                    onClick={handleRandomStation}
                    className="p-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all duration-300 hover:scale-110"
                    title="Play Random Station"
                  >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <button
                    onClick={togglePlayback}
                    className="p-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transition-all duration-300 hover:scale-110"
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
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-300 hover:scale-110"
                  >
                    <svg 
                      className={`w-6 h-6 text-white transform transition-transform duration-500 ${isExpanded ? 'rotate-180' : ''}`} 
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
                <div className="mt-4 pt-4 border-t border-white/10 animate-fadeIn">
                  <div className="space-y-4">
                    {/* Station Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <h4 className="text-white/60 text-sm font-medium">Station Info</h4>
                        </div>
                        <div className="space-y-1">
                          <p className="text-white text-sm truncate">{selectedStation.name}</p>
                          {selectedStation.country && (
                            <p className="text-white/60 text-sm">{selectedStation.country}</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <h4 className="text-white/60 text-sm font-medium">Stream</h4>
                        </div>
                        <div className="space-y-1">
                          {selectedStation.url_resolved && (
                            <a 
                              href={selectedStation.url_resolved}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-purple-400 hover:text-purple-300 text-sm truncate block"
                            >
                              Open Stream
                            </a>
                          )}
                        </div>
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