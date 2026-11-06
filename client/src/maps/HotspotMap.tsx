import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip,
  useMap,
  useMapEvents
} from 'react-leaflet';
import { HotspotCluster, AccidentRecord } from '../types';

export type MapViewMode = 'individual' | 'density' | 'clusters';

interface HotspotMapProps {
  viewMode: MapViewMode;
  clusters: HotspotCluster[];
  algorithm: 'kmeans' | 'dbscan';
  rawAccidents: AccidentRecord[];
  center: [number, number];
  zoom: number;
  selectedClusterId?: number | null;
  onSelectCluster?: (cluster: HotspotCluster) => void;
  onViewportChange?: (bounds: { min_lat: number; max_lat: number; min_lng: number; max_lng: number }) => void;
}

// Helper to recenter map view programmatically when state changes
const RecenterView: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

// Hook to capture user pan/zoom and trigger viewport data updates
const ViewportListener: React.FC<{
  onViewportChange?: (bounds: { min_lat: number; max_lat: number; min_lng: number; max_lng: number }) => void;
}> = ({ onViewportChange }) => {
  const map = useMapEvents({
    moveend: () => {
      if (!onViewportChange) return;
      const b = map.getBounds();
      onViewportChange({
        min_lat: b.getSouth(),
        max_lat: b.getNorth(),
        min_lng: b.getWest(),
        max_lng: b.getEast(),
      });
    },
  });
  return null;
};

