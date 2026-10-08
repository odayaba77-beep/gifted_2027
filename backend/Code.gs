// ====================================================================
// GOOGLE APPS SCRIPT â€” ظ†ط¸ط§ظ… ظ‡ظٹط£ط© ط±ط¹ط§ظٹط© ط§ظ„ظ…ظˆظ‡ظˆط¨ظٹظ† v5
// ====================================================================
// ط®ط·ظˆط§طھ ط§ظ„ظ†ط´ط±:
//  1. ط§ظپطھط­ Google Sheets ظˆط£ظ†ط´ط¦ ط¬ط¯ظˆظ„ط§ظ‹ ط¬ط¯ظٹط¯ط§ظ‹
//  2. ظ…ظ† ط§ظ„ظ‚ط§ط¦ظ…ط©: Extensions > Apps Script
//  3. ط§ظ„طµظ‚ ظ‡ط°ط§ ط§ظ„ظƒظˆط¯ ظƒط§ظ…ظ„ط§ظ‹ ظˆط§ط³طھط¨ط¯ظ„ SPREADSHEET_ID ط¨ط§ظ„ظ€ ID ط§ظ„ط­ظ‚ظٹظ‚ظٹ
//  4. ط§ظ†ظ‚ط± Deploy > New Deployment > Web App
//     - Execute as: Me
//     - Who has access: Anyone
//  5. ط§ظ†ط³ط® ط±ط§ط¨ط· Web App URL ظˆط£ط¯ط®ظ„ظ‡ ظپظٹ طµظپط­ط© "ظ…ط²ط§ظ…ظ†ط© ط§ظ„ط¨ظٹط§ظ†ط§طھ" ظپظٹ ط§ظ„ظ†ط¸ط§ظ…
// ====================================================================

const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; // â†گ ط§ط³طھط¨ط¯ظ„ ظ‡ط°ط§ ط¨ظ€ ID ط¬ط¯ظˆظ„ظƒ
const SECRET_TOKEN   = '';    // ط¶ط¹ ط±ظ…ط²ط§ظ‹ ط³ط±ظٹط§ظ‹ ظ‡ظ†ط§ ظ„ظ„ط­ظ…ط§ظٹط© ظ…ط«ظ„: 'MySecret@2025'
const APP_VERSION    = '5.0.0';

