'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { fetchStationsByTag } from '../utils/fetchStations';
import * as THREE from 'three';
import { Object3D } from 'three';

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
  tags?: string[];
}

interface ContinentLabel {
  lat: number;
  lng: number;
  text: string;
}

// Dynamically load Globe on client only
const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

// Add custom point rendering component
const StationPoint = ({ station, isPlaying }: { station: Station, isPlaying: boolean }) => {
  return (
    <div className="relative">
      <div className={`w-4 h-4 rounded-full ${isPlaying ? 'bg-blue-500' : 'bg-white'} transition-colors duration-300`} />
      {isPlaying && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center space-x-0.5">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-0.5 h-2 bg-blue-500 animate-sound-wave"
                style={{
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: '0.8s'
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Add this CSS animation to your global styles or create a new style block
const globeStyles = `
  @keyframes sound-wave {
    0%, 100% { height: 2px; }
    50% { height: 8px; }
  }
  .animate-sound-wave {
    animation: sound-wave infinite ease-in-out;
  }
`;

export default function WorldMap({ tag, onTagChange }: WorldMapProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [hoveredStation, setHoveredStation] = useState<Station | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
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

  // Add new state for image loading errors
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const genres = [
    { value: 'jazz', label: 'Jazz', icon: '♫' },
    { value: 'rock', label: 'Rock', icon: '⚡' },
    { value: 'classical', label: 'Classical', icon: '♪' },
    { value: 'electronic', label: 'Electronic', icon: '⌘' },
    { value: 'lofi', label: 'Lofi', icon: '∞' },
    { value: 'pop', label: 'Pop', icon: '★' },
    { value: 'hiphop', label: 'Hip Hop', icon: '♬' },
    { value: 'ambient', label: 'Ambient', icon: '☾' }
  ];

  const moods = [
    { value: 'chill', label: 'Chill', icon: '☁' },
    { value: 'energetic', label: 'Energetic', icon: '⚡' },
    { value: 'relaxing', label: 'Relaxing', icon: '~' },
    { value: 'focus', label: 'Focus', icon: '●' },
    { value: 'party', label: 'Party', icon: '✧' },
    { value: 'romantic', label: 'Romantic', icon: '♥' },
    { value: 'nostalgic', label: 'Nostalgic', icon: '⌛' },
    { value: 'adventurous', label: 'Adventurous', icon: '▲' }
  ];

  // Add state for visible indices
  const [visibleGenreIndex, setVisibleGenreIndex] = useState(0);
  const [visibleMoodIndex, setVisibleMoodIndex] = useState(0);

  // Update the tag change handler
  const handleOptionSelect = (optionValue: string) => {
    onTagChange(optionValue);
  };

  // Get visible options
  const getVisibleGenres = () => {
    const startIndex = visibleGenreIndex * 3;
    return genres.slice(startIndex, startIndex + 3);
  };

  const getVisibleMoods = () => {
    const startIndex = visibleMoodIndex * 3;
    return moods.slice(startIndex, startIndex + 3);
  };

  // Navigation handlers
  const changeGenre = (direction: 'next' | 'prev') => {
    if (direction === 'next') {
      setVisibleGenreIndex((prev) => (prev + 1) % Math.ceil(genres.length / 3));
    } else {
      setVisibleGenreIndex((prev) => (prev - 1 + Math.ceil(genres.length / 3)) % Math.ceil(genres.length / 3));
    }
  };

  const changeMood = (direction: 'next' | 'prev') => {
    if (direction === 'next') {
      setVisibleMoodIndex((prev) => (prev + 1) % Math.ceil(moods.length / 3));
    } else {
      setVisibleMoodIndex((prev) => (prev - 1 + Math.ceil(moods.length / 3)) % Math.ceil(moods.length / 3));
    }
  };

  // 1) Remove the old inline array and replace with a memoized one
  const continentLabels = useMemo<ContinentLabel[]>(() => [
    { lat: 8,   lng: 20,   text: 'AFRICA' },
    { lat: 54,  lng: -105, text: 'NORTH AMERICA' },
    { lat: -15, lng: -60,  text: 'SOUTH AMERICA' },
    { lat: 54,  lng: 15,   text: 'EUROPE' },
    { lat: 34,  lng: 100,  text: 'ASIA' },
    { lat: -25, lng: 133,  text: 'AUSTRALIA' },
    { lat: -82, lng: 0,    text: 'ANTARCTICA' }
  ], []);

  // Add country labels
  const countryLabels = useMemo<ContinentLabel[]>(() => [
    // North America
    { lat: 40, lng: -74, text: 'New York' },
    { lat: 34, lng: -118, text: 'Los Angeles' },
    { lat: 43, lng: -79, text: 'Toronto' },
    { lat: 19, lng: -99, text: 'Mexico City' },
    
    // South America
    { lat: -23, lng: -46, text: 'São Paulo' },
    { lat: -34, lng: -58, text: 'Buenos Aires' },
    { lat: -33, lng: -70, text: 'Santiago' },
    
    // Europe
    { lat: 51, lng: 0, text: 'London' },
    { lat: 48, lng: 2, text: 'Paris' },
    { lat: 52, lng: 13, text: 'Berlin' },
    { lat: 41, lng: 12, text: 'Rome' },
    { lat: 40, lng: -3, text: 'Madrid' },
    
    // Asia
    { lat: 35, lng: 139, text: 'Tokyo' },
    { lat: 31, lng: 121, text: 'Shanghai' },
    { lat: 28, lng: 77, text: 'New Delhi' },
    { lat: 1, lng: 103, text: 'Singapore' },
    
    // Africa
    { lat: 30, lng: 31, text: 'Cairo' },
    { lat: -33, lng: 18, text: 'Cape Town' },
    { lat: 6, lng: 3, text: 'Lagos' },
    
    // Australia
    { lat: -33, lng: 151, text: 'Sydney' },
    { lat: -37, lng: 144, text: 'Melbourne' }
  ], []);

  // Combine continent and country labels
  const allLabels = useMemo(() => [...continentLabels, ...countryLabels], [continentLabels, countryLabels]);

  // Add function to handle image loading errors
  const handleImageError = (stationName: string) => {
    setImageErrors(prev => new Set([...prev, stationName]));
  };

  // Add function to get smart search suggestions
  const getSearchSuggestions = (query: string) => {
    if (!query.trim()) return [];
    
    const searchTerms = query.toLowerCase().split(' ');
    return stations
      .filter(station => {
        // Handle tags that could be string or array
        const tagsText = station.tags 
          ? (Array.isArray(station.tags) 
              ? station.tags.join(' ') 
              : station.tags)
          : '';
        
        const stationText = `${station.name} ${station.country || ''} ${tagsText}`.toLowerCase();
        return searchTerms.every(term => stationText.includes(term));
      })
      .slice(0, 5); // Limit to 5 suggestions
  };

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
            
            // Skip if coordinates are invalid
            if (isNaN(lat) || isNaN(lng)) {
              console.log('Skipping station with invalid coordinates:', current.name);
              return acc;
            }

            // Normalize station name for comparison
            const normalizedName = current.name.toLowerCase().trim();
            
            // Check for duplicates using multiple criteria
            const isDuplicate = acc.some(station => {
              const stationName = station.name.toLowerCase().trim();
              const nameMatch = stationName === normalizedName;
              const locationMatch = Math.abs(station.latitude - lat) < 0.001 && Math.abs(station.longitude - lng) < 0.001;
              const urlMatch = station.url_resolved === current.url_resolved;
              
              // Log duplicate detection for debugging
              if (nameMatch || locationMatch || urlMatch) {
                console.log('Potential duplicate found:', {
                  existing: station.name,
                  new: current.name,
                  nameMatch,
                  locationMatch,
                  urlMatch
                });
              }
              
              // Consider it a duplicate if any two criteria match
              return (nameMatch && locationMatch) || (nameMatch && urlMatch) || (locationMatch && urlMatch);
            });
            
            if (!isDuplicate) {
              acc.push({
                ...current,
                latitude: lat,
                longitude: lng
              });
            } else {
              console.log('Removed duplicate station:', current.name);
            }
            return acc;
          }, []);

          console.log('Processed stations:', uniqueStations);
          setStations(uniqueStations.slice(0, 100));
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

  // Add function to center globe on a station
  const centerGlobeOnStation = (station: Station) => {
    if (globeRef.current) {
      const { latitude, longitude } = station;
      globeRef.current.pointOfView({
        lat: latitude,
        lng: longitude,
        altitude: 2
      }, 1000); // 1000ms animation duration
    }
  };

  // Add function to play random station
  const playRandomStation = () => {
    if (stations.length > 0) {
      const randomIndex = Math.floor(Math.random() * stations.length);
      const randomStation = stations[randomIndex];
      setSelectedStation(randomStation);
      centerGlobeOnStation(randomStation);
      if (audioRef.current) {
        audioRef.current.src = randomStation.url_resolved || '';
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  // Update handleStationClick to include centering
  const handleStationClick = (station: Station) => {
    setSelectedStation(station);
    centerGlobeOnStation(station);
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

  // Add effect to select random station on load
  useEffect(() => {
    if (stations.length > 0 && !selectedStation) {
      const randomIndex = Math.floor(Math.random() * stations.length);
      const randomStation = stations[randomIndex];
      setSelectedStation(randomStation);
      if (audioRef.current) {
        audioRef.current.src = randomStation.url_resolved || '';
      }
    }
  }, [stations]);

  return (
    <div className="relative w-screen h-screen">
      <style>{globeStyles}</style>
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
            {hoveredStation.favicon && !imageErrors.has(hoveredStation.name) ? (
              <img 
                src={hoveredStation.favicon} 
                alt={hoveredStation.name}
                className="w-8 h-8 rounded"
                onError={() => handleImageError(hoveredStation.name)}
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
          
          {/* Search Suggestions */}
          {searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {getSearchSuggestions(searchQuery).map((station, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setSearchQuery(station.name);
                    handleStationClick(station);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-white/10 transition-colors flex items-center space-x-3"
                >
                  {station.favicon && !imageErrors.has(station.name) ? (
                    <img 
                      src={station.favicon} 
                      alt={station.name}
                      className="w-6 h-6 rounded"
                      onError={() => handleImageError(station.name)}
                    />
                  ) : (
                    <div className="w-6 h-6 bg-white/10 rounded flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-grow min-w-0">
                    <div className="text-white truncate">{station.name}</div>
                    {station.country && (
                      <div className="text-white/60 text-xs truncate">{station.country}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
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
            showAtmosphere={true}
            atmosphereColor="rgba(255,255,0,0.1)"
            atmosphereAltitude={0.12}
            pointsData={filteredStations}
            pointLat="latitude"
            pointLng="longitude"
            pointColor={(d: any) => selectedStation?.name === d.name ? '#22c55e' : '#ffffff'}
            pointRadius={dimensions.width < 768 ? 0.3 : 0.5}
            customLayerData={filteredStations}
            customThreeObject={(d: object) => {
              const station = d as Station;
              const isPlaying = selectedStation?.name === station.name;
              return new THREE.Mesh(
                new THREE.SphereGeometry(0.3, 16, 16),
                new THREE.MeshBasicMaterial({
                  color: isPlaying ? '#22c55e' : '#ffffff',
                  transparent: true,
                  opacity: 0.8
                })
              );
            }}
            customThreeObjectUpdate={(obj: Object3D, objData: any) => {
              const station = objData as Station;
              const isPlaying = selectedStation?.name === station.name;
              if (isPlaying) {
                obj.scale.setScalar(1 + Math.sin(Date.now() * 0.003) * 0.2);
                ((obj as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set('#22c55e');
              } else {
                obj.scale.setScalar(1);
                ((obj as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set('#ffffff');
              }
            }}
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
            pointsTransitionDuration={300}
            pointLabel={() => ''}
            labelsData={allLabels}
            labelLat={(d: any) => d.lat}
            labelLng={(d: any) => d.lng}
            labelText={(d: any) => d.text}
            labelSize={(d: any) => continentLabels.includes(d) ? (dimensions.width < 768 ? 1.5 : 2.5) : (dimensions.width < 768 ? 0.8 : 1.2)}
            labelColor={(d: any) => continentLabels.includes(d) ? '#ffffff' : '#cccccc'}
            labelDotRadius={0}
            labelResolution={2}
            labelsTransitionDuration={0}
          />
        </div>
      )}

      {/* Floating Player UI */}
      {selectedStation && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
          {/* Genre Container - Slides down when expanded */}
          <div 
            className={`bg-black/95 backdrop-blur-sm border border-white/20 rounded-2xl shadow-xl transition-all duration-500 ease-in-out transform mb-4 ${
              isExpanded ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'
            }`}
          >
            <div className="w-[600px] p-2">
              <div className="flex justify-between gap-3">
                {/* Genres Section */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white/80 text-[10px] font-medium mb-1.5">Genres</h3>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => changeGenre('prev')}
                      className="p-1 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all duration-300 hover:scale-110 active:scale-95 flex-shrink-0"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    <div className="flex-1 overflow-hidden">
                      <div 
                        className="flex space-x-1.5 transition-transform duration-500 ease-in-out"
                        style={{ transform: `translateX(-${visibleGenreIndex * 100}%)` }}
                      >
                        {genres.map((genre) => (
                          <button
                            key={genre.value}
                            onClick={() => handleOptionSelect(genre.value)}
                            className={`flex-1 px-1.5 py-1 rounded-lg text-[11px] transition-all duration-300 flex items-center justify-center space-x-1 min-w-[calc(33.333%-0.375rem)] ${
                              tag === genre.value
                                ? 'bg-white text-black scale-105'
                                : 'bg-white/10 text-white hover:bg-white/20 hover:scale-105'
                            }`}
                          >
                            <span className="text-base">{genre.icon}</span>
                            <span className="truncate">{genre.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => changeGenre('next')}
                      className="p-1 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all duration-300 hover:scale-110 active:scale-95 flex-shrink-0"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Moods Section */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white/80 text-[10px] font-medium mb-1.5">Moods</h3>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => changeMood('prev')}
                      className="p-1 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all duration-300 hover:scale-110 active:scale-95 flex-shrink-0"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    <div className="flex-1 overflow-hidden">
                      <div 
                        className="flex space-x-1.5 transition-transform duration-500 ease-in-out"
                        style={{ transform: `translateX(-${visibleMoodIndex * 100}%)` }}
                      >
                        {moods.map((mood) => (
                          <button
                            key={mood.value}
                            onClick={() => handleOptionSelect(mood.value)}
                            className={`flex-1 px-1.5 py-1 rounded-lg text-[11px] transition-all duration-300 flex items-center justify-center space-x-1 min-w-[calc(33.333%-0.375rem)] ${
                              tag === mood.value
                                ? 'bg-white text-black scale-105'
                                : 'bg-white/10 text-white hover:bg-white/20 hover:scale-105'
                            }`}
                          >
                            <span className="text-base">{mood.icon}</span>
                            <span className="truncate">{mood.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => changeMood('next')}
                      className="p-1 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all duration-300 hover:scale-110 active:scale-95 flex-shrink-0"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Player Container - Always visible */}
          <div className={`bg-black/90 backdrop-blur-sm border border-white/20 rounded-2xl shadow-xl transition-all duration-500 ease-in-out ${
            isExpanded ? 'w-[600px]' : 'w-[400px]'
          }`}>
            <div className="p-4">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  {selectedStation.favicon && !imageErrors.has(selectedStation.name) ? (
                    <img 
                      src={selectedStation.favicon} 
                      alt={selectedStation.name}
                      className={`rounded-lg transition-all duration-500 ${
                        isExpanded ? 'w-16 h-16' : 'w-12 h-12'
                      }`}
                      onError={() => handleImageError(selectedStation.name)}
                    />
                  ) : (
                    <div className={`bg-white/10 rounded-lg flex items-center justify-center transition-all duration-500 ${
                      isExpanded ? 'w-16 h-16' : 'w-12 h-12'
                    }`}>
                      <svg className={`text-white transition-all duration-500 ${
                        isExpanded ? 'w-8 h-8' : 'w-6 h-6'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  {isExpanded && (
                    <div className="mt-2 space-y-2">
                      {selectedStation.tags && (
                        <div className="flex flex-wrap gap-2">
                          {(Array.isArray(selectedStation.tags) 
                            ? selectedStation.tags 
                            : typeof selectedStation.tags === 'string' 
                              ? (selectedStation.tags as string).split(',').map((tag: string) => tag.trim())
                              : []
                          ).slice(0, showAllTags ? undefined : 6).map((tag: string, index: number) => (
                            <span key={index} className="px-2 py-1 bg-white/10 rounded-full text-xs text-white/80">
                              {tag}
                            </span>
                          ))}
                          {selectedStation.tags && 
                            (Array.isArray(selectedStation.tags) 
                              ? selectedStation.tags 
                              : typeof selectedStation.tags === 'string' 
                                ? (selectedStation.tags as string).split(',').map((tag: string) => tag.trim())
                                : []
                            ).length > 6 && (
                            <button
                              onClick={() => setShowAllTags(!showAllTags)}
                              className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded-full text-xs text-white/80 transition-colors duration-300"
                            >
                              {showAllTags ? 'Show Less' : 'Show More'}
                            </button>
                          )}
                        </div>
                      )}
                      {selectedStation.url_resolved && (
                        <a 
                          href={selectedStation.url_resolved}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-sm flex items-center space-x-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          <span>Visit Station</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  {isExpanded && (
                    <>
                      <button
                        onClick={() => {/* Add favorite functionality */}}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-300 hover:scale-110 active:scale-95"
                      >
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {/* Add share functionality */}}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-300 hover:scale-110 active:scale-95"
                      >
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </button>
                    </>
                  )}
                  <button
                    onClick={playRandomStation}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-300 hover:scale-110 active:scale-95 group"
                  >
                    <svg className="w-6 h-6 text-white transform transition-transform duration-300 group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <button
                    onClick={togglePlayback}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-300 hover:scale-110 active:scale-95"
                  >
                    {isPlaying ? (
                      <svg className="w-6 h-6 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-300 hover:scale-110 active:scale-95"
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
            </div>
          </div>
          <audio ref={audioRef} className="hidden" />
        </div>
      )}
    </div>
  );
}