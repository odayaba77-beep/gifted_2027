/**
 * Clean Google Apps Script backend for the centralized dynamic schema system.
 *
 * Use this file when the old Code.gs text appears corrupted.
 *
 * Steps:
 * 1. Replace YOUR_SPREADSHEET_ID_HERE with your Google Sheet ID.
 * 2. Optional: set SECRET_TOKEN to the same token you type in the system.
 * 3. Run setupSchemaSheets once.
 * 4. Deploy as Web App.
 */

const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
const SECRET_TOKEN = '';

const SCHEMA_HEADERS = ['id', 'label', 'type', 'required', 'order', 'visible', 'options', 'version', 'updatedAt'];

function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = params.action || 'ping';
    const token = params.token || '';

    if (!isAuthorized(token)) {
      return json({ ok: false, error: 'Unauthorized' });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    if (action === 'ping') {
      return json({ ok: true, msg: 'Schema backend is working', version: getSchemaVersion(ss) });
    }

    if (action === 'getAllConfig') {
      setupSchemaSheets();
      return json({
        ok: true,
        fields: readSchemaFields(ss, 'all'),
        schoolInfoFields: readSchemaFields(ss, 'school'),
        version: getSchemaVersion(ss)
      });
    }

    if (action === 'getFields') {
      setupSchemaSheets();
      return json({
        ok: true,
        fields: readSchemaFields(ss, params.target || 'all'),
        version: getSchemaVersion(ss)
      });
    }

    return json({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return json({ ok: false, error: err.message, stack: err.stack });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');

    if (!isAuthorized(data.token || '')) {
      return json({ ok: false, error: 'Unauthorized' });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    setupSchemaSheets();

    if (data.action === 'addField' || data.action === 'updateField') {
      return json(upsertField(ss, data));
    }

    if (data.action === 'deleteField') {
      return json(deleteField(ss, data.id || data.field_name, data.target || 'all'));
    }

    if (data.action === 'addSchoolInfoField' || data.action === 'updateSchoolInfoField') {
      data.target = 'school';
      return json(upsertField(ss, data));
    }

    if (data.action === 'deleteSchoolInfoField') {
      return json(deleteField(ss, data.id, 'school'));
    }

    return json({ ok: false, error: 'Unknown action: ' + data.action });
  } catch (err) {
    return json({ ok: false, error: err.message, stack: err.stack });
  }
}

function setupSchemaSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ['student_fields', 'staff_fields', 'school_fields'].forEach(function(name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(SCHEMA_HEADERS);
    } else {
      sheet.getRange(1, 1, 1, SCHEMA_HEADERS.length).setValues([SCHEMA_HEADERS]);
    }

    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, SCHEMA_HEADERS.length)
      .setBackground('#00695C')
      .setFontColor('#ffffff')
      .setFontWeight('bold');

    try {
      sheet.autoResizeColumns(1, SCHEMA_HEADERS.length);
      sheet.setRightToLeft(false);
    } catch (err) {}
  });

  const settings = ss.getSheetByName('Settings') || ss.insertSheet('Settings');
  if (settings.getLastRow() === 0) {
    settings.appendRow(['key', 'value', 'updatedAt']);
  }
}

function readSchemaFields(ss, target) {
  if (target === 'all') {
    return []
      .concat(readSchemaFields(ss, 'students'))
      .concat(readSchemaFields(ss, 'staff'));
  }

  const normalizedTarget = normalizeTarget(target);
  const sheet = ensureSchemaSheet(ss, normalizedTarget);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(String);
  return values.slice(1).map(function(row) {
    const record = {};
    headers.forEach(function(header, index) {
      record[header] = row[index];
    });

    if (!record.id) return null;

    return {
      id: String(record.id),
      field_name: String(record.id),
      field_label: String(record.label || record.id),
      field_type: String(record.type || 'text'),
      label: String(record.label || record.id),
      type: String(record.type || 'text'),
      required: toBool(record.required),
      visible: String(record.visible).toUpperCase() !== 'FALSE',
      sort_order: Number(record.order || 0),
      target: normalizedTarget === 'school' ? 'schools' : normalizedTarget,
      options: record.options ? String(record.options).split(/[,،]/).map(function(item) { return item.trim(); }).filter(Boolean) : [],
      version: Number(record.version || 1),
      updatedAt: record.updatedAt || ''
    };
  }).filter(Boolean);
}