// ط£ط³ظ…ط§ط، ط§ظ„ط´ظٹطھط§طھ ط§ظ„ظ…ط­ط¬ظˆط²ط© (ظ„ط§ طھظڈط­ط°ظپ طھظ„ظ‚ط§ط¦ظٹط§ظ‹)
const RESERVED_SHEETS = ['Logs', 'Backups', 'Settings', 'Users'];

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// doGet â€” ط§ط³طھظ‚ط¨ط§ظ„ ط·ظ„ط¨ط§طھ GET (طھط­ظ…ظٹظ„ ط§ظ„ط¨ظٹط§ظ†ط§طھ / ping)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function doGet(e) {
  try {
    var params  = e.parameter || {};
    var action  = params.action || 'ping';
    var token   = params.token  || '';

    // ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† Token (ط¥ظ† ظƒط§ظ† ظ…ظڈط¹ظٹظژظ‘ظ†ط§ظ‹)
    if (SECRET_TOKEN && token !== SECRET_TOKEN) {
      return _json({ ok: false, error: 'Unauthorized â€” ط±ظ…ط² ط§ظ„ظ…طµط§ط¯ظ‚ط© ط؛ظٹط± طµط­ظٹط­' });
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // â”€â”€ ping â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (action === 'ping') {
      return _json({
        ok:      true,
        msg:     'Google Apps Script ظٹط¹ظ…ظ„ ط¨ظ†ط¬ط§ط­',
        version: APP_VERSION,
        ts:      new Date().toISOString()
      });
    }

    // â”€â”€ downloadData â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (action === 'downloadData') {
      var type      = _sanitize(params.type   || 'teach');
      var school    = _sanitize(params.school || 'all');
      var sheetName = _sheetName(type, school);
      var sheet     = ss.getSheetByName(sheetName);

      if (!sheet) {
        return _json({ ok: true, records: [], msg: 'ظ„ط§ طھظˆط¬ط¯ ط¨ظٹط§ظ†ط§طھ ظ„ظ‡ط°ظ‡ ط§ظ„ظ…ط¯ط±ط³ط©' });
      }

      var rows = sheet.getDataRange().getValues();
      if (rows.length < 2) {
        return _json({ ok: true, records: [] });
      }

      var headers = rows[0];
      var records = rows.slice(1).map(function(row) {
        var obj = {};
        headers.forEach(function(h, i) { obj[String(h)] = row[i]; });
        return obj;
      });

      _log(ss, 'downloadData', type, school, records.length);
      return _json({ ok: true, records: records, count: records.length });
    }

    // â”€â”€ getLogs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (action === 'getLogs') {
      var logSheet = ss.getSheetByName('Logs');
      if (!logSheet) return _json({ ok: true, logs: [] });
      var rows = logSheet.getDataRange().getValues();
      return _json({ ok: true, logs: rows.slice(1) });
    }

    // â”€â”€ getStats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (action === 'getStats') {
      var sheets   = ss.getSheets();
      var stats    = {};
      sheets.forEach(function(sh) {
        var name = sh.getName();
        if (!RESERVED_SHEETS.includes(name)) {
          stats[name] = Math.max(0, sh.getLastRow() - 1);
        }
      });
      return _json({ ok: true, stats: stats });
    }

    if (action === 'getFields') {
      return _json({
        ok: true,
        fields: _readSchemaFields(ss, params.target || 'all'),
        version: _schemaVersion(ss)
      });
    }

    if (action === 'getAllConfig') {
      return _json({
        ok: true,
        fields: _readSchemaFields(ss, 'all'),
        schoolInfoFields: _readSchoolFields(ss),
        version: _schemaVersion(ss)
      });
    }

    return _json({ ok: false, error: 'action ط؛ظٹط± ظ…ط¹ط±ظˆظپ: ' + action });

  } catch(err) {
    return _json({ ok: false, error: err.message, stack: err.stack });
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// doPost â€” ط§ط³طھظ‚ط¨ط§ظ„ ط·ظ„ط¨ط§طھ POST (ط±ظپط¹ / ظ†ط³ط® ط§ط­طھظٹط§ط·ظٹط© / ط¹ظ…ظ„ظٹط§طھ)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function doPost(e) {
  try {
    var data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch(parseErr) {
      return _json({ ok: false, error: 'JSON ط؛ظٹط± طµط§ظ„ط­: ' + parseErr.message });
    }

    // ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† Token
    if (SECRET_TOKEN && data.token !== SECRET_TOKEN) {
      return _json({ ok: false, error: 'Unauthorized â€” ط±ظ…ط² ط§ظ„ظ…طµط§ط¯ظ‚ط© ط؛ظٹط± طµط­ظٹط­' });
    }

    var ss     = SpreadsheetApp.openById(SPREADSHEET_ID);
    var action = data.action || 'uploadData';

    // â”€â”€ uploadData â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (action === 'uploadData') {
      var type    = _sanitize(data.type    || 'teach');
      var school  = _sanitize(data.school  || 'all');
      var records = data.records || [];

      if (!Array.isArray(records)) {
        return _json({ ok: false, error: 'records ظٹط¬ط¨ ط£ظ† طھظƒظˆظ† ظ…طµظپظˆظپط©' });
      }

      // طھظ†ط¸ظٹظپ ط§ظ„ط³ط¬ظ„ط§طھ: ط­ط°ظپ ط§ظ„طµظˆط± (ظƒط¨ظٹط±ط© ط¬ط¯ط§ظ‹) ظˆط§ظ„ط­ظ‚ظˆظ„ ط§ظ„ط¯ط§ط®ظ„ظٹط©
      var cleanRecords = records.map(function(r) {
        var clean = {};
        Object.keys(r).forEach(function(k) {
          if (k !== 'photo' && k !== '_type') {
            clean[k] = r[k];
          }
        });
        return clean;
      });

      var sheetName = _sheetName(type, school);
      _writeSheet(ss, sheetName, cleanRecords);
      _log(ss, 'uploadData', type, school, cleanRecords.length);

      return _json({ ok: true, msg: 'طھظ… ط±ظپط¹ ' + cleanRecords.length + ' ط³ط¬ظ„', count: cleanRecords.length });
    }

    // â”€â”€ promoteStudents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // ظٹظ†ط´ط¦ ط´ظٹطھ ظ…ط®طµطµ ظ„ظ„ظ…ط¯ط±ط³ط©+ط§ظ„ط³ظ†ط© ط§ظ„ظ‡ط¯ظپ (ظ…ط«ظ„: ط·ظ„ط§ط¨_ط¨ط؛ط¯ط§ط¯_2026_2027)
    // ظˆظٹط­ط¯ظ‘ط« ط´ظٹطھ "ط·ظ„ط§ط¨_ط§ظ„ظƒظ„" ط§ظ„ط¹ط§ظ…
    if (action === 'promoteStudents') {
      var school      = _sanitize(data.school || '');
      var targetYear  = _sanitize(data.targetYear || '');
      var records     = data.records || [];

      if (!Array.isArray(records)) {
        return _json({ ok: false, error: 'records ظٹط¬ط¨ ط£ظ† طھظƒظˆظ† ظ…طµظپظˆظپط©' });
      }

      var cleanRecords = records.map(function(r) {
        var clean = {};
        Object.keys(r).forEach(function(k) {
          if (k !== 'photo' && k !== '_type') clean[k] = r[k];
        });
        return clean;
      });

      // ط´ظٹطھ ط®ط§طµ ط¨ط§ظ„ظ…ط¯ط±ط³ط© ظˆط§ظ„ط³ظ†ط© (ط·ظ„ط§ط¨_ط§ظ„ظ…ط¯ط±ط³ط©_ط§ظ„ط³ظ†ط©)
      var yearSuffix   = targetYear.replace(/[^0-9]+/g, '_');
      var promoSheet   = _sheetName('stud', school) + (yearSuffix ? ('_' + yearSuffix) : '');
      _writeSheet(ss, promoSheet, cleanRecords);

      // طھط­ط¯ظٹط« ط´ظٹطھ "ط·ظ„ط§ط¨_ط§ظ„ظƒظ„" ط§ظ„ط¹ط§ظ… ط¨ط¯ظ…ط¬ ط§ظ„ط³ط¬ظ„ط§طھ ط§ظ„ط¬ط¯ظٹط¯ط© ظ…ط¹ ط§ظ„ظ…ظˆط¬ظˆط¯ط© (ط¨ط­ط³ط¨ id)
      var allSheetName = _sheetName('stud', 'all');
      var allSheet     = ss.getSheetByName(allSheetName);
      var allRecords   = [];
      if (allSheet) {
        var allRows = allSheet.getDataRange().getValues();
        if (allRows.length > 1) {
          var allHeaders = allRows[0];
          allRecords = allRows.slice(1).map(function(row) {
            var obj = {}; allHeaders.forEach(function(h, i) { obj[h] = row[i]; }); return obj;
          });
        }
      }
      var byId = {};
      allRecords.forEach(function(r) { if (r.id) byId[r.id] = r; });
      cleanRecords.forEach(function(r) { if (r.id) byId[r.id] = r; });
      _writeSheet(ss, allSheetName, Object.keys(byId).map(function(k) { return byId[k]; }));

      _log(ss, 'promoteStudents', 'stud', school, cleanRecords.length);
      return _json({ ok: true, msg: 'طھظ… طھط±ط­ظٹظ„ ' + cleanRecords.length + ' ط³ط¬ظ„', sheet: promoSheet, count: cleanRecords.length });
    }

    // â”€â”€ backupData â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (action === 'backupData') {
      var backup  = data.backup || {};
      var bkSheet = ss.getSheetByName('Backups') || ss.insertSheet('Backups');

      // ط¨ظٹط§ظ†ط§طھ طھظ„ط®ظٹطµظٹط© ظ„ظ„ظ†ط³ط®ط© ط§ظ„ط§ط­طھظٹط§ط·ظٹط©
      var teachCount = Array.isArray(backup.teach) ? backup.teach.length : 0;
      var studCount  = Array.isArray(backup.stud)  ? backup.stud.length  : 0;
      bkSheet.appendRow([
        new Date().toISOString(),
        backup.label || 'ظ†ط³ط®ط© ط§ط­طھظٹط§ط·ظٹط©',
        teachCount,
        studCount,
        APP_VERSION
      ]);

      // ط­ظپط¸ ط§ظ„ظƒط§ط¯ط± ظپظٹ ط´ظٹطھ ط§ط­طھظٹط§ط·ظٹ
      if (Array.isArray(backup.teach) && backup.teach.length > 0) {
        _writeSheet(ss, 'Backup_ظƒط§ط¯ط±', backup.teach.map(function(r) {
          var c = Object.assign({}, r); delete c.photo; return c;
        }));
      }
      // ط­ظپط¸ ط§ظ„ط·ظ„ط§ط¨ ظپظٹ ط´ظٹطھ ط§ط­طھظٹط§ط·ظٹ
      if (Array.isArray(backup.stud) && backup.stud.length > 0) {
        _writeSheet(ss, 'Backup_ط·ظ„ط§ط¨', backup.stud.map(function(r) {
          var c = Object.assign({}, r); delete c.photo; return c;
        }));
      }

      _log(ss, 'backupData', 'backup', 'all', teachCount + studCount);
      return _json({ ok: true, msg: 'طھظ… ط±ظپط¹ ط§ظ„ظ†ط³ط®ط© ط§ظ„ط§ط­طھظٹط§ط·ظٹط© ط¨ظ†ط¬ط§ط­' });
    }

    // â”€â”€ saveRecord â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // ط­ظپط¸ / طھط¹ط¯ظٹظ„ ط³ط¬ظ„ ظˆط§ط­ط¯ (ط·ط§ظ„ط¨ ط£ظˆ ظƒط§ط¯ط±)
    if (action === 'saveRecord') {
      var type   = _sanitize(data.type   || 'teach');
      var school = _sanitize(data.school || 'all');
      var record = data.record || {};
      delete record.photo;

      var sheetName = _sheetName(type, school);
      var sheet     = ss.getSheetByName(sheetName);

      if (sheet && record.id) {
        // ط§ط¨ط­ط« ط¹ظ† ط§ظ„ط³ط¬ظ„ ظˆط­ط¯ظ‘ط«ظ‡
        var rows    = sheet.getDataRange().getValues();
        var headers = rows[0];
        var idIdx   = headers.indexOf('id');
        if (idIdx >= 0) {
          for (var i = 1; i < rows.length; i++) {
            if (String(rows[i][idIdx]) === String(record.id)) {
              var updRow = headers.map(function(h) { return record[h] !== undefined ? record[h] : rows[i][headers.indexOf(h)]; });
              sheet.getRange(i + 1, 1, 1, headers.length).setValues([updRow]);
              _log(ss, 'updateRecord', type, school, 1);
              return _json({ ok: true, msg: 'طھظ… طھط­ط¯ظٹط« ط§ظ„ط³ط¬ظ„' });
            }
          }
        }
      }

      // ط¥ط¶ط§ظپط© ظƒط³ط¬ظ„ ط¬ط¯ظٹط¯ ط¥ط°ط§ ظ„ظ… ظٹظڈظˆط¬ط¯
      var existingRecords = [];
      if (sheet) {
        var rows = sheet.getDataRange().getValues();
        if (rows.length > 1) {
          var headers = rows[0];
          existingRecords = rows.slice(1).map(function(row) {
            var obj = {}; headers.forEach(function(h, i) { obj[h] = row[i]; }); return obj;
          });
        }
      }
      existingRecords.push(record);
      _writeSheet(ss, sheetName, existingRecords);
      _log(ss, 'saveRecord', type, school, 1);
      return _json({ ok: true, msg: 'طھظ… ط¥ط¶ط§ظپط© ط§ظ„ط³ط¬ظ„' });
    }

    // â”€â”€ deleteRecord â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (action === 'deleteRecord') {
      var type      = _sanitize(data.type   || 'teach');
      var school    = _sanitize(data.school || 'all');
      var recordId  = String(data.id || '');

      if (!recordId) return _json({ ok: false, error: 'id ظ…ط·ظ„ظˆط¨' });

      var sheetName = _sheetName(type, school);
      var sheet     = ss.getSheetByName(sheetName);
      if (!sheet) return _json({ ok: false, error: 'ط§ظ„ط´ظٹطھ ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });

      var rows    = sheet.getDataRange().getValues();
      var headers = rows[0];
      var idIdx   = headers.indexOf('id');
      if (idIdx < 0) return _json({ ok: false, error: 'ط¹ظ…ظˆط¯ id ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });

      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][idIdx]) === recordId) {
          sheet.deleteRow(i + 1);
          _log(ss, 'deleteRecord', type, school, 1);
          return _json({ ok: true, msg: 'طھظ… ط­ط°ظپ ط§ظ„ط³ط¬ظ„' });
        }
      }
      return _json({ ok: false, error: 'ط§ظ„ط³ط¬ظ„ ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });
    }

    // â”€â”€ oplog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (action === 'oplog') {
      var record = data.record || {};
      var logSheet = ss.getSheetByName('Logs') || ss.insertSheet('Logs');
      if (logSheet.getLastRow() === 0) {
        logSheet.appendRow(['ط§ظ„ظˆظ‚طھ','ط§ظ„ط¹ظ…ظ„ظٹط©','ط§ظ„ظ†ظˆط¹','ط§ظ„ط§ط³ظ…','ط§ظ„ظ…ط¯ط±ط³ط©','ط§ظ„ظ…ط³طھط®ط¯ظ…','طھظپط§طµظٹظ„']);
        logSheet.getRange(1,1,1,7).setBackground('#1a3a5c').setFontColor('#fff').setFontWeight('bold');
      }
      logSheet.appendRow([
        record.ts   ? new Date(record.ts).toLocaleString('ar') : new Date().toLocaleString('ar'),
        record.action  || '',
        record.type    || '',
        record.name    || '',
        record.school  || '',
        record.user    || '',
        record.details || ''
      ]);
      return _json({ ok: true });
    }

    if (action === 'addField') {
      return _json(_upsertSchemaField(ss, data, true));
    }

    if (action === 'updateField') {
      return _json(_upsertSchemaField(ss, data, false));
    }

    if (action === 'deleteField') {
      return _json(_deleteSchemaField(ss, String(data.id || data.field_name || ''), data.target || 'all'));
    }

    if (action === 'addSchoolInfoField' || action === 'updateSchoolInfoField') {
      data.target = 'school';
      return _json(_upsertSchemaField(ss, data, action === 'addSchoolInfoField'));
    }

    if (action === 'deleteSchoolInfoField') {
      return _json(_deleteSchemaField(ss, String(data.id || ''), 'school'));
    }

    return _json({ ok: false, error: 'action ط؛ظٹط± ظ…ط¹ط±ظˆظپ: ' + action });

  } catch(err) {
    return _json({ ok: false, error: err.message });
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ط¯ظˆط§ظ„ ظ…ط³ط§ط¹ط¯ط© ط¯ط§ط®ظ„ظٹط©
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * ط¨ظ†ط§ط، ط§ط³ظ… ط§ظ„ط´ظٹطھ ط¨ظ†ط§ط،ظ‹ ط¹ظ„ظ‰ ظ†ظˆط¹ ط§ظ„ط¨ظٹط§ظ†ط§طھ ظˆط§ظ„ظ…ط¯ط±ط³ط©
 */
function _sheetName(type, school) {
  var prefix = type === 'teach' ? 'ظƒط§ط¯ط±' : 'ط·ظ„ط§ط¨';
  if (!school || school === 'all') return prefix + '_ط§ظ„ظƒظ„';
  return prefix + '_' + school;
}

/**
 * ظƒطھط§ط¨ط© ظ…طµظپظˆظپط© ط³ط¬ظ„ط§طھ ظپظٹ ط´ظٹطھ â€” ظٹط­ط°ظپ ط§ظ„ظ‚ط¯ظٹظ… ظˆظٹظƒطھط¨ ط§ظ„ط¬ط¯ظٹط¯
 */
function _writeSheet(ss, sheetName, records) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    sheet.clearContents();
  }

  if (!records || records.length === 0) return;

  // ط¨ظ†ط§ط، ظ‚ط§ط¦ظ…ط© ط§ظ„ظ…ظپط§طھظٹط­ (ط§ظ„ط£ط¹ظ…ط¯ط©) ظ…ظ† ط£ظˆظ„ ط³ط¬ظ„
  var keys = Object.keys(records[0]).filter(function(k) {
    return k !== 'photo' && k !== '_type';
  });

  // ط±ط£ط³ ط§ظ„ط¬ط¯ظˆظ„
  var headerRange = sheet.getRange(1, 1, 1, keys.length);
  headerRange.setValues([keys]);
  headerRange.setBackground('#00695C').setFontColor('#ffffff').setFontWeight('bold');

  // ط§ظ„طµظپظˆظپ
  var rows = records.map(function(r) {
    return keys.map(function(k) {
      var v = r[k];
      if (Array.isArray(v)) return v.join('طŒ ');
      return (v === null || v === undefined) ? '' : String(v);
    });
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, keys.length).setValues(rows);
  }

  // طھظ†ط³ظٹظ‚ ط¥ط¶ط§ظپظٹ
  sheet.setFrozenRows(1);
  try { sheet.autoResizeColumns(1, keys.length); } catch(e) {}
  // RTL
  try { sheet.setRightToLeft(true); } catch(e) {}
}

