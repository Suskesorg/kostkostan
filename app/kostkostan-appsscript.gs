/**
 * =====================================================
 * KOSTKOSTAN — Google Apps Script
 * =====================================================
 * 
 * FITUR:
 * 1. updateKostData()  — Isi data penghuni (format DD-MM-YYYY)
 * 2. doPost(e)         — Web App endpoint untuk perpanjang dari website
 * 3. fixDateFormat()   — Convert semua tanggal ke DD-MM-YYYY
 * 
 * =====================================================
 * CARA SETUP WEB APP (untuk fitur Perpanjang):
 * =====================================================
 * 1. Buka Extensions → Apps Script
 * 2. Paste seluruh kode ini
 * 3. Klik "Deploy" → "New deployment"
 * 4. Type: pilih "Web app"
 * 5. Execute as: "Me"
 * 6. Who has access: "Anyone"
 * 7. Klik "Deploy"
 * 8. COPY URL yang muncul — paste ke file reminder/page.js
 *    (ganti PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE)
 * 9. Setiap kali update kode, buat "New deployment" lagi
 * =====================================================
 */

// ==================== WEB APP ENDPOINT ====================
// Dipanggil dari website saat user klik "Perpanjang"

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    if (data.action === "extend") {
      var result = extendTenant(data.room, data.newDateEnd, data.newDateJoined);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unknown action" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle CORS preflight
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: "ok", message: "Kostkostan API ready" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==================== EXTEND TENANT ====================
// Perpanjang kontrak: update Date Joined = old Date End, Date End = +30 hari

function extendTenant(room, newDateEnd, newDateJoined) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Tenants");
  if (!sheet) return { success: false, error: "Sheet 'Tenants' not found" };
  
  var lastRow = sheet.getLastRow();
  var roomCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  
  for (var i = 0; i < roomCol.length; i++) {
    var cellRoom = String(roomCol[i][0]).trim().toUpperCase();
    if (cellRoom === room.trim().toUpperCase()) {
      var row = i + 2;
      
      // Update Date Joined (col D) with old end date = new start date
      sheet.getRange(row, 4).setValue(newDateJoined);
      
      // Update Date End (col E) with new end date (+30 days)
      sheet.getRange(row, 5).setValue(newDateEnd);
      
      // Make sure status is active
      sheet.getRange(row, 6).setValue("active");
      
      // Format as DD-MM-YYYY
      sheet.getRange(row, 4).setNumberFormat("dd-MM-yyyy");
      sheet.getRange(row, 5).setNumberFormat("dd-MM-yyyy");
      
      SpreadsheetApp.flush(); // Force save
      
      return { 
        success: true, 
        room: room, 
        newDateJoined: newDateJoined,
        newDateEnd: newDateEnd,
        message: "Room " + room + " extended until " + newDateEnd
      };
    }
  }
  
  return { success: false, error: "Room " + room + " not found" };
}


// ==================== UPDATE KOST DATA ====================
// Isi data penghuni — format DD-MM-YYYY friendly

function updateKostData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Tenants");
  if (!sheet) {
    SpreadsheetApp.getActive().toast("❌ Sheet 'Tenants' not found!", "Error", 5);
    return;
  }
  
  var lastRow = sheet.getLastRow();
  
  // STEP 1: Reset semua
  if (lastRow >= 2) {
    sheet.getRange(2, 2, lastRow - 1, 1).clearContent(); // Name
    sheet.getRange(2, 3, lastRow - 1, 1).clearContent(); // Phone
    sheet.getRange(2, 4, lastRow - 1, 1).clearContent(); // Date Joined
    sheet.getRange(2, 5, lastRow - 1, 1).clearContent(); // Date End
    sheet.getRange(2, 7, lastRow - 1, 1).clearContent(); // Notes
    
    var vacantValues = [];
    for (var v = 0; v < lastRow - 1; v++) vacantValues.push(["vacant"]);
    sheet.getRange(2, 6, lastRow - 1, 1).setValues(vacantValues);
  }
  
  // STEP 2: Data penghuni — format DD-MM-YYYY
  var tenantData = {
    "A01": ["Haura",          "11-03-2026", "10-04-2026"],
    "A02": ["Palesa",         "15-03-2026", "14-04-2026"],
    "A03": ["Fajar Puspita",  "23-03-2026", "22-04-2026"],
    "A04": ["Heni",           "25-03-2026", "24-04-2026"],
    "A05": ["Kerja di Sawit", "08-04-2026", "08-05-2026"],
    "A06": ["Nurul Huda",     "01-04-2026", "01-05-2026"],
    "A07": ["Fina",           "10-04-2026", "10-05-2026"],
    "A08": ["Joseph",         "26-03-2026", "25-04-2026"],
    "B01": ["Kurnia",         "20-03-2026", "19-04-2026"],
    "B02": ["Duhitta",        "16-03-2026", "15-04-2026"],
    "B04": ["Patricia",       "04-04-2026", "04-05-2026"],
    "B05": ["Rommy",          "29-03-2026", "28-04-2026"],
    "B06": ["Kadek Puspita",  "22-03-2026", "21-04-2026"],
    "B07": ["Ratu",           "08-03-2026", "07-04-2026"],
    "B08": ["Luke",           "08-04-2026", "08-05-2026"],
    "B09": ["Dani",           "31-03-2026", "30-04-2026"],
    "B11": ["Bintang",        "10-03-2026", "09-04-2026"]
  };
  
  // STEP 3: Isi data
  var roomColumn = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  
  for (var i = 0; i < roomColumn.length; i++) {
    var roomCode = String(roomColumn[i][0]).trim();
    
    if (tenantData[roomCode]) {
      var row = i + 2;
      var name = tenantData[roomCode][0];
      var dateJoined = tenantData[roomCode][1];
      var dateEnd = tenantData[roomCode][2];
      
      sheet.getRange(row, 2).setValue(name);
      sheet.getRange(row, 4).setValue(dateJoined);
      sheet.getRange(row, 5).setValue(dateEnd);
      sheet.getRange(row, 6).setValue("active");
    }
  }
  
  // STEP 4: Format tanggal DD-MM-YYYY
  if (lastRow >= 2) {
    sheet.getRange(2, 4, lastRow - 1, 1).setNumberFormat("dd-MM-yyyy");
    sheet.getRange(2, 5, lastRow - 1, 1).setNumberFormat("dd-MM-yyyy");
  }
  
  SpreadsheetApp.getActive().toast("✅ Data penghuni berhasil diupdate! (DD-MM-YYYY)", "Selesai", 5);
}


// ==================== FIX DATE FORMAT ====================
// Convert semua tanggal ke DD-MM-YYYY

function fixDateFormat() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Tenants");
  if (!sheet) {
    SpreadsheetApp.getActive().toast("❌ Sheet 'Tenants' not found!", "Error", 5);
    return;
  }

  var lastRow = sheet.getLastRow();
  
  if (lastRow >= 2) {
    sheet.getRange(2, 4, lastRow - 1, 1).setNumberFormat("dd-MM-yyyy");
    sheet.getRange(2, 5, lastRow - 1, 1).setNumberFormat("dd-MM-yyyy");
  }
  
  SpreadsheetApp.getActive().toast("✅ Format tanggal diubah ke DD-MM-YYYY!", "Selesai", 5);
}
