import React, { useEffect, useState, useCallback, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { HotspotMap, MapViewMode } from '../maps/HotspotMap';
import { CardSkeleton } from '../components/LoadingSkeleton';
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
  ALL: { center: [37.5, -119.5], zoom: 5 },
  CA: { center: [36.7783, -119.4179], zoom: 6 },
  FL: { center: [27.9944, -81.7603], zoom: 7 },
  TX: { center: [31.9686, -99.9018], zoom: 6 },
};

export const HotspotExplorer: React.FC = () => {
  const [viewMode, setViewMode] = useState<MapViewMode>('clusters');
  const [algorithm, setAlgorithm] = useState<'kmeans' | 'dbscan'>('dbscan');
  const [kValue, setKValue] = useState<number>(10);
  const [selectedState, setSelectedState] = useState<string>('CA');
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [selectedSeverity, setSelectedSeverity] = useState<number | undefined>(undefined);

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
          limit: 600
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
  }, [kValue, selectedState, selectedCity, selectedSeverity]);

  // Viewport-based fetching on pan/zoom (debounced)
  const handleViewportChange = useCallback((bounds: { min_lat: number; max_lat: number; min_lng: number; max_lng: number }) => {
    if (viewMode === 'clusters') return; // Viewport fetching is for raw/density points

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
          severity: selectedSeverity,
          limit: 750
        });
        if (records.length > 0) {
          setRawAccidents(records);
        }
      } catch (err) {
        // Silent fail on viewport drag
      }
    }, 350);
  }, [viewMode, selectedState, selectedSeverity]);

  const handleStateChange = (stateCode: string) => {
    setSelectedState(stateCode);
    setSelectedCity('All');
    setSelectedCluster(null);
    const vp = STATE_VIEWPORTS[stateCode] || STATE_VIEWPORTS.ALL;
    setMapCenter(vp.center);
    setMapZoom(vp.zoom);
  };

  const handleResetMap = () => {
    setSelectedState('CA');
    setSelectedCity('All');
    setSelectedSeverity(undefined);
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

  const uniqueCities = Array.from(new Set(currentClusters.map((c) => c.dominant_city))).filter(Boolean);

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
            Explore individual incident locations, regional accident density, and machine learning cluster hotspots.
          </p>
        </div>
      </div>

      {/* Compact Map Toolbar */}
      <div className="bg-white border border-[#E5E7E1] rounded-lg p-3 shadow-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Visualization Mode Toggle */}
        <div className="flex items-center gap-1 bg-[#F0F2ED] p-0.5 rounded-md">
          <button
            onClick={() => setViewMode('clusters')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition ${
              viewMode === 'clusters'
                ? 'bg-white text-[#252923] shadow-sm font-semibold'
                : 'text-[#777D78] hover:text-[#252923]'
            }`}
          >
            Hotspot Clusters
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

        {/* Middle: Method Controls (when in cluster mode) */}
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
                DBSCAN (Density)
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
              <span className="text-xs text-[#777D78]">
                Radius: 7.5 km (Haversine)
              </span>
            )}
          </div>
        ) : (
          <div className="text-xs text-[#777D78]">
            Showing {rawAccidents.length.toLocaleString()} locations in view
          </div>
        )}

        {/* Right: State, City, Severity Filters and Reset */}
        <div className="flex items-center gap-2">
          {/* State */}
          <select
            value={selectedState}
            onChange={(e) => handleStateChange(e.target.value)}
            className="bg-[#F7F7F4] border border-[#E5E7E1] rounded px-2.5 py-1.5 text-xs text-[#252923] font-medium focus:outline-none focus:border-[#28634D]"
          >
            <option value="ALL">All States</option>
            <option value="CA">California (CA)</option>
            <option value="FL">Florida (FL)</option>
            <option value="TX">Texas (TX)</option>
          </select>

          {/* City */}
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="bg-[#F7F7F4] border border-[#E5E7E1] rounded px-2.5 py-1.5 text-xs text-[#252923] font-medium focus:outline-none focus:border-[#28634D]"
          >
            <option value="All">All Cities</option>
            {uniqueCities.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>

          {/* Severity */}
          <select
            value={selectedSeverity !== undefined ? String(selectedSeverity) : 'ALL'}
            onChange={(e) => setSelectedSeverity(e.target.value === 'ALL' ? undefined : Number(e.target.value))}
            className="bg-[#F7F7F4] border border-[#E5E7E1] rounded px-2.5 py-1.5 text-xs text-[#252923] font-medium focus:outline-none focus:border-[#28634D]"
          >
            <option value="ALL">All Severities</option>
            <option value="1">Level 1 (Minor)</option>
            <option value="2">Level 2 (Moderate)</option>
            <option value="3">Level 3 (Long delay)</option>
            <option value="4">Level 4 (Severe)</option>
          </select>

          {/* Reset Map */}
          <button
            onClick={handleResetMap}
            title="Reset map view"
            className="p-1.5 rounded border border-[#E5E7E1] hover:bg-[#F0F2ED] text-[#777D78] hover:text-[#252923] transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
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

      {/* Cluster Table (when viewing clusters) */}
      {viewMode === 'clusters' && (
        <div className="bg-white border border-[#E5E7E1] rounded-lg p-5 shadow-subtle">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-[#252923]">
                Identified accident concentrations
              </h2>
              <p className="text-xs text-[#777D78] mt-0.5">
                Dense corridors ranked by total recorded incidents
              </p>
            </div>
            <span className="text-xs text-[#777D78]">
              {filteredClusters.length} clusters found
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
                  <th className="py-2.5 px-3 text-right">Dataset Share</th>
                  <th className="py-2.5 px-3 text-center">Avg Delay Severity</th>
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
                          Level {cluster.average_severity}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#777D78]">
                        {cluster.spread_radius_km} km
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="text-[#28634D] font-medium hover:underline">
                          View
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

      {/* Natural Editorial Explanation Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#252923]">
        <div className="bg-white border border-[#E5E7E1] rounded-lg p-4 space-y-1.5 shadow-subtle">
          <div className="font-semibold text-xs text-[#28634D]">
            DBSCAN with Haversine Metric
          </div>
          <p className="text-xs text-[#777D78] leading-relaxed">
            DBSCAN groups points based on spatial density without requiring an upfront cluster count. Because road accidents occur on Earth’s spherical surface, Haversine great-circle distance is used instead of flat Cartesian coordinates to avoid geometric distortion across long freeway corridors.
          </p>
        </div>

        <div className="bg-white border border-[#E5E7E1] rounded-lg p-4 space-y-1.5 shadow-subtle">
          <div className="font-semibold text-xs text-[#252923]">
            K-Means Centroid Partitioning
          </div>
          <p className="text-xs text-[#777D78] leading-relaxed">
            K-Means groups coordinates into K geographic regions by minimizing the sum of squared distances to each center. While useful for dividing patrol areas, it forces all points into spherical clusters and includes remote rural incidents into the nearest cluster.
          </p>
        </div>
      </div>
    </div>
  );
};