/**
 * طھط³ط¬ظٹظ„ ط¹ظ…ظ„ظٹط© ظپظٹ ط´ظٹطھ Logs
 */
function _log(ss, action, type, school, count) {
  try {
    var ls = ss.getSheetByName('Logs');
    if (!ls) {
      ls = ss.insertSheet('Logs');
      ls.appendRow(['ط§ظ„ظˆظ‚طھ','ط§ظ„ط¹ظ…ظ„ظٹط©','ط§ظ„ظ†ظˆط¹','ط§ظ„ظ…ط¯ط±ط³ط©','ط¹ط¯ط¯ ط§ظ„ط³ط¬ظ„ط§طھ','ط§ظ„ط¥طµط¯ط§ط±']);
      ls.getRange(1,1,1,6).setBackground('#1a3a5c').setFontColor('#fff').setFontWeight('bold');
    }
    ls.appendRow([
      new Date().toLocaleString('ar'),
      action, type, school, count, APP_VERSION
    ]);
  } catch(e) { /* ظ†طھط¬ط§ظ‡ظ„ ط£ط®ط·ط§ط، ط§ظ„ط³ط¬ظ„ط§طھ */ }
}

/**
 * طھظ†ط¸ظٹظپ ط§ظ„ظ†طµظˆطµ ظ…ظ† ط§ظ„ط£ط­ط±ظپ ط§ظ„ط®ط·ط±ط©
 */