export const HotspotMap: React.FC<HotspotMapProps> = ({
  viewMode,
  clusters,
  algorithm,
  rawAccidents = [],
  center,
  zoom,
  selectedClusterId,
  onSelectCluster,
  onViewportChange
}) => {
  const getSeverityColor = (sev: number) => {
    if (sev >= 3.5) return '#C24E42'; // Level 4 (Severe)
    if (sev >= 2.6) return '#D69A43'; // Level 3 (High)
    if (sev >= 2.0) return '#28634D'; // Level 2 (Moderate)
    return '#529871'; // Level 1 (Minor)
  };

  const getClusterRadius = (count: number, maxCount: number) => {
    if (!maxCount || maxCount === 0) return 14;
    const scaled = (count / maxCount) * 30;
    return Math.max(12, Math.min(scaled, 38));
  };

  const maxAccidents = clusters.length > 0 ? Math.max(...clusters.map((c) => c.accident_count)) : 1;

  return (
    <div className="relative w-full h-[580px] md:h-[620px] rounded-lg overflow-hidden border border-[#E5E7E1] bg-[#F7F7F4] shadow-subtle">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="w-full h-full z-10"
      >
        <RecenterView center={center} zoom={zoom} />
        <ViewportListener onViewportChange={onViewportChange} />

        {/* Clean Standard OpenStreetMap Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={18}
        />

        {/* MODE A: Individual Accident Locations */}
        {viewMode === 'individual' &&
          rawAccidents.map((acc) => (
            <CircleMarker
              key={acc.id}
              center={[acc.latitude, acc.longitude]}
              radius={4}
              pathOptions={{
                color: getSeverityColor(acc.severity),
                fillColor: getSeverityColor(acc.severity),
                fillOpacity: 0.75,
                weight: 1,
              }}
            >
              <Popup>
                <div className="text-xs p-0.5 space-y-1">
                  <div className="font-semibold text-xs text-[#252923] border-b border-[#E5E7E1] pb-1">
                    Accident Record {acc.id}
                  </div>
                  <div className="text-[#252923]">
                    <span className="text-[#777D78]">Location: </span>
                    {acc.city}, {acc.state}
                  </div>
                  <div className="text-[#252923]">
                    <span className="text-[#777D78]">Severity: </span>
                    <span className="font-semibold text-[#28634D]">Level {acc.severity}</span>
                  </div>
                  <div className="text-[#252923]">
                    <span className="text-[#777D78]">Weather: </span>
                    {acc.weather_condition} ({acc.temperature_f}°F)
                  </div>
                  <div className="text-[#777D78] text-[11px] pt-0.5">
                    {acc.junction ? 'At highway junction' : 'Standard roadway segment'}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}

        {/* MODE B: Density Heatmap Circles */}
        {viewMode === 'density' &&
          rawAccidents.map((acc) => (
            <CircleMarker
              key={`density-${acc.id}`}
              center={[acc.latitude, acc.longitude]}
              radius={10}
              pathOptions={{
                color: 'transparent',
                fillColor: '#D69A43',
                fillOpacity: 0.22,
                weight: 0,
              }}
            />
          ))}

        {/* MODE C: ML Hotspot Clusters */}
        {viewMode === 'clusters' &&
          clusters.map((cluster) => {
            const color = getSeverityColor(cluster.average_severity);
            const radius = getClusterRadius(cluster.accident_count, maxAccidents);
            const isSelected = selectedClusterId === cluster.cluster_id;

            return (
              <CircleMarker
                key={`${algorithm}-${cluster.cluster_id}`}
                center={[cluster.center_lat, cluster.center_lng]}
                radius={radius}
                pathOptions={{
                  color: isSelected ? '#252923' : color,
                  fillColor: color,
                  fillOpacity: isSelected ? 0.9 : 0.6,
                  weight: isSelected ? 3 : 1.5,
                }}
                eventHandlers={{
                  click: () => {
                    if (onSelectCluster) onSelectCluster(cluster);
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -radius]} opacity={0.95}>
                  <div className="text-xs font-semibold text-[#252923]">
                    {cluster.dominant_city} Hotspot #{cluster.cluster_id + 1}
                    <div className="font-normal text-[11px] text-[#777D78]">
                      {cluster.accident_count.toLocaleString()} accidents ({cluster.accident_percentage}%)
                    </div>
                  </div>
                </Tooltip>

                <Popup>
                  <div className="text-xs p-1 min-w-[200px] space-y-1.5">
                    <div className="flex items-center justify-between border-b border-[#E5E7E1] pb-1.5 mb-1.5">
                      <span className="font-semibold text-xs text-[#252923]">
                        {cluster.dominant_city} Cluster #{cluster.cluster_id + 1}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                        style={{ backgroundColor: color }}
                      >
                        Level {cluster.average_severity}
                      </span>
                    </div>

                    <div className="space-y-1 text-[#252923]">
                      <div className="flex justify-between">
                        <span className="text-[#777D78]">Method:</span>
                        <span className="font-medium">{algorithm === 'kmeans' ? 'K-Means Centroid' : 'DBSCAN Area'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#777D78]">Recorded accidents:</span>
                        <span className="font-bold">{cluster.accident_count.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#777D78]">Share of dataset:</span>
                        <span>{cluster.accident_percentage}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#777D78]">Average delay severity:</span>
                        <span className="font-medium">{cluster.average_severity} / 4.0</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#777D78]">Spread radius:</span>
                        <span>{cluster.spread_radius_km} km</span>
                      </div>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
      </MapContainer>

      {/* Understated Legend Overlay */}
      <div className="absolute bottom-4 right-4 z-20 bg-white/95 backdrop-blur-sm border border-[#E5E7E1] rounded-md p-3 shadow-card text-xs max-w-[220px]">
        <div className="font-semibold text-xs text-[#252923] mb-1.5">
          {viewMode === 'clusters'
            ? 'Hotspot Severity'
            : viewMode === 'density'
            ? 'Accident Density'
            : 'Accident Severity'}
        </div>
        <div className="space-y-1 text-[11px] text-[#252923]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C24E42]"></span>
            <span>Level 4 — Severe delay</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D69A43]"></span>
            <span>Level 3 — Long delay</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#28634D]"></span>
            <span>Level 2 — Moderate delay</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#529871]"></span>
            <span>Level 1 — Minor impact</span>
          </div>
        </div>
        {viewMode === 'individual' && (
          <div className="mt-2 pt-1.5 border-t border-[#E5E7E1] text-[10px] text-[#777D78]">
            Showing {rawAccidents.length.toLocaleString()} locations in view
          </div>
        )}
      </div>
    </div>
  );
};
