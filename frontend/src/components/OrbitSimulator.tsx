import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './OrbitSimulator.css';
import Globe from 'react-globe.gl';

// Type definitions
interface SimulationParams {
  orbitType: 'sso' | 'nonPolar';
  altitude: number;
  inclination: number | null;
  ltan?: number;
}

interface Position {
  time: string;
  lat: number;
  lon: number;
  alt: number;
  x?: number;
  y?: number;
  z?: number;
}

interface Satellite {
  name: string;
  positions: Position[];
}

interface VisibilityWindow {
  start: string;
  end: string;
  duration_minutes: number;
}

interface SatelliteVisibility {
  satellite: string;
  windows: VisibilityWindow[];
}

interface ConnectivityStats {
  percentage: number;
  total_minutes: number;
  gaps: VisibilityWindow[];
}

interface SimulationResults {
  orbit_parameters: {
    type: string;
    altitude: number;
    inclination: number | null;
    ltan: number | null;
  };
  custom_satellite: Satellite;
  iridium_satellites: Satellite[];
  visibility_windows: SatelliteVisibility[];
  connectivity_stats: ConnectivityStats;
}

// Simpler arc data format that works with Globe component
interface ArcData {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  altitude: number;
  satelliteId: string; // Added for filtering
}

// Point data format
interface PointData {
  lat: number;
  lng: number;
  alt: number;
  radius: number;
  color: string;
  label: string;
  satelliteId: string; // Added for filtering
}

// Satellite display info
interface SatelliteInfo {
  id: string;
  name: string;
  color: string;
  isVisible: boolean;
}

