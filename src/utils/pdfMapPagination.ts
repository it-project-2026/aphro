import { MapPoint, MapTile } from './pdfExportTypes';

/**
 * Calculates geographic tiles based on sequential chunks with max 10 points per page.
 * Ensures each PDF page / tile has a clean, readable layout without overlapping labels.
 */
export function calculateGeographicTiles(points: MapPoint[], maxPointsPerPage: number = 10): MapTile[] {
  if (points.length === 0) return [];

  const tiles: MapTile[] = [];
  const pageSize = Math.max(1, maxPointsPerPage);
  const numPages = Math.ceil(points.length / pageSize);

  for (let i = 0; i < numPages; i++) {
    const chunk = points.slice(i * pageSize, (i + 1) * pageSize);
    if (chunk.length === 0) continue;

    // 1. Find bounding box for this chunk of points
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    chunk.forEach(p => {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    });

    if (minLat === maxLat) {
      minLat -= 0.001;
      maxLat += 0.001;
    }
    if (minLng === maxLng) {
      minLng -= 0.001;
      maxLng += 0.001;
    }

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    tiles.push({
      id: i + 1,
      bounds: { north: maxLat, south: minLat, east: maxLng, west: minLng },
      points: chunk,
      center: { lat: centerLat, lng: centerLng },
      zoom: 16
    });
  }

  return tiles;
}