function _sanitize(str) {
  if (typeof str !== 'string') return String(str || '');
  return str.replace(/[<>"'`]/g, '').substring(0, 200);
}

/**
 * ط¥ظ†ط´ط§ط، ط§ط³طھط¬ط§ط¨ط© JSON
 */
function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _schemaSheetName(target) {
  if (target === 'students' || target === 'stud') return 'student_fields';
  if (target === 'staff' || target === 'teach') return 'staff_fields';
  return 'school_fields';
}

function _ensureSchemaSheet(ss, target) {
  var name = _schemaSheetName(target);
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'label', 'type', 'required', 'order', 'visible', 'options', 'version', 'updatedAt']);
    sheet.getRange(1, 1, 1, 9).setBackground('#00695C').setFontColor('#fff').setFontWeight('bold');
  }
  return sheet;
}

function _readSchemaSheet(ss, target) {
  var sheet = _ensureSchemaSheet(ss, target);
  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  var headers = rows[0].map(String);
  var out = [];
  rows.slice(1).forEach(function(row) {
    var rec = {};
    headers.forEach(function(h, i) { rec[h] = row[i]; });
    if (!rec.id) return;
    out.push({
      id: String(rec.id),
      field_name: String(rec.id),
      field_label: String(rec.label || rec.id),
      field_type: String(rec.type || 'text'),
      label: String(rec.label || rec.id),
      type: String(rec.type || 'text'),
      required: String(rec.required).toUpperCase() === 'TRUE' || rec.required === true,
      visible: String(rec.visible).toUpperCase() !== 'FALSE',
      sort_order: Number(rec.order || 0),
      target: target === 'school' ? 'schools' : target,
      options: rec.options ? String(rec.options).split(/[,طŒ]/).map(function(s){ return s.trim(); }).filter(Boolean) : [],
      version: rec.version || 1,
      updatedAt: rec.updatedAt || ''
    });
  });
  return out;
}

