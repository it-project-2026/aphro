import jsPDF from 'jspdf';
import { MapPoint, MapTile, LabelBox } from './pdfExportTypes';
import { calculateGeographicTiles } from './pdfMapPagination';
import { resolveLabelCollisions } from './pdfLabelPlacement';
import { AppSettings, WorkOrder, Realisasi } from '../types';
import { formatDateOnly } from './dateFormatter';

/**
 * Enhanced PDF Export Service for APHRO.
 * Handles tiling, anti-collision, and rich map elements.
 */
export async function generateEnhancedLaporanPetaPDF(
  workOrders: WorkOrder[],
  settings: AppSettings,
  filterUlpName: string,
  filterPenyulangName: string,
  realisasiList: Realisasi[],
  points: MapPoint[],
  routePositions: [number, number][] = [] // Added route support
) {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const areaName = settings.namaUnitLayanan.replace(/^UP3\s*/i, '').toUpperCase() || 'BUKITTINGGI';
  const ulpTitle = filterUlpName !== 'ALL' ? filterUlpName.toUpperCase() : (points[0]?.ulpName?.toUpperCase() || 'BASO');
  const feederTitle = filterPenyulangName !== 'ALL' ? filterPenyulangName.toUpperCase() : (points[0]?.penyulangName?.toUpperCase() || 'F. MATUR');

  // 0. Pre-fetch the Logo (Local Asset)
  const logoUrl = window.location.origin + "/logo_plnes.png";
  const logoData = await fetchImageAsDataUrl(logoUrl).catch(() => null);

  // 1. Calculate Tiles
  const tiles = calculateGeographicTiles(points, 25); 

  // 2. Process each tile as a separate page
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    if (i > 0) doc.addPage();

    // Draw Page Header
    drawPDFFrame(doc, pageWidth, pageHeight);
    drawPDFHeader(doc, feederTitle, ulpTitle, i + 1, tiles.length, undefined, logoData);

    // Generate Map Image for this tile including the route
    const mapImage = await generateMapImageForTile(tile, 2000, 1000, routePositions); 
    if (mapImage) {
      doc.addImage(mapImage, 'PNG', 8, 28, 281, 122);
    }

    // Draw Legend and Info Box
    await drawPDFFooter(doc, tile, settings, reguNameFromPoints(tile.points, workOrders), i + 1, tiles.length);
  }

  // Save the PDF
  const safeUlp = ulpTitle.replace(/[^a-zA-Z0-9]/g, '_');
  const safeFeeder = feederTitle.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Laporan_Peta_APHRO_${safeUlp}_${safeFeeder}_${Date.now()}.pdf`;
  doc.save(filename);
}

function drawPDFFrame(doc: jsPDF, w: number, h: number) {
  doc.setLineWidth(0.8);
  doc.setDrawColor(15, 23, 42);
  doc.roundedRect(6, 6, w - 12, h - 12, 3, 3);
}

function drawPDFHeader(doc: jsPDF, feeder: string, ulp: string, page: number, total: number, customTitle?: string, logoData?: string | null) {
  doc.setLineWidth(0.5);
  doc.setDrawColor(15, 23, 42);
  doc.roundedRect(8, 8, 281, 18, 2, 2);
  doc.line(58, 8, 58, 26);
  doc.line(241, 8, 241, 26);

  // Left: PLN Logo
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', 12, 10, 42, 14, undefined, 'FAST');
    } catch (e) {
      // Fallback if image fail
      drawOldLogo(doc);
    }
  } else {
    drawOldLogo(doc);
  }

  // Center: Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(customTitle || 'GAMBAR PETA POHON (ROW)', 149.5, 13.5, { align: 'center' });
  doc.setFontSize(8.5);
  doc.text(`FEEDER ${feeder} | ULP ${ulp}`, 149.5, 20, { align: 'center' });
  doc.setFontSize(7);
  doc.text(`Halaman ${page} dari ${total}`, 149.5, 24, { align: 'center' });

  // Right: Safety
  doc.setFontSize(8);
  doc.setTextColor(0, 162, 185);
  doc.text('Safety First 🛡️', 265, 15, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('APHRO GIS EXPORT', 265, 21, { align: 'center' });
}

function drawOldLogo(doc: jsPDF) {
  // Draw a "New Style" vector fallback that looks like the yellow PLN ES logo
  doc.setFillColor(234, 179, 8); // Yellow
  doc.roundedRect(12, 10, 14, 14, 2, 2, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text('⚡', 15.5, 18);
  
  doc.setFontSize(12);
  doc.setTextColor(3, 105, 161); // Blue
  doc.text('PLN', 30, 16);
  
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Icon Plus', 30, 22);
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Fetch failed');
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function drawPDFFooter(doc: jsPDF, tile: MapTile, settings: any, regu: string, page: number, total: number) {
  doc.roundedRect(8, 152, 281, 48, 2, 2);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('KETERANGAN :', 12, 157);
  doc.line(8, 159, 289, 159);

  doc.setDrawColor(226, 232, 240);
  doc.line(100, 159, 100, 200);
  doc.line(200, 159, 200, 200);

  const formattedDate = formatDateOnly(new Date());
  
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`TANGGAL: ${formattedDate}`, 12, 165);
  doc.text(`NAMA REGU: ${regu}`, 12, 172);
  doc.text(`TITIK PADA HALAMAN INI: ${tile.points.length}`, 12, 179);

  // Stats
  const tebang = tile.points.filter(p => p.keterangan.toUpperCase().includes('TEBANG')).length;
  const pangkas = tile.points.filter(p => p.keterangan.toUpperCase().includes('PANGKAS')).length;
  const potong = tile.points.filter(p => p.keterangan.toUpperCase().includes('POTONG')).length;

  doc.text(`TOTAL TEBANG: ${tebang}`, 104, 165);
  doc.text(`TOTAL PANGKAS: ${pangkas}`, 104, 172);
  doc.text(`TOTAL POTONG: ${potong}`, 104, 179);

  // Legend Symbols
  drawLegendSymbol(doc, 104, 185, '#ef4444', 'Tebang');
  drawLegendSymbol(doc, 134, 185, '#facc15', 'Pangkas');
  drawLegendSymbol(doc, 164, 185, '#22c55e', 'Potong');
  
  // Route Legend
  doc.setDrawColor(0, 162, 185); // PLN Cyan
  doc.setLineWidth(0.8);
  doc.setLineDashPattern([2, 1], 0);
  doc.line(104, 192, 114, 192);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(6);
  doc.text('Rute / Jalur Kerja', 117, 193);

  // Signatures
  doc.setFont('helvetica', 'bold');
  doc.text('Mengetahui / Disetujui', 245, 165, { align: 'center' });
  doc.text('______________________', 245, 190, { align: 'center' });
}

function drawLegendSymbol(doc: jsPDF, x: number, y: number, color: string, label: string) {
  doc.setFillColor(color);
  doc.circle(x, y, 1.5, 'F');
  doc.setFontSize(6);
  doc.text(label, x + 3, y + 1);
}

function reguNameFromPoints(points: MapPoint[], workOrders: WorkOrder[]): string {
  const firstWo = workOrders.find(wo => wo.nomorWO === points[0]?.nomorWO);
  return firstWo?.reguName || 'TIM ROW';
}

/**
 * Helper to calculate tile coordinates from lat/lng
 */
function getTileCoords(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const xtile = Math.floor(((lng + 180) / 360) * n);
  const ytile = Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n
  );
  return { x: xtile, y: ytile };
}

/**
 * Generates a high-resolution map image using Canvas API and Satellite tiles.
 */
async function generateMapImageForTile(
  tile: MapTile, 
  width: number, 
  height: number,
  routePositions: [number, number][] = []
): Promise<string | null> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Projection logic
  const { north, south, east, west } = tile.bounds;
  const latSpan = north - south;
  const lngSpan = east - west;
  const padding = 100;
  const usableW = width - padding * 2;
  const usableH = height - padding * 2;

  const project = (lat: number, lng: number) => ({
    x: padding + ((lng - west) / lngSpan) * usableW,
    y: height - padding - ((lat - south) / latSpan) * usableH
  });

  // 1. Fetch Satellite, Road, and Label Tiles
  // Determine optimal zoom level based on bounding box
  const getZoom = (lats: number, lngs: number) => {
    const maxSpan = Math.max(lats, lngs);
    if (maxSpan < 0.005) return 18;
    if (maxSpan < 0.01) return 17;
    if (maxSpan < 0.02) return 16;
    if (maxSpan < 0.05) return 15;
    return 14;
  };

  const zoom = getZoom(latSpan, lngSpan);
  const topLeftTile = getTileCoords(north, west, zoom);
  const bottomRightTile = getTileCoords(south, east, zoom);

  const satellitePromises: Promise<any>[] = [];
  const roadPromises: Promise<any>[] = [];
  const labelPromises: Promise<any>[] = [];

  for (let x = topLeftTile.x; x <= bottomRightTile.x; x++) {
    for (let y = topLeftTile.y; y <= bottomRightTile.y; y++) {
      // Satellite Tiles
      satellitePromises.push(new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve({ img, x, y });
        img.onerror = () => resolve(null);
        img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
      }));

      // Road/Transportation Overlay
      roadPromises.push(new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve({ img, x, y });
        img.onerror = () => resolve(null);
        img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/${zoom}/${y}/${x}`;
      }));

      // Boundaries and Places (Village names, small paths labels)
      labelPromises.push(new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve({ img, x, y });
        img.onerror = () => resolve(null);
        img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${zoom}/${y}/${x}`;
      }));
    }
  }

  const loadedSatTiles = (await Promise.all(satellitePromises)).filter(t => t !== null);
  const loadedRoadTiles = (await Promise.all(roadPromises)).filter(t => t !== null);
  const loadedLabelTiles = (await Promise.all(labelPromises)).filter(t => t !== null);

  // Background fallback
  ctx.fillStyle = '#0f172a'; 
  ctx.fillRect(0, 0, width, height);

  // Draw loaded Satellite tiles
  const tileToLng = (x: number, z: number) => (x / Math.pow(2, z)) * 360 - 180;
  const tileToLat = (y: number, z: number) => {
    const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  };

  loadedSatTiles.forEach(t => {
    const tNorth = tileToLat(t.y, zoom);
    const tSouth = tileToLat(t.y + 1, zoom);
    const tWest = tileToLng(t.x, zoom);
    const tEast = tileToLng(t.x + 1, zoom);

    const posTopLeft = project(tNorth, tWest);
    const posBottomRight = project(tSouth, tEast);

    ctx.drawImage(
      t.img, 
      posTopLeft.x, 
      posTopLeft.y, 
      posBottomRight.x - posTopLeft.x, 
      posBottomRight.y - posTopLeft.y
    );
  });

  // Draw Road and Label tiles on top
  [...loadedRoadTiles, ...loadedLabelTiles].forEach(t => {
    const tNorth = tileToLat(t.y, zoom);
    const tSouth = tileToLat(t.y + 1, zoom);
    const tWest = tileToLng(t.x, zoom);
    const tEast = tileToLng(t.x + 1, zoom);

    const posTopLeft = project(tNorth, tWest);
    const posBottomRight = project(tSouth, tEast);

    ctx.globalAlpha = 0.85;
    ctx.drawImage(
      t.img, 
      posTopLeft.x, 
      posTopLeft.y, 
      posBottomRight.x - posTopLeft.x, 
      posBottomRight.y - posTopLeft.y
    );
    ctx.globalAlpha = 1.0;
  });

  // Dark overlay to make labels pop
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(0, 0, width, height);

  // Grid (Subtle on satellite)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  const gridSize = 150;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // Draw Route (Polyline)
  if (routePositions.length > 1) {
    ctx.strokeStyle = '#06b6d4'; // Brighter Cyan for satellite contrast
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.setLineDash([20, 15]);
    
    ctx.beginPath();
    let first = true;
    routePositions.forEach(([lat, lng]) => {
      const pos = project(lat, lng);
      if (first) {
        ctx.moveTo(pos.x, pos.y);
        first = false;
      } else {
        ctx.lineTo(pos.x, pos.y);
      }
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
  }

  // Draw North Arrow
  drawNorthArrow(ctx, width - 60, 60);

  // Draw Scale Bar
  drawScaleBar(ctx, 60, height - 60, lngSpan);

  // Points & Labels
  const projectedPoints = tile.points.map(p => ({
    ...project(p.lat, p.lng),
    point: p
  }));

  const labels = resolveLabelCollisions(projectedPoints, 230, 50, width, height);

  // Draw Leader Lines and Boxes
  labels.forEach(label => {
    // Leader Line with shadow
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(label.anchorX, label.anchorY);
    ctx.lineTo(label.x + label.width/2, label.y + label.height/2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(label.x, label.y, label.width, label.height, 6);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${label.point.seqNo}. ${label.point.noTiang}`, label.x + 15, label.y + 28);
    ctx.font = '18px sans-serif';
    ctx.fillText(label.point.jenisTanaman, label.x + 15, label.y + 45);
  });

  // Draw Coordinate Dots with Glow
  projectedPoints.forEach(p => {
    const checkStr = (p.point.keterangan || p.point.jenisTanaman || '').toUpperCase();
    let color = '#fbbf24';
    if (checkStr.includes('TEBANG')) color = '#ef4444';
    else if (checkStr.includes('POTONG')) color = '#22c55e';

    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.fillStyle = color;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
  });

  return canvas.toDataURL('image/png');
}

function drawNorthArrow(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#0f172a';
  ctx.fillStyle = '#0f172a';
  ctx.lineWidth = 2;
  
  // N text
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', 0, -25);

  // Arrow triangle
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(10, 20);
  ctx.lineTo(0, 10);
  ctx.lineTo(-10, 20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawScaleBar(ctx: CanvasRenderingContext2D, x: number, y: number, lngSpan: number) {
  // Very rough scale estimation
  const meters = lngSpan * 111000 * Math.cos(-0.28 * Math.PI / 180);
  const scaleText = meters > 1000 ? `${(meters/10).toFixed(1)} km` : `${Math.round(meters/10)} m`;

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 100, y);
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x, y + 5);
  ctx.moveTo(x + 100, y - 5);
  ctx.lineTo(x + 100, y + 5);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(scaleText, x + 50, y - 10);
}
