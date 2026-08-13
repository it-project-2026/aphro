import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { WorkOrder, Realisasi, AppSettings } from '../types';
import { formatDateTime, formatDateOnly, formatExecutionDateTime } from './dateFormatter';

/**
 * Utility to convert an image URL or dataUrl into base64 for ExcelJS embedding
 */
async function urlToBase64Image(url: string): Promise<{ base64: string; extension: 'jpeg' | 'png' } | null> {
  if (!url || typeof url !== 'string') return null;

  // 1. Data URL
  if (url.startsWith('data:image/')) {
    const isPng = url.startsWith('data:image/png');
    const parts = url.split(',');
    if (parts.length > 1 && parts[1].trim().length > 0) {
      return { base64: parts[1].trim(), extension: isPng ? 'png' : 'jpeg' };
    }
    return null;
  }

  // 2. Load via HTML Image & Canvas
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxW = 400;
        const maxH = 300;
        let w = img.width || 400;
        let h = img.height || 300;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = Math.max(w, 10);
        canvas.height = Math.max(h, 10);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const base64 = dataUrl.split(',')[1];
          if (base64) {
            resolve({ base64, extension: 'jpeg' });
            return;
          }
        }
      } catch (e) {
        console.warn('Canvas toDataURL failed:', e);
      }
      resolve(null);
    };

    img.onerror = () => {
      fetch(url)
        .then((res) => res.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            if (result && result.startsWith('data:image/')) {
              const isPng = result.startsWith('data:image/png');
              const base64 = result.split(',')[1];
              resolve(base64 ? { base64, extension: isPng ? 'png' : 'jpeg' } : null);
            } else {
              resolve(null);
            }
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        })
        .catch(() => resolve(null));
    };

    img.src = url;
  });
}

/**
 * Export Cetak Photo to Excel file (Format REKAP HASIL ROW PLN ELECTRICITY SERVICES)
 * Includes embedded photos directly inside the Excel cells with custom styles and borders.
 */