function _readSchemaFields(ss, target) {
  if (target && target !== 'all') {
    var normalized = target === 'schools' ? 'school' : target;
    return _readSchemaSheet(ss, normalized);
  }
  return []
    .concat(_readSchemaSheet(ss, 'students'))
    .concat(_readSchemaSheet(ss, 'staff'));
}

function _readSchoolFields(ss) {
  return _readSchemaSheet(ss, 'school');
}

function _schemaVersion(ss) {
  var settings = ss.getSheetByName('Settings') || ss.insertSheet('Settings');
  var rows = settings.getDataRange().getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === 'schema_version') return rows[i][1] || 1;
  }
  settings.appendRow(['schema_version', 1, new Date().toISOString()]);
  return 1;
}

function _bumpSchemaVersion(ss) {
  var settings = ss.getSheetByName('Settings') || ss.insertSheet('Settings');
  var rows = settings.getDataRange().getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === 'schema_version') {
      var next = Number(rows[i][1] || 1) + 1;
      settings.getRange(i + 1, 2, 1, 2).setValues([[next, new Date().toISOString()]]);
      return next;
    }
  }
  settings.appendRow(['schema_version', 1, new Date().toISOString()]);
  return 1;
}

function _upsertSchemaField(ss, data, isCreate) {
  var target = data.target || 'students';
  if (target === 'schools') target = 'school';
  var sheet = _ensureSchemaSheet(ss, target);
  var id = String(data.id || data.field_name || '').trim();
  if (!id) return { ok: false, error: 'id ظ…ط·ظ„ظˆط¨' };
  var label = String(data.label || data.field_label || id).trim();
  var type = String(data.type || data.field_type || 'text').trim();
  var rows = sheet.getDataRange().getValues();
  var duplicateLabel = false;
  var rowIndex = -1;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === id) rowIndex = i + 1;
    if (String(rows[i][1]).trim() === label && String(rows[i][0]) !== id) duplicateLabel = true;
  }
  if (duplicateLabel) return { ok: false, error: 'ط§ط³ظ… ط§ظ„ط­ظ‚ظ„ ظ…ظƒط±ط±' };
  var version = _bumpSchemaVersion(ss);
  var record = [
    id,
    label,
    type,
    data.required === true || String(data.required).toUpperCase() === 'TRUE',
    Number(data.sort_order || data.order || Math.max(1, sheet.getLastRow())),
    data.visible === false || String(data.visible).toUpperCase() === 'FALSE' ? false : true,
    Array.isArray(data.options) ? data.options.join(', ') : (data.options || ''),
    version,
    new Date().toISOString()
  ];
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, record.length).setValues([record]);
  } else {
    sheet.appendRow(record);
  }
  return { ok: true, id: id, version: version };
}

