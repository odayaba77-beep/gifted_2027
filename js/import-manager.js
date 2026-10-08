// ImportManager: SheetJS-powered xlsx/csv import mapped through FIELD_CONFIG.
(function () {
  'use strict';

  const TYPE_TO_CONFIG = { stud: 'students', teach: 'staff', students: 'students', staff: 'staff' };

  function dataKey(type) {
    return type === 'students' ? 'stud' : type === 'staff' ? 'teach' : type;
  }

  function fieldsFor(type) {
    return window.FIELD_CONFIG?.[TYPE_TO_CONFIG[type] || type] || [];
  }

  function normalize(text) {
    return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function buildHeaderMap(type) {
    const map = new Map();
    fieldsFor(type).forEach(field => {
      [field.id, field.name, field.label].filter(Boolean).forEach(key => map.set(normalize(key), field.id || field.name));
    });
    return map;
  }

  function castValue(value, field) {
    if (value === undefined || value === null) return '';
    if (field?.type === 'number') return Number(value) || 0;
    if (field?.type === 'date' && typeof value === 'number' && window.XLSX?.SSF) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
    return String(value).trim();
  }

  function mergeRows(type, imported) {
    const key = dataKey(type);
    const existing = window.gdb ? window.gdb(key) : JSON.parse(localStorage.getItem(`gft_${key}`) || '[]');
    const byId = new Map(existing.map(row => [row.id, row]));
    imported.forEach(row => {
      row.id = row.id || window.nid?.() || `${Date.now()}${Math.random()}`;
      byId.set(row.id, { ...(byId.get(row.id) || {}), ...row, tsEdit: Date.now() });
      window.BatchSyncManager?.enqueue({ type: key, rowId: row.id, record: byId.get(row.id), action: 'upsert', school: row.school });
    });
    const rows = Array.from(byId.values());
    if (window.sdb) window.sdb(key, rows);
    else localStorage.setItem(`gft_${key}`, JSON.stringify(rows));
    window.GridEngine?.refresh?.(key);
    return rows;
  }

  const ImportManager = {
    async importFile(file, type) {
      if (!window.XLSX) throw new Error('SheetJS غير محمل');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const headerMap = buildHeaderMap(type);
      const fieldById = Object.fromEntries(fieldsFor(type).map(field => [field.id || field.name, field]));

      const imported = rows.map(raw => {
        const record = {};
        Object.entries(raw).forEach(([header, value]) => {
          const fieldId = headerMap.get(normalize(header));
          if (fieldId) record[fieldId] = castValue(value, fieldById[fieldId]);
        });
        return record;
      }).filter(record => Object.keys(record).length);

      mergeRows(type, imported);
      window.addSyncLog?.(`تم استيراد ${imported.length} سجل إلى الطابور`, 'success');
      return imported;
    }
  };

  window.ImportManager = ImportManager;
  window.importFromExcel = async function importFromExcel(event, type) {
    const file = event?.target?.files?.[0];
    if (!file) return [];
    try {
      return await ImportManager.importFile(file, type);
    } catch (error) {
      alert(error.message || 'فشل استيراد الملف');
      return [];
    } finally {
      if (event?.target) event.target.value = '';
    }
  };
  window.downloadTemplate = function downloadTemplate(type) {
    try {
      const isStaff = (type === 'teach' || type === 'staff');
      const targetType = isStaff ? 'staff' : 'students';
      const key = isStaff ? 'teach' : 'stud';
      
      let fields = [];
      if (window.getFields) {
        fields = window.getFields(key);
      }
      if (!fields || !fields.length) {
        fields = window.FIELD_CONFIG?.[targetType] || [];
      }
      
      let activeFields = (fields || []).filter(f => f.visible !== false && !f._deleted);
      let headers = activeFields.map(f => f.label || f.name || f.id).filter(Boolean);
      
      if (!headers || !headers.length) {
        if (isStaff) {
          headers = ['الاسم الأول', 'اسم الأب', 'اسم الجد', 'اللقب', 'الرقم الوطني', 'تاريخ الميلاد', 'المدرسة', 'الصفة الوظيفية', 'المادة الدراسية', 'المؤهل العلمي', 'الدرجة الوظيفية', 'تاريخ المباشرة', 'رقم الهاتف', 'البريد الإلكتروني', 'حالة الدوام'];
        } else {
          headers = ['الاسم الأول', 'اسم الأب', 'اسم الجد', 'اللقب', 'تاريخ الميلاد', 'الجنس', 'المدرسة', 'السنة الدراسية', 'المرحلة الدراسية', 'الموهبة والاهتمام', 'المعدل الدراسي', 'هاتف ولي الأمر', 'حالة الدوام'];
        }
      }

      const sheetName = isStaff ? 'كادر المدرسة' : 'الطلاب الموهوبون';
      const fileName = (isStaff ? 'قالب_استيراد_الكادر' : 'قالب_استيراد_الطلاب') + '.xlsx';

      if (window.XLSX) {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        
        ws['!sheetView'] = [{ rightToLeft: true }];
        ws['!cols'] = headers.map(h => ({ wch: Math.max(String(h).length * 2, 16) }));
        
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, fileName);
      } else {
        const csvContent = '\uFEFF' + headers.map(h => '"' + String(h).replace(/"/g, '""') + '"').join(',') + '\n';
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (isStaff ? 'قالب_استيراد_الكادر' : 'قالب_استيراد_الطلاب') + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('[downloadTemplate error]:', err);
      alert('حدث خطأ أثناء تنزيل القالب: ' + (err.message || err));
    }
  };
})();