export async function exportCetakPhotoToExcel(
  realisasiList: Realisasi[],
  workOrdersMap: Record<string, WorkOrder>,
  settings: AppSettings,
  filterUlpName?: string,
  fallbackWorkOrders: WorkOrder[] = []
) {
  const areaName = settings.namaUnitLayanan.replace(/^UP3\s*/i, '').toUpperCase() || 'BUKITTINGGI';
  const ulpTitle = filterUlpName && filterUlpName !== 'ALL' ? filterUlpName.toUpperCase() : 'BASO';

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Eviden ROW Photo');

  worksheet.views = [{ showGridLines: true }];

  worksheet.columns = [
    { key: 'noWo', width: 22 },
    { key: 'area', width: 16 },
    { key: 'ulp', width: 16 },
    { key: 'namaTim', width: 22 },
    { key: 'feeder', width: 20 },
    { key: 'noTiang', width: 16 },
    { key: 'tanggalEksekusi', width: 22 },
    { key: 'fotoSebelum', width: 25 },
    { key: 'fotoSesudah', width: 25 },
    { key: 'jenisTanaman', width: 28 },
    { key: 'keterangan', width: 18 },
    { key: 'pertumbuhanTanaman', width: 22 },
    { key: 'kendala', width: 18 },
    { key: 'lokasi', width: 28 },
  ];

  // Row 1: REKAP HASIL ROW (bg-sky-600)
  const row1 = worksheet.addRow(['REKAP HASIL ROW']);
  row1.height = 28;
  worksheet.mergeCells('A1:N1');
  const cellA1 = worksheet.getCell('A1');
  cellA1.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  cellA1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } }; // Sky 600
  cellA1.alignment = { horizontal: 'center', vertical: 'middle' };
  cellA1.border = {
    top: { style: 'thin', color: { argb: 'FF0369A1' } },
    left: { style: 'thin', color: { argb: 'FF0369A1' } },
    bottom: { style: 'thin', color: { argb: 'FF0369A1' } },
    right: { style: 'thin', color: { argb: 'FF0369A1' } },
  };

  // Row 2: PLN ELECTRICITY SERVICES (bg-sky-800)
  const row2 = worksheet.addRow(['PLN ELECTRICITY SERVICES']);
  row2.height = 24;
  worksheet.mergeCells('A2:N2');
  const cellA2 = worksheet.getCell('A2');
  cellA2.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  cellA2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF075985' } }; // Sky 800
  cellA2.alignment = { horizontal: 'center', vertical: 'middle' };
  cellA2.border = {
    top: { style: 'thin', color: { argb: 'FF0C4A6E' } },
    left: { style: 'thin', color: { argb: 'FF0C4A6E' } },
    bottom: { style: 'thin', color: { argb: 'FF0C4A6E' } },
    right: { style: 'thin', color: { argb: 'FF0C4A6E' } },
  };

  // Row 3: Column Titles (bg-sky-900)
  const headers = [
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
  ];
  const row3 = worksheet.addRow(headers);
  row3.height = 26;
  row3.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C4A6E' } }; // Sky 900
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF0F172A' } },
      bottom: { style: 'thin', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FF0F172A' } },
    };
  });

  // Data Items
  let dataItems: Array<{
    noWo: string;
    area: string;
    ulp: string;
    namaTim: string;
    feeder: string;
    noTiang: string;
    tanggalEksekusi: string;
    fotoSebelumUrl?: string;
    fotoSesudahUrl?: string;
    jenisTanaman: string;
    keterangan: string;
    pertumbuhanTanaman: string;
    kendala: string;
    lokasi: string;
  }> = [];

  if (realisasiList.length > 0) {
    dataItems = realisasiList.map((rel) => {
      const wo = workOrdersMap[rel.workOrderId];
      const lat = rel.latitude || wo?.latitude || -0.286071;
      const lng = rel.longitude || wo?.longitude || 100.449261;

      return {
        noWo: rel.nomorWO || wo?.nomorWO || '-',
        area: areaName,
        ulp: rel.ulpName || wo?.ulpName || ulpTitle,
        namaTim: rel.reguName || wo?.reguName || rel.petugasName || 'TIM ROW BASO',
        feeder: rel.penyulangName || wo?.penyulangName || 'F Baso',
        noTiang: rel.noTiang || wo?.lokasi || '-',
        tanggalEksekusi: formatExecutionDateTime(rel, wo),
        fotoSebelumUrl: rel.photosSebelum?.[0]?.dataUrl || rel.fotoSebelumUrl,
        fotoSesudahUrl: rel.photosSesudah?.[0]?.dataUrl || rel.fotoSesudahUrl,
        jenisTanaman: rel.jenisTanaman || wo?.jenisPekerjaan || 'PEMBERSIHAN HALAMAN GARDU',
        keterangan: rel.keterangan || 'POTONG',
        pertumbuhanTanaman: rel.pertumbuhanTanaman || 'SEDANG',
        kendala: rel.kendala || 'NIHIL',
        lokasi: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      };
    });
  } else if (fallbackWorkOrders.length > 0) {
    dataItems = fallbackWorkOrders.map((wo) => {
      const lat = wo.latitude || -0.286071;
      const lng = wo.longitude || 100.449261;
      return {
        noWo: wo.nomorWO || '-',
        area: areaName,
        ulp: wo.ulpName || ulpTitle,
        namaTim: wo.reguName || 'TIM ROW BASO',
        feeder: wo.penyulangName || 'F Baso',
        noTiang: wo.lokasi || '-',
        tanggalEksekusi: formatExecutionDateTime(undefined, wo),
        fotoSebelumUrl: wo.lampiranUrl,
        fotoSesudahUrl: undefined,
        jenisTanaman: wo.jenisPekerjaan || 'PEMBANGKASAN POHON (ROW)',
        keterangan: wo.deskripsi || 'POTONG',
        pertumbuhanTanaman: 'SEDANG',
        kendala: 'NIHIL',
        lokasi: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      };
    });
  }

  const thinSlateBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  for (let idx = 0; idx < dataItems.length; idx++) {
    const item = dataItems[idx];
    const excelRowIndex = 4 + idx; // Data starts at Row 4

    const row = worksheet.addRow([
      item.noWo,
      item.area,
      item.ulp,
      item.namaTim,
      item.feeder,
      item.noTiang,
      item.tanggalEksekusi,
      item.fotoSebelumUrl ? '' : 'No Photo',
      item.fotoSesudahUrl ? '' : 'No Photo',
      item.jenisTanaman,
      item.keterangan,
      item.pertumbuhanTanaman,
      item.kendala,
      item.lokasi,
    ]);

    row.height = 95; // High row for embedding images cleanly

    row.eachCell((cell, colNumber) => {
      cell.border = thinSlateBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF0F172A' } };

      if (colNumber === 1) {
        cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF075985' } };
      }
      if (colNumber === 6) {
        cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
      }
      if ((colNumber === 8 && !item.fotoSebelumUrl) || (colNumber === 9 && !item.fotoSesudahUrl)) {
        cell.font = { name: 'Arial', size: 8.5, italic: true, color: { argb: 'FF94A3B8' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });

    // Embed Foto Sebelum into Col H (col 8 -> 7.1 in 0-based col)
    if (item.fotoSebelumUrl) {
      const imgData = await urlToBase64Image(item.fotoSebelumUrl);
      if (imgData) {
        const imageId = workbook.addImage({
          base64: imgData.base64,
          extension: imgData.extension,
        });
        worksheet.addImage(imageId, {
          tl: { col: 7.1, row: excelRowIndex - 0.9 },
          ext: { width: 140, height: 105 },
          editAs: 'oneCell',
        });
      } else {
        const cell = row.getCell(8);
        cell.value = 'Foto Tidak Dimuat';
        cell.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF94A3B8' } };
      }
    }

    // Embed Foto Sesudah into Col I (col 9 -> 8.1 in 0-based col)
    if (item.fotoSesudahUrl) {
      const imgData = await urlToBase64Image(item.fotoSesudahUrl);
      if (imgData) {
        const imageId = workbook.addImage({
          base64: imgData.base64,
          extension: imgData.extension,
        });
        worksheet.addImage(imageId, {
          tl: { col: 8.1, row: excelRowIndex - 0.9 },
          ext: { width: 140, height: 105 },
          editAs: 'oneCell',
        });
      } else {
        const cell = row.getCell(9);
        cell.value = 'Foto Tidak Dimuat';
        cell.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF94A3B8' } };
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `Eviden_ROW_Photo_Area_${areaName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * Generate PDF Report for Cetak Photo (Format REKAP HASIL ROW PLN ELECTRICITY SERVICES)
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

  // Main Banner REKAP HASIL ROW / PLN ELECTRICITY SERVICES
  doc.setFillColor(37, 99, 235); // Royal Blue
  doc.rect(14, 13, pageWidth - 28, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('REKAP HASIL ROW', pageWidth / 2, 17.5, { align: 'center' });

  doc.setFillColor(29, 78, 216); // Darker Blue
  doc.rect(14, 19, pageWidth - 28, 5, 'F');
  doc.setFontSize(8);
  doc.text('PLN ELECTRICITY SERVICES', pageWidth / 2, 22.5, { align: 'center' });

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
      formatExecutionDateTime(rel, wo),
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
        formatExecutionDateTime(undefined, wo),
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
export async function exportCetakPetaToExcel(
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

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Peta Pohon ROW');
  worksheet.views = [{ showGridLines: true }];

  worksheet.columns = [
    { key: 'no', width: 8 },
    { key: 'nomorWO', width: 22 },
    { key: 'area', width: 16 },
    { key: 'ulp', width: 16 },
    { key: 'feeder', width: 22 },
    { key: 'noTiang', width: 18 },
    { key: 'jenisTanaman', width: 28 },
    { key: 'keterangan', width: 16 },
    { key: 'pertumbuhanTanaman', width: 22 },
    { key: 'status', width: 16 },
    { key: 'latitude', width: 16 },
    { key: 'longitude', width: 16 },
    { key: 'koordinat', width: 26 },
    { key: 'fotoEviden', width: 25 },
  ];

  // Row 1: Banner Title
  const row1 = worksheet.addRow(['GAMBAR PETA POHON (ROW) - PLN ELECTRICITY SERVICES']);
  row1.height = 28;
  worksheet.mergeCells('A1:N1');
  const cellA1 = worksheet.getCell('A1');
  cellA1.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  cellA1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } }; // Sky 600
  cellA1.alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 2: Sub-Banner
  const row2 = worksheet.addRow([`FEEDER: ${feederTitle} | ULP: ${ulpTitle} | AREA: ${areaName}`]);
  row2.height = 24;
  worksheet.mergeCells('A2:N2');
  const cellA2 = worksheet.getCell('A2');
  cellA2.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  cellA2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF075985' } }; // Sky 800
  cellA2.alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 3: Headers
  const headers = [
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
  ];
  const row3 = worksheet.addRow(headers);
  row3.height = 26;
  row3.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C4A6E' } }; // Sky 900
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  const thinSlateBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  for (let idx = 0; idx < mapPoints.length; idx++) {
    const pt = mapPoints[idx];
    const excelRowIndex = 4 + idx;

    const row = worksheet.addRow([
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
      pt.photoUrl ? '' : 'No Photo',
    ]);

    row.height = pt.photoUrl ? 95 : 28;

    row.eachCell((cell, colNumber) => {
      cell.border = thinSlateBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF0F172A' } };

      if (colNumber === 2) {
        cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF075985' } };
      }
      if (colNumber === 14 && !pt.photoUrl) {
        cell.font = { name: 'Arial', size: 8.5, italic: true, color: { argb: 'FF94A3B8' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });

    if (pt.photoUrl) {
      const imgData = await urlToBase64Image(pt.photoUrl);
      if (imgData) {
        const imageId = workbook.addImage({
          base64: imgData.base64,
          extension: imgData.extension,
        });
        worksheet.addImage(imageId, {
          tl: { col: 13.1, row: excelRowIndex - 0.9 },
          ext: { width: 140, height: 105 },
          editAs: 'oneCell',
        });
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `Peta_Pohon_ROW_Area_${areaName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
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

  // Left Section: PLN Electricity Services box
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
  doc.text('Electricity Services', 21, 22);

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

  // 4. KETERANGAN Legend Block (Bottom Box matching summary requirements)
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
  doc.line(200, 159, 200, 200);

  const woNumbers = workOrders.map(w => w.nomorWO).join(', ') || realisasiList?.[0]?.nomorWO || '-';
  const formattedDate = formatDateOnly(realisasiList?.[0]?.tanggalRealisasi || workOrders[0]?.tanggal || new Date());
  const reguName = realisasiList?.[0]?.reguName || workOrders[0]?.petugasName || 'Regu ROW Alpha';
  const totalRealisasi = mapPointsData?.length || realisasiList?.length || workOrders.length;
  const pangkasCount = (mapPointsData || realisasiList || workOrders).filter(item => {
    const s = ((item as any).keterangan || (item as any).jenisPekerjaan || (item as any).jenisTanaman || '').toUpperCase();
    return s.includes('PANGKAS');
  }).length;
  const tebangCount = (mapPointsData || realisasiList || workOrders).filter(item => {
    const s = ((item as any).keterangan || (item as any).jenisPekerjaan || (item as any).jenisTanaman || '').toUpperCase();
    return s.includes('TEBANG');
  }).length;
  const potongCount = (mapPointsData || realisasiList || workOrders).filter(item => {
    const s = ((item as any).keterangan || (item as any).jenisPekerjaan || (item as any).jenisTanaman || '').toUpperCase();
    return s.includes('POTONG');
  }).length;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);

  // Column 1: Info Resmi Kiri (NO WO, TANGGAL, NAMA ULP, NAMA PENYULANG, NAMA REGU)
  doc.text(`NO WO: ${woNumbers}`, 12, 164);
  doc.text(`TANGGAL: ${formattedDate}`, 12, 171);
  doc.text(`NAMA ULP: ${ulpTitle}`, 12, 178);
  doc.text(`NAMA PENYULANG: ${feederTitle}`, 12, 185);
  doc.text(`NAMA REGU: ${reguName}`, 12, 192);

  // Column 2: Jumlah Realisasi Tengah
  doc.text(`JUMLAH REALISASI: ${totalRealisasi} Titik`, 104, 164);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9); // Amber for pangkas
  doc.text(`JUMLAH REALISASI PANGKAS: ${pangkasCount}`, 104, 171);
  doc.setTextColor(220, 38, 38); // Red for tebang
  doc.text(`JUMLAH REALISASI TEBANG: ${tebangCount}`, 104, 178);
  doc.setTextColor(22, 163, 74); // Green for potong
  doc.text(`JUMLAH REALISASI POTONG: ${potongCount}`, 104, 185);

  // Column 3: Mengetahui / Disetujui
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Mengetahui / Disetujui', 241, 175, { align: 'center' });

  // Save PDF file
  const safeUlp = ulpTitle.replace(/[^a-zA-Z0-9]/g, '_');
  const safeFeeder = feederTitle.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = customFilename || `Peta_Pohon_ROW_${safeUlp}_${safeFeeder}_${dateStr}.pdf`;
  doc.save(filename);
}
