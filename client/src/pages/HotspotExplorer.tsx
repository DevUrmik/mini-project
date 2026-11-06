import React, { useEffect, useState, useCallback, useRef } from 'react';
import { RotateCcw, AlertCircle, Info } from 'lucide-react';
import { HotspotMap, MapViewMode } from '../maps/HotspotMap';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  getKMeansHotspots,
  getDBSCANHotspots,
  getAccidents
} from '../services/api';
import {
  HotspotCluster,
  AccidentRecord,
  KMeansResponse,
  DBSCANResponse
} from '../types';

// Preset state coordinates and zoom levels
const STATE_VIEWPORTS: Record<string, { center: [number, number]; zoom: number }> = {
  ALL: { center: [33.5, -100.0], zoom: 4 },
  CA: { center: [36.7783, -119.4179], zoom: 6 },
  FL: { center: [27.9944, -81.7603], zoom: 7 },
  TX: { center: [31.9686, -99.9018], zoom: 6 },
};

// Cities strictly present in the 35,000-record dataset
const STATE_CITIES: Record<string, string[]> = {
  ALL: ['Los Angeles', 'San Francisco', 'San Jose', 'San Diego', 'Sacramento', 'Miami', 'Houston'],
  CA: ['Los Angeles', 'San Francisco', 'San Jose', 'San Diego', 'Sacramento'],
  FL: ['Miami'],
  TX: ['Houston'],
};

// City center coordinates for automatic focus
const CITY_COORDINATES: Record<string, { center: [number, number]; zoom: number }> = {
  'Los Angeles': { center: [34.0522, -118.2437], zoom: 10 },
  'San Francisco': { center: [37.7749, -122.4194], zoom: 11 },
  'San Jose': { center: [37.3382, -121.8863], zoom: 11 },
  'San Diego': { center: [32.7157, -117.1611], zoom: 11 },
  'Sacramento': { center: [38.5816, -121.4944], zoom: 11 },
  'Miami': { center: [25.7617, -80.1918], zoom: 11 },
  'Houston': { center: [29.7604, -95.3698], zoom: 10 },
};

