/**
 * ملف نظيف لإنشاء شيتات الحقول المركزية داخل Google Sheets.
 *
 * طريقة الاستخدام:
 * 1. افتح Google Sheets.
 * 2. Extensions > Apps Script.
 * 3. أضف ملف Script جديد باسم SchemaSetup.
 * 4. الصق هذا الكود.
 * 5. ضع SPREADSHEET_ID الحقيقي.
 * 6. شغل setupSchemaSheets مرة واحدة.
 */

const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

function setupSchemaSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const sheets = [
    {
      name: 'student_fields',
      headers: ['id', 'label', 'type', 'required', 'order', 'visible', 'options', 'version', 'updatedAt']
    },
    {
      name: 'staff_fields',
      headers: ['id', 'label', 'type', 'required', 'order', 'visible', 'options', 'version', 'updatedAt']
    },
    {
      name: 'school_fields',
      headers: ['id', 'label', 'type', 'required', 'order', 'visible', 'options', 'version', 'updatedAt']
    }
  ];

  sheets.forEach(function(def) {
    let sheet = ss.getSheetByName(def.name);

    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    }

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(def.headers);
    } else {
      sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
    }

    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, def.headers.length)
      .setBackground('#00695C')
      .setFontColor('#ffffff')
      .setFontWeight('bold');

    try {
      sheet.autoResizeColumns(1, def.headers.length);
      sheet.setRightToLeft(false);
    } catch (err) {}
  });

  Logger.log('Schema sheets created successfully: student_fields, staff_fields, school_fields');
}
