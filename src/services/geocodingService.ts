/// <reference types="vite/client" />
import { LocationInfo } from '../utils/pdfExportTypes';

export const locationCache: Record<string, LocationInfo> = {};

export function isLocationCached(lat: number, lng: number): boolean {
  const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  return !!locationCache[key];
}

export async function reverseGeocode(lat: number, lng: number): Promise<LocationInfo> {
  const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  if (locationCache[key]) {
    return locationCache[key];
  }

  try {
    // Calling local server proxy to avoid CORS/Failed to fetch issues
    const url = `/api/reverse-geocode?lat=${lat}&lon=${lng}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    
    const data = await response.json();

    if (data && data.address) {
      const addr = data.address;
      
      // Extract meaningful building or place name
      const buildingName = addr.building || addr.amenity || addr.office || addr.shop || addr.house_number || 'N/A';
      const placeName = addr.village || addr.suburb || addr.city_district || addr.city || 'N/A';

      const info: LocationInfo = {
        placeName,
        buildingName,
        address: data.display_name
      };

      locationCache[key] = info;
      return info;
    }
  } catch (error) {
    console.error('Nominatim Geocoding Error:', error);
  }

  return {
    placeName: 'N/A',
    buildingName: 'N/A',
    address: 'Lokasi tidak ditemukan'
  };
}