function _deleteSchemaField(ss, id, target) {
  if (!id) return { ok: false, error: 'id ظ…ط·ظ„ظˆط¨' };
  var targets = target === 'all' ? ['students', 'staff', 'school'] : [target === 'schools' ? 'school' : target];
  for (var t = 0; t < targets.length; t++) {
    var sheet = _ensureSchemaSheet(ss, targets[t]);
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === id) {
        if (_fieldHasData(ss, id)) return { ok: false, error: 'ظ„ط§ ظٹظ…ظƒظ† ط­ط°ظپ ط­ظ‚ظ„ ظ…ط±طھط¨ط· ط¨ط¨ظٹط§ظ†ط§طھ ط­ط§ظ„ظٹط©' };
        sheet.deleteRow(i + 1);
        return { ok: true, version: _bumpSchemaVersion(ss) };
      }
    }
  }
  return { ok: false, error: 'ط§ظ„ط­ظ‚ظ„ ط؛ظٹط± ظ…ظˆط¬ظˆط¯' };
}

function _fieldHasData(ss, fieldId) {
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var name = sheets[s].getName();
    if (['student_fields', 'staff_fields', 'school_fields', 'Logs', 'Backups', 'Settings', 'Users'].indexOf(name) >= 0) continue;
    var rows = sheets[s].getDataRange().getValues();
    if (rows.length < 2) continue;
    var idx = rows[0].map(String).indexOf(fieldId);
    if (idx < 0) continue;
    for (var r = 1; r < rows.length; r++) {
      if (rows[r][idx] !== '' && rows[r][idx] !== null && rows[r][idx] !== undefined) return true;
    }
  }
  return false;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ط¯ظˆط§ظ„ ط§ظ„ط¥ط¹ط¯ط§ط¯ ط§ظ„ط£ظˆظ„ظٹ â€” طھظڈظ†ظپظژظ‘ط° ظ…ط±ط© ظˆط§ط­ط¯ط© ظ„ط¥ط¹ط¯ط§ط¯ ط§ظ„ط¨ظ†ظٹط© ط§ظ„ط£ط³ط§ط³ظٹط©
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * ط£ظ†ط´ط¦ ظ‡ظٹظƒظ„ ط§ظ„ط´ظٹطھط§طھ ط§ظ„ط£ط³ط§ط³ظٹط© ط¥ط°ط§ ظ„ظ… طھظƒظ† ظ…ظˆط¬ظˆط¯ط©
 * ظ†ظپظ‘ط°ظ‡ط§ ظ…ظ† ظ…ط­ط±ط± Apps Script ظ…ط±ط© ظˆط§ط­ط¯ط© ط¹ظ†ط¯ ط§ظ„ط¨ط¯ط،
 */
