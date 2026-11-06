import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Layers,
  Sliders,
  Filter,
  Info,
  Car,
  Activity,
  Compass,
  ArrowRight
} from 'lucide-react';
import { HotspotMap } from '../maps/HotspotMap';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  getKMeansHotspots,
  getDBSCANHotspots,
  getAccidents,
  getClusteringComparison
} from '../services/api';
import {
  HotspotCluster,
  AccidentRecord,
  KMeansResponse,
  DBSCANResponse
} from '../types';

export const HotspotExplorer: React.FC = () => {
  const [algorithm, setAlgorithm] = useState<'kmeans' | 'dbscan'>('dbscan');
  const [kValue, setKValue] = useState<number>(10);
  const [kmeansData, setKmeansData] = useState<KMeansResponse | null>(null);
  const [dbscanData, setDbscanData] = useState<DBSCANResponse | null>(null);
  const [comparison, setComparison] = useState<any | null>(null);
  const [rawAccidents, setRawAccidents] = useState<AccidentRecord[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [selectedCluster, setSelectedCluster] = useState<HotspotCluster | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([36.7783, -119.4179]);
  const [mapZoom, setMapZoom] = useState<number>(6);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClusters = async () => {
    setLoading(true);
    setError(null);
    try {
      const [kmRes, dbRes, accRes, compRes] = await Promise.all([
        getKMeansHotspots(kValue),
        getDBSCANHotspots(),
        getAccidents({ limit: 120 }),
        getClusteringComparison()
      ]);
      setKmeansData(kmRes);
      setDbscanData(dbRes);
      setRawAccidents(accRes);
      setComparison(compRes);
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve spatial clustering models.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClusters();
  }, [kValue]);

  // Handle switching algorithm or K
  const currentClusters = algorithm === 'kmeans'
    ? (kmeansData?.clusters || [])
    : (dbscanData?.clusters || []);

  // Filter clusters by selected city
  const filteredClusters = selectedCity === 'All'
    ? currentClusters
    : currentClusters.filter((c) => c.dominant_city.toLowerCase() === selectedCity.toLowerCase());

  // Available cities for dropdown
  const uniqueCities = Array.from(new Set(currentClusters.map((c) => c.dominant_city))).filter(Boolean);

  const handleSelectCluster = (cluster: HotspotCluster) => {
    setSelectedCluster(cluster);
    setMapCenter([cluster.center_lat, cluster.center_lng]);
    setMapZoom(11);
  };

  const handleResetView = () => {
    setSelectedCluster(null);
    setSelectedCity('All');
    setMapCenter([36.7783, -119.4179]);
    setMapZoom(6);
  };

  if (loading && !kmeansData && !dbscanData) {
    return (
      <div className="space-y-6">
        <CardSkeleton count={3} />
        <div className="h-[550px] bg-slate-900 border border-slate-800 rounded-2xl animate-pulse"></div>
      </div>
    );
  }

  if (error && !kmeansData && !dbscanData) {
    return <ErrorBanner message={error} onRetry={fetchClusters} />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-sky-400" />
            Accident Hotspot Explorer
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Geospatial concentration identification comparing K-Means centroids and DBSCAN Haversine density clusters.
          </p>
        </div>

        {/* Algorithm Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => { setAlgorithm('dbscan'); setSelectedCluster(null); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              algorithm === 'dbscan'
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            DBSCAN (Haversine Density)
          </button>
          <button
            onClick={() => { setAlgorithm('kmeans'); setSelectedCluster(null); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              algorithm === 'kmeans'
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            K-Means (Centroids)
          </button>
        </div>
      </div>

      {/* Control Bar: Hyperparameters & Filters */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {algorithm === 'kmeans' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Number of Clusters (K):</span>
              <div className="flex items-center gap-1">
                {[5, 8, 10, 15, 20].map((k) => (
                  <button
                    key={k}
                    onClick={() => setKValue(k)}
                    className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition ${
                      kValue === k
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    K={k}
                  </button>
                ))}
              </div>
              <span className="text-[11px] font-mono text-slate-400 ml-2">
                Inertia: {kmeansData?.inertia.toLocaleString()}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">
                <span className="text-slate-400">Epsilon (Radius):</span>
                <span className="font-mono font-bold text-sky-300">7.5 km</span>
                <span className="text-slate-400 text-[10px]">(0.001177 rad)</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">
                <span className="text-slate-400">MinPts:</span>
                <span className="font-mono font-bold text-sky-300">35 pts</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">
                <span className="text-slate-400">Isolated Noise:</span>
                <span className="font-mono font-bold text-amber-300">
                  {dbscanData?.noise_points_count} ({dbscanData?.noise_percentage}%)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* City Filter & Reset */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-medium"
            >
              <option value="All">All Cities ({currentClusters.length} clusters)</option>
              {uniqueCities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleResetView}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            Reset View
          </button>
        </div>
      </div>

      {/* Main Interactive Map */}
      <HotspotMap
        clusters={filteredClusters}
        algorithm={algorithm}
        rawAccidents={rawAccidents}
        center={mapCenter}
        zoom={mapZoom}
        selectedClusterId={selectedCluster?.cluster_id}
        onSelectCluster={handleSelectCluster}
      />

      {/* Cluster Details Table / Cards */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              Identified Spatial Hotspots Ranked by Historical Incident Density
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Click any cluster row to pan and zoom directly to the high-density highway corridor on the map
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {filteredClusters.length} Clusters Displayed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 uppercase text-[10px] tracking-wider text-slate-400 font-mono">
              <tr>
                <th className="py-2.5 px-3">Cluster ID</th>
                <th className="py-2.5 px-3">Dominant Metro Corridor</th>
                <th className="py-2.5 px-3">Centroid Coordinates</th>
                <th className="py-2.5 px-3">Accident Volume</th>
                <th className="py-2.5 px-3">Dataset Share</th>
                <th className="py-2.5 px-3">Avg Severity</th>
                <th className="py-2.5 px-3">Spread Radius</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredClusters.map((cluster) => {
                const isSelected = selectedCluster?.cluster_id === cluster.cluster_id;
                return (
                  <tr
                    key={cluster.cluster_id}
                    onClick={() => handleSelectCluster(cluster)}
                    className={`cursor-pointer transition ${
                      isSelected
                        ? 'bg-sky-500/15 text-white'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="py-3 px-3 font-mono font-bold text-sky-400">
                      #{cluster.cluster_id + 1}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-100 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {cluster.dominant_city}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                      {cluster.center_lat.toFixed(4)}, {cluster.center_lng.toFixed(4)}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-white">
                      {cluster.accident_count.toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-400 rounded-full"
                            style={{ width: `${Math.min(cluster.accident_percentage * 2, 100)}%` }}
                          ></div>
                        </div>
                        <span className="font-mono text-[11px]">{cluster.accident_percentage}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        cluster.average_severity >= 2.5
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      }`}>
                        Level {cluster.average_severity}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                      {cluster.spread_radius_km} km
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-[11px] text-sky-400 hover:text-sky-300 font-medium inline-flex items-center gap-1">
                        View Map <ArrowRight className="w-3 h-3" />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Architectural Viva Comparison Box */}
      {comparison && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 text-xs">
            <div className="flex items-center gap-2 font-bold text-sky-400 mb-2">
              <Compass className="w-4 h-4" />
              <span>K-Means Spatial Characteristics</span>
            </div>
            <ul className="space-y-1.5 text-slate-300 text-[11px] leading-relaxed">
              <li>• <strong>Distance Metric:</strong> Euclidean planar coordinates approximation.</li>
              <li>• <strong>Cluster Shape:</strong> Spherical convex Voronoi partitions around geometric centroids.</li>
              <li>• <strong>Outlier Treatment:</strong> Forces every isolated rural incident into the nearest cluster center.</li>
              <li>• <strong>Best Suited:</strong> Partitioning regional highway emergency patrol zones.</li>
            </ul>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 text-xs">
            <div className="flex items-center gap-2 font-bold text-emerald-400 mb-2">
              <Activity className="w-4 h-4" />
              <span>DBSCAN Haversine Characteristics</span>
            </div>
            <ul className="space-y-1.5 text-slate-300 text-[11px] leading-relaxed">
              <li>• <strong>Distance Metric:</strong> Great-Circle Haversine spherical distance on Earth's curved surface.</li>
              <li>• <strong>Cluster Shape:</strong> Arbitrary geometric chains following real curvy highway corridors (I-5, I-405).</li>
              <li>• <strong>Outlier Treatment:</strong> Isolates sparse rural accidents as noise ({dbscanData?.noise_points_count} isolated).</li>
              <li>• <strong>Best Suited:</strong> High-precision blackspot detection without artificial geometric distortion.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

