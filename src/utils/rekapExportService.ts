/**
 * Excel & PDF Export Service untuk Rekap Pekerjaan Harian
 * Menghasilkan file Excel (.xlsx) dengan multi-level header, kolom tanggal dinamis,
 * pewarnaan merah untuk Sabtu, Minggu, Hari Libur Nasional, dan rumus perhitungan total.
 */

import ExcelJS from 'exceljs';
import { DayDetail } from './holidaysIndonesia';

export interface RekapItemData {
  id: string;
  noUrut?: number;
  kodeUnit?: string;
  namaUlp: string;
  timRow: string;
  target: number;
  keterangan: string;
  // Key: 'day_01', 'day_02', ..., each containing { tebang1: number, pangkas: number, tebang2: number }
  dailyValues: Record<string, { tebang1: number; pangkas: number; tebang2: number }>;
}

export async function exportRekapHarianToExcel(
  unitName: string,
  year: number,
  monthName: string,
  days: DayDetail[],
  rowsData: RekapItemData[],
  summaryTitle: string = 'UP3 BUKITTINGGI',
  summaryKodeUnit: string = ''
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'APHRO PLN System';
  workbook.created = new Date();

  const sheetName = `REKAP_${monthName.slice(0, 3)}_${year}`;
  const worksheet = workbook.addWorksheet(sheetName, {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  // 1. Title Rows
  const title1 = `LAPORAN HARIAN TIM ROW ${unitName.toUpperCase()}`;
  const title2 = `PER TANGGAL ${monthName.toUpperCase()} ${year}`;

  const row1 = worksheet.addRow([title1]);
  row1.font = { bold: true, size: 12, name: 'Calibri' };

  const row2 = worksheet.addRow([title2]);
  row2.font = { bold: true, size: 11, name: 'Calibri' };

  worksheet.addRow([]); // Blank line

  // 2. Table Headers (Multi-level header)
  // Header Row 1: NO. URUT | ULP | TIM ROW | [Day Name per 4 cols] | TOTAL | SISA | % | KET
  // Header Row 2:          |     |         | [Day Number (01, 02..)] |       |      |   |
  // Header Row 3:          |     |         | TEBANG | PANGKAS | TEBANG | TOTAL | | | |

  const headerRow1Values: any[] = ['NO. URUT', 'NAMA ULP', 'TIM ROW (NAMA REGU)'];
  const headerRow2Values: any[] = ['', '', ''];
  const headerRow3Values: any[] = ['', '', ''];

  days.forEach((d) => {
    // 4 columns per day: TEBANG, PANGKAS, TEBANG, TOTAL
    headerRow1Values.push(d.dayName, '', '', '');
    headerRow2Values.push(d.dayFormatted, '', '', '');
    headerRow3Values.push('TEBANG', 'PANGKAS', 'TEBANG', 'TOTAL');
  });

  // Summary headers
  headerRow1Values.push('TOTAL', 'SISA', '%', 'KET');
  headerRow2Values.push('', '', '', '');
  headerRow3Values.push('', '', '', '');

  const hRow1 = worksheet.addRow(headerRow1Values);
  const hRow2 = worksheet.addRow(headerRow2Values);
  const hRow3 = worksheet.addRow(headerRow3Values);

  const startHeaderRowNum = 4;
  const endHeaderRowNum = 6;

  // Header Styling (Gray background, border, centered)
  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFBFBFBF' }, // Classic Excel Header Gray
  };

  const headerFont: Partial<ExcelJS.Font> = {
    bold: true,
    size: 9,
    name: 'Calibri',
    color: { argb: 'FF000000' },
  };

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  // Format static headers (NO. URUT, ULP, TIM ROW)
  worksheet.mergeCells(startHeaderRowNum, 1, endHeaderRowNum, 1);
  worksheet.mergeCells(startHeaderRowNum, 2, endHeaderRowNum, 2);
  worksheet.mergeCells(startHeaderRowNum, 3, endHeaderRowNum, 3);

  // Format dynamic date headers
  let currentCol = 4;
  days.forEach((d) => {
    // Merge Day Name (cols: currentCol to currentCol + 3, row: 4)
    worksheet.mergeCells(startHeaderRowNum, currentCol, startHeaderRowNum, currentCol + 3);
    // Merge Day Number (cols: currentCol to currentCol + 3, row: 5)
    worksheet.mergeCells(startHeaderRowNum + 1, currentCol, startHeaderRowNum + 1, currentCol + 3);
    currentCol += 4;
  });

  // Format end headers (TOTAL, SISA, %, KET)
  const totalCol = currentCol;
  const sisaCol = currentCol + 1;
  const percentCol = currentCol + 2;
  const ketCol = currentCol + 3;

  worksheet.mergeCells(startHeaderRowNum, totalCol, endHeaderRowNum, totalCol);
  worksheet.mergeCells(startHeaderRowNum, sisaCol, endHeaderRowNum, sisaCol);
  worksheet.mergeCells(startHeaderRowNum, percentCol, endHeaderRowNum, percentCol);
  worksheet.mergeCells(startHeaderRowNum, ketCol, endHeaderRowNum, ketCol);

  // Apply styles to header rows
  for (let r = startHeaderRowNum; r <= endHeaderRowNum; r++) {
    const row = worksheet.getRow(r);
    row.height = 18;
    for (let c = 1; c <= ketCol; c++) {
      const cell = row.getCell(c);
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = thinBorder;
    }
  }

  // 3. Data Rows
  const redFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFF0000' }, // Pure Red as in user reference
  };

  const redFont: Partial<ExcelJS.Font> = {
    color: { argb: 'FFFFFFFF' },
    bold: true,
    size: 9,
    name: 'Calibri',
  };

  const regularFont: Partial<ExcelJS.Font> = {
    size: 9,
    name: 'Calibri',
    color: { argb: 'FF000000' },
  };

  let currentRowIdx = endHeaderRowNum + 1;

  rowsData.forEach((item, itemIdx) => {
    const rowValues: any[] = [
      item.noUrut ?? (itemIdx + 1),
      item.namaUlp,
      item.timRow,
    ];

    let rowTotal = 0;

    days.forEach((d) => {
      const val = item.dailyValues[d.dayFormatted] || { tebang1: 0, pangkas: 0, tebang2: 0 };
      const dayTotal = (val.tebang1 || 0) + (val.pangkas || 0) + (val.tebang2 || 0);
      rowTotal += dayTotal;

      rowValues.push(
        val.tebang1 > 0 ? val.tebang1 : '',
        val.pangkas > 0 ? val.pangkas : '',
        val.tebang2 > 0 ? val.tebang2 : '',
        dayTotal > 0 ? dayTotal : ''
      );
    });

    const target = item.target || 0;
    const sisa = target > 0 ? Math.max(0, target - rowTotal) : 0;
    const percent = target > 0 ? Math.round((rowTotal / target) * 100) : 0;

    rowValues.push(
      rowTotal > 0 ? rowTotal : 0,
      target > 0 ? sisa : '',
      target > 0 ? `${percent}%` : '',
      item.keterangan || ''
    );

    const dataRow = worksheet.addRow(rowValues);
    dataRow.height = 18;

    // Apply borders and alignment
    for (let c = 1; c <= ketCol; c++) {
      const cell = dataRow.getCell(c);
      cell.border = thinBorder;
      cell.font = regularFont;

      if (c === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (c === 2) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (c === 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else if (c === ketCol) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    }

    // Color Red for Weekend / Holiday columns
    let dayColStart = 4;
    days.forEach((d) => {
      if (d.isRedDay) {
        // Red color for all 4 subcolumns of this holiday/weekend
        for (let sub = 0; sub < 4; sub++) {
          const cIdx = dayColStart + sub;
          const cell = dataRow.getCell(cIdx);
          cell.fill = redFill;
          cell.font = redFont;
        }
      }
      dayColStart += 4;
    });

    currentRowIdx++;
  });

  // 4. Merge ULP for consecutive rows with the same ULP
  let uStart = endHeaderRowNum + 1;
  while (uStart < currentRowIdx) {
    const startUlpVal = rowsData[uStart - (endHeaderRowNum + 1)].namaUlp;
    let uEnd = uStart;
    while (
      uEnd + 1 < currentRowIdx &&
      rowsData[uEnd + 1 - (endHeaderRowNum + 1)].namaUlp === startUlpVal
    ) {
      uEnd++;
    }

    if (uEnd > uStart) {
      worksheet.mergeCells(uStart, 2, uEnd, 2);
    }
    uStart = uEnd + 1;
  }

  // 5. Total Summary Row (UP3 / UL Total Matrix)
  const summaryRowValues: any[] = [
    '',
    summaryTitle,
    '', // TIM ROW empty in summary
  ];

  let grandTotal = 0;

  days.forEach((d) => {
    let dayTebang1Sum = 0;
    let dayPangkasSum = 0;
    let dayTebang2Sum = 0;
    let dayTotalSum = 0;

    rowsData.forEach((row) => {
      const v = row.dailyValues[d.dayFormatted] || { tebang1: 0, pangkas: 0, tebang2: 0 };
      dayTebang1Sum += v.tebang1 || 0;
      dayPangkasSum += v.pangkas || 0;
      dayTebang2Sum += v.tebang2 || 0;
      dayTotalSum += (v.tebang1 || 0) + (v.pangkas || 0) + (v.tebang2 || 0);
    });

    grandTotal += dayTotalSum;

    summaryRowValues.push(
      dayTebang1Sum,
      dayPangkasSum,
      dayTebang2Sum,
      dayTotalSum
    );
  });

  let totalTarget = 0;
  rowsData.forEach((r) => {
    totalTarget += r.target || 0;
  });
  const totalSisa = totalTarget > 0 ? Math.max(0, totalTarget - grandTotal) : 0;
  const totalPercent = totalTarget > 0 ? Math.round((grandTotal / totalTarget) * 100) : 0;

  summaryRowValues.push(
    grandTotal,
    totalTarget > 0 ? totalSisa : 0,
    totalTarget > 0 ? `${totalPercent}%` : '',
    ''
  );

  const sumRow = worksheet.addRow(summaryRowValues);
  sumRow.height = 20;

  // Format Summary Row
  worksheet.mergeCells(currentRowIdx, 2, currentRowIdx, 3); // Merge ULP and TIM ROW cell for UP3
  for (let c = 1; c <= ketCol; c++) {
    const cell = sumRow.getCell(c);
    cell.fill = headerFill;
    cell.font = { bold: true, size: 9, name: 'Calibri' };
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  }

  // Auto column widths
  worksheet.getColumn(1).width = 12; // NO. URUT
  worksheet.getColumn(2).width = 24; // NAMA ULP
  worksheet.getColumn(3).width = 26; // TIM ROW (NAMA REGU)

  for (let c = 4; c < totalCol; c++) {
    worksheet.getColumn(c).width = 6; // Compact subcolumns for days
  }

  worksheet.getColumn(totalCol).width = 10;
  worksheet.getColumn(sisaCol).width = 8;
  worksheet.getColumn(percentCol).width = 8;
  worksheet.getColumn(ketCol).width = 14;

  // Generate buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `LAPORAN_HARIAN_TIM_ROW_${unitName.replace(/\s+/g, '_')}_${monthName}_${year}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
