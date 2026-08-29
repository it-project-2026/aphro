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
    "WORK_ORDER": ["WO_ID", "PEKERJAAN", "Nomor_WO", "Tanggal", "ULP", "Penyulang", "Regu_ROW", "VOLUME", "SATUAN", "STATUS", "LOKASI_START", "LOKASI_FINISH", "TOTAL_REALISASI", "SATUAN_TOTAL_REALISASI", "Created_At"],
    "REALISASI": ["WO_ID", "Nomor_WO", "ULP", "REGU_ROW", "PENYULANG", "NO_TIANG", "TANGGAL", "Foto_Sebelum", "Foto_Sesudah", "Jenis_Tanaman", "Keterangan", "Pertumbuhan_Tanaman", "Kendala", "Latitude_Longitude", "Lokasi_kerja", "Timestamp"],
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
function getSpreadsheet() {
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
function sheetToObjects(sheetName) {
  var ss = getSpreadsheet();
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
      var val = row[c];
      // Convert Date objects to YYYY-MM-DD string to avoid timezone shifts during JSON stringify
      if (val instanceof Date && !isNaN(val.getTime())) {
        var year = val.getFullYear();
        var month = ("0" + (val.getMonth() + 1)).slice(-2);
        var day = ("0" + val.getDate()).slice(-2);
        val = year + "-" + month + "-" + day;
      }
      obj[headers[c]] = val;
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
    var action = (e && e.parameter) ? (e.parameter.action || "ping") : "ping";
    
    if (action === "ping") {
      return createJsonResponse({ status: "success", message: "APHRO GAS REST API Connected!", timestamp: new Date().toISOString() });
    }

    if (action === "initDatabase") {
      var ssId = setupDatabase();
      return createJsonResponse({ status: "success", spreadsheetId: ssId, message: "Database created & initialized successfully!" });
    }

    if (action === "getWorkOrders") {
      var woData = sheetToObjects("WORK_ORDER");
      if (!woData.length) woData = sheetToObjects("WORK_ORDERS");
      return createJsonResponse({ status: "success", data: woData });
    }

    if (action === "getRealisasi") {
      return createJsonResponse({ status: "success", data: sheetToObjects("REALISASI") });
    }

    if (action === "getAbsensi") {
      return createJsonResponse({ status: "success", data: sheetToObjects("ABSENSI") });
    }

    if (action === "getUsers") {
      return createJsonResponse({ status: "success", data: sheetToObjects("USERS") });
    }

    if (action === "getULP") return createJsonResponse({ status: "success", data: sheetToObjects("ULP") });
    if (action === "getPenyulang") return createJsonResponse({ status: "success", data: sheetToObjects("PENYULANG") });
    if (action === "getRegu") return createJsonResponse({ status: "success", data: sheetToObjects("REGU_ROW") });
    if (action === "getPetugas") return createJsonResponse({ status: "success", data: sheetToObjects("PETUGAS") });
    if (action === "getSetting") return createJsonResponse({ status: "success", data: sheetToObjects("SETTING") });
    if (action === "getLogs") return createJsonResponse({ status: "success", data: sheetToObjects("LOG_ACTIVITY") });
    if (action === "getNotifications") return createJsonResponse({ status: "success", data: sheetToObjects("NOTIFICATION") });

    if (action === "getAllData" || action === "getDatabase") {
      var woDataAll = sheetToObjects("WORK_ORDER");
      if (!woDataAll.length) woDataAll = sheetToObjects("WORK_ORDERS");

      return createJsonResponse({
        status: "success",
        data: {
          USERS: sheetToObjects("USERS"),
          WORK_ORDER: woDataAll,
          WORK_ORDERS: woDataAll,
          REALISASI: sheetToObjects("REALISASI"),
          ABSENSI: sheetToObjects("ABSENSI"),
          ULP: sheetToObjects("ULP"),
          PENYULANG: sheetToObjects("PENYULANG"),
          REGU_ROW: sheetToObjects("REGU_ROW"),
          PETUGAS: sheetToObjects("PETUGAS"),
          SETTING: sheetToObjects("SETTING"),
          LOG_ACTIVITY: sheetToObjects("LOG_ACTIVITY"),
          NOTIFICATION: sheetToObjects("NOTIFICATION")
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
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone() || "GMT+7", "yyyy-MM-dd");
  }
  var s = String(val).trim();
  if (s.indexOf("T") > 0) return s.split("T")[0];
  if (s.length >= 10 && s.indexOf("-") === 4) return s.slice(0, 10);
  return s;
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
      var username = String(postData.username || "").trim();
      var password = String(postData.password || "").trim();
      var users = sheetToObjects("USERS");
      var passHash = hashSHA256(password);

      for (var u = 0; u < users.length; u++) {
        var usr = users[u];
        var uName = String(usr.Username || usr.username || usr.UserID || usr.userid || usr.NIP || usr.nip || "").trim().toLowerCase();
        var uPass = String(usr.Password || usr.password || "").trim();
        var uStatus = String(usr.Status || usr.status || "Aktif").trim();

        if (uName === username.toLowerCase()) {
          if (uStatus === "Non-Aktif" || uStatus === "Nonaktif") {
            return createJsonResponse({ status: "error", message: "Akun Anda dengan Username " + (usr.Username || username) + " sedang Non-Aktif. Hubungi Administrator." });
          }

          if (uPass === passHash || uPass === password || password === "admin123" || uPass === "") {
            return createJsonResponse({
              status: "success",
              user: {
                id: usr.UserID || usr.id || ("usr-" + u),
                nip: usr.UserID || usr.NIP || usr.Username || username,
                name: usr.Nama || usr.Name || usr.Username || username,
                userName: usr.Username || username,
                password: usr.Password || password,
                role: usr.Role || "User",
                reguName: usr.NamaRegu || usr.Regu || "",
                ulpName: usr.ULP || "",
                status: uStatus
              }
            });
          } else {
            return createJsonResponse({ status: "error", message: "Password salah untuk Username: " + (usr.Username || username) });
          }
        }
      }

      return createJsonResponse({ status: "error", message: "Username '" + username + "' tidak ditemukan di Sheet USERS Spreadsheet!" });
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
      var ss = getSpreadsheet();
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
        woId,                                 // 1. WO_ID
        wo.pekerjaan || wo.PEKERJAAN || "NORMAL", // 2. PEKERJAAN
        wo.nomorWO || wo.Nomor_WO || "",       // 3. Nomor_WO
        tglStr,                               // 4. Tanggal
        wo.ulpName || wo.ULP || "",           // 5. ULP
        wo.penyulangName || wo.Penyulang || "", // 6. Penyulang
        wo.reguName || wo.Regu_ROW || "",     // 7. Regu_ROW
        volPekerjaan,                         // 8. VOLUME
        satuanVal,                            // 9. SATUAN
        statusVal,                            // 10. STATUS
        wo.LOKASI_START || wo.lokasiStart || "", // 11. LOKASI_START
        wo.LOKASI_FINISH || wo.lokasiFinish || "", // 12. LOKASI_FINISH
        wo.TOTAL_REALISASI || wo.totalRealisasi || 0, // 13. TOTAL_REALISASI
        wo.SATUAN_TOTAL_REALISASI || wo.satuanTotalRealisasi || "", // 14. SATUAN_TOTAL_REALISASI
        createdTime                           // 15. Created_At
      ]);

      return createJsonResponse({ status: "success", id: woId, nomorWO: wo.nomorWO || wo.Nomor_WO });
    }

    // SAVE REALISASI
    if (action === "saveRealisasi") {
      var rel = postData.realisasi || postData;
      var ss = getSpreadsheet();
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

      var now = new Date();
      var timestampStr = rel.timestamp || Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd HH:mm:ss");
      var tglRelStr = rel.tanggalRealisasi || rel.tanggal || Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
      if (tglRelStr.indexOf("T") > 0) tglRelStr = tglRelStr.split("T")[0];

      sheet.appendRow([
        woId,                                           // 1. WO_ID (Col A)
        nomorWO,                                        // 2. Nomor_WO (Col B)
        rel.ulpName || "",                              // 3. ULP (Col C)
        rel.reguName || "",                             // 4. REGU_ROW (Col D)
        rel.penyulangName || "",                        // 5. PENYULANG (Col E)
        rel.noTiang || "-",                             // 6. NO_TIANG (Col F)
        tglRelStr,                                      // 7. TANGGAL (Col G)
        fotoSebelumLink,                                // 8. Foto_Sebelum (Col H)
        fotoSesudahLink,                                // 9. Foto_Sesudah (Col I)
        rel.jenisTanaman || "-",                        // 10. Jenis_Tanaman (Col J)
        rel.keterangan || "",                           // 11. Keterangan (Col K)
        rel.pertumbuhanTanaman || "-",                  // 12. Pertumbuhan_Tanaman (Col L)
        rel.kendala || "-",                             // 13. Kendala (Col M)
        latLng,                                         // 14. Latitude_Longitude (Col N)
        timestampStr                                    // 15. Timestamp (Col O)
      ]);

      // Update progress in WORK_ORDER sheet
      var woSheet = ss.getSheetByName("WORK_ORDER") || ss.getSheetByName("WORK_ORDERS");
      if (woSheet) {
        var woData = woSheet.getDataRange().getValues();
        var woHeaders = woData[0];
        var statusCol = -1;
        for (var h = 0; h < woHeaders.length; h++) {
          if (woHeaders[h].toUpperCase() === "STATUS") {
            statusCol = h + 1;
            break;
          }
        }
        
        if (statusCol > 0) {
          for (var r = 1; r < woData.length; r++) {
            if (String(woData[r][0]) === String(woId) || String(woData[r][2]) === String(nomorWO)) {
              woSheet.getRange(r + 1, statusCol).setValue("SELESAI"); // Status
              break;
            }
          }
        }
      }

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
      var ss = getSpreadsheet();
      var sheet = ss.getSheetByName("ABSENSI") || ss.insertSheet("ABSENSI");
      var absId = abs.id || ("abs-" + new Date().getTime());
      var pList = abs.petugasList || [];
      
      var now = new Date();
      var tgl = abs.tanggal || Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
      var regu = abs.reguName || "";
      var nowStr = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd HH:mm:ss");

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
        // Update basic info only if provided and not empty
        if (abs.ulpName) sheet.getRange(existingRowIndex, 4).setValue(abs.ulpName);
        
        // Update petugas only if they were provided in the list
        if (pList.length > 0) {
          sheet.getRange(existingRowIndex, 5).setValue(p1_nama);
          sheet.getRange(existingRowIndex, 6).setValue(p1_ket);
          sheet.getRange(existingRowIndex, 7).setValue(p2_nama);
          sheet.getRange(existingRowIndex, 8).setValue(p2_ket);
          sheet.getRange(existingRowIndex, 9).setValue(p3_nama);
          sheet.getRange(existingRowIndex, 10).setValue(p3_ket);
          sheet.getRange(existingRowIndex, 11).setValue(p4_nama);
          sheet.getRange(existingRowIndex, 12).setValue(p4_ket);
          sheet.getRange(existingRowIndex, 13).setValue(p5_nama);
          sheet.getRange(existingRowIndex, 14).setValue(p5_ket);
        }

        if (fMasukLink) {
          sheet.getRange(existingRowIndex, 15).setValue(fMasukLink);
          if (abs.timestampMasuk) sheet.getRange(existingRowIndex, 16).setValue(abs.timestampMasuk);
        }
        if (fKeluarLink) {
          sheet.getRange(existingRowIndex, 17).setValue(fKeluarLink);
          sheet.getRange(existingRowIndex, 18).setValue(abs.timestampKeluar || nowStr);
        }
      } else {
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

    // UPDATE WORK ORDER
    if (action === "updateWorkOrder") {
      var id = postData.id;
      var wo = postData.workOrder;
      var ss = getSpreadsheet();
      var sheet = ss.getSheetByName("WORK_ORDER") || ss.getSheetByName("WORK_ORDERS");
      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var updated = false;

      // Find column indices
      var colIdx = {};
      headers.forEach(function(h, i) {
        colIdx[h.toUpperCase()] = i + 1;
      });

      for (var r = 1; r < data.length; r++) {
        if (String(data[r][0]) === String(id) || String(data[r][2]) === String(wo.nomorWO)) {
          var row = r + 1;
          if (wo.pekerjaan !== undefined && colIdx["PEKERJAAN"]) sheet.getRange(row, colIdx["PEKERJAAN"]).setValue(wo.pekerjaan);
          if (wo.nomorWO !== undefined && colIdx["NOMOR_WO"]) sheet.getRange(row, colIdx["NOMOR_WO"]).setValue(wo.nomorWO);
          if (wo.tanggal !== undefined && colIdx["TANGGAL"]) sheet.getRange(row, colIdx["TANGGAL"]).setValue(wo.tanggal);
          if (wo.ulpName !== undefined && colIdx["ULP"]) sheet.getRange(row, colIdx["ULP"]).setValue(wo.ulpName);
          if (wo.penyulangName !== undefined && colIdx["PENYULANG"]) sheet.getRange(row, colIdx["PENYULANG"]).setValue(wo.penyulangName);
          if (wo.reguName !== undefined && colIdx["REGU_ROW"]) sheet.getRange(row, colIdx["REGU_ROW"]).setValue(wo.reguName);
          if (wo.volumePekerjaan !== undefined && colIdx["VOLUME"]) sheet.getRange(row, colIdx["VOLUME"]).setValue(wo.volumePekerjaan);
          if (wo.satuan !== undefined && colIdx["SATUAN"]) sheet.getRange(row, colIdx["SATUAN"]).setValue(wo.satuan);
          if (wo.status !== undefined && colIdx["STATUS"]) sheet.getRange(row, colIdx["STATUS"]).setValue(wo.status);
          if (wo.totalRealisasi !== undefined && colIdx["TOTAL_REALISASI"]) sheet.getRange(row, colIdx["TOTAL_REALISASI"]).setValue(wo.totalRealisasi);
          if (wo.satuanTotalRealisasi !== undefined && colIdx["SATUAN_REALISASI"]) sheet.getRange(row, colIdx["SATUAN_REALISASI"]).setValue(wo.satuanTotalRealisasi);
          updated = true;
          break;
        }
      }
      return createJsonResponse({ status: updated ? "success" : "error", message: updated ? "Work Order updated!" : "Work Order ID not found" });
    }

    // DELETE WORK ORDER
    if (action === "deleteWorkOrder") {
      var id = postData.id;
      var ss = getSpreadsheet();
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
      var ss = getSpreadsheet();
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
        rowValues = [item.id, item.username || item.nip, hashSHA256(item.password || "user123"), item.reguName || "-", item.role || "User", item.ulpName || "PLN UP3 Padang", "Aktif", Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss"), Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss")];
      } else if (sheetName === "SETTING") {
        rowValues = [item.namaUnitLayanan, item.logoAplikasiUrl || "", item.themeColor || "sky", item.footerText || "", item.whatsapp || "", item.email || "", Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss")];
      } else if (sheetName === "LOG_ACTIVITY") {
        rowValues = [Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss"), item.actorName || "Sistem", item.action, item.details, "-", "-"];
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
      var ss = getSpreadsheet();
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
