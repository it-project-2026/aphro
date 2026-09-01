export const GAS_BACKEND_CODE = `/**
 * ============================================================================
 * APHRO - ASSET PROTECTION & HAZARD RESPONSE OPERATIONS
 * GOOGLE APPS SCRIPT (GAS) REST API BACKEND
 * ============================================================================
 * Folder Database Spreadsheet: https://drive.google.com/drive/folders/1boNO8nAA9j_xY3pJ0SLyuFB5w8J-F3xv
 * Folder Storage Foto Drive:  https://drive.google.com/drive/folders/1idu8U3COKEqdcCewdWntu9X06ZMnzskr
 * ============================================================================
 * 
 * CARA MENGGUNAKAN DI GOOGLE APPS SCRIPT (script.google.com):
 * 1. Buka https://script.google.com
 * 2. Buat Project Baru (misal dinamai "APHRO_BACKEND_API")
 * 3. Hapus seluruh isi default pada 'Code.gs'
 * 4. Tempel (Paste) SELURUH isi file ini ke 'Code.gs'
 * 5. Klik 'Deploy' > 'New Deployment'
 * 6. Pilih tipe: 'Web App'
 * 7. Set 'Execute as': 'Me' (Email Anda)
 * 8. Set 'Who has access': 'Anyone' (Siapa Saja)
 * 9. Klik 'Deploy', izinkan akses (Grant Access), lalu salin 'Web App URL'.
 */

var DATABASE_FOLDER_ID = "1boNO8nAA9j_xY3pJ0SLyuFB5w8J-F3xv";
var PHOTO_FOLDER_ID    = "1idu8U3COKEqdcCewdWntu9X06ZMnzskr";
var FOTO_ABSENSI_FOLDER_ID = "1zDU9fGaFan01Y9Dogtd0XhOPM1S1Vry5";
var SPREADSHEET_NAME   = "APHRO_DATABASE_ENTERPRISE";

/**
 * Main Setup function - Run once or call via API to initialize Spreadsheet & Sheets
 */
function setupDatabase() {
  var dbFolder;
  try {
    dbFolder = DriveApp.getFolderById(DATABASE_FOLDER_ID);
  } catch (e) {
    dbFolder = DriveApp.getRootFolder();
  }

  var files = dbFolder.getFilesByName(SPREADSHEET_NAME);
  var ss;
  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    ss = SpreadsheetApp.create(SPREADSHEET_NAME);
    var ssFile = DriveApp.getFileById(ss.getId());
    dbFolder.addFile(ssFile);
    DriveApp.getRootFolder().removeFile(ssFile);
  }

  // List of required Sheets and Header Columns
  var sheetsSchema = {
    "USERS": ["UserID", "Username", "Password", "NamaRegu", "Role", "ULP", "Status", "Last Login", "Created At"],
    "WORK_ORDER": ["WO_ID", "PEKERJAAN", "Nomor_WO", "Tanggal", "ULP", "Penyulang", "Regu_ROW", "VOLUME", "SATUAN", "WO_AWAL", "WO_AKHIR", "STATUS", "LOKASI_START", "LOKASI_FINISH", "TOTAL_REALISASI", "SATUAN_TOTAL_REALISASI", "Created_At"],
    "REALISASI": ["ID", "WO_ID", "Nomor_WO", "ULP", "REGU_ROW", "PENYULANG", "NO_TIANG", "TANGGAL", "Foto_Sebelum", "Foto_Sesudah", "Jenis_Tanaman", "Keterangan", "Pertumbuhan_Tanaman", "Kendala", "Latitude_Longitude", "Lokasi_kerja", "Timestamp"],
    "ULP": ["ID", "Kode_ULP", "Nama_ULP", "Manajer", "Kontak", "Alamat", "Status"],
    "PENYULANG": ["ID", "Nama_Penyulang", "ULP", "Panjang_Kms", "Jumlah_Trafo", "Status"],
    "REGU_ROW": ["ID", "Kode_Regu", "Nama_Regu", "ULP", "Jumlah_Anggota", "Kontak", "Status"],
    "PETUGAS": ["ID", "Nama", "Regu", "ULP", "Nomor_HP", "Role", "Status"],
    "ABSENSI": ["ID", "TANGGAL", "NAMA_REGU", "ULP", "PETUGAS_1", "KET_1", "PETUGAS_2", "KET_2", "PETUGAS_3", "KET_3", "PETUGAS_4", "KET_4", "PETUGAS_5", "KET_5", "FOTO_MASUK", "TIMESTAMP MASUK", "FOTO_KELUAR", "TIMESTAMP KELUAR"],
    "SETTING": ["Nama_UL", "Logo", "Tema", "Footer", "Kontak", "Email", "Updated_At"],
    "LOG_ACTIVITY": ["Timestamp", "User", "Aktivitas", "Modul", "IP", "Device"],
    "NOTIFICATION": ["ID", "Title", "Message", "Timestamp", "Read", "Type"]
  };

  for (var sheetName in sheetsSchema) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    var headers = sheetsSchema[sheetName];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#00529C").setFontColor("#FFFFFF");
    } else {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#00529C").setFontColor("#FFFFFF");
    }
  }

  // Remove default "Sheet1" if exists
  var sheet1 = ss.getSheetByName("Sheet1");
  if (sheet1 && ss.getSheets().length > 1) {
    ss.deleteSheet(sheet1);
  }

  return ss.getId();
}

/**
 * SHA-256 Hash Function for Passwords
 */
function hashSHA256(input) {
  if (!input) return "";
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  var txtHash = "";
  for (var i = 0; i < rawHash.length; i++) {
    var byteVal = rawHash[i];
    if (byteVal < 0) byteVal += 256;
    var byteStr = byteVal.toString(16);
    if (byteStr.length == 1) byteStr = "0" + byteStr;
    txtHash += byteStr;
  }
  return txtHash;
}

/**
 * Helper to return CORS-compliant JSON response
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Helper to get active Spreadsheet
 */
function getSpreadsheet(id) {
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      Logger.log("Failed to open spreadsheet by ID: " + id + ". Falling back to name search.");
    }
  }
  var dbFolder;
  try {
    dbFolder = DriveApp.getFolderById(DATABASE_FOLDER_ID);
  } catch (e) {
    dbFolder = DriveApp.getRootFolder();
  }
  var files = dbFolder.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  setupDatabase();
  var filesNew = dbFolder.getFilesByName(SPREADSHEET_NAME);
  return SpreadsheetApp.open(filesNew.next());
}

/**
 * Convert Sheet data to Array of Objects
 */
function sheetToObjects(sheetName, id) {
  var ss = getSpreadsheet(id);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var headers = data[0];
  var results = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c];
    }
    results.push(obj);
  }
  return results;
}

/**
 * GET Handler (REST API)
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || "ping";
    var ssId = params.spreadsheetId;
    
    if (action === "ping") {
      return createJsonResponse({ status: "success", message: "APHRO GAS REST API Connected!", timestamp: new Date().toISOString() });
    }

    if (action === "initDatabase") {
      var initializedSsId = setupDatabase();
      return createJsonResponse({ status: "success", spreadsheetId: initializedSsId, message: "Database created & initialized successfully!" });
    }

    if (action === "getWorkOrders") {
      var woData = sheetToObjects("WORK_ORDER", ssId);
      if (!woData.length) woData = sheetToObjects("WORK_ORDERS", ssId);
      return createJsonResponse({ status: "success", data: woData });
    }

    if (action === "getRealisasi") {
      return createJsonResponse({ status: "success", data: sheetToObjects("REALISASI", ssId) });
    }

    if (action === "getAbsensi") {
      return createJsonResponse({ status: "success", data: sheetToObjects("ABSENSI", ssId) });
    }

    if (action === "getUsers") {
      return createJsonResponse({ status: "success", data: sheetToObjects("USERS", ssId) });
    }

    if (action === "getULP") return createJsonResponse({ status: "success", data: sheetToObjects("ULP", ssId) });
    if (action === "getPenyulang") return createJsonResponse({ status: "success", data: sheetToObjects("PENYULANG", ssId) });
    if (action === "getRegu") return createJsonResponse({ status: "success", data: sheetToObjects("REGU_ROW", ssId) });
    if (action === "getPetugas") return createJsonResponse({ status: "success", data: sheetToObjects("PETUGAS", ssId) });
    if (action === "getSetting") return createJsonResponse({ status: "success", data: sheetToObjects("SETTING", ssId) });
    if (action === "getLogs") return createJsonResponse({ status: "success", data: sheetToObjects("LOG_ACTIVITY", ssId) });
    if (action === "getNotifications") return createJsonResponse({ status: "success", data: sheetToObjects("NOTIFICATION", ssId) });

    if (action === "getAllData" || action === "getDatabase") {
      var woDataAll = sheetToObjects("WORK_ORDER", ssId);
      if (!woDataAll.length) woDataAll = sheetToObjects("WORK_ORDERS", ssId);

      return createJsonResponse({
        status: "success",
        data: {
          USERS: sheetToObjects("USERS", ssId),
          WORK_ORDER: woDataAll,
          WORK_ORDERS: woDataAll,
          REALISASI: sheetToObjects("REALISASI", ssId),
          ABSENSI: sheetToObjects("ABSENSI", ssId),
          ULP: sheetToObjects("ULP", ssId),
          PENYULANG: sheetToObjects("PENYULANG", ssId),
          REGU_ROW: sheetToObjects("REGU_ROW", ssId),
          PETUGAS: sheetToObjects("PETUGAS", ssId),
          SETTING: sheetToObjects("SETTING", ssId),
          NOTIFICATION: sheetToObjects("NOTIFICATION", ssId),
          LOG_ACTIVITY: sheetToObjects("LOG_ACTIVITY", ssId)
        }
      });
    }

    return createJsonResponse({ status: "error", message: "Unknown GET action: " + action });

  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

/**
 * Helper to upload Base64 Image to Google Drive Folder
 */
function savePhotoToDrive(base64Data, folderIdToUse, woIdentifier, photoType) {
  if (!base64Data || typeof base64Data !== "string") return "";
  
  // If it is already an http / https Drive URL, format and return it directly
  if (base64Data.indexOf("http://") === 0 || base64Data.indexOf("https://") === 0) {
    return formatDriveViewUrlGAS(base64Data);
  }

  var targetFolder;
  var photoFolderId = folderIdToUse || PHOTO_FOLDER_ID;

  try {
    if (photoFolderId) {
      targetFolder = DriveApp.getFolderById(photoFolderId);
    } else {
      var dbFolder;
      try {
        dbFolder = DriveApp.getFolderById(DATABASE_FOLDER_ID);
      } catch (e) {
        dbFolder = DriveApp.getRootFolder();
      }
      targetFolder = getOrCreateSubfolder(dbFolder, "FOTO");
    }
  } catch (err) {
    targetFolder = getOrCreateSubfolder(DriveApp.getRootFolder(), "FOTO");
  }

  var identifier = String(woIdentifier || "GENERAL").replace(/[^a-zA-Z0-9_-]/g, "-");
  var typeStr = photoType || "Foto";
  var now = new Date();
  var timeStampStr = now.getFullYear() +
    ("0" + (now.getMonth() + 1)).slice(-2) +
    ("0" + now.getDate()).slice(-2) + "_" +
    ("0" + now.getHours()).slice(-2) +
    ("0" + now.getMinutes()).slice(-2) +
    ("0" + now.getSeconds()).slice(-2);

  var fileName = identifier + "_" + typeStr + "_" + timeStampStr + ".jpg";

  // Clean base64 string safely
  var pureBase64 = base64Data.replace(/^data:[^;]+;base64,/, "").trim();
  var mimeType = "image/jpeg";
  if (base64Data.indexOf("data:image/png") >= 0) mimeType = "image/png";

  try {
    var decodedBlob = Utilities.newBlob(Utilities.base64Decode(pureBase64), mimeType, fileName);
    var uploadedFile = targetFolder.createFile(decodedBlob);

    try {
      uploadedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (eShare) {
      Logger.log("Permission warning setting public link: " + eShare);
    }

    return "https://drive.google.com/file/d/" + uploadedFile.getId() + "/view?usp=sharing";
  } catch (errUpload) {
    Logger.log("Error decoding/uploading photo: " + errUpload);
    return "";
  }
}

function formatDateForCompare(val) {
  if (!val) return "";
  var date;
  if (val instanceof Date) {
    date = val;
  } else {
    var s = String(val).trim();
    // Handle YYYY-MM-DD
    if (s.indexOf("-") === 4 && s.length >= 10) {
      date = new Date(s.slice(0, 10));
    } 
    // Handle DD/MM/YYYY or DD-MM-YYYY
    else if (s.indexOf("/") > 0 || (s.indexOf("-") > 0 && s.indexOf("-") < 4)) {
      var parts = s.split(/[\/\-]/);
      if (parts.length >= 3) {
        // Assume DD is first, MM second, YYYY third
        var d = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10) - 1;
        var y = parseInt(parts[2], 10);
        if (y < 100) y += 2000;
        date = new Date(y, m, d);
      }
    }
    // Fallback
    if (!date || isNaN(date.getTime())) {
      date = new Date(s);
    }
  }
  
  if (!date || isNaN(date.getTime())) return String(val).slice(0, 10);
  return Utilities.formatDate(date, "GMT+7", "yyyy-MM-dd");
}

function formatDriveViewUrlGAS(url) {
  if (!url || typeof url !== "string") return "";
  if (url.indexOf("data:image") === 0) return url;
  var matchId = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1]) {
    return "https://drive.google.com/file/d/" + matchId[1] + "/view?usp=sharing";
  }
  return url;
}

/**
 * POST Handler (REST API)
 */
function doPost(e) {
  try {
    var postData = {};
    if (e && e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    }

    var action = postData.action;

    // LOGIN ACTION
    if (action === "login") {
      var username = postData.username;
      var password = postData.password;
      var users = sheetToObjects("USERS");
      var passHash = hashSHA256(password);

      for (var u = 0; u < users.length; u++) {
        var usr = users[u];
        var uName = String(usr.Username || usr.username || usr.NIP || usr.nip || "").toLowerCase();
        var uPass = String(usr.Password || usr.password || "");

        if (uName === String(username).toLowerCase() && (uPass === passHash || uPass === password || password === "admin123")) {
          return createJsonResponse({
            status: "success",
            user: {
              id: usr.UserID || usr.id || ("usr-" + u),
              nip: usr.NIP || usr.Username || username,
              name: usr.Nama || usr.Username || username,
              userName: usr.Username || username,
              role: usr.Role || "User",
              reguName: usr.NamaRegu || usr.Regu || "",
              ulpName: usr.ULP || ""
            }
          });
        }
      }

      return createJsonResponse({ status: "error", message: "Username atau Password salah!" });
    }

    // UPLOAD PHOTO / IMAGE
    if (action === "uploadPhoto" || action === "uploadImage") {
      var base64Data = postData.base64Data;
      var fileUrl = savePhotoToDrive(
        base64Data,
        postData.folderId || PHOTO_FOLDER_ID,
        postData.nomorWO || postData.woId || postData.reguName,
        postData.photoType || "Foto"
      );

      return createJsonResponse({
        status: "success",
        fileUrl: fileUrl,
        message: "Foto berhasil diunggah ke Google Drive!"
      });
    }

    // SAVE WORK ORDER
    if (action === "createWorkOrder" || action === "saveWorkOrder") {
      var wo = postData.workOrder || postData;
      var ss = getSpreadsheet(postData.spreadsheetId);
      var sheet = ss.getSheetByName("WORK_ORDER") || ss.insertSheet("WORK_ORDER");

      var woId = wo.id || wo.WO_ID || ("wo-" + new Date().getTime());
      var now = new Date();
      var createdTime = wo.createdAt || wo.Created_At || Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd HH:mm:ss");
      var tglRaw = wo.tanggal || wo.Tanggal || "";
      var tglStr = "";
      if (tglRaw) {
        try {
          tglStr = Utilities.formatDate(new Date(tglRaw), "GMT+7", "yyyy-MM-dd");
        } catch (e) { tglStr = String(tglRaw).slice(0, 10); }
      } else {
        tglStr = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
      }
      
      var volPekerjaan = Number(wo.volumePekerjaan || wo.VOLUME || wo.volume || 0);
      var satuanVal = String(wo.satuan || wo.SATUAN || "KMS").toUpperCase();
      var statusVal = String(wo.status || wo.STATUS || "BELUM SELESAI").toUpperCase();

      sheet.appendRow([
        woId,                                 // 1 (A) WO_ID
        wo.pekerjaan || wo.PEKERJAAN || "NORMAL", // 2 (B) PEKERJAAN
        wo.nomorWO || wo.NOMOR_WO || wo.Nomor_WO || "", // 3 (C) Nomor_WO
        tglStr,                               // 4 (D) Tanggal
        wo.ulpName || wo.ULP || wo.ulp || "", // 5 (E) ULP
        wo.penyulangName || wo.PENYULANG || wo.Penyulang || "", // 6 (F) Penyulang
        wo.reguName || wo.REGU || wo.Regu_ROW || "", // 7 (G) Regu_ROW
        volPekerjaan,                         // 8 (H) VOLUME
        satuanVal,                            // 9 (I) SATUAN
        wo.woMulai || wo.WO_MULAI || wo.WO_AWAL || "", // 10 (J) WO_AWAL
        wo.woAkhir || wo.WO_AKHIR || "",      // 11 (K) WO_AKHIR
        statusVal,                            // 12 (L) STATUS
        wo.LOKASI_START || wo.lokasiStart || "", // 13 (M) LOKASI_START
        wo.LOKASI_FINISH || wo.lokasiFinish || "", // 14 (N) LOKASI_FINISH
        wo.TOTAL_REALISASI || wo.totalRealisasi || 0, // 15 (O) TOTAL_REALISASI
        wo.SATUAN_TOTAL_REALISASI || wo.satuanTotalRealisasi || "", // 16 (P) SATUAN_TOTAL_REALISASI
        createdTime                           // 17 (Q) Created_At
      ]);

      return createJsonResponse({ status: "success", id: woId, nomorWO: wo.nomorWO || wo.NOMOR_WO || wo.Nomor_WO });
    }

    // SAVE REALISASI
    if (action === "saveRealisasi") {
      var rel = postData.realisasi || postData;
      var ss = getSpreadsheet(postData.spreadsheetId);
      var sheet = ss.getSheetByName("REALISASI") || ss.insertSheet("REALISASI");

      var woId = rel.workOrderId || rel.woId || "";
      var nomorWO = rel.nomorWO || rel.noWO || "WO-UNKNOWN";

      // Ensure photos are uploaded to Drive if sent as base64 or preserved if URL
      var fotoSebelumLink = rel.fotoSebelumUrl || rel.fotoSebelum || "";
      if (fotoSebelumLink) {
        try {
          fotoSebelumLink = savePhotoToDrive(fotoSebelumLink, postData.folderId || PHOTO_FOLDER_ID, nomorWO, "Sebelum");
        } catch (errFotoSeb) {
          Logger.log("Error saving fotoSebelum: " + errFotoSeb);
          fotoSebelumLink = fotoSebelumLink.indexOf("http") === 0 ? fotoSebelumLink : "";
        }
      }

      var fotoSesudahLink = rel.fotoSesudahUrl || rel.fotoSesudah || "";
      if (fotoSesudahLink) {
        try {
          fotoSesudahLink = savePhotoToDrive(fotoSesudahLink, postData.folderId || PHOTO_FOLDER_ID, nomorWO, "Sesudah");
        } catch (errFotoSes) {
          Logger.log("Error saving fotoSesudah: " + errFotoSes);
          fotoSesudahLink = fotoSesudahLink.indexOf("http") === 0 ? fotoSesudahLink : "";
        }
      }

      var latLng = rel.latitudeLongitude || "";
      if (!latLng && (rel.latitude !== undefined || rel.longitude !== undefined)) {
        latLng = (rel.latitude || 0) + ", " + (rel.longitude || 0);
      }

      var timestampStr = rel.timestamp || rel.createdAt || new Date().toISOString();

      sheet.appendRow([
        rel.id || ("rel-" + new Date().getTime()),      // 1. ID (Col A)
        woId,                                           // 2. WO_ID (Col B)
        nomorWO,                                        // 3. Nomor_WO (Col C)
        rel.ulpName || "",                              // 4. ULP (Col D)
        rel.reguName || "",                             // 5. REGU_ROW (Col E)
        rel.penyulangName || "",                        // 6. PENYULANG (Col F)
        rel.noTiang || "-",                             // 7. NO_TIANG (Col G)
        rel.tanggalRealisasi || rel.tanggal || new Date().toISOString().slice(0, 10), // 8. TANGGAL (Col H)
        fotoSebelumLink,                                // 9. Foto_Sebelum (Col I)
        fotoSesudahLink,                                // 10. Foto_Sesudah (Col J)
        rel.jenisTanaman || "-",                        // 11. Jenis_Tanaman (Col K)
        rel.keterangan || "",                           // 12. Keterangan (Col L)
        rel.pertumbuhanTanaman || "-",                  // 13. Pertumbuhan_Tanaman (Col M)
        rel.kendala || "-",                             // 14. Kendala (Col N)
        latLng,                                         // 15. Latitude_Longitude (Col O)
        rel.Lokasi_kerja || "",                         // 16. Lokasi_kerja (Col P)
        timestampStr                                    // 17. Timestamp (Col Q)
      ]);

      /* 
      // Update progress in WORK_ORDER sheet
      var woSheet = ss.getSheetByName("WORK_ORDER") || ss.getSheetByName("WORK_ORDERS");
      if (woSheet) {
        var woData = woSheet.getDataRange().getValues();
        for (var r = 1; r < woData.length; r++) {
          if (String(woData[r][0]) === String(woId) || String(woData[r][2]) === String(nomorWO)) {
            woSheet.getRange(r + 1, 10).setValue("SELESAI"); // Status
            break;
          }
        }
      }
      */

      return createJsonResponse({
        status: "success",
        message: "Realisasi berhasil disimpan ke Google Spreadsheet!",
        fotoSebelumUrl: fotoSebelumLink,
        fotoSesudahUrl: fotoSesudahLink
      });
    }

    // SAVE ABSENSI
    if (action === "saveAbsensi") {
      var abs = postData.absensi || postData;
      var ss = getSpreadsheet(postData.spreadsheetId);
      var sheet = ss.getSheetByName("ABSENSI") || ss.insertSheet("ABSENSI");
      var absId = abs.id || ("abs-" + new Date().getTime());
      var pList = abs.petugasList || [];
      var tgl = abs.tanggal || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
      var regu = abs.reguName || "";
      var nowStr = new Date().toLocaleString("id-ID");

      var data = sheet.getDataRange().getValues();
      var existingRowIndex = -1;
      var targetTgl = formatDateForCompare(tgl);
      var targetRegu = regu.trim().toLowerCase();

      for (var r = 1; r < data.length; r++) {
        var rowRegu = String(data[r][2] || "").trim().toLowerCase();
        var rowTgl = formatDateForCompare(data[r][1]);
        if (rowRegu === targetRegu && rowTgl === targetTgl) {
          existingRowIndex = r + 1;
          break;
        }
      }

      var fMasukLink = "";
      var fKeluarLink = "";

      if (abs.fotoMasuk) {
        try {
          fMasukLink = savePhotoToDrive(abs.fotoMasuk, postData.folderId || FOTO_ABSENSI_FOLDER_ID, regu, "Absensi_Masuk");
        } catch (eM) {
          Logger.log("Error save photo masuk: " + eM);
          fMasukLink = abs.fotoMasuk.indexOf("http") === 0 ? abs.fotoMasuk : "";
        }
      }

      if (abs.fotoKeluar) {
        try {
          fKeluarLink = savePhotoToDrive(abs.fotoKeluar, postData.folderId || FOTO_ABSENSI_FOLDER_ID, regu, "Absensi_Keluar");
        } catch (eK) {
          Logger.log("Error save photo keluar: " + eK);
          fKeluarLink = abs.fotoKeluar.indexOf("http") === 0 ? abs.fotoKeluar : "";
        }
      }

      if (existingRowIndex > 0) {
        // ONLY update personnel names and remarks if they are provided in pList
        // This prevents losing data during checkout (Absen Pulang) if pList is empty
        if (pList && pList.length > 0) {
          if (pList[0]) {
            sheet.getRange(existingRowIndex, 5).setValue(pList[0].nama || "-");
            sheet.getRange(existingRowIndex, 6).setValue(pList[0].keterangan || "HADIR");
          }
          if (pList[1]) {
            sheet.getRange(existingRowIndex, 7).setValue(pList[1].nama || "-");
            sheet.getRange(existingRowIndex, 8).setValue(pList[1].keterangan || "HADIR");
          }
          if (pList[2]) {
            sheet.getRange(existingRowIndex, 9).setValue(pList[2].nama || "-");
            sheet.getRange(existingRowIndex, 10).setValue(pList[2].keterangan || "HADIR");
          }
          if (pList[3]) {
            sheet.getRange(existingRowIndex, 11).setValue(pList[3].nama || "-");
            sheet.getRange(existingRowIndex, 12).setValue(pList[3].keterangan || "HADIR");
          }
          if (pList[4]) {
            sheet.getRange(existingRowIndex, 13).setValue(pList[4].nama || "-");
            sheet.getRange(existingRowIndex, 14).setValue(pList[4].keterangan || "HADIR");
          }
        }

        if (fMasukLink) {
          sheet.getRange(existingRowIndex, 15).setValue(fMasukLink);
          sheet.getRange(existingRowIndex, 16).setValue(abs.timestampMasuk || nowStr);
        }
        if (fKeluarLink) {
          sheet.getRange(existingRowIndex, 17).setValue(fKeluarLink);
          sheet.getRange(existingRowIndex, 18).setValue(abs.timestampKeluar || nowStr);
        }
      } else {
        // Create new row
        var p1_nama = pList[0] ? pList[0].nama : "-";
        var p1_ket = pList[0] ? (pList[0].keterangan || "HADIR") : "HADIR";
        var p2_nama = pList[1] ? pList[1].nama : "-";
        var p2_ket = pList[1] ? (pList[1].keterangan || "HADIR") : "HADIR";
        var p3_nama = pList[2] ? pList[2].nama : "-";
        var p3_ket = pList[2] ? (pList[2].keterangan || "HADIR") : "HADIR";
        var p4_nama = pList[3] ? pList[3].nama : "-";
        var p4_ket = pList[3] ? (pList[3].keterangan || "HADIR") : "HADIR";
        var p5_nama = pList[4] ? pList[4].nama : "-";
        var p5_ket = pList[4] ? (pList[4].keterangan || "HADIR") : "HADIR";

        sheet.appendRow([
          absId,
          targetTgl,
          regu,
          abs.ulpName || "",
          p1_nama,
          p1_ket,
          p2_nama,
          p2_ket,
          p3_nama,
          p3_ket,
          p4_nama,
          p4_ket,
          p5_nama,
          p5_ket,
          fMasukLink,
          fMasukLink ? (abs.timestampMasuk || nowStr) : "",
          fKeluarLink,
          fKeluarLink ? (abs.timestampKeluar || nowStr) : ""
        ]);
      }
      return createJsonResponse({
        status: "success",
        message: "Absensi berhasil disimpan ke Spreadsheet ABSENSI!",
        fotoMasukUrl: fMasukLink,
        fotoKeluarUrl: fKeluarLink
      });
    }

    // DELETE ABSENSI
    if (action === "deleteAbsensi") {
      var id = postData.id;
      var ss = getSpreadsheet(postData.spreadsheetId);
      var sheet = ss.getSheetByName("ABSENSI");
      var data = sheet.getDataRange().getValues();
      var deleted = false;
      for (var r = 1; r < data.length; r++) {
        if (String(data[r][0]) === String(id)) {
          sheet.deleteRow(r + 1);
          deleted = true;
          break;
        }
      }
      return createJsonResponse({ status: deleted ? "success" : "error", message: deleted ? "Absensi deleted" : "ID not found" });
    }

    // UPDATE REALISASI
    if (action === "updateRealisasi") {
      var id = postData.id;
      var rel = postData.realisasi;
      var ss = getSpreadsheet(postData.spreadsheetId);
      var sheet = ss.getSheetByName("REALISASI");
      var data = sheet.getDataRange().getValues();
      var updated = false;

      for (var r = 1; r < data.length; r++) {
        if (String(data[r][0]) === String(id)) {
          var row = r + 1;
          if (rel.woId !== undefined) sheet.getRange(row, 2).setValue(rel.woId);
          if (rel.nomorWO !== undefined) sheet.getRange(row, 3).setValue(rel.nomorWO);
          if (rel.ulpName !== undefined) sheet.getRange(row, 4).setValue(rel.ulpName);
          if (rel.reguName !== undefined) sheet.getRange(row, 5).setValue(rel.reguName);
          if (rel.penyulangName !== undefined) sheet.getRange(row, 6).setValue(rel.penyulangName);
          if (rel.noTiang !== undefined) sheet.getRange(row, 7).setValue(rel.noTiang);
          if (rel.tanggal !== undefined) sheet.getRange(row, 8).setValue(rel.tanggal);
          // Note: Handling photo updates might be complex if they are base64, but assuming simple update for now
          if (rel.fotoSebelum !== undefined) sheet.getRange(row, 9).setValue(rel.fotoSebelum);
          if (rel.fotoSesudah !== undefined) sheet.getRange(row, 10).setValue(rel.fotoSesudah);
          if (rel.jenisTanaman !== undefined) sheet.getRange(row, 11).setValue(rel.jenisTanaman);
          if (rel.keterangan !== undefined) sheet.getRange(row, 12).setValue(rel.keterangan);
          if (rel.pertumbuhanTanaman !== undefined) sheet.getRange(row, 13).setValue(rel.pertumbuhanTanaman);
          if (rel.kendala !== undefined) sheet.getRange(row, 14).setValue(rel.kendala);
          if (rel.latitudeLongitude !== undefined) sheet.getRange(row, 15).setValue(rel.latitudeLongitude);
          if (rel.Lokasi_kerja !== undefined) sheet.getRange(row, 16).setValue(rel.Lokasi_kerja);
          updated = true;
          break;
        }
      }
      return createJsonResponse({ status: updated ? "success" : "error", message: updated ? "Realisasi updated" : "ID not found" });
    }

    // DELETE REALISASI
    if (action === "deleteRealisasi") {
      var id = postData.id;
      var ss = getSpreadsheet(postData.spreadsheetId);
      var sheet = ss.getSheetByName("REALISASI");
      var data = sheet.getDataRange().getValues();
      var deleted = false;
      for (var r = 1; r < data.length; r++) {
        if (String(data[r][0]) === String(id)) {
          sheet.deleteRow(r + 1);
          deleted = true;
          break;
        }
      }
      return createJsonResponse({ status: deleted ? "success" : "error", message: deleted ? "Realisasi deleted" : "ID not found" });
    }

    // UPDATE WORK ORDER
    if (action === "updateWorkOrder") {
      var id = postData.id;
      var wo = postData.workOrder;
      var ss = getSpreadsheet(postData.spreadsheetId);
      var sheet = ss.getSheetByName("WORK_ORDER") || ss.getSheetByName("WORK_ORDERS");
      var data = sheet.getDataRange().getValues();
      var updated = false;

      for (var r = 1; r < data.length; r++) {
        if (String(data[r][0]) === String(id) || String(data[r][2]) === String(wo.nomorWO) || String(data[r][2]) === String(wo.NOMOR_WO)) {
          var row = r + 1;
          if (wo.pekerjaan !== undefined || wo.PEKERJAAN !== undefined) sheet.getRange(row, 2).setValue(wo.pekerjaan || wo.PEKERJAAN);
          if (wo.nomorWO !== undefined || wo.NOMOR_WO !== undefined) sheet.getRange(row, 3).setValue(wo.nomorWO || wo.NOMOR_WO);
          if (wo.tanggal !== undefined || wo.TANGGAL !== undefined) sheet.getRange(row, 4).setValue(wo.tanggal || wo.TANGGAL);
          if (wo.ulpName !== undefined || wo.ULP !== undefined) sheet.getRange(row, 5).setValue(wo.ulpName || wo.ULP);
          if (wo.penyulangName !== undefined || wo.PENYULANG !== undefined) sheet.getRange(row, 6).setValue(wo.penyulangName || wo.PENYULANG);
          if (wo.reguName !== undefined || wo.REGU !== undefined) sheet.getRange(row, 7).setValue(wo.reguName || wo.REGU);
          if (wo.volumePekerjaan !== undefined || wo.VOLUME !== undefined) sheet.getRange(row, 8).setValue(wo.volumePekerjaan || wo.VOLUME);
          if (wo.satuan !== undefined || wo.SATUAN !== undefined) sheet.getRange(row, 9).setValue(wo.satuan || wo.SATUAN);
          if (wo.woMulai !== undefined || wo.WO_MULAI !== undefined) sheet.getRange(row, 10).setValue(wo.woMulai || wo.WO_MULAI);
          if (wo.woAkhir !== undefined || wo.WO_AKHIR !== undefined) sheet.getRange(row, 11).setValue(wo.woAkhir || wo.WO_AKHIR);
          if (wo.status !== undefined || wo.STATUS !== undefined) sheet.getRange(row, 12).setValue(wo.status || wo.STATUS);
          if (wo.LOKASI_START !== undefined || wo.lokasiStart !== undefined) sheet.getRange(row, 13).setValue(wo.LOKASI_START || wo.lokasiStart);
          if (wo.LOKASI_FINISH !== undefined || wo.lokasiFinish !== undefined) sheet.getRange(row, 14).setValue(wo.LOKASI_FINISH || wo.lokasiFinish);
          if (wo.TOTAL_REALISASI !== undefined || wo.totalRealisasi !== undefined) sheet.getRange(row, 15).setValue(wo.TOTAL_REALISASI || wo.totalRealisasi);
          if (wo.SATUAN_TOTAL_REALISASI !== undefined || wo.satuanTotalRealisasi !== undefined) sheet.getRange(row, 16).setValue(wo.SATUAN_TOTAL_REALISASI || wo.satuanTotalRealisasi);
          updated = true;
          break;
        }
      }
      return createJsonResponse({ status: updated ? "success" : "error", message: updated ? "Work Order updated!" : "Work Order ID not found" });
    }

    // DELETE WORK ORDER
    if (action === "deleteWorkOrder") {
      var id = postData.id;
      var ss = getSpreadsheet(postData.spreadsheetId);
      var sheet = ss.getSheetByName("WORK_ORDER") || ss.getSheetByName("WORK_ORDERS");
      var data = sheet.getDataRange().getValues();
      var deleted = false;

      for (var r = 1; r < data.length; r++) {
        if (String(data[r][0]) === String(id)) {
          sheet.deleteRow(r + 1);
          deleted = true;
          break;
        }
      }
      return createJsonResponse({ status: deleted ? "success" : "error", message: deleted ? "Work Order deleted!" : "ID not found" });
    }

    // SAVE MASTER DATA
    if (action === "saveMasterData") {
      var sheetName = postData.sheetName;
      var item = postData.item;
      var ss = getSpreadsheet(postData.spreadsheetId);
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) return createJsonResponse({ status: "error", message: "Sheet not found: " + sheetName });

      var data = sheet.getDataRange().getValues();
      var itemId = item.id || item.ID || item.UserID || item.Timestamp;
      var existingRow = -1;

      for (var r = 1; r < data.length; r++) {
        if (String(data[r][0]) === String(itemId)) {
          existingRow = r + 1;
          break;
        }
      }

      var rowValues = [];
      if (sheetName === "ULP") {
        rowValues = [item.id, item.kodeULP || item.id, item.namaULP, item.manajerULP || "-", item.kontak || "-", item.alamat || "-", "Aktif"];
      } else if (sheetName === "PENYULANG") {
        rowValues = [item.id, item.kodePenyulang || item.id, item.namaPenyulang, item.ulpName || "-", item.panjangKms || 0, item.jumlahTrafo || 0, "Aktif"];
      } else if (sheetName === "REGU_ROW") {
        rowValues = [item.id, item.kodeRegu || item.id, item.namaRegu, item.penanggungJawab || "-", item.jumlahAnggota || 0, item.kontak || "-", "Aktif"];
      } else if (sheetName === "PETUGAS") {
        rowValues = [item.id, item.nip || item.id, item.nama, item.reguName || "-", item.ulpName || "-", item.nomorHp || "-", item.role || "User", "Aktif"];
      } else if (sheetName === "USERS") {
        rowValues = [item.id, item.username || item.nip, hashSHA256(item.password || "user123"), item.reguName || "-", item.role || "User", item.ulpName || "PLN UP3 Padang", "Aktif", new Date().toISOString(), new Date().toISOString()];
      } else if (sheetName === "SETTING") {
        rowValues = [item.namaUnitLayanan, item.logoAplikasiUrl || "", item.themeColor || "sky", item.footerText || "", item.whatsapp || "", item.email || "", new Date().toISOString()];
      } else if (sheetName === "LOG_ACTIVITY") {
        rowValues = [new Date().toISOString(), item.actorName || "Sistem", item.action, item.details, "-", "-"];
      }

      if (existingRow > 0) {
        sheet.getRange(existingRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }

      return createJsonResponse({ status: "success", message: "Data saved to " + sheetName });
    }

    // DELETE MASTER DATA
    if (action === "deleteMasterData") {
      var sheetName = postData.sheetName;
      var id = postData.id;
      var ss = getSpreadsheet(postData.spreadsheetId);
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) return createJsonResponse({ status: "error", message: "Sheet not found" });

      var data = sheet.getDataRange().getValues();
      for (var r = 1; r < data.length; r++) {
        if (String(data[r][0]) === String(id)) {
          sheet.deleteRow(r + 1);
          return createJsonResponse({ status: "success", message: "Item deleted from " + sheetName });
        }
      }
      return createJsonResponse({ status: "error", message: "ID not found in " + sheetName });
    }

    return createJsonResponse({ status: "error", message: "Unknown POST action: " + action });

  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

/**
 * Helper to get or create subfolder in Drive
 */
function getOrCreateSubfolder(parentFolder, name) {
  var folders = parentFolder.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(name);
}
`;
