import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { WorkOrder, Realisasi, AppSettings } from '../types';

/**
 * Export Cetak Photo to Excel file (Format REKAP HASIL ROW PT HALEYORA POWER)
 */
export function exportCetakPhotoToExcel(
  realisasiList: Realisasi[],
  workOrdersMap: Record<string, WorkOrder>,
  settings: AppSettings,
  filterUlpName?: string,
  fallbackWorkOrders: WorkOrder[] = []
) {
  const areaName = settings.namaUnitLayanan.replace(/^UP3\s*/i, '').toUpperCase() || 'BUKITTINGGI';
  const ulpTitle = filterUlpName && filterUlpName !== 'ALL' ? filterUlpName.toUpperCase() : 'BASO';

  let items = realisasiList.map((rel) => {
    const wo = workOrdersMap[rel.workOrderId];
    const lat = rel.latitude || wo?.latitude || -0.286071;
    const lng = rel.longitude || wo?.longitude || 100.449261;

    const fotoSebelum = rel.fotoSebelumUrl || (rel.photosSebelum?.[0]?.dataUrl ? 'TERSEDIA (FOTO EVIDEN)' : 'TIDAK ADA');
    const fotoSesudah = rel.fotoSesudahUrl || (rel.photosSesudah?.[0]?.dataUrl ? 'TERSEDIA (FOTO EVIDEN)' : 'TIDAK ADA');

    return [
      rel.nomorWO || wo?.nomorWO || '-',
      areaName,
      rel.ulpName || wo?.ulpName || ulpTitle,
      rel.reguName || wo?.reguName || rel.petugasName || 'TIM ROW BASO',
      rel.penyulangName || wo?.penyulangName || 'F Baso',
      rel.noTiang || wo?.lokasi || '-',
      rel.tanggalRealisasi || wo?.tanggal || '-',
      fotoSebelum,
      fotoSesudah,
      rel.jenisTanaman || wo?.jenisPekerjaan || 'PEMBERSIHAN HALAMAN GARDU',
      rel.keterangan || 'POTONG',
      rel.pertumbuhanTanaman || 'SEDANG',
      rel.kendala || 'NIHIL',
      `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    ];
  });

  if (items.length === 0 && fallbackWorkOrders.length > 0) {
    items = fallbackWorkOrders.map((wo) => {
      const lat = wo.latitude || -0.286071;
      const lng = wo.longitude || 100.449261;
      return [
        wo.nomorWO || '-',
        areaName,
        wo.ulpName || ulpTitle,
        wo.reguName || 'TIM ROW BASO',
        wo.penyulangName || 'F Baso',
        wo.lokasi || '-',
        wo.tanggal || '-',
        wo.lampiranUrl ? 'TERSEDIA (FOTO EVIDEN)' : 'TIDAK ADA',
        'TIDAK ADA',
        wo.jenisPekerjaan || 'PEMBANGKASAN POHON (ROW)',
        wo.deskripsi || 'POTONG',
        'SEDANG',
        'NIHIL',
        `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      ];
    });
  }

  const titleHeader = [
    ['REKAP HASIL ROW - PT HALEYORA POWER'],
    [`EVIDEN ROW AREA ${areaName} | ULP ${ulpTitle}`],
    [`TANGGAL EVIDEN: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' }).toUpperCase()}`],
    [''],
    [
      'NO WO',
      'AREA',
      'ULP',
      'NAMA TIM',
      'FEEDER',
      'NO TIANG',
      'TANGGAL EKSEKUSI',
      'FOTO SEBELUM',
      'FOTO SESUDAH',
      'JENIS TANAMAN',
      'KETERANGAN',
      'PERTUMBUHAN TANAMAN',
      'KENDALA',
      'LOKASI',
    ],
  ];

  const sheetData = [...titleHeader, ...items];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  worksheet['!cols'] = [
    { wch: 18 },
    { wch: 15 },
    { wch: 14 },
    { wch: 20 },
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
    { wch: 25 },
    { wch: 25 },
    { wch: 28 },
    { wch: 16 },
    { wch: 22 },
    { wch: 16 },
    { wch: 25 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Eviden ROW Photo');

  XLSX.writeFile(workbook, `Eviden_ROW_Photo_Area_${areaName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Generate PDF Report for Cetak Photo (Format REKAP HASIL ROW PT HALEYORA POWER)
 */
export function generateCetakPhotoPDF(
  realisasiList: Realisasi[],
  workOrdersMap: Record<string, WorkOrder>,
  settings: AppSettings,
  filterUlpName?: string,
  fallbackWorkOrders: WorkOrder[] = []
) {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm

  const areaName = settings.namaUnitLayanan.replace(/^UP3\s*/i, '').toUpperCase() || 'BUKITTINGGI';
  const ulpTitle = filterUlpName && filterUlpName !== 'ALL' ? filterUlpName.toUpperCase() : 'BASO';

  // Top Left & Top Right text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`EVIDEN ROW AREA ${areaName}`, 14, 10);
  doc.text(`ULP ${ulpTitle}`, pageWidth - 14, 10, { align: 'right' });

  // Main Banner REKAP HASIL ROW / PT HALEYORA POWER
  doc.setFillColor(37, 99, 235); // Royal Blue
  doc.rect(14, 13, pageWidth - 28, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('REKAP HASIL ROW', pageWidth / 2, 17.5, { align: 'center' });

  doc.setFillColor(29, 78, 216); // Darker Blue
  doc.rect(14, 19, pageWidth - 28, 5, 'F');
  doc.setFontSize(8);
  doc.text('PT HALEYORA POWER', pageWidth / 2, 22.5, { align: 'center' });

  let tableData = realisasiList.map((rel) => {
    const wo = workOrdersMap[rel.workOrderId];
    const lat = rel.latitude || wo?.latitude || -0.286071;
    const lng = rel.longitude || wo?.longitude || 100.449261;
    return [
      rel.nomorWO || wo?.nomorWO || '-',
      areaName,
      rel.ulpName || wo?.ulpName || ulpTitle,
      rel.reguName || wo?.reguName || rel.petugasName || 'TIM ROW BASO',
      rel.penyulangName || wo?.penyulangName || 'F Baso',
      rel.noTiang || wo?.lokasi || '-',
      rel.tanggalRealisasi || wo?.tanggal || '-',
      '', // Foto Sebelum (drawn via didDrawCell)
      '', // Foto Sesudah (drawn via didDrawCell)
      rel.jenisTanaman || wo?.jenisPekerjaan || 'PEMBERSIHAN HALAMAN GARDU',
      rel.keterangan || 'POTONG',
      rel.pertumbuhanTanaman || 'SEDANG',
      rel.kendala || 'NIHIL',
      `${lat.toFixed(6)},\n${lng.toFixed(6)}`,
    ];
  });

  if (tableData.length === 0 && fallbackWorkOrders.length > 0) {
    tableData = fallbackWorkOrders.map((wo) => {
      const lat = wo.latitude || -0.286071;
      const lng = wo.longitude || 100.449261;
      return [
        wo.nomorWO || '-',
        areaName,
        wo.ulpName || ulpTitle,
        wo.reguName || 'TIM ROW BASO',
        wo.penyulangName || 'F Baso',
        wo.lokasi || '-',
        wo.tanggal || '-',
        '',
        '',
        wo.jenisPekerjaan || 'PEMBANGKASAN POHON (ROW)',
        wo.deskripsi || 'POTONG',
        'SEDANG',
        'NIHIL',
        `${lat.toFixed(6)},\n${lng.toFixed(6)}`,
      ];
    });
  }

  autoTable(doc, {
    startY: 26,
    head: [
      [
        'NO WO',
        'AREA',
        'ULP',
        'NAMA TIM',
        'FEEDER',
        'NO TIANG',
        'TANGGAL EKSEKUSI',
        'FOTO SEBELUM',
        'FOTO SESUDAH',
        'JENIS TANAMAN',
        'KETERANGAN',
        'PERTUMBUHAN TANAMAN',
        'KENDALA',
        'LOKASI',
      ],
    ],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [59, 130, 246], // Sky Blue header
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.5,
      halign: 'center',
      valign: 'middle',
    },
    styles: {
      fontSize: 6,
      cellPadding: 1,
      valign: 'middle',
      halign: 'center',
      minCellHeight: 20, // Space for photo thumbnails
    },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold' },
      1: { cellWidth: 16 },
      2: { cellWidth: 14 },
      3: { cellWidth: 18 },
      4: { cellWidth: 14 },
      5: { cellWidth: 12 },
      6: { cellWidth: 16 },
      7: { cellWidth: 24 },
      8: { cellWidth: 24 },
      9: { cellWidth: 26 },
      10: { cellWidth: 16 },
      11: { cellWidth: 22 },
      12: { cellWidth: 15 },
      13: { cellWidth: 25 },
    },
    didDrawCell: (data) => {
      if (data.section === 'body') {
        const rowIndex = data.row.index;
        const rel = realisasiList[rowIndex];

        // Foto Sebelum Column (index 7)
        if (data.column.index === 7) {
          const imgBefore = rel?.photosSebelum?.[0]?.dataUrl || rel?.fotoSebelumUrl;
          if (imgBefore) {
            try {
              doc.addImage(
                imgBefore,
                'JPEG',
                data.cell.x + 1,
                data.cell.y + 1,
                data.cell.width - 2,
                data.cell.height - 2
              );
            } catch (err) {
              console.warn('PDF photo render error:', err);
            }
          }
        }

        // Foto Sesudah Column (index 8)
        if (data.column.index === 8) {
          const imgAfter = rel?.photosSesudah?.[0]?.dataUrl || rel?.fotoSesudahUrl;
          if (imgAfter) {
            try {
              doc.addImage(
                imgAfter,
                'JPEG',
                data.cell.x + 1,
                data.cell.y + 1,
                data.cell.width - 2,
                data.cell.height - 2
              );
            } catch (err) {
              console.warn('PDF photo render error:', err);
            }
          }
        }
      }
    },
  });

  doc.save(`Eviden_ROW_Photo_Area_${areaName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Export Cetak Peta to Excel file (Format GAMBAR PETA POHON ROW)
 */
export function exportCetakPetaToExcel(
  mapPoints: Array<{
    nomorWO: string;
    ulpName: string;
    penyulangName: string;
    jenisTanaman: string;
    noTiang: string;
    lat: number;
    lng: number;
    keterangan: string;
    pertumbuhanTanaman: string;
    status: string;
    photoUrl?: string;
  }>,
  settings: AppSettings,
  filterUlpName?: string,
  filterPenyulangName?: string
) {
  const areaName = settings.namaUnitLayanan.replace(/^UP3\s*/i, '').toUpperCase() || 'BUKITTINGGI';
  const ulpTitle = filterUlpName && filterUlpName !== 'ALL' ? filterUlpName.toUpperCase() : (mapPoints[0]?.ulpName?.toUpperCase() || 'BASO');
  const feederTitle = filterPenyulangName && filterPenyulangName !== 'ALL' ? filterPenyulangName.toUpperCase() : (mapPoints[0]?.penyulangName?.toUpperCase() || '1 BASO - G.H. TANJUNG ALAM');

  const rows = mapPoints.map((pt, idx) => [
    idx + 1,
    pt.nomorWO || '-',
    areaName,
    pt.ulpName || ulpTitle,
    pt.penyulangName || feederTitle,
    pt.noTiang || '-',
    pt.jenisTanaman || 'PEMBANGKASAN POHON (ROW)',
    pt.keterangan || 'POTONG',
    pt.pertumbuhanTanaman || 'SEDANG',
    pt.status || 'Selesai',
    pt.lat.toFixed(6),
    pt.lng.toFixed(6),
    `${pt.lat.toFixed(6)}, ${pt.lng.toFixed(6)}`,
    pt.photoUrl ? 'ADA FOTO' : 'TIDAK ADA',
  ]);

  const titleHeader = [
    ['GAMBAR PETA POHON (ROW) - PT HALEYORA POWER'],
    [`FEEDER: ${feederTitle} | ULP: ${ulpTitle} | AREA: ${areaName}`],
    [`TANGGAL CETAK: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' }).toUpperCase()}`],
    [''],
    [
      'NO',
      'NOMOR WO',
      'AREA',
      'ULP',
      'FEEDER / PENYULANG',
      'NO TIANG / LOKASI',
      'JENIS TANAMAN',
      'KETERANGAN',
      'PERTUMBUHAN TANAMAN',
      'STATUS',
      'LATITUDE',
      'LONGITUDE',
      'KOORDINAT',
      'FOTO EVIDEN',
    ],
  ];

  const sheetData = [...titleHeader, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 15 },
    { wch: 14 },
    { wch: 22 },
    { wch: 18 },
    { wch: 28 },
    { wch: 16 },
    { wch: 22 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 25 },
    { wch: 15 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Peta Pohon ROW');

  XLSX.writeFile(workbook, `Peta_Pohon_ROW_Area_${areaName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Export Work Orders list to Excel file
 */
export function exportWorkOrdersToExcel(workOrders: WorkOrder[], unitName: string) {
  const data = workOrders.map((wo, index) => ({
    'No': index + 1,
    'Nomor WO': wo.nomorWO,
    'Tanggal': wo.tanggal,
    'ULP': wo.ulpName,
    'Penyulang / Feeder': wo.penyulangName,
    'Koordinat': `${wo.latitude}, ${wo.longitude}`,
    'Jenis Pekerjaan': wo.jenisPekerjaan,
    'Prioritas': wo.prioritas,
    'Regu ROW': wo.reguName,
    'Status': wo.status,
    'Progress (%)': `${wo.progressPercent}%`,
    'Deadline': wo.deadline,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Work Order');

  worksheet['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 30 }, { wch: 35 }, { wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 22 }, { wch: 20 }];

  XLSX.writeFile(workbook, `WorkOrders_${unitName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

/**
 * Generate PDF Summary Table & Official Diagram Laporan Peta Pekerjaan (PETA POHON ROW)
 * Strictly matching the template image attached by the user.
 */
export function generateLaporanPetaPDF(
  workOrders: WorkOrder[],
  settings: AppSettings,
  filterUlpName?: string,
  filterPenyulangName?: string,
  realisasiList?: Realisasi[],
  mapImageDataUrl?: string,
  mapPointsData?: Array<{
    nomorWO: string;
    noTiang: string;
    jenisTanaman: string;
    lat: number;
    lng: number;
    keterangan: string;
    status: string;
  }>,
  customFilename?: string
) {
  const doc = new jsPDF('landscape', 'mm', 'a4');

  const areaName = settings.namaUnitLayanan.replace(/^UP3\s*/i, '').toUpperCase() || 'BUKITTINGGI';
  const ulpTitle = filterUlpName && filterUlpName !== 'ALL' ? filterUlpName.toUpperCase() : (realisasiList?.[0]?.ulpName?.toUpperCase() || workOrders[0]?.ulpName?.toUpperCase() || 'BASO');
  const feederTitle = filterPenyulangName && filterPenyulangName !== 'ALL' ? filterPenyulangName.toUpperCase() : (realisasiList?.[0]?.penyulangName?.toUpperCase() || workOrders[0]?.penyulangName?.toUpperCase() || 'F. MATUR');

  // 1. Outer Frame Box (Rounded clean dark container)
  doc.setLineWidth(0.8);
  doc.setDrawColor(15, 23, 42); // slate-900
  doc.roundedRect(6, 6, 285, 198, 3, 3);

  // 2. Header Block (Top Box)
  doc.setLineWidth(0.5);
  doc.roundedRect(8, 8, 281, 18, 2, 2);
  doc.line(58, 8, 58, 26);
  doc.line(241, 8, 241, 26);

  // Left Section: PLN Haleyora Power box
  doc.setFillColor(234, 179, 8); // Yellow background for lightning
  doc.roundedRect(12, 11, 7, 12, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('⚡', 13.5, 19.5);

  doc.setFontSize(11);
  doc.setTextColor(3, 105, 161); // sky-700
  doc.text('PLN', 21, 16);
  doc.setFontSize(8);
  doc.setTextColor(30, 58, 138); // sky-900
  doc.text('Haleyora Power', 21, 22);

  // Middle Section: GAMBAR PETA POHON (ROW) Title Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('GAMBAR PETA POHON (ROW)', 149.5, 13.5, { align: 'center' });
  doc.setFontSize(8.5);
  doc.setTextColor(3, 105, 161);
  doc.text(`FEEDER ${feederTitle}`, 149.5, 18.5, { align: 'center' });
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`ULP ${ulpTitle}`, 149.5, 23, { align: 'center' });

  // Right Section: Safety First & Certification Box
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87); // emerald-700
  doc.text('Safety First 🛡️', 265, 15, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('YKAN / SK3 Certified', 265, 21, { align: 'center' });

  // 3. Diagram / Map Canvas Box (x: 8..289, y: 28..150, height: 122)
  doc.setLineWidth(0.5);
  doc.setDrawColor(15, 23, 42);
  doc.roundedRect(8, 28, 281, 122, 2, 2);

  if (mapImageDataUrl) {
    // Render Actual GIS Map Screenshot
    try {
      doc.addImage(mapImageDataUrl, 'PNG', 8.5, 28.5, 280, 121, undefined, 'FAST');
    } catch (e) {
      console.error('Failed to draw map image in PDF:', e);
    }
  } else {
    // Fallback: Feeder line schematic
    doc.setFillColor(234, 179, 8); // Yellow
    doc.setDrawColor(180, 83, 9);
    doc.circle(15, 75, 3.5, 'FD');
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('1', 15, 77.5, { align: 'center' });

    doc.circle(280, 42, 3.5, 'FD');
    doc.text('2', 280, 44.5, { align: 'center' });

    doc.setLineWidth(1.2);
    doc.setDrawColor(245, 158, 11);
    doc.line(18, 75, 225, 88);
    doc.line(225, 88, 252, 75);
    doc.line(252, 75, 260, 52);
    doc.line(260, 52, 276, 30);
  }

  // 4. KETERANGAN Legend Block (Bottom Box matching image template)
  doc.roundedRect(8, 152, 281, 48, 2, 2);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('KETERANGAN :', 12, 157);

  doc.setLineWidth(0.4);
  doc.setDrawColor(15, 23, 42);
  doc.line(8, 159, 289, 159);

  // Column Dividers inside bottom legend
  doc.setDrawColor(226, 232, 240);
  doc.line(100, 159, 100, 200);
  doc.line(220, 159, 220, 200);

  // Column 1: Equipment Symbols
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  doc.text('• = TIANG BESI', 12, 164);
  doc.text('⊙ = TIANG BETON', 12, 169);
  doc.text('⊗ = TIANG BESI VS BESI', 12, 174);
  doc.text('▲ = GARDU DISTRIBUSI (GD) 1 TIANG BESI', 12, 179);
  doc.text('◼ = GARDU DISTRIBUSI (GD) 2 TIANG BESI', 12, 184);
  doc.text('✖ = TOWER', 12, 189);

  // Column 2: Line Legend & Action Color Boxes
  doc.text('────── = JARINGAN TEGANGAN RENDAH (TR) PLN', 105, 162);
  doc.text('------- = JARINGAN TEGANGAN MENENGAH (JTM)', 105, 167);
  doc.text('────── = KABEL TANAH (SKTM)', 105, 172);
  doc.text('───► = TRECK SCHOOR / DRUCK SCHOOR', 105, 177);

  // Colored action boxes
  // 1. PANGKAS (Yellow)
  doc.setFillColor(250, 204, 21);
  doc.rect(105, 182, 4, 4, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.text('= PANGKAS', 111, 185);

  // 2. POTONG (Green)
  doc.setFillColor(74, 222, 128);
  doc.rect(138, 182, 4, 4, 'FD');
  doc.text('= POTONG', 144, 185);

  // 3. TEBANG (Red)
  doc.setFillColor(248, 113, 113);
  doc.rect(168, 182, 4, 4, 'FD');
  doc.text('= TEBANG', 174, 185);

  // 4. TIDAK DIRAMPAL (White)
  doc.setFillColor(255, 255, 255);
  doc.rect(198, 182, 4, 4, 'FD');
  doc.text('= TIDAK DIRAMPAL', 204, 185);

  // Column 3: Date
  const formattedDate = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).toUpperCase();

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`TANGGAL ${formattedDate}`, 254, 192, { align: 'center' });

  // Save PDF file
  const safeUlp = ulpTitle.replace(/[^a-zA-Z0-9]/g, '_');
  const safeFeeder = feederTitle.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = customFilename || `Peta_Pohon_ROW_${safeUlp}_${safeFeeder}_${dateStr}.pdf`;
  doc.save(filename);
}