function upsertField(ss, data) {
  const target = normalizeTarget(data.target || 'students');
  const sheet = ensureSchemaSheet(ss, target);
  const id = String(data.id || data.field_name || '').trim();
  if (!id) return { ok: false, error: 'Field id is required' };

  const label = String(data.label || data.field_label || id).trim();
  const type = String(data.type || data.field_type || 'text').trim();
  const values = sheet.getDataRange().getValues();

  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    const existingId = String(values[i][0] || '').trim();
    const existingLabel = String(values[i][1] || '').trim();
    if (existingId === id) rowIndex = i + 1;
    if (existingLabel === label && existingId !== id) {
      return { ok: false, error: 'Duplicate field label: ' + label };
    }
  }

  const version = bumpSchemaVersion(ss);
  const order = Number(data.sort_order || data.order || Math.max(1, sheet.getLastRow()));
  const options = Array.isArray(data.options) ? data.options.join(', ') : String(data.options || '');
  const row = [
    id,
    label,
    type,
    toBool(data.required),
    order,
    data.visible === false || String(data.visible).toUpperCase() === 'FALSE' ? false : true,
    options,
    version,
    new Date().toISOString()
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return { ok: true, id: id, version: version };
}

function deleteField(ss, fieldId, target) {
  const id = String(fieldId || '').trim();
  if (!id) return { ok: false, error: 'Field id is required' };

  const targets = target === 'all' ? ['students', 'staff', 'school'] : [normalizeTarget(target)];

  for (let t = 0; t < targets.length; t++) {
    const sheet = ensureSchemaSheet(ss, targets[t]);
    const values = sheet.getDataRange().getValues();

    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0] || '').trim() === id) {
        if (fieldHasData(ss, id)) {
          return { ok: false, error: 'Cannot delete field because it has saved data' };
        }
        sheet.deleteRow(i + 1);
        return { ok: true, version: bumpSchemaVersion(ss) };
      }
    }
  }

  return { ok: false, error: 'Field not found' };
}

function ensureSchemaSheet(ss, target) {
  const name = schemaSheetName(target);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    setupSchemaSheets();
    sheet = ss.getSheetByName(name);
  }
  return sheet;
}

function schemaSheetName(target) {
  const normalizedTarget = normalizeTarget(target);
  if (normalizedTarget === 'students') return 'student_fields';
  if (normalizedTarget === 'staff') return 'staff_fields';
  return 'school_fields';
}

function normalizeTarget(target) {
  if (target === 'stud' || target === 'student' || target === 'students') return 'students';
  if (target === 'teach' || target === 'staff') return 'staff';
  if (target === 'schools' || target === 'school') return 'school';
  return 'students';
}

function getSchemaVersion(ss) {
  const settings = ss.getSheetByName('Settings') || ss.insertSheet('Settings');
  const values = settings.getDataRange().getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === 'schema_version') return Number(values[i][1] || 1);
  }
  settings.appendRow(['schema_version', 1, new Date().toISOString()]);
  return 1;
}

function bumpSchemaVersion(ss) {
  const settings = ss.getSheetByName('Settings') || ss.insertSheet('Settings');
  const values = settings.getDataRange().getValues();

  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === 'schema_version') {
      const next = Number(values[i][1] || 1) + 1;
      settings.getRange(i + 1, 2, 1, 2).setValues([[next, new Date().toISOString()]]);
      return next;
    }
  }

  settings.appendRow(['schema_version', 1, new Date().toISOString()]);
  return 1;
}

function fieldHasData(ss, fieldId) {
  const ignored = ['student_fields', 'staff_fields', 'school_fields', 'Logs', 'Backups', 'Settings', 'Users'];
  const sheets = ss.getSheets();

  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    if (ignored.indexOf(sheet.getName()) >= 0) continue;

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) continue;

    const headerIndex = values[0].map(String).indexOf(fieldId);
    if (headerIndex < 0) continue;

    for (let r = 1; r < values.length; r++) {
      const value = values[r][headerIndex];
      if (value !== '' && value !== null && value !== undefined) return true;
    }
  }

  return false;
}

function toBool(value) {
  return value === true || String(value).toUpperCase() === 'TRUE' || String(value) === '1';
}

function isAuthorized(token) {
  return !SECRET_TOKEN || token === SECRET_TOKEN;
}

function json(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
