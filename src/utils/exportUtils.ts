import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { WorkOrder, Realisasi, AppSettings } from '../types';

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

  // Auto column widths
  const max_width = data.reduce((w, r) => Math.max(w, r['Nomor WO'].length), 10);
  worksheet['!cols'] = [{ wch: 5 }, { wch: max_width + 4 }, { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 30 }, { wch: 35 }, { wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 12 }];

  XLSX.writeFile(workbook, `APHRO_WorkOrders_${new Date().toISOString().slice(0,10)}.xlsx`);
}

/**
 * Generate PDF Report for Realisasi Foto
 */
export function generateRealisasiFotoPDF(
  realisasiList: Realisasi[],
  workOrdersMap: Record<string, WorkOrder>,
  settings: AppSettings
) {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner
  doc.setFillColor(0, 82, 156); // PLN Blue
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('LAPORAN REALISASI FOTO ASSET PROTECTION', 14, 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${settings.namaUnitLayanan.toUpperCase()}`, 14, 18);
  doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`, 14, 24);

  let yPos = 36;

  realisasiList.forEach((rel, index) => {
    const wo = workOrdersMap[rel.workOrderId];
    
    // Check page height space
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    // WO Card Container Header
    doc.setFillColor(241, 245, 249);
    doc.rect(14, yPos, pageWidth - 28, 22, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, yPos, pageWidth - 28, 22, 'S');

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${index + 1}. WO NO: ${rel.nomorWO}`, 18, yPos + 7);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`ULP: ${wo?.ulpName || '-'} | Feeder: ${wo?.penyulangName || '-'}`, 18, yPos + 13);
    doc.text(`Petugas: ${rel.petugasName} | Tanggal: ${rel.tanggalRealisasi} | Progress: ${rel.progressPercent}% [${rel.status}]`, 18, yPos + 18);

    yPos += 26;

    // Photos side by side
    const photoWidth = (pageWidth - 36) / 2;
    const photoHeight = photoWidth * 0.65;

    // Before Photo
    if (rel.photosSebelum && rel.photosSebelum.length > 0) {
      try {
        doc.addImage(rel.photosSebelum[0].dataUrl, 'JPEG', 14, yPos, photoWidth, photoHeight);
        doc.setFontSize(8);
        doc.setTextColor(220, 38, 38);
        doc.text('FOTO SEBELUM (BEFORE)', 14, yPos + photoHeight + 4);
      } catch (e) {
        console.error('PDF Image render error:', e);
      }
    } else {
      doc.rect(14, yPos, photoWidth, photoHeight, 'S');
      doc.text('Tidak Ada Foto Sebelum', 18, yPos + photoHeight / 2);
    }

    // After Photo
    if (rel.photosSesudah && rel.photosSesudah.length > 0) {
      try {
        doc.addImage(rel.photosSesudah[0].dataUrl, 'JPEG', 14 + photoWidth + 8, yPos, photoWidth, photoHeight);
        doc.setFontSize(8);
        doc.setTextColor(22, 163, 74);
        doc.text('FOTO SESUDAH (AFTER)', 14 + photoWidth + 8, yPos + photoHeight + 4);
      } catch (e) {
        console.error('PDF Image render error:', e);
      }
    } else {
      doc.rect(14 + photoWidth + 8, yPos, photoWidth, photoHeight, 'S');
      doc.text('Tidak Ada Foto Sesudah', 14 + photoWidth + 12, yPos + photoHeight / 2);
    }

    yPos += photoHeight + 14;

    // Description
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Keterangan: ${rel.keterangan || 'Tidak ada catatan'}`, 14, yPos);
    
    yPos += 12;
  });

  doc.save(`Laporan_Realisasi_Foto_${new Date().toISOString().slice(0,10)}.pdf`);
}

/**
 * Generate PDF Summary Table Laporan Peta Pekerjaan
 */
export function generateLaporanPetaPDF(
  workOrders: WorkOrder[],
  settings: AppSettings
) {
  const doc = new jsPDF('landscape', 'mm', 'a4');

  doc.setFillColor(0, 82, 156);
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LAPORAN PETA & LOKASI PEKERJAAN ASSET PROTECTION (ROW)', 14, 11);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${settings.namaUnitLayanan.toUpperCase()} | Tanggal: ${new Date().toLocaleDateString('id-ID')}`, 14, 18);

  const tableData = workOrders.map((wo, i) => [
    i + 1,
    wo.nomorWO,
    wo.tanggal,
    wo.ulpName,
    wo.penyulangName,
    wo.lokasi,
    `${wo.latitude.toFixed(4)}, ${wo.longitude.toFixed(4)}`,
    wo.petugasName,
    wo.status,
    `${wo.progressPercent}%`,
  ]);

  autoTable(doc, {
    startY: 28,
    head: [['No', 'Nomor WO', 'Tanggal', 'ULP', 'Penyulang', 'Lokasi Pekerjaan', 'Koordinat GPS', 'Petugas', 'Status', 'Progress']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [0, 82, 156], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  doc.save(`Laporan_Peta_Pekerjaan_${new Date().toISOString().slice(0,10)}.pdf`);
}
