export interface MapPoint {
  id: string;
  nomorWO: string;
  noTiang: string;
  jenisTanaman: string;
  lat: number;
  lng: number;
  keterangan: string;
  lokasiKerja?: string;
  status: string;
  seqNo: number;
  ulpName?: string;
  penyulangName?: string;
}

export interface LocationInfo {
  placeName: string;
  buildingName: string;
  address: string;
}

export interface LabelBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  point: MapPoint;
  anchorX: number;
  anchorY: number;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

export interface MapTile {
  id: number;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  points: MapPoint[];
  center: { lat: number; lng: number };
  zoom: number;
}
