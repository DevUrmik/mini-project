import React, { useEffect, useState, useCallback, useRef } from 'react';
import { RotateCcw, Info, MapPin } from 'lucide-react';
import { HotspotMap, MapViewMode } from '../maps/HotspotMap';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  getAvailableStates,
  getAvailableCities,
  getDatasetBounds,
  getKMeansHotspots,
  getDBSCANHotspots,
  getAccidents
} from '../services/api';
import {
  HotspotCluster,
  AccidentRecord,
  KMeansResponse,
  DBSCANResponse,
  StateSummary,
  CitySummary
} from '../types';

export const HotspotExplorer: React.FC = () => {
  const [viewMode, setViewMode] = useState<MapViewMode>('clusters');
  const [algorithm, setAlgorithm] = useState<'dbscan' | 'kmeans'>('dbscan');
  const [kValue, setKValue] = useState<number>(10);

  // Dynamic Geographic State (Zero hardcoded constants)
  const [availableStates, setAvailableStates] = useState<StateSummary[]>([]);
  const [availableCities, setAvailableCities] = useState<CitySummary[]>([]);
  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [selectedSeverity, setSelectedSeverity] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Dynamically calculated bounds directly from actual accident GPS records
  const [mapBounds, setMapBounds] = useState<[[number, number], [number, number]]>([
    [24.0, -125.0],
    [50.0, -66.0]
  ]);
  const [totalMatching, setTotalMatching] = useState<number>(0);

  const [kmeansData, setKmeansData] = useState<KMeansResponse | null>(null);
  const [dbscanData, setDbscanData] = useState<DBSCANResponse | null>(null);
  const [rawAccidents, setRawAccidents] = useState<AccidentRecord[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<HotspotCluster | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const viewportDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // 1. Initial Geographic Discovery: Load available states and overall dataset bounds
  useEffect(() => {
    const initGeography = async () => {
      try {
        const [statesData, boundsData] = await Promise.all([
          getAvailableStates(),
          getDatasetBounds()
        ]);
        setAvailableStates(statesData);
        if (boundsData && boundsData.bounds) {
          setMapBounds(boundsData.bounds);
        }
      } catch (err) {
        console.error('Failed to discover dataset geography:', err);
      }
    };
    initGeography();
  }, []);

  // 2. Discover cities whenever selected state changes
  useEffect(() => {
    const fetchCities = async () => {
      try {
        const citiesData = await getAvailableCities(selectedState === 'ALL' ? undefined : selectedState);
        setAvailableCities(citiesData);
      } catch (err) {
        console.error('Failed to discover cities for state:', selectedState, err);
      }
    };
    fetchCities();
  }, [selectedState]);

  // 3. Main Data Fetcher: Loads clusters, accidents, and record counts for active filters
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [kmRes, dbRes, accRes] = await Promise.all([
        getKMeansHotspots(kValue, selectedState),
        getDBSCANHotspots(selectedState),
        getAccidents({
          state: selectedState === 'ALL' ? undefined : selectedState,
          city: selectedCity === 'All' ? undefined : selectedCity,
          severity: selectedSeverity,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          page: 1,
          page_size: 1500
        })
      ]);
      setKmeansData(kmRes);
      setDbscanData(dbRes);
      setRawAccidents(accRes.items || []);
      setTotalMatching(accRes.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to load accident map data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [kValue, selectedState, selectedCity, selectedSeverity, startDate, endDate]);

  // 4. Viewport-based fetching on pan/zoom (debounced)
  const handleViewportChange = useCallback((bounds: { min_lat: number; max_lat: number; min_lng: number; max_lng: number }) => {
    if (viewMode === 'clusters') return; // Viewport queries apply to raw and density modes

    if (viewportDebounceTimer.current) {
      clearTimeout(viewportDebounceTimer.current);
    }

    viewportDebounceTimer.current = setTimeout(async () => {
      try {
        const paged = await getAccidents({
          min_lat: bounds.min_lat,
          max_lat: bounds.max_lat,
          min_lng: bounds.min_lng,
          max_lng: bounds.max_lng,
          state: selectedState === 'ALL' ? undefined : selectedState,
          city: selectedCity === 'All' ? undefined : selectedCity,
          severity: selectedSeverity,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          page: 1,
          page_size: 1500
        });
        if (paged.items && paged.items.length > 0) {
          setRawAccidents(paged.items);
          setTotalMatching(paged.total);
        }
      } catch (err) {
        // Suppress transient drag errors
      }
    }, 350);
  }, [viewMode, selectedState, selectedCity, selectedSeverity, startDate, endDate]);

  // 5. Dynamic State Selection: Automatically computes and zooms to that state's exact bounds
  const handleStateChange = async (stateCode: string) => {
    setSelectedState(stateCode);
    setSelectedCity('All');
    setSelectedCluster(null);
    try {
      const boundsData = await getDatasetBounds(stateCode === 'ALL' ? undefined : stateCode);
      if (boundsData && boundsData.bounds) {
        setMapBounds(boundsData.bounds);
      }
    } catch (err) {
      console.error('Failed to compute dynamic state bounds:', err);
    }
  };

  // 6. Dynamic City Selection: Automatically computes and zooms to that city's exact bounds
  const handleCityChange = async (cityName: string) => {
    setSelectedCity(cityName);
    setSelectedCluster(null);
    try {
      const boundsData = await getDatasetBounds(
        selectedState === 'ALL' ? undefined : selectedState,
        cityName === 'All' ? undefined : cityName
      );
      if (boundsData && boundsData.bounds) {
        setMapBounds(boundsData.bounds);
      }
    } catch (err) {
      console.error('Failed to compute dynamic city bounds:', err);
    }
  };

  // 7. Reset map control: Dynamically re-fetches overall bounds directly from backend
  const handleResetMap = async () => {
    setSelectedState('ALL');
    setSelectedCity('All');
    setSelectedSeverity(undefined);
    setStartDate('');
    setEndDate('');
    setSelectedCluster(null);
    try {
      const boundsData = await getDatasetBounds();
      if (boundsData && boundsData.bounds) {
        setMapBounds(boundsData.bounds);
      }
    } catch (err) {
      console.error('Failed to reset bounds:', err);
    }
  };

  const currentClusters = algorithm === 'kmeans'
    ? (kmeansData?.clusters || [])
    : (dbscanData?.clusters || []);

  const filteredClusters = selectedCity === 'All'
    ? currentClusters
    : currentClusters.filter((c) => c.dominant_city.toLowerCase() === selectedCity.toLowerCase());

  const handleSelectCluster = (cluster: HotspotCluster) => {
    setSelectedCluster(cluster);
    const lat = cluster.center_lat;
    const lng = cluster.center_lng;
    const delta = Math.max(0.08, (cluster.spread_radius_km || 10) / 111.0);
    setMapBounds([
      [lat - delta, lng - delta],
      [lat + delta, lng + delta]
    ]);
  };

  if (loading && !kmeansData && !dbscanData && availableStates.length === 0) {
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

  const selectedStateObj = availableStates.find((s) => s.state === selectedState);
  const selectedStateLabel = selectedState === 'ALL'
    ? `All ${availableStates.length} Discovered States`
    : selectedStateObj ? `${selectedStateObj.name} (${selectedStateObj.state})` : selectedState;

  return (
    <div className="space-y-4">
      {/* Editorial Header */}
      <div className="pb-1 border-b border-[#E5E7E1] flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#252923]">
            Hotspot Explorer
          </h1>
          <p className="text-xs text-[#777D78] mt-0.5">
            Explore individual accident locations, K-Means geographic clusters, and DBSCAN hotspot corridors across {availableStates.length} US states + DC.
          </p>
        </div>
      </div>

      {/* Spatial Sample & Terminology Scope Card */}
      <div className="bg-[#F0F2ED] border border-[#E5E7E1] rounded-lg p-3 text-xs text-[#252923] flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#28634D] shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-[11px] leading-relaxed">
          <span className="font-semibold text-[#252923]">Map Sample & Layer Definitions: </span>
          Interactive markers and spatial clustering use a <strong>193,209-record stratified spatial sample</strong> (2.5% of the 7,728,394-record dataset) across <strong>{availableStates.length} states</strong> and <strong>{availableCities.length}+ cities</strong> for responsive browser rendering.
          {' '}<strong>Accident Locations</strong> plot individual coordinates; <strong>K-Means</strong> partitions coordinates into <em>K</em> geographic regions; <strong>DBSCAN</strong> identifies dense highway hotspot corridors (7.5 km Haversine radius).
        </div>
      </div>

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
              ML Hotspot Clusters
            </button>
            <button
              onClick={() => setViewMode('individual')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                viewMode === 'individual'
                  ? 'bg-white text-[#252923] shadow-sm font-semibold'
                  : 'text-[#777D78] hover:text-[#252923]'
              }`}
            >
              Accident Locations
            </button>
            <button
              onClick={() => setViewMode('density')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                viewMode === 'density'
                  ? 'bg-white text-[#252923] shadow-sm font-semibold'
                  : 'text-[#777D78] hover:text-[#252923]'
              }`}
            >
              Density Heatmap
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
                  {[3, 5, 8, 10, 15].map((k) => (
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
                  Radius: 7.5 km · Great-circle Haversine metric
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs text-[#777D78]">
              Loaded <strong className="text-[#252923]">{rawAccidents.length.toLocaleString()}</strong> of{' '}
              <strong className="text-[#252923]">{totalMatching.toLocaleString()}</strong> matching records in view
            </div>
          )}
        </div>

        {/* Lower Row: Dynamically Populated State, City, Severity, and Date Range Filters */}
        <div className="pt-2 border-t border-[#E5E7E1] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Dynamic State Selector */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[#777D78]">State:</span>
              <select
                value={selectedState}
                onChange={(e) => handleStateChange(e.target.value)}
                className="bg-[#F7F7F4] border border-[#E5E7E1] rounded px-2 py-1 text-xs text-[#252923] font-medium focus:outline-none focus:border-[#28634D]"
              >
                <option value="ALL">
                  All Available States ({availableStates.length})
                </option>
                {availableStates.map((st) => (
                  <option key={st.state} value={st.state}>
                    {st.name} ({st.state} — {st.count.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic City Selector (dependent on state) */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[#777D78]">City:</span>
              <select
                value={selectedCity}
                onChange={(e) => handleCityChange(e.target.value)}
                className="bg-[#F7F7F4] border border-[#E5E7E1] rounded px-2 py-1 text-xs text-[#252923] font-medium focus:outline-none focus:border-[#28634D]"
              >
                <option value="All">All Cities ({availableCities.length})</option>
                {availableCities.map((ct) => (
                  <option key={`${ct.state}-${ct.city}`} value={ct.city}>
                    {ct.city} ({ct.count.toLocaleString()})
                  </option>
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
            title="Reset to full dataset bounds"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#E5E7E1] bg-[#F7F7F4] hover:bg-[#F0F2ED] text-[#252923] font-medium transition"
          >
            <RotateCcw className="w-3 h-3 text-[#777D78]" />
            <span>Reset Bounds</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Map with dynamic fitBounds */}
      <HotspotMap
        viewMode={viewMode}
        clusters={filteredClusters}
        algorithm={algorithm}
        rawAccidents={rawAccidents}
        bounds={mapBounds}
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
                {algorithm === 'dbscan' ? 'DBSCAN Density Corridors' : 'K-Means Centroid Clusters'}
              </h2>
              <p className="text-xs text-[#777D78] mt-0.5">
                Dense corridors identified across {selectedStateLabel}
              </p>
            </div>
            <span className="text-xs text-[#777D78]">
              {filteredClusters.length} clusters identified · {totalMatching.toLocaleString()} total records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#252923]">
              <thead className="bg-[#F7F7F4] border-b border-[#E5E7E1] text-[11px] uppercase tracking-wider text-[#777D78] font-medium">
                <tr>
                  <th className="py-2.5 px-3">Cluster</th>
                  <th className="py-2.5 px-3">Primary Area</th>
                  <th className="py-2.5 px-3">State</th>
                  <th className="py-2.5 px-3">Coordinates</th>
                  <th className="py-2.5 px-3 text-right">Recorded Accidents</th>
                  <th className="py-2.5 px-3 text-right">Regional Share</th>
                  <th className="py-2.5 px-3 text-center">Avg Severity</th>
                  <th className="py-2.5 px-3 text-right">Spread Radius</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7E1]">
                {filteredClusters.map((cluster) => {
                  const isSelected = selectedCluster?.cluster_id === cluster.cluster_id && selectedCluster?.dominant_city === cluster.dominant_city;
                  return (
                    <tr
                      key={`${cluster.dominant_city}-${cluster.cluster_id}`}
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
                      <td className="py-2.5 px-3 font-semibold text-[#777D78]">
                        {cluster.state || 'N/A'}
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
                          Zoom
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
            DBSCAN with Spherical Haversine Metric
          </div>
          <p className="text-xs text-[#777D78] leading-relaxed">
            DBSCAN identifies clusters of arbitrary shape without pre-specifying cluster counts. Using true great-circle Haversine distance avoids flat Cartesian distortion across long interstate distances. Outlier incidents in remote highway segments that fail density thresholds (min_samples) are separated as noise.
          </p>
        </div>

        <div className="bg-white border border-[#E5E7E1] rounded-lg p-4 space-y-1.5 shadow-subtle">
          <div className="font-semibold text-xs text-[#252923]">
            K-Means Centroid Partitioning
          </div>
          <p className="text-xs text-[#777D78] leading-relaxed">
            K-Means partitions incident coordinates into K spherical geographic regions by minimizing squared Euclidean distance to each cluster center. While useful for creating operational boundaries and district dispatch centroids, it forces all points (including isolated rural incidents) into the nearest centroid.
          </p>
        </div>
      </div>
    </div>
  );
};
