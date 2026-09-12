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

  // 1. Calculate Tiles
  const tiles = calculateGeographicTiles(points, 25); 

  // 2. Process each tile as a separate page
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    if (i > 0) doc.addPage();

    // Draw Page Header
    drawPDFFrame(doc, pageWidth, pageHeight);
    drawPDFHeader(doc, feederTitle, ulpTitle, i + 1, tiles.length, undefined);

    // Generate Map Image for this tile including the route
    const mapImage = await generateMapImageForTile(tile, 2000, 1000, routePositions); 
    if (mapImage) {
      doc.addImage(mapImage, 'PNG', 8, 28, 281, 122);
    }

    // Draw Legend and Info Box
    const tileExecutionDate = tile.points[0]?.tanggalRealisasi || realisasiList[0]?.tanggalRealisasi || workOrders[0]?.tanggal;
    await drawPDFFooter(doc, tile, settings, reguNameFromPoints(tile.points, workOrders), i + 1, tiles.length, tileExecutionDate);
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

function drawPDFHeader(doc: jsPDF, feeder: string, ulp: string, page: number, total: number, customTitle?: string) {
  doc.setLineWidth(0.5);
  doc.setDrawColor(15, 23, 42);
  doc.roundedRect(8, 8, 281, 18, 2, 2);
  doc.line(58, 8, 58, 26);
  doc.line(241, 8, 241, 26);

  // Left: PLN Icon Plus vector logo
  drawPLNIconPlusLogo(doc);

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

function drawPLNIconPlusLogo(doc: jsPDF) {
  // Yellow background badge
  doc.setFillColor(255, 235, 0); // #FFEB00
  doc.roundedRect(12, 11, 10, 12, 0.5, 0.5, 'F');
  
  // Wavy lines inside the yellow badge
  doc.setDrawColor(0, 162, 185); // Blue waves #00A2B9
  doc.setLineWidth(0.4);
  // Wave 1
  doc.line(13, 14, 15, 13.5); doc.line(15, 13.5, 17, 14.5); doc.line(17, 14.5, 19, 13.5); doc.line(19, 13.5, 21, 14);
  // Wave 2
  doc.line(13, 17, 15, 16.5); doc.line(15, 16.5, 17, 17.5); doc.line(17, 17.5, 19, 16.5); doc.line(19, 16.5, 21, 17);
  // Wave 3
  doc.line(13, 20, 15, 19.5); doc.line(15, 19.5, 17, 20.5); doc.line(17, 20.5, 19, 19.5); doc.line(19, 19.5, 21, 20);

  // Red lightning bolt
  doc.setFillColor(229, 62, 62); // Red #E53E3E
  doc.triangle(18.5, 11.5, 14, 17.5, 17, 17.5, 'F');
  doc.triangle(16.5, 17.5, 19.5, 17.5, 15, 22.5, 'F');

  // Text labels
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 162, 185); // Blue #00A2B9
  doc.text('PLN', 24, 15.5);
  doc.setFontSize(7);
  doc.setTextColor(0, 162, 185); // Blue #00A2B9
  doc.text('Electricity Service', 24, 20);
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

async function drawPDFFooter(doc: jsPDF, tile: MapTile, settings: any, regu: string, page: number, total: number, dbDate?: Date | string) {
  doc.roundedRect(8, 152, 281, 48, 2, 2);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('KETERANGAN :', 12, 157);
  doc.line(8, 159, 289, 159);

  doc.setDrawColor(226, 232, 240);
  doc.line(100, 159, 100, 200);
  doc.line(200, 159, 200, 200);

  const formattedDate = formatDateOnly(dbDate || new Date());
  
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
  try {
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

    const startX = Math.min(topLeftTile.x, bottomRightTile.x);
    const endX = Math.min(startX + 8, Math.max(topLeftTile.x, bottomRightTile.x));
    const startY = Math.min(topLeftTile.y, bottomRightTile.y);
    const endY = Math.min(startY + 8, Math.max(topLeftTile.y, bottomRightTile.y));

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
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
  } catch (error) {
    console.warn('ArcGIS map tile canvas tainted or blocked, falling back to offline-first clean vector map:', error);
    return generateVectorMapImageForTile(tile, width, height, routePositions);
  }
}

/**
  * High-fidelity offline-first vector map drawer when web tiles fail.
  * Completely bypasses CORS and network delays.
  */
function generateVectorMapImageForTile(
  tile: MapTile,
  width: number,
  height: number,
  routePositions: [number, number][] = []
): string | null {
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

  // Background - Clean Light Gray Map Theme
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, width, height);

  // Decorative Vegetation Area Vector Polygons (Makes the map look beautiful)
  ctx.fillStyle = '#e2f0d9';
  ctx.beginPath();
  ctx.roundRect(60, 80, 240, 150, 16);
  ctx.roundRect(width - 340, 120, 260, 220, 24);
  ctx.fill();

  // Primary Vector Roads (Aesthetic Grid)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  [height * 0.35, height * 0.7].forEach(yPos => {
    ctx.beginPath(); ctx.moveTo(0, yPos); ctx.lineTo(width, yPos); ctx.stroke();
  });
  [width * 0.3, width * 0.7].forEach(xPos => {
    ctx.beginPath(); ctx.moveTo(xPos, 0); ctx.lineTo(xPos, height); ctx.stroke();
  });

  // Road Centerlines
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 4;
  [height * 0.35, height * 0.7].forEach(yPos => {
    ctx.beginPath(); ctx.moveTo(0, yPos); ctx.lineTo(width, yPos); ctx.stroke();
  });
  [width * 0.3, width * 0.7].forEach(xPos => {
    ctx.beginPath(); ctx.moveTo(xPos, 0); ctx.lineTo(xPos, height); ctx.stroke();
  });

  // Grid Coordinate Lines
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 0.5;
  const gridSize = 150;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // Draw Route (Polyline)
  const routeCoords = routePositions.map(([lat, lng]) => project(lat, lng));
  if (routeCoords.length > 1) {
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(routeCoords[0].x, routeCoords[0].y);
    routeCoords.forEach(c => ctx.lineTo(c.x, c.y));
    ctx.stroke();

    ctx.strokeStyle = '#00a2b9'; // PLN Cyan Line
    ctx.lineWidth = 4;
    ctx.setLineDash([15, 10]);
    ctx.beginPath();
    ctx.moveTo(routeCoords[0].x, routeCoords[0].y);
    routeCoords.forEach(c => ctx.lineTo(c.x, c.y));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw North Arrow
  drawNorthArrow(ctx, width - 60, 60);

  // Draw Scale Bar
  drawScaleBar(ctx, 60, height - 60, lngSpan);

  // Projected Points
  const projectedPoints = tile.points.map(p => ({
    ...project(p.lat, p.lng),
    point: p
  }));

  // Resolve Label Collisions
  const labels = resolveLabelCollisions(projectedPoints, 230, 50, width, height);

  // Draw Leader Lines and Boxes
  labels.forEach(label => {
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(label.anchorX, label.anchorY);
    ctx.lineTo(label.x + label.width / 2, label.y + label.height / 2);
    ctx.stroke();

    // Box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(label.x, label.y, label.width, label.height, 6);
    ctx.fill();
    ctx.stroke();

    // Draw Badge circle (Pangkas: Yellow, Tebang: Red, Potong: Green)
    const checkStr = (label.point.keterangan || label.point.jenisTanaman || '').toUpperCase();
    let badgeBg = '#facc15';
    if (checkStr.includes('TEBANG')) badgeBg = '#ef4444';
    else if (checkStr.includes('POTONG')) badgeBg = '#22c55e';

    ctx.fillStyle = badgeBg;
    ctx.beginPath();
    ctx.arc(label.x + 22, label.y + label.height / 2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label.point.seqNo), label.x + 22, label.y + label.height / 2);

    // Text inside label box
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(label.point.noTiang, label.x + 42, label.y + 22);
    ctx.font = '10px sans-serif';
    ctx.fillText(label.point.jenisTanaman, label.x + 42, label.y + 38);
  });

  // Coordinate Dots
  projectedPoints.forEach(p => {
    const checkStr = (p.point.keterangan || p.point.jenisTanaman || '').toUpperCase();
    let color = '#fbbf24';
    if (checkStr.includes('TEBANG')) color = '#ef4444';
    else if (checkStr.includes('POTONG')) color = '#22c55e';

    ctx.fillStyle = color;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
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