export const HotspotExplorer: React.FC = () => {
  const [viewMode, setViewMode] = useState<MapViewMode>('clusters');
  const [algorithm, setAlgorithm] = useState<'kmeans' | 'dbscan'>('dbscan');
  const [kValue, setKValue] = useState<number>(10);
  const [selectedState, setSelectedState] = useState<string>('CA');
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [selectedSeverity, setSelectedSeverity] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [mapCenter, setMapCenter] = useState<[number, number]>(STATE_VIEWPORTS.CA.center);
  const [mapZoom, setMapZoom] = useState<number>(STATE_VIEWPORTS.CA.zoom);

  const [kmeansData, setKmeansData] = useState<KMeansResponse | null>(null);
  const [dbscanData, setDbscanData] = useState<DBSCANResponse | null>(null);
  const [rawAccidents, setRawAccidents] = useState<AccidentRecord[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<HotspotCluster | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const viewportDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Load initial cluster models and accidents
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [kmRes, dbRes, accRes] = await Promise.all([
        getKMeansHotspots(kValue),
        getDBSCANHotspots(),
        getAccidents({
          state: selectedState === 'ALL' ? undefined : selectedState,
          city: selectedCity === 'All' ? undefined : selectedCity,
          severity: selectedSeverity,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          limit: 1000
        })
      ]);
      setKmeansData(kmRes);
      setDbscanData(dbRes);
      setRawAccidents(accRes);
    } catch (err: any) {
      setError(err?.message || 'Failed to load map data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [kValue, selectedState, selectedCity, selectedSeverity, startDate, endDate]);

  // Viewport-based fetching on pan/zoom (debounced)
  const handleViewportChange = useCallback((bounds: { min_lat: number; max_lat: number; min_lng: number; max_lng: number }) => {
    if (viewMode === 'clusters') return; // Viewport queries apply to raw and density modes

    if (viewportDebounceTimer.current) {
      clearTimeout(viewportDebounceTimer.current);
    }

    viewportDebounceTimer.current = setTimeout(async () => {
      try {
        const records = await getAccidents({
          min_lat: bounds.min_lat,
          max_lat: bounds.max_lat,
          min_lng: bounds.min_lng,
          max_lng: bounds.max_lng,
          state: selectedState === 'ALL' ? undefined : selectedState,
          city: selectedCity === 'All' ? undefined : selectedCity,
          severity: selectedSeverity,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          limit: 1200
        });
        if (records.length > 0) {
          setRawAccidents(records);
        }
      } catch (err) {
        // Suppress transient pan errors
      }
    }, 350);
  }, [viewMode, selectedState, selectedCity, selectedSeverity, startDate, endDate]);

  // Automatic state transition
  const handleStateChange = (stateCode: string) => {
    setSelectedState(stateCode);
    setSelectedCity('All');
    setSelectedCluster(null);
    const vp = STATE_VIEWPORTS[stateCode] || STATE_VIEWPORTS.ALL;
    setMapCenter(vp.center);
    setMapZoom(vp.zoom);
  };

  // Automatic city transition
  const handleCityChange = (cityName: string) => {
    setSelectedCity(cityName);
    setSelectedCluster(null);
    if (cityName !== 'All' && CITY_COORDINATES[cityName]) {
      setMapCenter(CITY_COORDINATES[cityName].center);
      setMapZoom(CITY_COORDINATES[cityName].zoom);
    } else {
      const vp = STATE_VIEWPORTS[selectedState] || STATE_VIEWPORTS.ALL;
      setMapCenter(vp.center);
      setMapZoom(vp.zoom);
    }
  };

  // Reset map control
  const handleResetMap = () => {
    setSelectedState('CA');
    setSelectedCity('All');
    setSelectedSeverity(undefined);
    setStartDate('');
    setEndDate('');
    setSelectedCluster(null);
    setMapCenter(STATE_VIEWPORTS.CA.center);
    setMapZoom(STATE_VIEWPORTS.CA.zoom);
  };

  const currentClusters = algorithm === 'kmeans'
    ? (kmeansData?.clusters || [])
    : (dbscanData?.clusters || []);

  const filteredClusters = selectedCity === 'All'
    ? currentClusters
    : currentClusters.filter((c) => c.dominant_city.toLowerCase() === selectedCity.toLowerCase());

  const availableCities = STATE_CITIES[selectedState] || STATE_CITIES.ALL;

  const handleSelectCluster = (cluster: HotspotCluster) => {
    setSelectedCluster(cluster);
    setMapCenter([cluster.center_lat, cluster.center_lng]);
    setMapZoom(11);
  };

  if (loading && !kmeansData && !dbscanData) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-white border border-[#E5E7E1] rounded-md animate-pulse"></div>
        <div className="h-[580px] bg-white border border-[#E5E7E1] rounded-md animate-pulse"></div>
      </div>
    );
  }

  if (error && !kmeansData && !dbscanData) {
    return <ErrorBanner message={error} onRetry={fetchData} />;
  }

  return (
    <div className="space-y-4">
      {/* Editorial Header */}
      <div className="pb-1 border-b border-[#E5E7E1] flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#252923]">
            Accident Map & Hotspots
          </h1>
          <p className="text-xs text-[#777D78] mt-0.5">
            Geographic analysis of traffic-impacting incidents, spatial densities, and unsupervised clustering.
          </p>
        </div>
      </div>

      {/* Dataset & Spatial Sample Disclosure Card */}
      <div className="bg-[#F0F2ED] border border-[#E5E7E1] rounded-lg p-3 text-xs text-[#252923] flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#28634D] shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-[11px] leading-relaxed">
          <span className="font-semibold text-[#252923]">Dataset Coverage & Clustering Scope: </span>
          The development dataset contains 35,000 incident records across California (33,052), Florida (1,173), and Texas (775).
          DBSCAN and K-Means models were trained on a representative spatial subset of 20,000 California incidents (19,963 clustered into 5 dense metropolitan corridors, 37 noise points).
          All cluster percentages use this 20,000-point sample as their denominator.
        </div>
      </div>

      {/* State Cluster Notice when FL or TX is selected in Cluster mode */}
      {viewMode === 'clusters' && selectedState !== 'CA' && selectedState !== 'ALL' && (
        <div className="bg-[#FFF8E7] border border-[#D69A43]/40 rounded-lg p-3 text-xs text-[#252923] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#D69A43] shrink-0" />
          <span>
            The precomputed ML clustering models were trained specifically on California accident coordinates.
            Switch to <strong>Individual Incidents</strong> or <strong>Density View</strong> to inspect Florida (Miami) or Texas (Houston) records.
          </span>
        </div>
      )}

      {/* Compact Interactive Map Toolbar */}
      <div className="bg-white border border-[#E5E7E1] rounded-lg p-3 shadow-subtle space-y-2.5 text-xs">
        {/* Upper Row: Mode and Clustering Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#F0F2ED] p-0.5 rounded-md">
            <button
              onClick={() => setViewMode('clusters')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                viewMode === 'clusters'
                  ? 'bg-white text-[#252923] shadow-sm font-semibold'
                  : 'text-[#777D78] hover:text-[#252923]'
              }`}
            >
              ML Clusters
            </button>
            <button
              onClick={() => setViewMode('individual')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                viewMode === 'individual'
                  ? 'bg-white text-[#252923] shadow-sm font-semibold'
                  : 'text-[#777D78] hover:text-[#252923]'
              }`}
            >
              Individual Incidents
            </button>
            <button
              onClick={() => setViewMode('density')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                viewMode === 'density'
                  ? 'bg-white text-[#252923] shadow-sm font-semibold'
                  : 'text-[#777D78] hover:text-[#252923]'
              }`}
            >
              Density View
            </button>
          </div>

          {/* Algorithm Switcher (in Cluster Mode) */}
          {viewMode === 'clusters' ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-[#F0F2ED] p-0.5 rounded-md">
                <button
                  onClick={() => setAlgorithm('dbscan')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                    algorithm === 'dbscan'
                      ? 'bg-white text-[#28634D] font-semibold shadow-sm'
                      : 'text-[#777D78] hover:text-[#252923]'
                  }`}
                >
                  DBSCAN (Haversine)
                </button>
                <button
                  onClick={() => setAlgorithm('kmeans')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                    algorithm === 'kmeans'
                      ? 'bg-white text-[#28634D] font-semibold shadow-sm'
                      : 'text-[#777D78] hover:text-[#252923]'
                  }`}
                >
                  K-Means (Centroids)
                </button>
              </div>

              {algorithm === 'kmeans' ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-[#777D78]">K:</span>
                  {[5, 10, 15, 20].map((k) => (
                    <button
                      key={k}
                      onClick={() => setKValue(k)}
                      className={`px-2 py-0.5 rounded border text-xs font-medium transition ${
                        kValue === k
                          ? 'bg-[#EBF2EE] text-[#28634D] border-[#28634D]'
                          : 'bg-white text-[#777D78] border-[#E5E7E1] hover:bg-[#F0F2ED]'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] text-[#777D78] hidden sm:inline">
                  Radius: 7.5 km · 35 min samples
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs text-[#777D78]">
              Loaded {rawAccidents.length.toLocaleString()} locations in view
            </div>
          )}
        </div>

        {/* Lower Row: State, Dependent City, Severity, and Date Range Filters */}
        <div className="pt-2 border-t border-[#E5E7E1] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* State Selector */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[#777D78]">State:</span>
              <select
                value={selectedState}
                onChange={(e) => handleStateChange(e.target.value)}
                className="bg-[#F7F7F4] border border-[#E5E7E1] rounded px-2 py-1 text-xs text-[#252923] font-medium focus:outline-none focus:border-[#28634D]"
              >
                <option value="ALL">All States (CA, FL, TX)</option>
                <option value="CA">California (CA - 33,052)</option>
                <option value="FL">Florida (FL - 1,173)</option>
                <option value="TX">Texas (TX - 775)</option>
              </select>
            </div>

            {/* Dependent City Selector */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[#777D78]">City:</span>
              <select
                value={selectedCity}
                onChange={(e) => handleCityChange(e.target.value)}
                className="bg-[#F7F7F4] border border-[#E5E7E1] rounded px-2 py-1 text-xs text-[#252923] font-medium focus:outline-none focus:border-[#28634D]"
              >
                <option value="All">All Cities</option>
                {availableCities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            {/* Severity Selector (Discrete 1 to 4) */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[#777D78]">Severity:</span>
              <select
                value={selectedSeverity !== undefined ? String(selectedSeverity) : 'ALL'}
                onChange={(e) => setSelectedSeverity(e.target.value === 'ALL' ? undefined : Number(e.target.value))}
                className="bg-[#F7F7F4] border border-[#E5E7E1] rounded px-2 py-1 text-xs text-[#252923] font-medium focus:outline-none focus:border-[#28634D]"
              >
                <option value="ALL">All Severities (1–4)</option>
                <option value="1">Level 1 (Minimal impact)</option>
                <option value="2">Level 2 (Moderate impact)</option>
                <option value="3">Level 3 (High impact)</option>
                <option value="4">Level 4 (Significant disruption)</option>
              </select>
            </div>

            {/* Date Range Filters */}
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-[#777D78]">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-[#F7F7F4] border border-[#E5E7E1] rounded px-1.5 py-0.5 text-xs text-[#252923] focus:outline-none focus:border-[#28634D]"
              />
              <span className="text-[#777D78]">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-[#F7F7F4] border border-[#E5E7E1] rounded px-1.5 py-0.5 text-xs text-[#252923] focus:outline-none focus:border-[#28634D]"
              />
            </div>
          </div>

          {/* Reset Map Button */}
          <button
            onClick={handleResetMap}
            title="Reset to California overview"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#E5E7E1] bg-[#F7F7F4] hover:bg-[#F0F2ED] text-[#252923] font-medium transition"
          >
            <RotateCcw className="w-3 h-3 text-[#777D78]" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Map */}
      <HotspotMap
        viewMode={viewMode}
        clusters={filteredClusters}
        algorithm={algorithm}
        rawAccidents={rawAccidents}
        center={mapCenter}
        zoom={mapZoom}
        selectedClusterId={selectedCluster?.cluster_id}
        onSelectCluster={handleSelectCluster}
        onViewportChange={handleViewportChange}
      />

      {/* Cluster Table (when in cluster mode) */}
      {viewMode === 'clusters' && (
        <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-[#252923]">
                {algorithm === 'dbscan' ? 'DBSCAN Spatial Hotspots' : 'K-Means Centroid Clusters'}
              </h2>
              <p className="text-xs text-[#777D78] mt-0.5">
                Dense corridors ranked by total recorded incidents across California
              </p>
            </div>
            <span className="text-xs text-[#777D78]">
              {filteredClusters.length} clusters identified
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#252923]">
              <thead className="bg-[#F7F7F4] border-b border-[#E5E7E1] text-[11px] uppercase tracking-wider text-[#777D78] font-medium">
                <tr>
                  <th className="py-2.5 px-3">Cluster</th>
                  <th className="py-2.5 px-3">Primary Area</th>
                  <th className="py-2.5 px-3">Coordinates</th>
                  <th className="py-2.5 px-3 text-right">Recorded Accidents</th>
                  <th className="py-2.5 px-3 text-right">CA Sample Share</th>
                  <th className="py-2.5 px-3 text-center">Avg Severity</th>
                  <th className="py-2.5 px-3 text-right">Spread Radius</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7E1]">
                {filteredClusters.map((cluster) => {
                  const isSelected = selectedCluster?.cluster_id === cluster.cluster_id;
                  return (
                    <tr
                      key={cluster.cluster_id}
                      onClick={() => handleSelectCluster(cluster)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#EBF2EE]' : 'hover:bg-[#F7F7F4]'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-semibold text-[#28634D]">
                        #{cluster.cluster_id + 1}
                      </td>
                      <td className="py-2.5 px-3 font-medium">
                        {cluster.dominant_city}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#777D78]">
                        {cluster.center_lat.toFixed(4)}, {cluster.center_lng.toFixed(4)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium">
                        {cluster.accident_count.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#777D78]">
                        {cluster.accident_percentage}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="font-semibold text-[#28634D]">
                          Level {cluster.average_severity.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#777D78]">
                        {cluster.spread_radius_km} km
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="text-[#28634D] font-medium hover:underline">
                          Focus
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Editorial Methodology Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#252923]">
        <div className="bg-white border border-[#E5E7E1] rounded-lg p-4 space-y-1.5 shadow-subtle">
          <div className="font-semibold text-xs text-[#28634D]">
            DBSCAN with Haversine Spherical Distance
          </div>
          <p className="text-xs text-[#777D78] leading-relaxed">
            DBSCAN discovers clusters of arbitrary geometric shape (such as curved highway arteries) without pre-specifying cluster counts. Using true Haversine distance preserves spherical surface geometry across California. Outliers that do not satisfy minimum spatial density thresholds are tagged as noise (37 points).
          </p>
        </div>

        <div className="bg-white border border-[#E5E7E1] rounded-lg p-4 space-y-1.5 shadow-subtle">
          <div className="font-semibold text-xs text-[#252923]">
            K-Means Centroid Partitioning
          </div>
          <p className="text-xs text-[#777D78] leading-relaxed">
            K-Means partitions incident coordinates into K spherical geographic regions by minimizing squared Euclidean distance to each cluster centroid. While effective for establishing emergency response district centroids, it forces all points (including isolated rural incidents) into nearest clusters.
          </p>
        </div>
      </div>
    </div>
  );
};
