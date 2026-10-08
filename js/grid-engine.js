// GridEngine: builds editable Tabulator grids from FIELD_CONFIG only.
(function () {
  'use strict';

  const TYPE_TO_CONFIG = { stud: 'students', teach: 'staff', students: 'students', staff: 'staff' };
  const tables = {};

  function configKey(type) {
    return TYPE_TO_CONFIG[type] || type;
  }

  function dataKey(type) {
    return type === 'students' ? 'stud' : type === 'staff' ? 'teach' : type;
  }

  function canEdit() {
    const role = String(window.CU?.role || window.CU?.userRole || window.CU?.type || '').trim();
    if (role === 'مدرس') return false;
    return !!window.CU?.isAdmin || role === 'إدارة' || role === 'ادارة';
  }

  function fieldsFor(type) {
    const fields = window.FIELD_CONFIG?.[configKey(type)] || [];
    return fields
      .filter(field => field.visible !== false)
      .slice()
      .sort((a, b) => (a.sort_order || a.order || 0) - (b.sort_order || b.order || 0));
  }

  function editorFor(field) {
    if (!canEdit()) return false;
    if (field.readonly || field.readOnly) return false;
    if (field.type === 'select') return 'list';
    if (field.type === 'number') return 'number';
    if (field.type === 'date') return 'date';
    if (field.type === 'textarea') return 'textarea';
    return 'input';
  }

  function validatorFor(field) {
    const validators = [];
    if (field.required) validators.push('required');
    if (field.type === 'number') validators.push('numeric');
    return validators.length ? validators : undefined;
  }

  function columnsFor(type) {
    return fieldsFor(type).map(field => ({
      title: field.label || field.name || field.id,
      field: field.id || field.name,
      minWidth: field.type === 'textarea' ? 220 : 140,
      headerFilter: 'input',
      editor: editorFor(field),
      validator: validatorFor(field),
      editorParams: field.type === 'select' ? { values: field.options || [] } : undefined
    }));
  }

  function readRows(type) {
    const key = dataKey(type);
    if (window.gdb) return window.gdb(key);
    try { return JSON.parse(localStorage.getItem(`gft_${key}`) || '[]'); } catch { return []; }
  }

  function writeRows(type, rows) {
    const key = dataKey(type);
    if (window.sdb) window.sdb(key, rows);
    else localStorage.setItem(`gft_${key}`, JSON.stringify(rows));
  }

  function ensureIds(rows) {
    return rows.map(row => ({ ...row, id: row.id || window.nid?.() || `${Date.now()}${Math.random()}` }));
  }

  function saveLocalRow(type, row) {
    const rows = readRows(type);
    const idx = rows.findIndex(item => item.id === row.id);
    if (idx >= 0) rows[idx] = { ...rows[idx], ...row, tsEdit: Date.now() };
    else rows.push({ ...row, ts: Date.now(), tsEdit: Date.now() });
    writeRows(type, rows);
  }

  function mountFallbackContainer(type) {
    const tableId = dataKey(type) === 'teach' ? 'teach-tbl' : 'stud-tbl';
    const table = document.getElementById(tableId);
    if (!table) return null;
    const container = document.createElement('div');
    container.id = `${dataKey(type)}-grid`;
    container.className = 'field-grid';
    table.replaceWith(container);
    return container;
  }

  const GridEngine = {
    create(type, selector, options = {}) {
      if (!window.Tabulator) throw new Error('Tabulator غير محمل');
      const target = typeof selector === 'string' ? document.querySelector(selector) : selector;
      const element = target || mountFallbackContainer(type);
      if (!element) throw new Error('لم يتم العثور على حاوية الجدول');

      const normalizedType = dataKey(type);
      const rows = ensureIds(options.data || readRows(normalizedType));
      writeRows(normalizedType, rows);

      tables[normalizedType]?.destroy?.();
      tables[normalizedType] = new Tabulator(element, {
        data: rows,
        index: 'id',
        layout: 'fitDataStretch',
        height: options.height || '540px',
        reactiveData: false,
        movableColumns: true,
        pagination: true,
        paginationSize: 10,
        placeholder: 'لا توجد بيانات',
        columns: columnsFor(normalizedType),
        cellEdited(cell) {
          const row = cell.getRow().getData();
          const field = cell.getField();
          saveLocalRow(normalizedType, row);
          window.BatchSyncManager?.enqueue({
            type: normalizedType,
            rowId: row.id,
            record: row,
            changedFields: [field],
            school: row.school
          });
        }
      });

      element.classList.toggle('readonly-grid', !canEdit());
      return tables[normalizedType];
    },

    refresh(type) {
      const key = dataKey(type);
      tables[key]?.setData?.(readRows(key));
    },

    getTable(type) {
      return tables[dataKey(type)];
    },

    buildColumns: columnsFor,
    getFields: fieldsFor,
    canEdit
  };

  window.GridEngine = GridEngine;
})();
