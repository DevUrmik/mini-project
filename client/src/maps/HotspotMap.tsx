import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import { HotspotCluster, AccidentRecord } from '../types';
import { Layers } from 'lucide-react';

interface HotspotMapProps {
  clusters: HotspotCluster[];
  algorithm: 'kmeans' | 'dbscan';
  rawAccidents?: AccidentRecord[];
  center?: [number, number];
  zoom?: number;
  selectedClusterId?: number | null;
  onSelectCluster?: (cluster: HotspotCluster) => void;
}

// Helper to recenter map view programmatically
const RecenterView: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

export const HotspotMap: React.FC<HotspotMapProps> = ({
  clusters,
  algorithm,
  rawAccidents = [],
  center = [36.7783, -119.4179], // California default centroid
  zoom = 6,
  selectedClusterId,
  onSelectCluster
}) => {
  const [basemap, setBasemap] = useState<'osm' | 'esri_dark' | 'esri_streets'>('osm');

  const getSeverityColor = (sev: number) => {
    if (sev >= 3.0) return '#ef4444'; // Red (High Impact)
    if (sev >= 2.4) return '#f59e0b'; // Amber
    if (sev >= 2.1) return '#38bdf8'; // Sky blue
    return '#10b981'; // Green
  };

  const getClusterRadius = (count: number, maxCount: number) => {
    if (!maxCount || maxCount === 0) return 14;
    const scaled = (count / maxCount) * 32;
    return Math.max(12, Math.min(scaled, 40));
  };

  const maxAccidents = clusters.length > 0 ? Math.max(...clusters.map((c) => c.accident_count)) : 1;

  const tileConfigs = {
    osm: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    esri_dark: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    },
    esri_streets: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS',
    }
  };

  return (
    <div className="relative w-full h-[600px] rounded-2xl overflow-hidden border border-slate-800 shadow-xl bg-slate-950">
      {/* Basemap Style Switcher Floating Pill */}
      <div className="absolute top-4 right-4 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-1.5 shadow-xl flex items-center gap-1 text-xs">
        <div className="flex items-center gap-1.5 px-2 py-1 text-slate-400 font-medium">
          <Layers className="w-3.5 h-3.5 text-sky-400" />
          <span>Basemap:</span>
        </div>
        <button
          onClick={() => setBasemap('osm')}
          className={`px-2.5 py-1 rounded-lg font-medium transition ${
            basemap === 'osm'
              ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          OpenStreetMap
        </button>
        <button
          onClick={() => setBasemap('esri_dark')}
          className={`px-2.5 py-1 rounded-lg font-medium transition ${
            basemap === 'esri_dark'
              ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          Dark Canvas
        </button>
        <button
          onClick={() => setBasemap('esri_streets')}
          className={`px-2.5 py-1 rounded-lg font-medium transition ${
            basemap === 'esri_streets'
              ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          Streets
        </button>
      </div>

      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="w-full h-full z-10"
        style={{ background: '#0a0f1d' }}
      >
        <RecenterView center={center} zoom={zoom} />

        {/* 100% Free OpenStreetMap / Esri Tile Layer (No API Key Required) */}
        <TileLayer
          key={basemap}
          attribution={tileConfigs[basemap].attribution}
          url={tileConfigs[basemap].url}
          maxZoom={19}
        />

        {/* Individual sampled accidents (small contextual dots) */}
        {rawAccidents.map((acc) => (
          <CircleMarker
            key={acc.id}
            center={[acc.latitude, acc.longitude]}
            radius={3}
            pathOptions={{
              color: getSeverityColor(acc.severity),
              fillColor: getSeverityColor(acc.severity),
              fillOpacity: 0.6,
              weight: 0.8,
            }}
          >
            <Popup className="custom-leaflet-popup">
              <div className="text-xs p-1 text-slate-800">
                <div className="font-bold text-slate-900">Incident {acc.id}</div>
                <div>City: {acc.city}, {acc.state}</div>
                <div>Severity: Level {acc.severity}</div>
                <div>Weather: {acc.weather_condition} ({acc.temperature_f}°F)</div>
                <div>Junction: {acc.junction ? 'Yes' : 'No'} | Signal: {acc.traffic_signal ? 'Yes' : 'No'}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Hotspot Cluster Markers */}
        {clusters.map((cluster) => {
          const color = getSeverityColor(cluster.average_severity);
          const radius = getClusterRadius(cluster.accident_count, maxAccidents);
          const isSelected = selectedClusterId === cluster.cluster_id;

          return (
            <CircleMarker
              key={`${algorithm}-${cluster.cluster_id}`}
              center={[cluster.center_lat, cluster.center_lng]}
              radius={radius}
              pathOptions={{
                color: isSelected ? '#ffffff' : color,
                fillColor: color,
                fillOpacity: isSelected ? 0.9 : 0.65,
                weight: isSelected ? 3.5 : 2,
              }}
              eventHandlers={{
                click: () => {
                  if (onSelectCluster) onSelectCluster(cluster);
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -radius]} opacity={0.95}>
                <span className="font-semibold text-xs text-slate-900">
                  {cluster.dominant_city} Hotspot #{cluster.cluster_id + 1}
                  <br />
                  <span className="font-normal text-[11px] text-slate-600">
                    {cluster.accident_count.toLocaleString()} historical incidents ({cluster.accident_percentage}%)
                  </span>
                </span>
              </Tooltip>

              <Popup>
                <div className="text-xs p-1 text-slate-900 min-w-[200px]">
                  <div className="flex items-center justify-between border-b pb-1 mb-2">
                    <span className="font-bold text-sm text-slate-900">
                      {cluster.dominant_city} Hotspot
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white uppercase"
                      style={{ backgroundColor: color }}
                    >
                      Sev {cluster.average_severity}
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Algorithm:</span>
                      <span className="font-medium">{algorithm === 'kmeans' ? 'K-Means Centroid' : 'DBSCAN Core Area'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Historical Incidents:</span>
                      <span className="font-bold text-slate-900">{cluster.accident_count.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Share of Dataset:</span>
                      <span className="font-medium">{cluster.accident_percentage}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Avg Traffic Delay:</span>
                      <span className="font-medium">{cluster.average_severity} / 4.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Spread Radius:</span>
                      <span className="font-medium">{cluster.spread_radius_km} km (Haversine)</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t">
                      <span>Coordinates:</span>
                      <span>{cluster.center_lat.toFixed(4)}, {cluster.center_lng.toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Floating Map Legend Overlay */}
      <div className="absolute bottom-4 right-4 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-3.5 shadow-xl text-xs max-w-xs">
        <div className="font-bold text-slate-200 mb-2 flex items-center justify-between">
          <span>Spatial Hotspot Legend</span>
          <span className="text-[10px] text-sky-400 font-mono uppercase">{algorithm.toUpperCase()}</span>
        </div>
        <div className="space-y-1.5 text-slate-300 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#ef4444]"></span>
            <span>Severe Impact (Sev ≥ 3.0)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#f59e0b]"></span>
            <span>High Delay (Sev 2.4 - 2.9)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#38bdf8]"></span>
            <span>Moderate Delay (Sev 2.1 - 2.3)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#10b981]"></span>
            <span>Minor Delay (Sev &lt; 2.1)</span>
          </div>
        </div>
        <div className="mt-2.5 pt-2 border-t border-slate-800 text-[10px] text-slate-400 leading-tight">
          Marker radius scales with accident frequency. Concentrated along major freeway arteries (I-5, I-405, US-101).
        </div>
      </div>
    </div>
  );
};