// Main component
const OrbitSimulator: React.FC = () => {
  // State
  const [params, setParams] = useState<SimulationParams>({
    orbitType: 'sso',
    altitude: 700,
    inclination: null,
    ltan: 10.5,
  });
  
  const [results, setResults] = useState<SimulationResults | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'params' | 'results' | 'stats'>('params');
  
  // Satellite visibility state
  const [satellites, setSatellites] = useState<SatelliteInfo[]>([]);
  const [selectedSatellite, setSelectedSatellite] = useState<string>("");
  
  // Prepare data for globe
  const [allArcsData, setAllArcsData] = useState<ArcData[]>([]);
  const [allPointsData, setAllPointsData] = useState<PointData[]>([]);
  
  // Filtered data based on selection
  const [displayArcsData, setDisplayArcsData] = useState<ArcData[]>([]);
  const [displayPointsData, setDisplayPointsData] = useState<PointData[]>([]);
  
  // Update displayed data when selection changes
  useEffect(() => {
    if (selectedSatellite === "") {
      // Show nothing
      setDisplayArcsData([]);
      setDisplayPointsData([]);
    } else if (selectedSatellite === "all") {
      // Show all satellites
      setDisplayArcsData(allArcsData);
      setDisplayPointsData(allPointsData);
    } else {
      // Filter satellites based on selection
      setDisplayArcsData(allArcsData.filter(arc => arc.satelliteId === selectedSatellite));
      setDisplayPointsData(allPointsData.filter(point => point.satelliteId === selectedSatellite));
    }
  }, [selectedSatellite, allArcsData, allPointsData]);
  
  // Prepare data whenever results change
  useEffect(() => {
    if (results) {
      prepareVisualizationData();
    }
  }, [results]);
  
  // Run simulation
  const runSimulation = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('https://your-backend-name.onrender.com/api/simulate', params);
      setResults(response.data);
      setActiveTab('results');
    } catch (err) {
      console.error('Simulation failed:', err);
      setError('Failed to run simulation. Please check the console for details.');
    } finally {
      setLoading(false);
    }
  };
  
  // Prepare data for visualization
  const prepareVisualizationData = () => {
    if (!results) return;
    
    const newArcsData: ArcData[] = [];
    const newPointsData: PointData[] = [];
    const newSatellites: SatelliteInfo[] = [];
    
    // Prepare custom satellite data
    if (results.custom_satellite && 
        results.custom_satellite.positions && 
        Array.isArray(results.custom_satellite.positions) && 
        results.custom_satellite.positions.length > 1) {
      
      const customSatId = 'custom-sat';
      const customSatColor = "rgba(0, 255, 0, 1)"; // Green
      
      // Add to satellites list
      newSatellites.push({
        id: customSatId,
        name: 'Custom Satellite',
        color: customSatColor,
        isVisible: false
      });
      
      // Create arcs by connecting consecutive positions
      for (let i = 0; i < results.custom_satellite.positions.length - 1; i++) {
        const startPos = results.custom_satellite.positions[i];
        const endPos = results.custom_satellite.positions[i + 1];
        
        newArcsData.push({
          startLat: startPos.lat,
          startLng: startPos.lon,
          endLat: endPos.lat,
          endLng: endPos.lon,
          color: customSatColor,
          altitude: Math.max(startPos.alt, endPos.alt) / 100, // Scale altitude
          satelliteId: customSatId
        });
      }
      
      // Add the satellite as a point (first position)
      const firstPos = results.custom_satellite.positions[0];
      newPointsData.push({
        lat: firstPos.lat,
        lng: firstPos.lon,
        alt: firstPos.alt / 100,
        radius: 5,
        color: customSatColor,
        label: 'Custom Satellite',
        satelliteId: customSatId
      });
    }
    
    // Prepare Iridium satellites data
    if (results.iridium_satellites && 
        Array.isArray(results.iridium_satellites)) {
      
      // Define colors for different satellites
      const colorStrings = [
        "rgba(255, 0, 0, 1)",     // Red
        "rgba(0, 0, 255, 1)",     // Blue
        "rgba(255, 255, 0, 1)",   // Yellow
        "rgba(255, 0, 255, 1)",   // Magenta
        "rgba(0, 255, 255, 1)"    // Cyan
      ];
      
      results.iridium_satellites.forEach((sat, satIndex) => {
        if (sat.positions && 
            Array.isArray(sat.positions) && 
            sat.positions.length > 1) {
          
          const satId = `iridium-${satIndex}`;
          const color = colorStrings[satIndex % colorStrings.length];
          
          // Add to satellites list
          newSatellites.push({
            id: satId,
            name: sat.name,
            color: color,
            isVisible: false
          });
          
          // Create arcs by connecting consecutive positions
          for (let i = 0; i < sat.positions.length - 1; i++) {
            const startPos = sat.positions[i];
            const endPos = sat.positions[i + 1];
            
            newArcsData.push({
              startLat: startPos.lat,
              startLng: startPos.lon,
              endLat: endPos.lat,
              endLng: endPos.lon,
              color: color,
              altitude: Math.max(startPos.alt, endPos.alt) / 100,
              satelliteId: satId
            });
          }
          
          // Add the satellite as a point (first position)
          const firstPos = sat.positions[0];
          newPointsData.push({
            lat: firstPos.lat,
            lng: firstPos.lon,
            alt: firstPos.alt / 100,
            radius: 3,
            color: color,
            label: sat.name,
            satelliteId: satId
          });
        }
      });
    }
    
    // Add an "All Satellites" option
    newSatellites.unshift({
      id: "all",
      name: "All Satellites",
      color: "",
      isVisible: false
    });
    
    // Add a "None" option (default)
    newSatellites.unshift({
      id: "",
      name: "None (Select a satellite)",
      color: "",
      isVisible: false
    });
    
    setAllArcsData(newArcsData);
    setAllPointsData(newPointsData);
    setSatellites(newSatellites);
    setSelectedSatellite(""); // Default: show none
  };
  
  return (
    <div className="orbit-simulator">
      <header className="header">
        <h1>Orbital Simulation</h1>
        <div className="tabs">
          <button 
            className={activeTab === 'params' ? 'active' : ''} 
            onClick={() => setActiveTab('params')}
          >
            Parameters
          </button>
          {results && (
            <>
              <button 
                className={activeTab === 'results' ? 'active' : ''} 
                onClick={() => setActiveTab('results')}
              >
                Visualization
              </button>
              <button 
                className={activeTab === 'stats' ? 'active' : ''} 
                onClick={() => setActiveTab('stats')}
              >
                Statistics
              </button>
            </>
          )}
        </div>
      </header>
      
      <div className="content">
        {activeTab === 'params' && (
          <div className="control-panel">
            <h2>Satellite Parameters</h2>
            <div className="form-group">
              <label>Orbit Type</label>
              <select
                value={params.orbitType}
                onChange={(e) => setParams({...params, orbitType: e.target.value as 'sso' | 'nonPolar'})}
              >
                <option value="sso">Sun-Synchronous</option>
                <option value="nonPolar">Non-Polar</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Altitude (km)</label>
              <input
                type="number"
                value={params.altitude}
                onChange={(e) => setParams({...params, altitude: parseInt(e.target.value) || 0})}
                min="200"
                max="2000"
              />
            </div>
            
            <div className="form-group">
              <label>Inclination (degrees)</label>
              <input
                type="number"
                value={params.inclination === null ? '' : params.inclination}
                onChange={(e) => setParams({
                  ...params, 
                  inclination: e.target.value ? parseFloat(e.target.value) : null
                })}
                placeholder={params.orbitType === 'sso' ? 'Auto calculate' : ''}
                min="0"
                max="180"
              />
              {params.orbitType === 'sso' && params.inclination === null && (
                <div className="form-help">Will be calculated based on altitude</div>
              )}
            </div>
            
            {params.orbitType === 'sso' && (
              <div className="form-group">
                <label>LTAN (Local Time of Ascending Node)</label>
                <input
                  type="number"
                  value={params.ltan || 10.5}
                  onChange={(e) => setParams({...params, ltan: parseFloat(e.target.value) || 10.5})}
                  step="0.25"
                  min="0"
                  max="24"
                />
                <div className="form-help">Time when satellite crosses equator (24h format)</div>
              </div>
            )}
            
            <div className="button-container">
              <button 
                className="primary-button" 
                onClick={runSimulation} 
                disabled={loading}
              >
                {loading ? 'Running Simulation...' : 'Run Simulation'}
              </button>
            </div>
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'results' && results && (
          <div className="visualization-panel">
            <div className="globe-container">
              <Globe
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
                bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
                arcsData={displayArcsData}
                arcColor="color"
                arcStroke={1.5}
                arcAltitude="altitude"
                arcDashLength={0.4}
                arcDashGap={0.2}
                arcDashAnimateTime={4000}
                pointsData={displayPointsData}
                pointAltitude="alt"
                pointLabel="label"
                pointRadius="radius"
                pointColor="color"
              />
            </div>
            <div className="legend">
              <h3>Satellite Selection</h3>
              <div className="satellite-selector">
                <select 
                  value={selectedSatellite}
                  onChange={(e) => setSelectedSatellite(e.target.value)}
                  className="satellite-dropdown"
                >
                  {satellites.map(sat => (
                    <option key={sat.id} value={sat.id}>
                      {sat.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <h3>Color Legend</h3>
              <div className="satellite-list">
                {satellites.filter(sat => sat.id !== "" && sat.id !== "all").map(sat => (
                  <div key={sat.id} className="legend-item">
                    <div className="legend-color" style={{backgroundColor: sat.color}}></div>
                    <div className="legend-label">{sat.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'stats' && results && (
          <div className="stats-panel">
            <div className="orbit-summary">
              <h2>Orbit Parameters</h2>
              <div className="stats-grid">
                <div>Type:</div>
                <div>{results.orbit_parameters.type === 'sso' ? 'Sun-Synchronous' : 'Non-Polar'}</div>
                
                <div>Altitude:</div>
                <div>{results.orbit_parameters.altitude} km</div>
                
                <div>Inclination:</div>
                <div>{results.orbit_parameters.inclination?.toFixed(2) || 'Auto-calculated'} degrees</div>
                
                {results.orbit_parameters.type === 'sso' && (
                  <>
                    <div>LTAN:</div>
                    <div>{results.orbit_parameters.ltan?.toFixed(2)} hours</div>
                  </>
                )}
              </div>
            </div>
            
            <div className="connectivity-summary">
              <h2>Connectivity Statistics</h2>
              <div className="stats-highlight">
                <div className="big-number">{results.connectivity_stats.percentage.toFixed(1)}%</div>
                <div className="highlight-label">Coverage</div>
              </div>
              
              <div className="stats-grid">
                <div>Connected Time:</div>
                <div>{results.connectivity_stats.total_minutes.toFixed(0)} minutes</div>
                
                <div>Communication Gaps:</div>
                <div>{results.connectivity_stats.gaps.length}</div>
                
                <div>Longest Gap:</div>
                <div>
                  {results.connectivity_stats.gaps.length > 0 
                    ? Math.max(...results.connectivity_stats.gaps.map(g => g.duration_minutes)).toFixed(1) 
                    : '0'} minutes
                </div>
              </div>
            </div>
            
            <div className="visibility-windows">
              <h2>Visibility Windows</h2>
              <div className="windows-list">
                {results.visibility_windows.length === 0 ? (
                  <div className="no-data">No visibility windows found</div>
                ) : (
                  results.visibility_windows.map((sat, i) => (
                    <div key={i} className="window-item">
                      <div className="window-header">
                        <div className="window-title">{sat.satellite}</div>
                        <div className="window-count">{sat.windows.length} windows</div>
                      </div>
                      <div className="window-details">
                        {sat.windows.slice(0, 5).map((window, j) => (
                          <div key={j} className="window-detail">
                            <div>{new Date(window.start).toLocaleTimeString()} - {new Date(window.end).toLocaleTimeString()}</div>
                            <div>{window.duration_minutes.toFixed(1)} min</div>
                          </div>
                        ))}
                        {sat.windows.length > 5 && (
                          <div className="window-more">+ {sat.windows.length - 5} more windows</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrbitSimulator;