function setupSpreadsheet() {
  var ss       = SpreadsheetApp.openById(SPREADSHEET_ID);
  var existing = ss.getSheets().map(function(s) { return s.getName(); });

  var sheetsToCreate = [
    { name: 'Logs',     headers: ['ط§ظ„ظˆظ‚طھ','ط§ظ„ط¹ظ…ظ„ظٹط©','ط§ظ„ظ†ظˆط¹','ط§ظ„ظ…ط¯ط±ط³ط©','ط¹ط¯ط¯ ط§ظ„ط³ط¬ظ„ط§طھ','ط§ظ„ط¥طµط¯ط§ط±'] },
    { name: 'Backups',  headers: ['ط§ظ„ظˆظ‚طھ','ط§ظ„ط§ط³ظ…','ط¹ط¯ط¯ ط§ظ„ظƒط§ط¯ط±','ط¹ط¯ط¯ ط§ظ„ط·ظ„ط§ط¨','ط§ظ„ط¥طµط¯ط§ط±'] },
    { name: 'Settings', headers: ['ط§ظ„ظ…ظپطھط§ط­','ط§ظ„ظ‚ظٹظ…ط©','ط¢ط®ط± طھط­ط¯ظٹط«'] },
    { name: 'Users',    headers: ['username','role','school','isAdmin','createdAt'] },
    { name: 'student_fields', headers: ['id','label','type','required','order','visible','options','version','updatedAt'] },
    { name: 'staff_fields',   headers: ['id','label','type','required','order','visible','options','version','updatedAt'] },
    { name: 'school_fields',  headers: ['id','label','type','required','order','visible','options','version','updatedAt'] }
  ];

  sheetsToCreate.forEach(function(def) {
    if (!existing.includes(def.name)) {
      var sh = ss.insertSheet(def.name);
      sh.appendRow(def.headers);
      sh.getRange(1,1,1,def.headers.length)
        .setBackground('#1a3a5c').setFontColor('#fff').setFontWeight('bold');
    }
  });

  Logger.log('âœ… طھظ… ط¥ط¹ط¯ط§ط¯ ظ‡ظٹظƒظ„ ط§ظ„ط¬ط¯ظˆظ„ ط¨ظ†ط¬ط§ط­');
}

/**
 * ط§ط®طھط¨ط§ط± ط§ظ„ط§طھطµط§ظ„ â€” ظ†ظپظ‘ط°ظ‡ط§ ظ„ظ„طھط­ظ‚ظ‚ ظ…ظ† طµط­ط© ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ
 */
function testConnection() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('âœ… ظ…طھطµظ„ ط¨ط§ظ„ط¬ط¯ظˆظ„: ' + ss.getName());
  Logger.log('ط§ظ„ط´ظٹطھط§طھ ط§ظ„ظ…ظˆط¬ظˆط¯ط©: ' + ss.getSheets().map(function(s){return s.getName();}).join(', '));
}

function setupSchemaSheets() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var headers = ['id', 'label', 'type', 'required', 'order', 'visible', 'options', 'version', 'updatedAt'];
  ['student_fields', 'staff_fields', 'school_fields'].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
    } else {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#00695C')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    try {
      sheet.autoResizeColumns(1, headers.length);
      sheet.setRightToLeft(false);
    } catch (err) {}
  });
  Logger.log('Schema sheets created successfully');
}

