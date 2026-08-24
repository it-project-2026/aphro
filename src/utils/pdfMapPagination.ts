import { MapPoint, MapTile } from './pdfExportTypes';

/**
 * Calculates geographic tiles based on marker density and total area.
 * Ensures each tile has a manageable number of markers for readability.
 */
export function calculateGeographicTiles(points: MapPoint[], maxPointsPerPage: number = 30): MapTile[] {
  if (points.length === 0) return [];

  // 1. Find the total bounding box
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  points.forEach(p => {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  });

  // If density is low, just one tile
  if (points.length <= maxPointsPerPage) {
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    return [{
      id: 1,
      bounds: { north: maxLat, south: minLat, east: maxLng, west: minLng },
      points,
      center: { lat: centerLat, lng: centerLng },
      zoom: 15 // Default zoom if one page
    }];
  }

  // 2. Recursive splitting or grid-based tiling
  // For simplicity, we'll start with a grid approach based on the aspect ratio and point count
  const numPages = Math.ceil(points.length / (maxPointsPerPage * 0.8)); // 20% buffer for overlap
  
  // Determine grid dimensions (cols * rows ≈ numPages)
  const latRange = maxLat - minLat;
  const lngRange = maxLng - minLng;
  
  // A4 Landscape aspect ratio is approx 1.41
  const aspectRatio = lngRange / latRange;
  
  let cols = Math.max(1, Math.round(Math.sqrt(numPages * aspectRatio)));
  let rows = Math.max(1, Math.ceil(numPages / cols));

  const tiles: MapTile[] = [];
  const latStep = latRange / rows;
  const lngStep = lngRange / cols;

  // Add 10% overlap padding to each tile
  const latPadding = latStep * 0.1;
  const lngPadding = lngStep * 0.1;

  let tileId = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const west = minLng + (c * lngStep) - lngPadding;
      const east = minLng + ((c + 1) * lngStep) + lngPadding;
      const south = minLat + (r * latStep) - latPadding;
      const north = minLat + ((r + 1) * latStep) + latPadding;

      // Filter points in this tile
      const tilePoints = points.filter(p => 
        p.lat >= south && p.lat <= north && p.lng >= west && p.lng <= east
      );

      if (tilePoints.length > 0) {
        tiles.push({
          id: tileId++,
          bounds: { north, south, east, west },
          points: tilePoints,
          center: { lat: (north + south) / 2, lng: (east + west) / 2 },
          zoom: 16 // Will be calculated dynamically later
        });
      }
    }
  }

  return tiles;
}
