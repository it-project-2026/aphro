import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import Supercluster from 'supercluster';
import 'leaflet/dist/leaflet.css';
import { StatusBadge } from './StatusBadge';
import { formatDateDisplay } from '../../utils/dateUtils';
import { WOStatus } from '../../types';
import { Layers, Eye, Zap, MapPin, Sparkles } from 'lucide-react';

export interface MapPointItem {
  id: string | number;
  lat: number;
  lng: number;
  type: 'wo' | 'regu' | 'realisasi' | 'plant';
  title: string;
  subtitle?: string;
  status?: string;
  ulpName?: string;
  penyulangName?: string;
  reguName?: string;
  lokasi?: string;
  tanggal?: string;
  lastUpdate?: string;
  raw?: any;
}

interface OptimizedMapViewProps {
  points: MapPointItem[];
  polylinePositions?: [number, number][];
  center?: [number, number];
  zoom?: number;
  height?: string;
  showPolyline?: boolean;
  onPointClick?: (point: MapPointItem) => void;
  customMarkerRenderer?: (point: MapPointItem) => L.DivIcon;
  badgeTitle?: string;
  tileProvider?: 'osm' | 'carto' | 'esri';
}

// Custom Marker Icons for Default Types
function defaultMarkerIcon(type: string, status?: string) {
  let color = '#3B82F6'; // Default Blue
  if (type === 'regu') {
    const reguHtml = `
      <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
        <span style="position: absolute; width: 100%; height: 100%; border-radius: 9999px; background-color: rgba(239, 68, 68, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <div style="position: relative; width: 30px; height: 30px; border-radius: 9999px; background-color: #EF4444; border: 2px solid #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.25); display: flex; align-items: center; justify-content: center; color: white;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
      </div>
    `;
    return L.divIcon({
      className: 'custom-regu-leaflet-marker',
      html: reguHtml,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18],
    });
  }

  if (status === 'Selesai' || status === 'SELESAI') color = '#00A2B9'; // Teal
  else if (status === 'Sedang Dikerjakan') color = '#F59E0B'; // Amber
  else color = '#3B82F6'; // Blue

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="12" cy="12" r="5" fill="#ffffff" />
    </svg>
  `;

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: svg,
    iconSize: [28, 42],
    iconAnchor: [14, 42],
    popupAnchor: [0, -24],
  });
}

// Cluster Badge Icon Generator
function createClusterIcon(count: number) {
  let size = 'w-9 h-9 text-xs';
  let colorBg = 'bg-[#008396]';
  if (count > 50) {
    size = 'w-11 h-11 text-sm';
    colorBg = 'bg-amber-600';
  } else if (count > 15) {
    size = 'w-10 h-10 text-xs';
    colorBg = 'bg-[#00A2B9]';
  }

  const html = `
    <div class="flex items-center justify-center ${size} ${colorBg} text-white font-extrabold rounded-full border-2 border-white shadow-xl hover:scale-110 transition-transform cursor-pointer">
      <span>${count}</span>
    </div>
  `;

  return L.divIcon({
    className: 'custom-cluster-badge',
    html,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

// Map Bounds Auto Fitter & Controller Component
const MapViewController: React.FC<{
  points: MapPointItem[];
  clusterEngine: Supercluster<any, any>;
  onViewportChange: (clusters: any[], zoom: number) => void;
}> = ({ points, clusterEngine, onViewportChange }) => {
  const map = useMap();

  const updateViewport = useCallback(() => {
    if (!map) return;
    const bounds = map.getBounds();
    const zoom = Math.floor(map.getZoom());

    // Extend bounds slightly (15% padding) for smooth panning
    const padded = bounds.pad(0.15);
    const sw = padded.getSouthWest();
    const ne = padded.getNorthEast();

    const bbox: [number, number, number, number] = [
      sw.lng,
      sw.lat,
      ne.lng,
      ne.lat,
    ];

    try {
      const clusters = clusterEngine.getClusters(bbox, zoom);
      onViewportChange(clusters, zoom);
    } catch (e) {
      console.warn('Supercluster error during viewport query:', e);
    }
  }, [map, clusterEngine, onViewportChange]);

  // Fit bounds when points list changes significantly
  useEffect(() => {
    if (points.length > 0) {
      const validPoints = points.filter(p => !isNaN(p.lat) && !isNaN(p.lng) && p.lat !== 0 && p.lng !== 0);
      if (validPoints.length > 0) {
        const latLngs = validPoints.map(p => [p.lat, p.lng] as [number, number]);
        const bounds = L.latLngBounds(latLngs);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [points, map]);

  // Attach Leaflet Map Event Listeners
  useEffect(() => {
    updateViewport();

    map.on('moveend', updateViewport);
    map.on('zoomend', updateViewport);
    map.on('resize', updateViewport);

    return () => {
      map.off('moveend', updateViewport);
      map.off('zoomend', updateViewport);
      map.off('resize', updateViewport);
    };
  }, [map, updateViewport]);

  return null;
};

export const OptimizedMapView: React.FC<OptimizedMapViewProps> = ({
  points,
  polylinePositions = [],
  center = [-0.92, 100.4],
  zoom = 11,
  height = '560px',
  showPolyline = true,
  customMarkerRenderer,
  badgeTitle = '⚡ PETA GIS ROW (CANVAS & BOUNDING-BOX)',
  tileProvider = 'osm',
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const [visibleClusters, setVisibleClusters] = useState<any[]>([]);
  const [currentZoom, setCurrentZoom] = useState<number>(zoom);

  // Convert points array into GeoJSON Feature array for Supercluster
  const geojsonFeatures = useMemo(() => {
    return points
      .filter((p) => p && typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng))
      .map((p, idx) => ({
        type: 'Feature' as const,
        properties: {
          cluster: false,
          pointId: p.id,
          pointData: p,
          index: idx,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [p.lng, p.lat],
        },
      }));
  }, [points]);

  // Instantiate Supercluster engine with fast geospatial indexing
  const clusterEngine = useMemo(() => {
    const sc = new Supercluster({
      radius: 40,
      maxZoom: 17,
      minPoints: 2,
    });
    sc.load(geojsonFeatures);
    return sc;
  }, [geojsonFeatures]);

  const handleViewportChange = useCallback((clusters: any[], z: number) => {
    setVisibleClusters(clusters);
    setCurrentZoom(z);
  }, []);

  const handleClusterClick = useCallback((clusterId: number, lng: number, lat: number) => {
    if (!mapRef.current) return;
    try {
      const expansionZoom = Math.min(clusterEngine.getClusterExpansionZoom(clusterId), 18);
      mapRef.current.flyTo([lat, lng], expansionZoom, { duration: 0.6 });
    } catch (e) {
      mapRef.current.setView([lat, lng], (mapRef.current.getZoom() || 12) + 2);
    }
  }, [clusterEngine]);

  // Tile Layer Configuration (Free & Open Source OpenStreetMap - NO API KEY REQUIRED)
  const tileConfig = useMemo(() => {
    if (tileProvider === 'esri') {
      return {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS',
      };
    }
    return {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    };
  }, [tileProvider]);

  // Canvas Renderer Instance for Polylines and Map Shapes
  const canvasRenderer = useMemo(() => L.canvas({ padding: 0.5 }), []);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-inner bg-slate-900 border border-slate-200 dark:border-slate-800" style={{ height }}>
      {/* Viewport Floating Stats Badge */}
      <div className="absolute top-3 right-3 z-[400] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-xl text-[11px] space-y-2 font-sans text-slate-800 dark:text-slate-200 min-w-[250px] no-print">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
          <p className="font-extrabold text-[#008396] dark:text-teal-400 flex items-center space-x-1.5">
            <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>{badgeTitle}</span>
          </p>
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-[10px] flex items-center space-x-1">
            <Sparkles className="w-3 h-3" />
            <span>CANVAS ACTIVE</span>
          </span>
        </div>

        <div className="space-y-1 text-slate-600 dark:text-slate-400 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Area Viewport (BBox):</span>
            <span className="font-extrabold text-[#00A2B9] dark:text-teal-400">{visibleClusters.length} Objek Dilihat</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Total Data Terdaftar:</span>
            <span className="font-extrabold text-slate-700 dark:text-slate-300">{points.length} Titik</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Tingkat Zoom:</span>
            <span className="font-bold text-amber-600 dark:text-amber-400">Level {currentZoom}</span>
          </div>
        </div>

        <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center justify-between">
          <span>⚡ Bounding-Box Query Active</span>
          <span className="text-[#00A2B9] font-bold">Clustering ON</span>
        </div>
      </div>

      <MapContainer
        center={center}
        zoom={zoom}
        preferCanvas={true}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <MapViewController
          points={points}
          clusterEngine={clusterEngine}
          onViewportChange={handleViewportChange}
        />

        <TileLayer
          attribution={tileConfig.attribution}
          url={tileConfig.url}
          crossOrigin="anonymous"
          keepBuffer={3}
          updateWhenIdle={false}
        />

        {showPolyline && polylinePositions.length > 1 && (
          <>
            {/* Outer Line Casing */}
            <Polyline
              positions={polylinePositions}
              color="#0f172a"
              weight={6}
              opacity={0.8}
              renderer={canvasRenderer}
            />
            {/* Jaringan TR Feeder Line */}
            <Polyline
              positions={polylinePositions}
              color="#f59e0b"
              weight={3.5}
              opacity={1}
              dashArray="8, 6"
              renderer={canvasRenderer}
            />
          </>
        )}

        {/* Render Viewport Bounding-Box Clusters or Single Markers */}
        {visibleClusters.map((feature, idx) => {
          const [lng, lat] = feature.geometry.coordinates;
          const isCluster = feature.properties.cluster;

          if (isCluster) {
            const clusterId = feature.properties.cluster_id;
            const pointCount = feature.properties.point_count;
            const clusterIcon = createClusterIcon(pointCount);

            return (
              <Marker
                key={`cluster-${clusterId}-${idx}`}
                position={[lat, lng]}
                icon={clusterIcon}
                eventHandlers={{
                  click: () => handleClusterClick(clusterId, lng, lat),
                }}
              >
                <Tooltip direction="top" offset={[0, -18]} className="font-bold text-xs bg-slate-900 text-white border-none rounded-lg px-2 py-1">
                  {pointCount} Titik Terkumpul (Klik untuk memperbesar)
                </Tooltip>
              </Marker>
            );
          }

          // Single Point Marker
          const pt: MapPointItem = feature.properties.pointData;
          if (!pt) return null;

          const markerIcon = customMarkerRenderer
            ? customMarkerRenderer(pt)
            : defaultMarkerIcon(pt.type, pt.status);

          return (
            <Marker
              key={`pt-${pt.id}-${idx}`}
              position={[pt.lat, pt.lng]}
              icon={markerIcon}
            >
              {pt.type === 'regu' && pt.title && (
                <Tooltip permanent direction="top" offset={[0, -20]} className="bg-[#EF4444] text-white font-extrabold border-none rounded-lg px-2.5 py-1 shadow-md text-[11px]">
                  {pt.title}
                </Tooltip>
              )}
              <Popup>
                <div className="p-1.5 space-y-2 max-w-xs font-sans text-xs">
                  <div className="border-b border-slate-200 dark:border-slate-700 pb-1.5 flex items-center justify-between">
                    <span className="font-black text-[#008396] text-xs">
                      {pt.title}
                    </span>
                    {pt.status && <StatusBadge status={pt.status as WOStatus} size="sm" />}
                  </div>

                  <div className="space-y-1 text-xs">
                    {pt.subtitle && (
                      <p className="font-bold text-slate-900 dark:text-slate-100 leading-tight">
                        {pt.subtitle}
                      </p>
                    )}
                    {pt.penyulangName && pt.ulpName && (
                      <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                        ⚡ {pt.penyulangName} - {pt.ulpName}
                      </p>
                    )}
                    {pt.lokasi && (
                      <p className="text-slate-600 dark:text-slate-300 text-[11px]">📍 {pt.lokasi}</p>
                    )}
                    {pt.reguName && (
                      <p className="text-slate-700 dark:text-slate-200 text-[11px] font-semibold">
                        👷‍♂️ Regu ROW: <span className="font-black text-[#008396]">{pt.reguName}</span>
                      </p>
                    )}
                    {pt.tanggal && (
                      <p className="text-slate-500 text-[10px]">
                        📅 Tanggal: {formatDateDisplay(pt.tanggal)}
                      </p>
                    )}
                    {pt.lastUpdate && (
                      <p className="text-slate-500 text-[10px]">
                        🕒 Update: {new Date(pt.lastUpdate).toLocaleTimeString('id-ID')}
                      </p>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};
