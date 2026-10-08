// ============================================================
// التطبيق الرئيسي — دوال العرض والجداول والإدارة
// ============================================================

// نظام الإشعارات المنبثقة التفاعلية (Toast Notifications System)
function showToast(message, type = 'info', duration = 3500) {
  try {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const normType = (type === 'warn' || type === 'warning') ? 'warning' 
                   : (type === 'error' || type === 'err') ? 'error' 
                   : (type === 'success' || type === 'ok') ? 'success' : 'info';
    
    toast.className = `toast toast-${normType}`;

    const icons = {
      success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:20px;height:20px;color:#15803d"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
      error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:20px;height:20px;color:#b91c1c"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:20px;height:20px;color:#b45309"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:20px;height:20px;color:#1d4ed8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
    };

    const titles = {
      success: 'تمت العملية بنجاح',
      error: 'تنبيه خطأ',
      warning: 'تنبيه هام',
      info: 'إشعار النظام'
    };

    const iconHtml = icons[normType] || icons.info;
    const defaultTitle = titles[normType] || 'إشعار';

    toast.innerHTML = `
      <div class="toast-icon">${iconHtml}</div>
      <div class="toast-content">
        <span class="toast-title">${defaultTitle}</span>
        <span class="toast-msg">${message}</span>
      </div>
      <button type="button" class="toast-close" title="إغلاق">✕</button>
      <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    const dismiss = () => {
      toast.classList.remove('toast-show');
      toast.classList.add('toast-hide');
      setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 350);
    };

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dismiss();
      });
    }

    toast.addEventListener('click', dismiss);
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    if (duration > 0) {
      setTimeout(dismiss, duration);
    }
  } catch (err) {
    console.warn('[showToast Error]:', err, message);
  }
}
window.showToast = showToast;

let modalType = null, editId = null, curPhoto = null;
let tableSortState = { teach: { column: null, direction: 'asc' }, stud: { column: null, direction: 'asc' } };
const TABLE_PAGE_SIZE = 10;
let tablePageState = { teach: 1, stud: 1 };
let ACTIVE_YEAR = getCurrentAcademicYear();
let dragSrcType = null, dragSrcIdx = null;

// دوال مساعدة أساسية
function nid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function gdb(k) { try { return JSON.parse(localStorage.getItem('gft_' + k) || '[]'); } catch { return []; } }
function sdb(k, d) {
  try {
    localStorage.setItem('gft_' + k, JSON.stringify(d));
    if (StorageManager._db && (k === 'teach' || k === 'stud')) {
      StorageManager.writeIDB(k, d).catch(() => { });
    }
    EventSystem.emit('data:changed', { type: k, count: Array.isArray(d) ? d.length : 0 });
  } catch (e) {
    console.warn('[sdb] خطأ في الحفظ:', e);
    try {
      localStorage.removeItem('gft_sync_log');
      localStorage.setItem('gft_' + k, JSON.stringify(d));
    } catch { alert('مساحة التخزين ممتلئة — يُرجى عمل نسخة احتياطية أولاً'); }
  }
}
function canSee(r) { return !CU || !CU?.school || r.school === CU.school; }
function gdata(t) { return gdb(t).filter(r => canSee(r)); }
function fullName(r) { return [r.name1, r.name2, r.name3, r.name4].filter(Boolean).join(' '); }
function getFullNameParts(rec) { return [rec.name1, rec.name2, rec.name3, rec.name4].filter(Boolean).join(' '); }

function arabicSort(a, b) {
  const na = fullName(a), nb = fullName(b);
  return na.localeCompare(nb, 'ar');
}

function findDuplicateRecord(type, nameStr, excludeId, school, stage, academicYear) {
  try {
    let db = gdb(type);
    const targetSchool = school || (CU?.school ? CU.school : null);
    if (targetSchool && targetSchool !== 'all') {
      db = db.filter(r => r.school === targetSchool);
    }
    const nameLower = (nameStr || '').toLowerCase().trim().replace(/\s+/g, ' ');
    if (!nameLower) return null;
    return db.find(r => {
      if (excludeId && r.id === excludeId) return false;
      const recName = getFullNameParts(r).toLowerCase().trim().replace(/\s+/g, ' ');
      if (recName !== nameLower) return false;
      if (type === 'stud') {
        const rStage = (r.stage || '').trim().toLowerCase();
        const curStage = (stage || '').trim().toLowerCase();
        if (curStage && rStage && curStage !== rStage) return false;

        const rYear = (r.academicYear || '').trim().toLowerCase();
        const curYear = (academicYear || '').trim().toLowerCase();
        if (curYear && rYear && curYear !== rYear) return false;
      }
      return true;
    }) || null;
  } catch (e) {
    console.error('[findDuplicateRecord] خطأ:', e);
    return null;
  }
}

function checkDuplicateName(type, nameStr, excludeId, school, stage, academicYear) {
  return !!findDuplicateRecord(type, nameStr, excludeId, school, stage, academicYear);
}

function displayFieldValue(r, id) {
  if (id === 'jobRole') return r.jobRole || r.role_type || '';
  if (id === 'subject') return r.subject || (r.role_type === 'تدريسي' ? r.job : '');
  if (id === 'targetStages') {
    if (Array.isArray(r.targetStages)) return r.targetStages.filter(Boolean).join('، ');
    if (typeof r.targetStages === 'string' && r.targetStages.trim()) return r.targetStages;
    return '';
  }
  return r[id] || '';
}

function stageArray(r) {
  if (Array.isArray(r.targetStages)) return r.targetStages.filter(Boolean);
  if (typeof r.targetStages === 'string' && r.targetStages.trim()) return r.targetStages.split('،').map(s => s.trim()).filter(Boolean);
  return [];
}

function getDefaultAvatar(type, gender) {
  const g = (gender || '').trim();
  const isFemale = g === 'أنثى' || g === 'انثى' || g === 'female' || g === 'Female';
  const isTeach = type === 'teach' || type === 'teacher' || type === 'Kader';
  
  if (isTeach) {
    return isFemale ? 'images/avatar_female_staff.jpg' : 'images/avatar_male_staff.jpg';
  } else {
    return isFemale ? 'images/avatar_girl_student.jpg' : 'images/avatar_boy_student.jpg';
  }
}

function getRecordAvatar(rec, type) {
  if (rec && rec.photo && typeof rec.photo === 'string' && rec.photo.trim().length > 10) {
    return rec.photo;
  }
  const recType = type || rec?._type || (rec?.jobRole || rec?.degree ? 'teach' : 'stud');
  return getDefaultAvatar(recType, rec?.gender);
}

function photoCell(r, type) {
  const src = getRecordAvatar(r, type);
  return `<td class="pc" style="text-align:center;width:48px"><img src="${src}" alt="صورة" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid var(--bd2)"></td>`;
}

function barColor(pct) {
  if (pct >= 80) return '#15803d';
  if (pct >= 50) return '#BA7517';
  return '#b91c1c';
}

function getTableDisplayFields(type) {
  return visibleFields(type).filter(f => 
    f && 
    f.id !== 'name1' && 
    f.id !== 'name2' && 
    f.id !== 'name3' && 
    f.id !== 'name4' && 
    f.id !== 'school' && 
    f.id !== 'role_type' && 
    f.id !== 'job' && 
    f.id !== 'teach_stages'
  );
}

// دوال الجداول والفرز
function buildTableHeaders(type) {
  const thead = document.getElementById(type + '-thead');
  if (!thead) return;
  const vf = getTableDisplayFields(type);
  const state = tableSortState[type] || { column: null, direction: 'asc' };

  const thList = [];
  
  // 1. الترقيم
  thList.push(`<th style="width:40px;text-align:center;white-space:nowrap">#</th>`);
  
  // 2. الصورة
  thList.push(`<th style="width:48px;text-align:center;white-space:nowrap">الصورة</th>`);
  
  // 3. الاسم الرباعي
  {
    const isSort = state.column === 'name';
    const icon = isSort ? (state.direction === 'asc' ? '⬆' : '⬇') : '⇅';
    const activeStyle = isSort ? 'background:var(--pr-l);color:var(--pr-d);' : '';
    thList.push(`<th onclick="sortTable('${type}', 'name')" style="cursor:pointer;white-space:nowrap;min-width:140px;${activeStyle}">الاسم الرباعي <span style="font-size:10px">${icon}</span></th>`);
  }
  
  // 4. المدرسة
  {
    const isSort = state.column === 'school';
    const icon = isSort ? (state.direction === 'asc' ? '⬆' : '⬇') : '⇅';
    const activeStyle = isSort ? 'background:var(--pr-l);color:var(--pr-d);' : '';
    thList.push(`<th onclick="sortTable('${type}', 'school')" style="cursor:pointer;white-space:nowrap;${activeStyle}">المدرسة <span style="font-size:10px">${icon}</span></th>`);
  }
  
  // 5. الحقول الديناميكية
  vf.forEach(f => {
    const isSort = state.column === f.id || state.column === f.label;
    const icon = isSort ? (state.direction === 'asc' ? '⬆' : '⬇') : '⇅';
    const activeStyle = isSort ? 'background:var(--pr-l);color:var(--pr-d);' : '';
    thList.push(`<th onclick="sortTable('${type}', '${f.id}')" style="cursor:pointer;white-space:nowrap;${activeStyle}">${f.label || f.name || f.id} <span style="font-size:10px">${icon}</span></th>`);
  });
  
  // 6. عمود الإجراءات (بدون فرز)
  thList.push(`<th style="text-align:center;white-space:nowrap;width:120px;cursor:default">إجراءات</th>`);

  thead.innerHTML = `<tr>${thList.join('')}</tr>`;
}

function sortTable(type, column) {
  const state = tableSortState[type];
  if (state.column === column) {
    state.direction = state.direction === 'asc' ? 'desc' : 'asc';
  } else {
    state.column = column;
    state.direction = 'asc';
  }
  tablePageState[type] = 1;
  buildTableHeaders(type);
  renderTbl(type);
}

function getSortValue(row, column, type) {
  if (column === 'name') return fullName(row);
  if (column === 'school') return row.school || '';
  const field = visibleFields(type).find(f => f.id === column || f.label === column);
  const key = field?.id || column;
  return displayFieldValue(row, key) || row[key] || '';
}

function applyTableSort(type, data) {
  const state = tableSortState[type];
  const sorted = [...data];
  if (!state || !state.column) return sorted.sort(arabicSort);
  const direction = state.direction === 'desc' ? -1 : 1;
  return sorted.sort((a, b) => {
    const av = getSortValue(a, state.column, type);
    const bv = getSortValue(b, state.column, type);
    const an = parseFloat(av);
    const bn = parseFloat(bv);
    if (!Number.isNaN(an) && !Number.isNaN(bn)) return (an - bn) * direction;
    return String(av).localeCompare(String(bv), 'ar', { numeric: true, sensitivity: 'base' }) * direction;
  });
}

function createTableRow(type, r, index, visibleFieldsList) {
  const dynCells = visibleFieldsList.map(f => {
    const rawVal = displayFieldValue(r, f.id);
    const hasVal = rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '';
    const val = hasVal ? rawVal : '—';
    if (f.id === 'jobRole' || f.id === 'subject') return `<td><span class="badge b-teal">${val}</span></td>`;
    if (f.id === 'degree') return `<td><span class="badge b-blue">${val}</span></td>`;
    if (f.id === 'grade') return `<td><span class="badge b-gray">${val}</span></td>`;
    if (f.id === 'talent') return `<td><span class="badge b-purple">${val}</span></td>`;
    if (f.id === 'attendance') {
      const badgeCls = val === 'مستمر' ? 'b-green' : (val === 'غير مستمر' ? 'b-red' : 'b-gray');
      return `<td><span class="badge ${badgeCls}">${val}</span></td>`;
    }
    if (f.id === 'targetStages') {
      const stages = stageArray(r);
      return stages.length === 0 ? `<td>—</td>` : `<td>${stages.map(s => `<span class="badge b-gray" style="margin:1px">${s}</span>`).join('')}</td>`;
    }
    if (f.id === 'gpa') return `<td style="font-weight:700;color:var(--pr-d);text-align:center">${val}</td>`;
    if (f.type === 'date') return `<td style="font-size:12px;color:var(--tx2);white-space:nowrap;direction:ltr;text-align:center">${val}</td>`;
    if (f.id === 'phone' || f.id === 'parentPhone' || f.id === 'studentPhone' || f.id === 'email') return `<td style="font-size:12px;color:var(--tx2);white-space:nowrap;direction:ltr;text-align:center">${val}</td>`;
    if (f.type === 'textarea' || f.id === 'address' || f.id === 'attendanceNotes' || f.id === 'achievements') {
      return `<td><span style="max-width:200px;display:inline-block;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;vertical-align:middle" title="${String(val).replace(/"/g, '&quot;')}">${val}</span></td>`;
    }
    return `<td>${val}</td>`;
  }).join('');
  const bdg = type === 'teach' ? 'b-teal' : 'b-amber';
  const tr = document.createElement('tr');
  tr.style.transition = 'opacity .2s';
  tr.innerHTML = `
    <td style="color:var(--tx3);font-size:12px;text-align:center;width:40px">${index + 1}</td>
    ${photoCell(r, type)}
    <td style="cursor:pointer;white-space:nowrap" onclick="openView('${type}','${r.id}')"><strong>${fullName(r)}</strong></td>
    <td><span class="badge ${bdg}">${r.school || '—'}</span></td>
    ${dynCells}
    <td style="text-align:center"><div class="tacts" style="justify-content:center">
      ${type === 'stud' ? `<button class="ab" onclick="openStudentReportModal('${r.id}')" title="تصدير بطاقة الطالب PDF" style="color:var(--pr-d);border-color:var(--pr);background:var(--pr-l)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><span>PDF</span></button>` : ''}
      <button class="ab ab-ed" onclick="openEdit('${type}','${r.id}')" title="تعديل السجل"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><span>تعديل</span></button>
      <button class="ab ab-dl" onclick="deleteRec('${type}','${r.id}')" title="حذف السجل"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg><span>حذف</span></button>
    </div></td>
  `;
  return tr;
}

let tablePageSizes = { teach: 10, stud: 10 };

function changeTablePageSize(type, size) {
  tablePageSizes[type] = parseInt(size, 10) || 10;
  tablePageState[type] = 1;
  renderTbl(type);
}

function changeTablePage(type, page) {
  tablePageState[type] = page;
  renderTbl(type, { keepPage: true });
}

function renderTablePager(type, totalRows, currentPage, totalPages) {
  const pager = document.getElementById(type + '-pager');
  if (!pager) return;
  const pageSize = tablePageSizes[type] || 10;
  
  if (totalRows === 0) {
    pager.innerHTML = '';
    return;
  }
  
  const pages = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let page = start; page <= end; page++) pages.push(page);
  
  const startRow = (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(currentPage * pageSize, totalRows);
  
  pager.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <span style="font-weight:600;color:var(--tx2)">عرض ${startRow} - ${endRow} من إجمالي ${totalRows} اسم</span>
      <div style="display:flex;align-items:center;gap:6px">
        <label style="font-size:12px;color:var(--tx3)">عدد الأسماء في الصفحة:</label>
        <select onchange="changeTablePageSize('${type}', this.value)" style="padding:4px 8px;border:1px solid var(--bd);border-radius:6px;font-size:12px;background:var(--sf);color:var(--tx);font-family:'Cairo',sans-serif">
          <option value="10" ${pageSize === 10 ? 'selected' : ''}>10 أسماء (افتراضي)</option>
          <option value="20" ${pageSize === 20 ? 'selected' : ''}>20 اسم</option>
          <option value="50" ${pageSize === 50 ? 'selected' : ''}>50 اسم</option>
          <option value="100" ${pageSize === 100 ? 'selected' : ''}>100 اسم</option>
          <option value="10000" ${pageSize >= 10000 ? 'selected' : ''}>عرض الكل</option>
        </select>
      </div>
    </div>
    <div class="tbl-pages">
      <button class="tbl-page-btn" onclick="changeTablePage('${type}', 1)" ${currentPage === 1 ? 'disabled' : ''} title="الصفحة الأولى">«</button>
      <button class="tbl-page-btn" onclick="changeTablePage('${type}', ${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹ السابق</button>
      ${pages.map(page => `<button class="tbl-page-btn ${page === currentPage ? 'active' : ''}" onclick="changeTablePage('${type}', ${page})">${page}</button>`).join('')}
      <button class="tbl-page-btn" onclick="changeTablePage('${type}', ${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>التالي ›</button>
      <button class="tbl-page-btn" onclick="changeTablePage('${type}', ${totalPages})" ${currentPage === totalPages ? 'disabled' : ''} title="الصفحة الأخيرة">»</button>
    </div>
  `;
}

function renderTbl(type, options = {}) {
  let data = gdata(type);
  const bodyEl = document.getElementById(type + '-body');
  const cntEl = document.getElementById(type + '-cnt');
  if (!bodyEl) return;

  if (type === 'teach') {
    const sc = document.getElementById('ft-sc')?.value || '';
    const role = document.getElementById('ft-role')?.value || '';
    const subj = document.getElementById('ft-subj')?.value || '';
    const dg = document.getElementById('ft-dg')?.value || '';
    const att = document.getElementById('ft-att')?.value || '';
    const q = (document.getElementById('ft-q')?.value || '').toLowerCase();
    if (sc) data = data.filter(r => r.school === sc);
    if (role) data = data.filter(r => (r.jobRole || r.role_type) === role);
    if (subj) data = data.filter(r => r.subject === subj);
    if (dg) data = data.filter(r => r.degree === dg);
    if (att) data = data.filter(r => (r.attendance || 'مستمر') === att);
    if (q) data = data.filter(r => fullName(r).toLowerCase().includes(q));
    const adminCnt = data.filter(r => (r.jobRole || r.role_type) === 'إداري').length;
    const teachCnt = data.filter(r => (r.jobRole || r.role_type) === 'تدريسي').length;
    const el1 = document.getElementById('teach-admin-cnt');
    const el2 = document.getElementById('teach-teach-cnt');
    if (el1) el1.textContent = adminCnt;
    if (el2) el2.textContent = teachCnt;
  } else {
    const yrEl = document.getElementById('fs-year');
    const yr = yrEl ? yrEl.value : '';
    const sc = document.getElementById('fs-sc')?.value || '';
    const st = document.getElementById('fs-st')?.value || '';
    const tl = document.getElementById('fs-tl')?.value || '';
    const dg = document.getElementById('fs-dg')?.value || '';
    const att = document.getElementById('fs-att')?.value || '';
    const q = (document.getElementById('fs-q')?.value || '').toLowerCase();
    
    if (yr) data = data.filter(r => r.academicYear === yr);
    if (sc) data = data.filter(r => r.school === sc);
    if (st) data = data.filter(r => r.stage === st);
    if (tl) data = data.filter(r => r.talent === tl);
    if (dg) data = data.filter(r => r.degree === dg);
    if (att) data = data.filter(r => (r.attendance || 'مستمر') === att);
    if (q) data = data.filter(r => fullName(r).toLowerCase().includes(q));
  }

  const pageSize = tablePageSizes[type] || 10;
  data = applyTableSort(type, data);
  const vf = getTableDisplayFields(type);
  const totalRows = data.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const requestedPage = options.keepPage ? (tablePageState[type] || 1) : 1;
  const currentPage = Math.min(Math.max(requestedPage, 1), totalPages);
  tablePageState[type] = currentPage;
  const pageStart = (currentPage - 1) * pageSize;
  const pageRows = data.slice(pageStart, pageStart + pageSize);

  bodyEl.textContent = '';
  if (!data.length) {
    const colSpanCount = vf.length + 5;
    bodyEl.innerHTML = `<tr><td colspan="${colSpanCount}" class="te">لا توجد سجلات</td></tr>`;
  } else {
    const fragment = document.createDocumentFragment();
    pageRows.forEach((r, i) => fragment.appendChild(createTableRow(type, r, pageStart + i, vf)));
    bodyEl.appendChild(fragment);
  }
  renderTablePager(type, totalRows, currentPage, totalPages);
  if (cntEl) cntEl.textContent = 'إجمالي السجلات: ' + data.length + ' | المعروض في هذه الصفحة: ' + pageRows.length + ' (الصفحة ' + currentPage + ' من ' + totalPages + ')';
  updateNavBadges();
  updateStats(type, data);
}

function updateNavBadges() {
  const teachActive = gdata('teach').filter(r => (r.attendance || 'مستمر') === 'مستمر').length;
  const studActive = gdata('stud').filter(r => (r.attendance || 'مستمر') === 'مستمر').length;
  const studArchived = gdata('stud').filter(r => (r.attendance || 'مستمر') === 'غير مستمر').length;

  const nbTeach = document.getElementById('nb-teach');
  if (nbTeach) {
    nbTeach.textContent = teachActive;
    nbTeach.title = 'المجموع الكلي المستمر في الدوام: ' + teachActive;
  }
  const nbStud = document.getElementById('nb-stud');
  if (nbStud) {
    nbStud.textContent = studActive;
    nbStud.title = 'المجموع الكلي المستمر في الدوام: ' + studActive;
  }
  const nbArch = document.getElementById('nb-archived');
  if (nbArch) {
    nbArch.textContent = studArchived;
  }
}
window.updateNavBadges = updateNavBadges;

function updateStats(type, data) {
  const males = data.filter(r => r.gender === 'ذكر').length;
  const females = data.filter(r => r.gender === 'أنثى').length;
  const active = data.filter(r => (r.attendance || 'مستمر') === 'مستمر').length;
  const inactive = data.filter(r => r.attendance === 'غير مستمر').length;
  const totalEl = document.getElementById(type + '-total');
  const malesEl = document.getElementById(type + '-males');
  const femalesEl = document.getElementById(type + '-females');
  const activeEl = document.getElementById(type + '-active');
  const inactiveEl = document.getElementById(type + '-inactive');
  if (totalEl) totalEl.textContent = data.length;
  if (malesEl) malesEl.textContent = males;
  if (femalesEl) femalesEl.textContent = females;
  if (activeEl) activeEl.textContent = active;
  if (inactiveEl) inactiveEl.textContent = inactive;
}

function refreshAll() {
  try { populateFilters(); } catch (e) { }
  try { updateNavBadges(); } catch (e) { }
  try { renderDashboard(); } catch (e) { }
  try { buildTableHeaders('teach'); renderTbl('teach'); } catch (e) { }
  try { buildTableHeaders('stud'); renderTbl('stud'); } catch (e) { }
  try { if (window.renderRelations) renderRelations(); } catch (e) { }
  try { if (window.renderOpsLog) renderOpsLog(); } catch (e) { }
}

function onGlobalYearChange(year) {
  if (!year && ACADEMIC_YEARS && ACADEMIC_YEARS.length) year = ACADEMIC_YEARS[0];
  ACTIVE_YEAR = year;
  ['global-year-sel', 'dash-year-filter', 'fs-year', 'ar-year'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value !== ACTIVE_YEAR) el.value = ACTIVE_YEAR;
  });
  refreshAll();
}

function populateFilters() {
  const vis = getSchoolsList().filter(s => !CU?.school || s === CU.school);
  ['ft-sc', 'fs-sc', 'chart-school-filter'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    while (el.options.length > 1) el.remove(1);
    vis.forEach(s => { el.add(new Option(s, s)); });
    if (CU?.school) { el.value = CU.school; el.disabled = true; }
  });
  populateYearSelectors();
}

function populateYearSelectors() {
  var _ayF = (getFieldConfigForType ? getFieldConfigForType('stud') : (CORE_FIELDS.stud || [])).find(function (f) { return f.id === 'academicYear'; });
  if (_ayF) _ayF.options = [].concat(ACADEMIC_YEARS);
  
  if (!ACTIVE_YEAR || !ACADEMIC_YEARS.includes(ACTIVE_YEAR)) {
    ACTIVE_YEAR = (ACADEMIC_YEARS && ACADEMIC_YEARS[0]) ? ACADEMIC_YEARS[0] : '2024-2025';
  }

  ['global-year-sel', 'dash-year-filter', 'fs-year', 'ar-year'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    ACADEMIC_YEARS.forEach(y => el.add(new Option(y, y)));
    if (ACTIVE_YEAR) el.value = ACTIVE_YEAR;
  });
}

function nav(id, el, title) {
  const adminOnlyPages = ['fieldmgr', 'schools', 'backup', 'settings'];
  if (adminOnlyPages.includes(id) && (!CU || !CU.isAdmin)) {
    if (window.showToast) window.showToast('⛔ هذه الصفحة متاحة لمدير النظام فقط', 'warning');
    else alert('⛔ هذه الصفحة متاحة لمدير النظام فقط');
    return;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById('pg-' + id);
  if (pg) pg.classList.add('active');
  if (el) el.classList.add('active');
  document.getElementById('tbt').textContent = title || '';
  if (id === 'dashboard') { renderDashboard(); if (CU && CU.isAdmin) renderDataEntryStatus(); }
  if (id === 'schools') { renderSchools(); }
  if (id === 'backup') renderBkStats();
  if (id === 'fieldmgr') renderFieldMgr();
  if (id === 'schoolinfo') { renderSchoolInfoPage(); }
  if (id === 'settings') { renderAccounts(); renderSchoolsMgmt(); updateMyCredBadge(); }
  if (id === 'sync') { renderSyncLog(); if (window.renderSyncSummary) renderSyncSummary(); updatePendingBadge(); checkOnline(); }
  if (id === 'promotion' && window.renderPromotionPage) renderPromotionPage();
  if (id === 'archived' && window.renderArchivedPage) renderArchivedPage();
}

function renderDashboard() {
  const activeYr = ACTIVE_YEAR || document.getElementById('dash-year-filter')?.value || '';
  const _dAttT = document.getElementById('ft-att')?.value || '';
  const _dAttS = document.getElementById('fs-att')?.value || '';
  let t = gdata('teach'), s = gdata('stud');
  if (activeYr) s = s.filter(r => r.academicYear === activeYr);
  if (_dAttT) t = t.filter(r => (r.attendance || 'مستمر') === _dAttT);
  if (_dAttS) s = s.filter(r => (r.attendance || 'مستمر') === _dAttS);
  updateNavBadges();

  const teachMales = t.filter(r => r.gender === 'ذكر').length;
  const teachFemales = t.filter(r => r.gender === 'أنثى').length;
  const studMales = s.filter(r => r.gender === 'ذكر').length;
  const studFemales = s.filter(r => r.gender === 'أنثى').length;

  const vis = CU?.school ? [CU.school] : getSchoolsList();
  let totalActual = 0, totalTarget = 0;
  vis.forEach(sc => { const ov = getSchoolOverall(sc); if (ov) { totalActual += ov.actual; totalTarget += ov.target; } });
  const overallPct = totalTarget > 0 ? Math.min(100, Math.round(totalActual / totalTarget * 100)) : null;
  const overallCol = overallPct !== null ? barColor(overallPct) : 'var(--tx3)';
  const yearLbl = activeYr ? `<div style="font-size:11px;color:var(--tx3);margin-top:3px">السنة: ${activeYr}</div>` : '';

  document.getElementById('dash-metrics').innerHTML = `
    <div class="mc"><div class="mc-ico" style="background:var(--pr-l)"><svg viewBox="0 0 24 24" fill="none" stroke="#00695C" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><div class="mc-val">${t.length}</div><div class="mc-lbl">كادر المدرسة</div><div style="font-size:13px;line-height:18px;font-weight:bold;color:var(--tx3);margin-top:4px">ذكور: ${teachMales} · إناث: ${teachFemales}</div></div>
    <div class="mc"><div class="mc-ico" style="background:var(--ac-l)"><svg viewBox="0 0 24 24" fill="none" stroke="#1a3a5c" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div><div class="mc-val">${t.filter(r => (r.jobRole || r.role_type) === 'إداري').length}</div><div class="mc-lbl">الكادر الإداري</div><div style="font-size:13px;line-height:18px;font-weight:bold;color:var(--tx3);margin-top:4px">تدريسي: ${t.filter(r => (r.jobRole || r.role_type) === 'تدريسي').length}</div></div>
    <div class="mc"><div class="mc-ico" style="background:var(--go-l)"><svg viewBox="0 0 24 24" fill="none" stroke="#c8922a" stroke-width="2"><path d="M12 14l9-5-9-5-9 5 9 5z"/></svg></div><div class="mc-val">${s.length}</div><div class="mc-lbl">الطلاب الموهوبون${activeYr ? ' (' + activeYr + ')' : ''}</div><div style="font-size:13px;line-height:18px;font-weight:bold;color:var(--tx3);margin-top:4px">ذكور: ${studMales} · إناث: ${studFemales}</div></div>
    <div class="mc" style="${overallPct !== null ? 'border-color:' + overallCol + ';border-width:2px' : ''}">
      <div class="mc-ico" style="background:${overallPct !== null ? overallCol + '22' : 'var(--ok-l)'}">
        <svg viewBox="0 0 24 24" fill="none" stroke="${overallPct !== null ? overallCol : '#15803d'}" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      </div>
      <div class="mc-val" style="${overallPct !== null ? 'color:' + overallCol : ''}">${overallPct !== null ? overallPct + '%' : t.length + s.length}</div>
      <div class="mc-lbl">${overallPct !== null ? 'نسبة الإنجاز' : 'إجمالي السجلات'}</div>
      ${overallPct !== null ? `<div style="margin-top:6px"><div class="pr-tr"><div class="pr-fl" style="width:${overallPct}%;background:${overallCol}"></div></div><div style="font-size:10px;color:var(--tx3);margin-top:2px">${totalActual} من ${totalTarget} سجل</div></div>` : ''}
    </div>`;

  const schools = CU?.school ? [CU.school] : getSchoolsList();
  const sg = document.getElementById('school-grid');
  if (sg) {
    if (CU && !CU.isAdmin && CU.school) {
      const sc = CU.school;
      const tc = gdb('teach').filter(r => r.school === sc).length;
      const tMales = gdb('teach').filter(r => r.school === sc && r.gender === 'ذكر').length;
      const tFemales = gdb('teach').filter(r => r.school === sc && r.gender === 'أنثى').length;

      const stc = (activeYr ? gdb('stud').filter(r => r.school === sc && r.academicYear === activeYr) : gdb('stud').filter(r => r.school === sc)).length;
      const sMales = (activeYr ? gdb('stud').filter(r => r.school === sc && r.academicYear === activeYr && r.gender === 'ذكر') : gdb('stud').filter(r => r.school === sc && r.gender === 'ذكر')).length;
      const sFemales = (activeYr ? gdb('stud').filter(r => r.school === sc && r.academicYear === activeYr && r.gender === 'أنثى') : gdb('stud').filter(r => r.school === sc && r.gender === 'أنثى')).length;

      const USERS = typeof buildUsersMap === 'function' ? buildUsersMap() : {};
      const u = Object.entries(USERS).find(([k, v]) => v.school === sc && !v.isAdmin);

      const ov = getSchoolOverall(sc);
      const targetPct = ov ? ov.pct : null;
      const targetCol = targetPct !== null ? barColor(targetPct) : 'var(--pr-d)';

      const siFields = getSchoolInfoFields().filter(f => f.visible);
      const siData = getSchoolInfoData(sc);
      let filledCount = 0;
      siFields.forEach(f => {
        if (siData[f.id] && String(siData[f.id]).trim() !== '') filledCount++;
      });
      const siPct = siFields.length ? Math.round((filledCount / siFields.length) * 100) : 0;
      const siCol = barColor(siPct);

      const sgCardHdr = document.querySelector('#sg-card .ch');
      if (sgCardHdr) {
        sgCardHdr.innerHTML = `
          <div class="ct">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            بورد استعلام بيانات مدرسة ${sc}
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="badge b-teal">المدرسة المعنية</span>
            <button class="btn btn-sm" onclick="nav('schoolinfo',null,'بيانات المدرسة')" style="font-size:11px;padding:3px 8px;gap:4px">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              تعديل البيانات
            </button>
          </div>
        `;
      }

      sg.style.display = 'block';
      sg.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:14px">
          <!-- رأس البورد -->
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--bd)">
            <div style="display:flex;align-items:center;gap:12px">
              <div class="sav" style="width:52px;height:52px;border-radius:12px;overflow:hidden;background:#fff;border:1px solid var(--bd);padding:2px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><img src="images/school_logo.jpg" alt="${sc}" style="width:100%;height:100%;object-fit:contain;border-radius:10px" onerror="this.onerror=null;this.parentElement.textContent='${sc.substring(0, 2)}'"></div>
              <div>
                <div style="font-size:17px;font-weight:800;color:var(--tx)">مدرسة الموهوبين في ${sc}</div>
                <div style="font-size:12px;color:var(--tx2);margin-top:2px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span>المستخدم: <strong style="color:var(--pr-d)">${u ? u[0] : sc}</strong></span>
                  <span>•</span>
                  <span class="badge b-green" style="font-size:11px;padding:2px 8px"><span class="dot-g"></span> نشط</span>
                  <span>•</span>
                  <span>الإجمالي: <strong>${tc + stc} سجل</strong></span>
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <button class="btn btn-sm" onclick="openSchoolReportModal('${sc}')" title="تصدير تقرير المدرسة الشامل PDF" style="background:#00897B;color:#fff;font-weight:700;display:inline-flex;align-items:center;gap:6px;border-radius:8px">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                تقرير المدرسة الشامل (PDF)
              </button>
            </div>
          </div>

          <!-- إحصائيات سريعة ومؤشرات الإنجاز -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
            <div style="background:var(--pr-l);border:1px solid var(--pr);border-radius:10px;padding:10px 14px">
              <div style="font-size:11px;font-weight:700;color:var(--pr-d);margin-bottom:2px">👥 كادر المدرسة</div>
              <div style="font-size:20px;font-weight:800;color:var(--pr-d)">${tc} <span style="font-size:11px;font-weight:normal">عضو</span></div>
              <div style="font-size:11px;color:var(--tx2);margin-top:2px">ذكور: ${tMales} · إناث: ${tFemales}</div>
            </div>
            <div style="background:var(--go-l);border:1px solid var(--go);border-radius:10px;padding:10px 14px">
              <div style="font-size:11px;font-weight:700;color:#92400e;margin-bottom:2px">🎓 الطلاب الموهوبون${activeYr ? ' (' + activeYr + ')' : ''}</div>
              <div style="font-size:20px;font-weight:800;color:#92400e">${stc} <span style="font-size:11px;font-weight:normal">طالب</span></div>
              <div style="font-size:11px;color:var(--tx2);margin-top:2px">ذكور: ${sMales} · إناث: ${sFemales}</div>
            </div>
            <div style="background:var(--ac-l);border:1px solid var(--bd);border-radius:10px;padding:10px 14px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
                <span style="font-size:11px;font-weight:700;color:var(--ac)">📋 اكتمال بيانات المدرسة</span>
                <span style="font-size:12px;font-weight:800;color:${siCol}">${siPct}%</span>
              </div>
              <div class="pr-tr" style="height:6px;background:rgba(0,0,0,0.06);border-radius:4px;overflow:hidden;margin-top:6px">
                <div class="pr-fl" style="width:${siPct}%;background:${siCol};height:100%"></div>
              </div>
              <div style="font-size:10px;color:var(--tx2);margin-top:4px">${filledCount} من أصل ${siFields.length} حقل مكتمل</div>
            </div>
            ${targetPct !== null ? `
            <div style="background:${targetCol}15;border:1px solid ${targetCol}44;border-radius:10px;padding:10px 14px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
                <span style="font-size:11px;font-weight:700;color:${targetCol}">🎯 تحقيق الأهداف</span>
                <span style="font-size:12px;font-weight:800;color:${targetCol}">${targetPct}%</span>
              </div>
              <div class="pr-tr" style="height:6px;background:rgba(0,0,0,0.06);border-radius:4px;overflow:hidden;margin-top:6px">
                <div class="pr-fl" style="width:${targetPct}%;background:${targetCol};height:100%"></div>
              </div>
              <div style="font-size:10px;color:var(--tx2);margin-top:4px">${ov.actual} من ${ov.target} سجل مستهدف</div>
            </div>
            ` : ''}
          </div>

          <!-- استعلام تفاصيل بيانات المدرسة الرسمية -->
          <div style="background:var(--sf2);border:1px solid var(--bd);border-radius:10px;padding:12px 14px">
            <div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
              <div style="display:flex;align-items:center;gap:6px">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--pr)"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                معلومات وبيانات المدرسة المستعلم عنها
              </div>
              <a href="javascript:void(0)" onclick="nav('schoolinfo',null,'بيانات المدرسة')" style="font-size:11px;color:var(--pr);font-weight:600;text-decoration:none">تعديل / تحديث البيانات ↗</a>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px">
              ${siFields.map(f => {
                const val = siData[f.id];
                const hasVal = val && String(val).trim() !== '';
                return `
                  <div style="background:var(--sf);border:1px solid var(--bd);border-radius:8px;padding:7px 10px">
                    <div style="font-size:10.5px;color:var(--tx3);margin-bottom:2px">${f.label}</div>
                    <div style="font-size:12.5px;font-weight:600;color:${hasVal ? 'var(--tx)' : 'var(--tx3)'}">${hasVal ? (Array.isArray(val) ? val.join('، ') : val) : '<span style="font-style:italic;font-size:11px;color:var(--tx3)">غير مدخل</span>'}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    } else {
      const sgCardHdr = document.querySelector('#sg-card .ch');
      if (sgCardHdr) {
        sgCardHdr.innerHTML = `
          <div class="ct"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>البيانات حسب المدرسة</div><span class="badge b-teal">${schools.length} مدارس</span>
        `;
      }
      sg.style.display = 'grid';
      sg.style.gridTemplateColumns = 'repeat(auto-fill,minmax(140px,1fr))';
      sg.innerHTML = schools.map(sc => {
        const tc = gdb('teach').filter(r => r.school === sc).length;
        const stc = (activeYr ? gdb('stud').filter(r => r.school === sc && r.academicYear === activeYr) : gdb('stud').filter(r => r.school === sc)).length;
        const ov = getSchoolOverall(sc);
        
        // حساب نسبة اكتمال بيانات المدرسة من حقول صفحة بيانات المدرسة
        const siFields = getSchoolInfoFields().filter(f => f.visible);
        const siData = getSchoolInfoData(sc);
        let filledCount = 0;
        siFields.forEach(f => {
          if (siData[f.id] && String(siData[f.id]).trim() !== '') filledCount++;
        });
        const siPct = siFields.length ? Math.round((filledCount / siFields.length) * 100) : 0;
        const siCol = barColor(siPct);

        const targetPct = ov ? ov.pct : null;
        const targetCol = targetPct !== null ? barColor(targetPct) : 'var(--pr-d)';

        return `<div class="st" onclick="nav('schools',null,'المدارس')" title="انقر للتفاصيل">
          <div class="sn">${sc}</div>
          <div class="sv" style="font-size:18px;color:var(--pr-d)">${tc + stc} <span style="font-size:11px;color:var(--tx3)">سجل</span></div>
          <div class="ss" style="margin-bottom:6px">${tc} كادر · ${stc} طالب${activeYr ? '<br><span style="font-size:10px;color:var(--tx3)">' + activeYr + '</span>' : ''}</div>
          
          <!-- مؤشر اكتمال بيانات المدرسة -->
          <div style="margin-top:8px;padding-top:6px;border-top:1px dashed var(--bd);text-align:right">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:var(--tx2);margin-bottom:3px">
              <span>اكتمال البيانات:</span>
              <span style="font-weight:700;color:${siCol}">${siPct}%</span>
            </div>
            <div class="pr-tr" style="height:5px;background:var(--bd);border-radius:3px;overflow:hidden">
              <div class="pr-fl" style="width:${siPct}%;background:${siCol};height:100%;transition:width 0.4s"></div>
            </div>
          </div>

          ${targetPct !== null ? `
          <!-- مؤشر نسبة إنجاز الأهداف إن وُجدت -->
          <div style="margin-top:6px;text-align:right">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:var(--tx2);margin-bottom:3px">
              <span>نسبة الأهداف:</span>
              <span style="font-weight:700;color:${targetCol}">${targetPct}%</span>
            </div>
            <div class="pr-tr" style="height:5px;background:var(--bd);border-radius:3px;overflow:hidden">
              <div class="pr-fl" style="width:${targetPct}%;background:${targetCol};height:100%;transition:width 0.4s"></div>
            </div>
          </div>
          ` : ''}
        </div>`;
      }).join('');
    }
  }
  const sgBadge = document.querySelector('#sg-card .badge');
  if (sgBadge && (!CU || CU.isAdmin)) {
    sgBadge.textContent = schools.length + (schools.length === 1 ? ' مدرسة' : ' مدارس');
  }
  const all = [...gdb('teach').map(r => ({ ...r, _t: 'كادر' })), ...gdb('stud').map(r => ({ ...r, _t: 'طالب' }))].filter(r => canSee(r)).sort((a, b) => (b.tsEdit || b.ts || 0) - (a.tsEdit || a.ts || 0)).slice(0, 5);
  document.getElementById('recent-list').innerHTML = all.length ? all.map(r => `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bd)"><span style="font-size:13px">${fullName(r)}</span><span class="badge ${r._t === 'كادر' ? 'b-teal' : 'b-amber'}">${r._t} — ${r.school}</span></div>`).join('') : '<p style="font-size:13px;color:var(--tx3)">لا توجد سجلات بعد</p>';
  renderCompletionBars();
  updatePendingBadge();
  if (typeof renderStudentCharts === 'function') renderStudentCharts();
  if (CU && CU.isAdmin) renderDataEntryStatus();
}

// دوال المدارس والأهداف
function getTargets() { try { return JSON.parse(localStorage.getItem('gft_targets') || '{}'); } catch { return {}; } }

function getCompletion(sc, tp) {
  const targets = getTargets();
  const actual = gdb(tp).filter(r => r.school === sc).length;
  const target = (targets[sc] && targets[sc][tp]) || 0;
  if (!target) return null;
  return { actual, target, pct: Math.min(100, Math.round(actual / target * 100)) };
}

function getSchoolOverall(sc) {
  const types = ['teach', 'stud'];
  const results = types.map(tp => getCompletion(sc, tp)).filter(r => r && r.target > 0);
  if (!results.length) return null;
  const totalActual = results.reduce((s, r) => s + r.actual, 0);
  const totalTarget = results.reduce((s, r) => s + r.target, 0);
  return { actual: totalActual, target: totalTarget, pct: Math.min(100, Math.round(totalActual / totalTarget * 100)) };
}

function renderSchools() {
  const el = document.getElementById('schools-list');
  if (!el) return;
  let schools = getSchoolsList();
  if (CU && !CU.isAdmin) {
    schools = schools.filter(sc => sc === CU.school);
  }
  el.innerHTML = schools.map(sc => {
    const tc = gdb('teach').filter(r => r.school === sc).length;
    const stc = gdb('stud').filter(r => r.school === sc).length;
    const USERS = buildUsersMap();
    const u = Object.entries(USERS).find(([k, v]) => v.school === sc && !v.isAdmin);
    const ov = getSchoolOverall(sc);
    const pct = ov ? ov.pct : null;
    const col = pct !== null ? barColor(pct) : 'var(--tx3)';
    const siData = getSchoolInfoData(sc);
    const siFields = getSchoolInfoFields().filter(f => f.visible && siData[f.id]);
    const siHtml = siFields.length ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">${siFields.map(f => `<span style="font-size:11px;background:var(--ac-l);color:var(--ac);padding:2px 8px;border-radius:6px"><strong>${f.label}:</strong> ${siData[f.id]}</span>`).join('')}</div>` : '';
    return `<div class="sdc" style="flex-wrap:wrap;gap:12px">
      <div class="sdl">
        <div class="sav" style="overflow:hidden;background:#fff;border:1px solid var(--bd);padding:2px"><img src="images/school_logo.jpg" alt="${sc}" style="width:100%;height:100%;object-fit:contain;border-radius:10px" onerror="this.onerror=null;this.parentElement.textContent='${sc.substring(0, 2)}'"></div>
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--tx)">مدرسة ${sc}</div>
          <div style="font-size:12px;color:var(--tx2);margin-top:2px">${tc} كادر · ${stc} طالب</div>
          ${siHtml}
          ${ov ? `<div style="margin-top:6px"><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--tx3);margin-bottom:3px"><span>اكتمال البيانات</span><span style="color:${col};font-weight:700">${pct}%</span></div><div class="pr-tr" style="width:200px"><div class="pr-fl" style="width:${pct}%;background:${col}"></div></div><div style="font-size:10px;color:var(--tx3);margin-top:2px">${ov.actual} من أصل ${ov.target} سجل</div></div>` : ''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        ${pct !== null ? `<div style="text-align:center;background:${col}22;border-radius:10px;padding:8px 14px"><div style="font-size:22px;font-weight:700;color:${col};font-family:'Cairo Play',sans-serif">${pct}%</div><div style="font-size:10px;color:var(--tx3)">اكتمال</div></div>` : ''}
        <div style="text-align:left"><div style="font-size:11px;color:var(--tx3)">المستخدم</div><span class="badge b-teal">${u ? u[0] : '—'}</span></div>
        <div style="text-align:left"><div style="font-size:11px;color:var(--tx3)">كلمة المرور</div><span style="font-family:monospace;font-size:13px">${u ? u[1].pass : '—'}</span></div>
        <span class="badge b-green"><span class="dot-g"></span> نشط</span>
        <button class="btn btn-sm" onclick="openSchoolReportModal('${sc}')" title="تصدير تقرير المدرسة الشامل PDF" style="background:var(--pr-d); color:#fff; font-size:11px; padding:5px 10px; display:inline-flex; align-items:center; gap:5px; border-radius:8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          تقرير PDF
        </button>
      </div>
    </div>`;
  }).join('');
  if (CU && CU.isAdmin) { renderTargetsContainer(); renderSchoolsMgmt(); }
}

function renderTargetsContainer() {
  const el = document.getElementById('targets-container');
  if (!el) return;
  const t = getTargets();
  const schools = getSchoolsList();
  el.innerHTML = schools.map(sc => `
    <div style="margin-bottom:14px;padding:12px;background:var(--sf2);border-radius:10px;border:1px solid var(--bd)">
      <div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:28px;height:28px;border-radius:7px;background:var(--pr-l);color:var(--pr-d);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center">${sc.substring(0, 2)}</div>
          مدرسة ${sc}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">
        <div class="target-inp-wrap"><label>كادر المدرسة</label><input id="tgt-${sc}-teach" type="number" min="0" value="${(t[sc] && t[sc].teach) || ''}" placeholder="0"></div>
        <div class="target-inp-wrap"><label>الطلاب</label><input id="tgt-${sc}-stud" type="number" min="0" value="${(t[sc] && t[sc].stud) || ''}" placeholder="0"></div>
        <div class="target-inp-wrap"><label style="color:var(--pr-d)">الإجمالي</label>
          <div style="padding:8px 10px;background:var(--pr-l);border-radius:8px;text-align:center;font-weight:700;color:var(--pr-d);font-size:13px">
            ${((t[sc] && t[sc].teach) || 0) + ((t[sc] && t[sc].stud) || 0) || '—'}
          </div>
        </div>
      </div>
    </div>`).join('');
}

function renderCompletionBars() {
  const el = document.getElementById('compl-list');
  const oel = document.getElementById('compl-overall');
  if (!el) return;
  const vis = CU?.school ? [CU.school] : getSchoolsList();
  const typeLabels = { teach: 'كادر المدرسة', stud: 'الطلاب' };
  let allActual = 0, allTarget = 0;
  el.innerHTML = vis.map(sc => {
    const ov = getSchoolOverall(sc);
    if (ov) { allActual += ov.actual; allTarget += ov.target; }
    const compRows = ['teach', 'stud'].map(tp => {
      const comp = getCompletion(sc, tp);
      if (!comp) return '';
      const col = barColor(comp.pct);
      return `<div class="comp-bar-wrap">
        <div class="comp-bar-lbl"><span>${typeLabels[tp]}</span><span style="color:${col};font-weight:700">${comp.pct}%</span></div>
        <div class="comp-bar-track"><div class="comp-bar-fill" style="width:${comp.pct}%;background:${col}"></div></div>
        <div class="comp-bar-nums">${comp.actual} / ${comp.target}</div>
      </div>`;
    }).join('');
    if (!compRows.replace(/<div[^>]*><\/div>/g, '').trim() && !compRows.includes('comp-bar-wrap')) {
      return `<div class="comp-school-card"><div class="comp-school-hdr"><div class="comp-school-name">مدرسة ${sc}</div><span style="font-size:12px;color:var(--tx3)">لم تُحدَّد أهداف بعد</span></div></div>`;
    }
    const pctOverall = ov ? ov.pct : 0;
    const col = barColor(pctOverall);
    return `<div class="comp-school-card">
      <div class="comp-school-hdr">
        <div class="comp-school-name">مدرسة ${sc}</div>
        ${ov ? `<div class="comp-pct" style="color:${col}">${pctOverall}%</div>` : ''}
      </div>
      ${ov ? `<div style="margin-bottom:10px"><div class="comp-bar-track"><div class="comp-bar-fill" style="width:${pctOverall}%;background:${col};height:10px"></div></div><div style="font-size:11px;color:var(--tx3);margin-top:3px">${ov.actual} سجل من أصل ${ov.target}</div></div>` : ''}
      <div class="comp-bars">${compRows}</div>
    </div>`;
  }).join('');
  if (oel && allTarget > 0) {
    const pct = Math.min(100, Math.round(allActual / allTarget * 100));
    oel.textContent = 'الإجمالي: ' + pct + '%';
    oel.style.background = pct >= 80 ? 'var(--ok-l)' : pct >= 50 ? 'var(--wn-l)' : 'var(--er-l)';
    oel.style.color = pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--wn)' : 'var(--er)';
  }
}

function saveTargets() {
  const t = {};
  const schools = getSchoolsList();
  schools.forEach(sc => {
    ['teach', 'stud'].forEach(tp => {
      const el = document.getElementById(`tgt-${sc}-${tp}`);
      if (el) {
        const v = parseInt(el.value) || 0;
        if (!t[sc]) t[sc] = {};
        t[sc][tp] = v;
      }
    });
  });
  localStorage.setItem('gft_targets', JSON.stringify(t));
  if (window.saveSettingsToSupabase) {
    window.saveSettingsToSupabase('gft_targets', t);
  }
  renderSchools();
  renderDashboard();
  if (window.showToast) window.showToast('✅ تم حفظ ومزامنة الأعداد المستهدفة مع Supabase', 'success');
  else alert('تم حفظ الأهداف بنجاح ومزامنتها');
}

function renderSchoolsMgmt() {
  const el = document.getElementById('schools-mgmt-list');
  if (!el) return;
  const schools = getSchoolsList();
  const badge = document.getElementById('schools-count-badge');
  if (badge) badge.textContent = schools.length + ' مدارس';
  el.innerHTML = schools.map((sc, i) => `
    <div style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px 5px 6px;background:var(--pr-l);border:1px solid var(--pr);border-radius:8px;font-size:13px;font-weight:600;color:var(--pr-d)">
      <span>${sc}</span>
      ${schools.length > 1 ? `<button onclick="removeSchool('${sc.replace(/'/g, "\\'")}') " style="background:none;border:none;cursor:pointer;color:var(--er);font-size:16px;line-height:1;padding:0 2px;font-weight:700" title="حذف المدرسة">×</button>` : ''}
    </div>`).join('');
}

function addSchool() {
  const inp = document.getElementById('new-school-inp');
  const name = (inp?.value || '').trim();
  if (!name) { alert('يرجى كتابة اسم المدرسة'); return; }
  const schools = getSchoolsList();
  if (schools.includes(name)) { alert('هذه المدرسة موجودة مسبقاً'); return; }
  schools.push(name);
  saveSchoolsList(schools);
  inp.value = '';
  renderSchoolsMgmt();
  refreshAllSchoolSelects();
  renderSchools();
  alert('تم إضافة مدرسة: ' + name);
}

function removeSchool(name) {
  const teachCount = (typeof gdb === 'function' ? gdb('teach') : []).filter(r => r.school === name).length;
  const studCount = (typeof gdb === 'function' ? gdb('stud') : []).filter(r => r.school === name).length;
  
  let confirmMsg = `هل تريد حذف مدرسة "${name}" من النظام وقاعدة بيانات Supabase نهائياً؟`;
  if (teachCount > 0 || studCount > 0) {
    confirmMsg += `\n\n⚠️ تنبيه: يوجد (${teachCount} كادر و ${studCount} طالب) مسجلين في هذه المدرسة حالياً. سيتم إزالة المدرسة من القوائم وقاعدة البيانات.`;
  }

  showConfirm(confirmMsg, async () => {
    let schools = getSchoolsList();
    const updatedSchools = schools.filter(s => s !== name);
    if (!updatedSchools.length) {
      alert('لا يمكن حذف جميع المدارس. يجب أن تبقى مدرسة واحدة على الأقل في النظام.');
      return;
    }

    // 1. Clean local school targets if any
    try {
      const t = JSON.parse(localStorage.getItem('gft_targets') || '{}');
      if (t[name]) {
        delete t[name];
        localStorage.setItem('gft_targets', JSON.stringify(t));
        if (window.saveSettingsToSupabase) {
          window.saveSettingsToSupabase('gft_targets', t);
        }
      }
    } catch(e) {}

    // 2. Clean local school info cache
    const siKey = 'gft_si_' + btoa(encodeURIComponent(name)).replace(/=/g, '');
    try { localStorage.removeItem(siKey); } catch(e) {}

    // 3. Save new schools list locally & trigger Supabase sync
    saveSchoolsList(updatedSchools);

    // 4. Directly delete from Supabase database table and settings
    if (window.deleteSchoolFromSupabase) {
      await window.deleteSchoolFromSupabase(name);
    }

    // 5. Activity log
    if (window.ActivityLogger) {
      window.ActivityLogger.local('حذف مدرسة', 'schools', { name: name });
    }

    // 6. Refresh UI
    renderSchoolsMgmt();
    refreshAllSchoolSelects();
    renderSchools();
    if (typeof renderDataEntryStatus === 'function') renderDataEntryStatus();
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderSchoolInfoPage === 'function') renderSchoolInfoPage();

    if (window.showToast) {
      window.showToast(`✅ تم حذف مدرسة ${name} من النظام وقاعدة بيانات Supabase بنجاح`, 'success', 3000);
    } else {
      alert(`✅ تم حذف مدرسة ${name} من النظام وقاعدة بيانات Supabase بنجاح`);
    }
  });
}

function resetSchools() {
  showConfirm('هل تريد إعادة ضبط المدارس إلى القائمة الافتراضية (7 مدارس)?', () => {
    saveSchoolsList([...SCHOOLS_DEFAULT]);
    renderSchoolsMgmt();
    refreshAllSchoolSelects();
    renderSchools();
    alert('تم إعادة ضبط المدارس');
  });
}

function refreshAllSchoolSelects() {
  const schools = getSchoolsList();
  ['ft-sc', 'fs-sc'].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.disabled) return;
    const val = el.value;
    while (el.options.length > 1) el.remove(1);
    schools.forEach(s => el.add(new Option(s, s)));
    if (val && schools.includes(val)) el.value = val;
  });
  ['teach', 'stud'].forEach(tp => {
    const fields = getFieldConfigForType ? getFieldConfigForType(tp) : (CORE_FIELDS[tp] || []);
    fields.forEach(f => {
      if (f.id === 'school') f.options = schools;
      if (tp === 'teach' && f.id === 'subject') f.options = CONFIG_DATA.subjects;
      if (tp === 'stud' && f.id === 'academicYear') f.options = ACADEMIC_YEARS;
    });
  });
  populateFilters();
}

function renderDataEntryStatus() {
  const el = document.getElementById('des-body');
  if (!el) return;
  const schools = getSchoolsList();
  const log = getOpsLog();
  let html = '';
  schools.forEach(sc => {
    const scLog = log.filter(l => l.school === sc);
    const lastAdd = scLog.find(l => l.action === 'إضافة');
    const lastEdit = scLog.find(l => l.action === 'تعديل');
    const lastDel = scLog.find(l => l.action === 'حذف');
    const fmt = ts => ts ? new Date(ts).toLocaleString('ar-IQ', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
    html += `<div class="des-card">
      <div class="des-school">
        <div class="sav" style="width:32px;height:32px;overflow:hidden;background:#fff;border:1px solid var(--bd);padding:1px"><img src="images/school_logo.jpg" alt="${sc}" style="width:100%;height:100%;object-fit:contain;border-radius:6px" onerror="this.onerror=null;this.parentElement.textContent='${sc.substring(0, 2)}'"></div>
        مدرسة ${sc}
        <span class="badge b-teal" style="margin-right:auto">${gdb('teach').filter(r => r.school === sc).length} كادر · ${gdb('stud').filter(r => r.school === sc).length} طالب</span>
      </div>
      <div class="des-grid">
        <div class="des-cell">
          <div class="des-cell-lbl">آخر إضافة</div>
          <div class="des-cell-val">${lastAdd ? lastAdd.name.substring(0, 18) : 'لا يوجد'}</div>
          <div class="des-cell-time">${fmt(lastAdd?.ts)}</div>
          ${lastAdd ? `<div style="font-size:10px;color:var(--tx3)">${lastAdd.user || '—'}</div>` : ''}
        </div>
        <div class="des-cell">
          <div class="des-cell-lbl">آخر تعديل</div>
          <div class="des-cell-val">${lastEdit ? lastEdit.name.substring(0, 18) : 'لا يوجد'}</div>
          <div class="des-cell-time">${fmt(lastEdit?.ts)}</div>
          ${lastEdit ? `<div style="font-size:10px;color:var(--tx3)">${lastEdit.user || '—'}</div>` : ''}
        </div>
        <div class="des-cell">
          <div class="des-cell-lbl">آخر حذف</div>
          <div class="des-cell-val">${lastDel ? lastDel.name.substring(0, 18) : 'لا يوجد'}</div>
          <div class="des-cell-time">${fmt(lastDel?.ts)}</div>
          ${lastDel ? `<div style="font-size:10px;color:var(--tx3)">${lastDel.user || '—'}</div>` : ''}
        </div>
      </div>
    </div>`;
  });
  el.innerHTML = html || '<div style="padding:16px;color:var(--tx3);font-size:13px">لا توجد بيانات بعد</div>';
}

function getOpsLog() { try { return JSON.parse(localStorage.getItem('gft_oplog') || '[]'); } catch { return []; } }
function clearOpsLog() { localStorage.removeItem('gft_oplog'); if (window.renderOpsLog) renderOpsLog(); }

function renderOpsLog() {
  const el = document.getElementById('ops-log-body');
  if (!el) return;
  let logs = getOpsLog();
  const fUser = document.getElementById('ops-f-user')?.value?.toLowerCase() || '';
  const fAct = document.getElementById('ops-f-act')?.value || '';
  const fSc = document.getElementById('ops-f-sc')?.value || '';
  if (fUser) logs = logs.filter(l => (l.user || '').toLowerCase().includes(fUser) || (l.username || '').toLowerCase().includes(fUser));
  if (fAct) logs = logs.filter(l => l.action === fAct);
  if (fSc) logs = logs.filter(l => l.school === fSc);
  if (CU && CU.school && !CU.isAdmin) logs = logs.filter(l => l.school === CU.school);
  if (!logs.length) { el.innerHTML = '<tr><td colspan="7" class="te">لا توجد عمليات مسجلة</td><tr>'; return; }
  el.innerHTML = logs.slice(0, 500).map(l => {
    const dt = new Date(l.ts).toLocaleString('ar-IQ');
    const actColor = l.action === 'إضافة' ? 'b-green' : (l.action === 'تعديل' ? 'b-blue' : 'b-red');
    return `<tr>
      <td style="font-size:12px;color:var(--tx3)">${dt}</td>
      <td><span class="badge ${actColor}">${l.action}</span></td>
      <td><span class="badge b-gray">${l.type}</span></td>
      <td><strong>${l.name || '—'}</strong></td>
      <td>${l.school || '—'}</td>
      <td>${l.academicYear || '—'}</td>
      <td>${l.user || '—'}</td>
    </tr>`;
  }).join('');
  const cntEl = document.getElementById('ops-log-cnt');
  if (cntEl) cntEl.textContent = 'إجمالي العمليات: ' + logs.length;
  const scSel = document.getElementById('ops-f-sc');
  if (scSel && scSel.options.length <= 1) {
    getSchoolsList().forEach(s => scSel.add(new Option(s, s)));
  }
}

function logAction(action, type, rec, details) {
  try {
    const log = JSON.parse(localStorage.getItem('gft_oplog') || '[]');
    const entry = {
      id: nid(),
      ts: Date.now(),
      action: action,
      type: type === 'teach' ? 'كادر' : (type === 'stud' ? 'طالب' : type),
      recordId: rec?.id || '',
      name: rec ? fullName(rec) : '',
      school: rec?.school || (CU ? CU.school : '') || '',
      academicYear: rec?.academicYear || '',
      user: CU ? (CU.name || CU.username) : 'نظام',
      username: CU ? CU.username : '',
      details: details || ''
    };
    log.unshift(entry);
    if (log.length > 2000) log.length = 2000;
    localStorage.setItem('gft_oplog', JSON.stringify(log));
  } catch (e) { console.error('logAction failed', e); }
}

// دوال إدارة حقول المدرسة
function renderSchoolInfoPage(targetSchool) {
  const existingSel = document.getElementById('si-school-sel')?.value;
  const selSchool = targetSchool || existingSel || CU?.school || (getSchoolsList()[0] || '');
  const sub = document.getElementById('school-info-sub');
  if (sub) sub.textContent = CU?.school ? `مدرسة ${CU.school}` : `معلومات مدرسة ${selSchool}`;

  const fields = getSchoolInfoFields().filter(f => f.visible);
  const wrap = document.getElementById('school-info-form-wrap');
  if (!wrap) return;

  let schoolSelector = '';
  if (CU?.isAdmin) {
    const schools = getSchoolsList();
    const opts = schools.map(s => `<option value="${s}" ${s === selSchool ? 'selected' : ''}>${s}</option>`).join('');
    schoolSelector = `<div class="card" style="margin-bottom:14px"><div class="cb"><div class="fgr" style="max-width:300px">
      <label>اختر المدرسة</label>
      <select id="si-school-sel" onchange="renderSchoolInfoPage(this.value)" style="font-size:13px;padding:8px 12px;border:1.5px solid var(--bd);border-radius:9px;font-family:'Cairo',sans-serif">
        ${opts}
      </select>
    </div></div></div>`;
  }

  const data = getSchoolInfoData(selSchool);

  let formHtml = `<div class="card"><div class="ch"><div class="ct"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>بيانات مدرسة ${selSchool}</div></div><div class="cb"><div class="fg">`;
  fields.forEach(f => {
    const val = data[f.id] || '';
    const span = (f.type === 'textarea' || f.type === 'multiselect' || f.type === 'checkboxes') ? 's2' : '';
    const reqStar = f.required ? ' <span class="req" style="color:var(--er);margin-right:2px;font-weight:bold">*</span>' : '';
    formHtml += `<div class="fgr ${span}"><label>${f.label}${reqStar}</label>`;
    
    if (f.type === 'textarea') {
      formHtml += `<textarea id="si-f-${f.id}" style="min-height:60px;padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;width:100%;font-family:'Cairo',sans-serif;font-size:13px">${val}</textarea>`;
    } else if (f.type === 'number') {
      formHtml += `<input id="si-f-${f.id}" type="number" value="${val}" placeholder="0" min="0" style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;width:100%;font-family:'Cairo',sans-serif;font-size:13px">`;
    } else if (f.type === 'date') {
      formHtml += `<input id="si-f-${f.id}" type="date" value="${val}" style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;width:100%;font-family:'Cairo',sans-serif;font-size:13px">`;
    } else if (f.type === 'select') {
      const opts = (f.options || []).map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('');
      formHtml += `<select id="si-f-${f.id}" style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;width:100%;font-family:'Cairo',sans-serif;font-size:13px"><option value="">-- اختر ${f.label} --</option>${opts}</select>`;
    } else if (f.type === 'multiselect') {
      const selectedArr = Array.isArray(val) ? val : (typeof val === 'string' && val ? val.split(/[,،]/).map(s => s.trim()) : []);
      const opts = (f.options || []).map(o => `<option value="${o}" ${selectedArr.includes(o) ? 'selected' : ''}>${o}</option>`).join('');
      formHtml += `<select id="si-f-${f.id}" multiple style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;width:100%;min-height:90px;font-family:'Cairo',sans-serif;font-size:13px">${opts}</select><span style="font-size:11px;color:var(--tx3);display:block;margin-top:4px">يمكن تحديد أكثر من خيار باستخدام Ctrl / Cmd</span>`;
    } else if (f.type === 'checkboxes') {
      const selectedArr = Array.isArray(val) ? val : (typeof val === 'string' && val ? val.split(/[,،]/).map(s => s.trim()) : []);
      const pills = (f.options || []).map((o, idx) => `
        <label class="chk-pill">
          <input type="checkbox" name="si-f-${f.id}" value="${o}" ${selectedArr.includes(o) ? 'checked' : ''}>
          <span>${o}</span>
        </label>
      `).join('');
      formHtml += `<div class="chk-grid" id="si-f-${f.id}">${pills}</div>`;
    } else {
      formHtml += `<input id="si-f-${f.id}" type="text" value="${val}" placeholder="${f.label}" style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;width:100%;font-family:'Cairo',sans-serif;font-size:13px">`;
    }
    formHtml += `</div>`;
  });
  formHtml += `</div></div></div>`;
  wrap.innerHTML = schoolSelector + formHtml;
  wrap.dataset.school = selSchool;

  // Background fetch from Supabase to ensure newest school data is always loaded
  if (navigator.onLine && typeof window.fetchSchoolInfoFromSupabase === 'function') {
    window.fetchSchoolInfoFromSupabase(selSchool).then(remoteData => {
      if (remoteData && Object.keys(remoteData).length > 0 && wrap.dataset.school === selSchool) {
        let changed = false;
        fields.forEach(f => {
          const remoteVal = remoteData[f.id] || '';
          const el = document.getElementById('si-f-' + f.id);
          if (!el) return;
          if (document.activeElement === el) return; // don't override active focus

          if (f.type === 'checkboxes') {
            const chkInputs = document.querySelectorAll(`input[name="si-f-${f.id}"]`);
            const selectedArr = Array.isArray(remoteVal) ? remoteVal : (typeof remoteVal === 'string' && remoteVal ? remoteVal.split(/[,،]/).map(s => s.trim()) : []);
            chkInputs.forEach(chk => {
              chk.checked = selectedArr.includes(chk.value);
            });
          } else if (f.type === 'multiselect') {
            const selectedArr = Array.isArray(remoteVal) ? remoteVal : (typeof remoteVal === 'string' && remoteVal ? remoteVal.split(/[,،]/).map(s => s.trim()) : []);
            Array.from(el.options).forEach(opt => {
              opt.selected = selectedArr.includes(opt.value);
            });
          } else {
            if (el.value !== remoteVal) {
              el.value = remoteVal;
              changed = true;
            }
          }
        });
        if (changed) {
          if (window.renderSchools) window.renderSchools();
          if (window.renderDashboard) window.renderDashboard();
        }
      }
    }).catch(() => {});
  }
}

async function pullSchoolInfoFromSupabase(targetSchool) {
  const wrap = document.getElementById('school-info-form-wrap');
  const selEl = document.getElementById('si-school-sel');
  const school = targetSchool || (selEl ? selEl.value : null) || (wrap ? wrap.dataset.school : null) || CU?.school || (typeof getSchoolsList === 'function' ? getSchoolsList()[0] : '');
  if (!school) {
    if (window.showToast) window.showToast('⚠️ تعذّر تحديد المدرسة لجلب بياناتها', 'warn', 3000);
    return false;
  }
  const btn = document.getElementById('btn-pull-schoolinfo');
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;display:inline-block"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> جاري السحب...`;
  }
  if (window.showToast) {
    window.showToast(`📥 جاري سحب بيانات مدرسة «${school}» من قاعدة بيانات Supabase...`, 'info', 3000);
  }
  try {
    if (window.fetchSchoolInfoFromSupabase) {
      const data = await window.fetchSchoolInfoFromSupabase(school);
      if (data && Object.keys(data).length > 0) {
        if (window.renderSchoolInfoPage) window.renderSchoolInfoPage(school);
        if (window.renderSchools) window.renderSchools();
        if (window.renderDashboard) window.renderDashboard();
        if (window.showToast) {
          window.showToast(`✅ تم سحب وتحديث بيانات مدرسة «${school}» بنجاح من Supabase`, 'success', 3500);
        }
        return true;
      } else {
        if (window.showToast) {
          window.showToast(`ℹ️ تم الاتصال بـ Supabase — لا توجد بيانات مسجلة لمدرسة «${school}» في السحابة حالياً`, 'warn', 3500);
        }
      }
    }
  } catch (err) {
    if (window.showToast) window.showToast(`❌ خطأ أثناء سحب بيانات المدرسة: ${err.message || err}`, 'error', 4000);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
  return false;
}

async function uploadSchoolInfoToSupabase(targetSchool) {
  const wrap = document.getElementById('school-info-form-wrap');
  const selEl = document.getElementById('si-school-sel');
  const school = targetSchool || (selEl ? selEl.value : null) || (wrap ? wrap.dataset.school : null) || CU?.school || (typeof getSchoolsList === 'function' ? getSchoolsList()[0] : '');
  if (!school) {
    if (window.showToast) window.showToast('⚠️ تعذّر تحديد المدرسة لرفع بياناتها', 'warn', 3000);
    return false;
  }
  const btn = document.getElementById('btn-push-schoolinfo');
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;display:inline-block"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> جاري الرفع...`;
  }
  if (window.showToast) {
    window.showToast(`📤 جاري رفع بيانات مدرسة «${school}» إلى قاعدة بيانات Supabase...`, 'info', 3000);
  }
  try {
    saveSchoolInfo();
    const data = getSchoolInfoData(school);
    if (window.syncSchoolInfoToSupabase) {
      await window.syncSchoolInfoToSupabase(school, data);
      if (window.showToast) {
        window.showToast(`✅ تم رفع وحفظ بيانات مدرسة «${school}» في Supabase بنجاح`, 'success', 3500);
      }
      return true;
    }
  } catch (err) {
    if (window.showToast) window.showToast(`❌ خطأ أثناء رفع بيانات المدرسة: ${err.message || err}`, 'error', 4000);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
  return false;
}

function saveSchoolInfo() {
  const wrap = document.getElementById('school-info-form-wrap');
  if (!wrap) return;
  const school = wrap.dataset.school || (CU ? CU.school : '') || '';
  if (!school) { 
    if (window.showToast) window.showToast('⚠️ تعذّر تحديد المدرسة لحفظ بياناتها', 'warn', 3000);
    else alert('تعذّر تحديد المدرسة'); 
    return; 
  }
  const fields = getSchoolInfoFields().filter(f => f.visible);
  const data = {};
  const _siInvalid = [];
  fields.forEach(f => {
    if (f.type === 'checkboxes') {
      const chks = document.querySelectorAll(`input[name="si-f-${f.id}"]:checked`);
      const valArr = Array.from(chks).map(c => c.value);
      const valStr = valArr.join(', ');
      data[f.id] = valStr;
      if (f.required && valArr.length === 0) {
        const grid = document.getElementById('si-f-' + f.id);
        if (grid) { grid.style.outline = '2px solid var(--er)'; }
        _siInvalid.push(grid || wrap);
      }
    } else if (f.type === 'multiselect') {
      const el = document.getElementById('si-f-' + f.id);
      if (!el) return;
      const selectedOpts = Array.from(el.selectedOptions).map(o => o.value);
      const valStr = selectedOpts.join(', ');
      data[f.id] = valStr;
      if (f.required && selectedOpts.length === 0) {
        el.style.borderColor = 'var(--er)';
        el.style.background = '#fff5f5';
        _siInvalid.push(el);
      }
    } else {
      const el = document.getElementById('si-f-' + f.id);
      if (!el) return;
      const val = el.value.trim();
      data[f.id] = val;
      if (f.required && !val) {
        el.style.borderColor = 'var(--er)';
        el.style.background = '#fff5f5';
        _siInvalid.push(el);
      }
    }
  });

  if (_siInvalid.length) {
    _siInvalid[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (_siInvalid[0].focus) _siInvalid[0].focus();
    const msgEl = document.getElementById('school-info-msg');
    if (msgEl) {
      msgEl.innerHTML = `<div class="alert a-er">يرجى ملء جميع الحقول الإلزامية (*) المميزة باللون الأحمر</div>`;
      setTimeout(() => { if (msgEl) msgEl.innerHTML = ''; }, 4000);
    }
    if (window.showToast) {
      window.showToast('⚠️ يرجى ملء كافة الحقول الإلزامية المطلوبة للمدرسة', 'warn', 3500);
    }
    return;
  }

  // Add metadata timestamps
  data.last_updated = new Date().toISOString();
  data.updated_by = CU ? (CU.name || CU.username) : 'المستخدم';

  // Build descriptive details of modified fields
  const updatedFieldNames = fields.filter(f => data[f.id]).map(f => f.label).slice(0, 4).join('، ');
  const detailsSummary = updatedFieldNames ? `تحديث (${updatedFieldNames})` : `تحديث شامل لبيانات مدرسة ${school}`;

  // 1. Save data locally and trigger Supabase sync
  saveSchoolInfoData(school, data);

  // 2. Log action to local operation log and remote Supabase database
  logAction('تعديل', 'مدرسة', { id: school, school: school, name1: `بيانات مدرسة ${school}` }, detailsSummary);
  if (window.ActivityLogger && typeof window.ActivityLogger.cloud === 'function') {
    window.ActivityLogger.cloud('تعديل', 'مدرسة', { id: school, school: school, name1: `بيانات مدرسة ${school}` }, detailsSummary);
  } else if (window.recordActivityLogToSupabase) {
    window.recordActivityLogToSupabase('تعديل بيانات المدرسة', 'مدرسة', { id: school, school: school, name1: `بيانات مدرسة ${school}` }, detailsSummary);
  }

  // 3. UI feedback
  const msgEl = document.getElementById('school-info-msg');
  if (msgEl) {
    msgEl.innerHTML = `<div class="alert a-ok">✅ تم حفظ ومزامنة بيانات مدرسة «${school}» في Supabase بنجاح</div>`;
    setTimeout(() => { if (msgEl) msgEl.innerHTML = ''; }, 4000);
  }
  if (window.showToast) {
    window.showToast(`✅ تم حفظ ومزامنة بيانات مدرسة «${school}» في Supabase بنجاح`, 'success', 3500);
  }

  // 4. Re-render views for immediate sync reflection & admin visibility
  if (window.renderSchools) window.renderSchools();
  if (window.renderDashboard) window.renderDashboard();
  if (typeof renderDataEntryStatus === 'function') renderDataEntryStatus();
  if (typeof renderOpsLog === 'function') renderOpsLog();
  if (typeof updatePendingBadge === 'function') updatePendingBadge();
}

function exportCurrentSchoolReportPDF() {
  const wrap = document.getElementById('school-info-form-wrap');
  const selEl = document.getElementById('si-school-sel');
  const school = (selEl ? selEl.value : null) || (wrap ? wrap.dataset.school : null) || CU?.school || (typeof getSchoolsList === 'function' ? getSchoolsList()[0] : 'بغداد');
  if (window.openSchoolReportModal) {
    window.openSchoolReportModal(school);
  } else {
    alert('تعذر فتح تقرير المدرسة');
  }
}

// دوال إدارة الحقول
function renderFieldMgr() {
  ['teach', 'stud'].forEach(type => {
    const fields = getFields(type);
    const el = document.getElementById('fm-' + type);
    if (!el) return;
    const rows = fields.map((f, idx) => {
      const col = iconColors[f.type] || '#888';
      const ico = fieldTypeIcons[f.type] || fieldTypeIcons.text;
      const isCore = !!f.core;
      return `<div class="ff-row ${f.visible ? '' : 'hidden-field'}"
        draggable="true"
        ondragstart="onFieldDragStart(event,'${type}',${idx})"
        ondragend="onFieldDragEnd(event)"
        ondragover="onFieldDragOver(event,'${type}',${idx})"
        ondragleave="onFieldDragLeave(event)"
        ondrop="onFieldDrop(event,'${type}',${idx})"
        style="cursor:default;transition:border-color .15s,opacity .15s">
        <div class="ff-info">
          <span style="color:var(--tx3);font-size:18px;cursor:grab;margin-left:6px;user-select:none" title="اسحب لإعادة الترتيب">⠿</span>
          <div class="ff-icon" style="background:${col}22">${ico.replace('currentColor', col)}</div>
          <div>
            <div class="ff-name">${f.label}${f.required ? ' <span style="color:var(--er);font-size:11px">*</span>' : ''}</div>
            <div class="ff-meta">${fieldTypeLabels[f.type] || f.type} · ${f.visible ? 'مرئي' : 'مخفي'}</div>
          </div>
        </div>
        <div class="ff-acts">
          <span class="ff-tag ${isCore ? 'ff-tag-core' : 'ff-tag-custom'}">${isCore ? 'أساسي' : 'مخصص'}</span>
          <button class="ff-tog ${f.visible ? 'on' : ''}" onclick="toggleField('${type}','${f.id}')" title="${f.visible ? 'إخفاء' : 'إظهار'}"></button>
          <button class="ab ab-ed" onclick="openEditField('${type}','${f.id}')" title="تعديل الحقل">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>تعديل
          </button>
          <button class="ab ab-dl" onclick="deleteField('${type}','${f.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>حذف
          </button>
        </div>
      </div>`;
    }).join('');

    const icons = { teach: '#00695C', stud: '#c8922a' };
    el.innerHTML = `<div class="fm-wrap">
      <div class="fm-hdr">
        <div class="fm-title" style="color:${icons[type]}">${typeNames[type]}</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="badge ${type === 'teach' ? 'b-teal' : 'b-amber'}">${fields.length} حقل · ${fields.filter(f => f.visible).length} مرئي</span>
          <button class="btn btn-sm" onclick="resetFieldsToDefault('${type}')" style="font-size:11px;color:var(--er)" title="إعادة ضبط الحقول للافتراضي">↺ إعادة ضبط</button>
        </div>
      </div>
      <div style="padding:8px 14px;font-size:11px;color:var(--in);background:var(--in-l);border-bottom:1px solid var(--bd)">
        ⠿ اسحب لإعادة الترتيب · يمكن حذف أي حقل بما فيها الأساسية · زر ↺ لاستعادة الافتراضي
      </div>
      <div class="fm-fields">${rows}</div>
    </div>`;
  });
  renderSchoolInfoFieldMgr();
  const addCard = document.getElementById('fm-add-card');
  if (!addCard) return;
  addCard.innerHTML = buildAddFieldCard();
  initAddFieldCard();
}

function ensureFieldConfigLoaded() {
  if (!window.FIELD_CONFIG) {
    alert("لم يتم تحميل إعدادات الحقول");
    return false;
  }
  if (!Array.isArray(window.FIELD_CONFIG.students)) window.FIELD_CONFIG.students = [];
  if (!Array.isArray(window.FIELD_CONFIG.staff)) window.FIELD_CONFIG.staff = [];
  if (!Array.isArray(window.FIELD_CONFIG.school)) window.FIELD_CONFIG.school = [];
  return true;
}

function cloneFieldConfigPayload() {
  return {
    students: JSON.parse(JSON.stringify(window.FIELD_CONFIG.students || [])),
    staff: JSON.parse(JSON.stringify(window.FIELD_CONFIG.staff || [])),
    school: JSON.parse(JSON.stringify(window.FIELD_CONFIG.school || []))
  };
}

function mirrorFieldConfigToRuntimeState() {
  if (!ensureFieldConfigLoaded()) return false;
  if (window.CORE_FIELDS) {
    CORE_FIELDS.teach = window.FIELD_CONFIG.staff;
    CORE_FIELDS.stud = window.FIELD_CONFIG.students;
  }
  if (window.CONFIG_DATA) {
    CONFIG_DATA.fields = CONFIG_DATA.fields || {};
    CONFIG_DATA.fields.teach = window.FIELD_CONFIG.staff;
    CONFIG_DATA.fields.stud = window.FIELD_CONFIG.students;
    CONFIG_DATA.schoolInfoFields = window.FIELD_CONFIG.school;
    CONFIG_DATA.updatedAt = Date.now();
  }
  return true;
}

function syncFieldConfigFromUI() {
  if (!ensureFieldConfigLoaded()) return false;
  window.FIELD_CONFIG.staff = Array.isArray(window.FIELD_CONFIG.staff) ? window.FIELD_CONFIG.staff.map((f, index) => ({ ...f, sort_order: index + 1 })) : [];
  window.FIELD_CONFIG.students = Array.isArray(window.FIELD_CONFIG.students) ? window.FIELD_CONFIG.students.map((f, index) => ({ ...f, sort_order: index + 1 })) : [];
  window.FIELD_CONFIG.school = Array.isArray(window.FIELD_CONFIG.school) ? window.FIELD_CONFIG.school.map((f, index) => ({ ...f, sort_order: index + 1 })) : [];
  return mirrorFieldConfigToRuntimeState();
}

function downloadBlobFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
  }, 1000);
}

function downloadFieldConfigJS() {
  downloadFieldConfigFile('js');
}

function downloadFieldConfigBackup() {
  downloadFieldConfigFile('json');
}

function downloadFieldConfigFile(format) {
  if (!syncFieldConfigFromUI()) return;
  const payload = cloneFieldConfigPayload();
  let content = '';
  let fileName = '';
  if (format === 'js') {
    content = `window.FIELD_CONFIG = ${JSON.stringify(payload, null, 2)};\nwindow.FIELD_CONFIG_DEFAULTS = JSON.parse(JSON.stringify(window.FIELD_CONFIG));\nif (window.CORE_FIELDS) { CORE_FIELDS.teach = window.FIELD_CONFIG.staff; CORE_FIELDS.stud = window.FIELD_CONFIG.students; }\n`;
    fileName = 'fields-config.js';
  } else {
    content = JSON.stringify(payload, null, 2);
    fileName = 'field-config-backup.json';
  }
  downloadBlobFile(content, fileName, format === 'js' ? 'application/javascript;charset=utf-8' : 'application/json;charset=utf-8');
}

function triggerFieldConfigImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.js';
  input.onchange = function () {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
      const text = e.target.result;
      handleFieldConfigImport(text, file.name);
    };
    reader.readAsText(file, 'UTF-8');
  };
  input.click();
}

function handleFieldConfigImport(text, fileName) {
  try {
    const imported = parseFieldConfigImportText(text, fileName);
    if (!imported || typeof imported !== 'object') throw new Error('الملف غير صالح');
    applyFieldConfigObject(imported);
    alert('✅ تم استيراد إعدادات الحقول بنجاح');
  } catch (err) {
    console.error('[FieldConfigImport]', err);
    alert('تعذّر استيراد الملف: ' + err.message);
  }
}

function parseFieldConfigImportText(text, fileName = '') {
  let trimmed = text.trim();
  if (trimmed.charCodeAt(0) === 0xFEFF) {
    trimmed = trimmed.slice(1).trim();
  }

  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // Continue to JS object parser
  }

  let match = trimmed.match(/(?:window\.)?(?:FIELD_CONFIG|config)\s*=\s*({[\s\S]*?})(?:;|\s*$)/i) ||
              trimmed.match(/({[\s\S]*})/);
  if (match) {
    try {
      return Function('"use strict"; return (' + match[1] + ')')();
    } catch (e) {
      console.warn('[parseFieldConfigImportText] Eval failed:', e);
    }
  }
  throw new Error('تعذّر تحليل محتوى الملف');
}

function extractFieldConfigTarget(config) {
  if (!config || typeof config !== 'object') return null;
  if (config.FIELD_CONFIG && typeof config.FIELD_CONFIG === 'object') return config.FIELD_CONFIG;
  if (config.FIELD_CONFIG_DEFAULTS && typeof config.FIELD_CONFIG_DEFAULTS === 'object') return config.FIELD_CONFIG_DEFAULTS;
  if (config.fields && typeof config.fields === 'object') return config.fields;
  if (config.config && typeof config.config === 'object') return config.config;
  if (config.data && typeof config.data === 'object') return config.data;
  return config;
}

function applyFieldConfigObject(configInput) {
  const config = extractFieldConfigTarget(configInput);
  if (!config || typeof config !== 'object') {
    throw new Error('الملف غير صالح');
  }

  const rawStaff = config.staff || config.teach || config.teachers || config.staffFields || config.teachFields;
  const rawStudents = config.students || config.stud || config.studentFields || config.studFields;
  const rawSchool = config.school || config.schoolInfo || config.schoolInfoFields || config.si || config.schoolFields;

  const hasStaff = Array.isArray(rawStaff);
  const hasStudents = Array.isArray(rawStudents);
  const hasSchool = Array.isArray(rawSchool);

  if (!hasStaff && !hasStudents && !hasSchool) {
    throw new Error('الملف يجب أن يحتوي على staff و students و school');
  }

  const curConfig = window.FIELD_CONFIG || {};

  const finalStaff = hasStaff ? rawStaff : (Array.isArray(curConfig.staff) ? curConfig.staff : (window.CORE_FIELDS?.teach || []));
  const finalStudents = hasStudents ? rawStudents : (Array.isArray(curConfig.students) ? curConfig.students : (window.CORE_FIELDS?.stud || []));
  const finalSchool = hasSchool ? rawSchool : (Array.isArray(curConfig.school) ? rawSchool : (window.CONFIG_DATA?.schoolInfoFields || []));

  window.FIELD_CONFIG = {
    staff: JSON.parse(JSON.stringify(finalStaff)),
    students: JSON.parse(JSON.stringify(finalStudents)),
    school: JSON.parse(JSON.stringify(finalSchool))
  };

  window.FIELD_CONFIG_DEFAULTS = JSON.parse(JSON.stringify(window.FIELD_CONFIG));

  if (window.CORE_FIELDS) {
    CORE_FIELDS.teach = window.FIELD_CONFIG.staff;
    CORE_FIELDS.stud = window.FIELD_CONFIG.students;
  }
  if (window.CONFIG_DATA) {
    CONFIG_DATA.fields = CONFIG_DATA.fields || {};
    CONFIG_DATA.fields.teach = JSON.parse(JSON.stringify(window.FIELD_CONFIG.staff));
    CONFIG_DATA.fields.stud = JSON.parse(JSON.stringify(window.FIELD_CONFIG.students));
    CONFIG_DATA.schoolInfoFields = JSON.parse(JSON.stringify(window.FIELD_CONFIG.school));
    CONFIG_DATA.updatedAt = Date.now();
  }

  if (typeof refreshAllSchoolSelects === 'function') refreshAllSchoolSelects();
  if (typeof renderFieldMgr === 'function') renderFieldMgr();
  if (typeof buildTableHeaders === 'function') {
    buildTableHeaders('teach');
    buildTableHeaders('stud');
  }
  if (typeof renderTbl === 'function') {
    renderTbl('teach');
    renderTbl('stud');
  }
  if (typeof renderSchoolInfoPage === 'function') renderSchoolInfoPage();
}

function renderSchoolInfoFieldMgr() {
  const el = document.getElementById('fm-school-info');
  if (!el) return;
  const fields = getSchoolInfoFields();
  const rows = fields.map((f, idx) => {
    const col = iconColors[f.type] || '#888';
    const ico = fieldTypeIcons[f.type] || fieldTypeIcons.text;
    const optsText = (f.options && f.options.length) ? ' · (' + f.options.join(', ') + ')' : '';
    return `<div class="ff-row ${f.visible ? '' : 'hidden-field'}"
      draggable="true"
      ondragstart="onFieldDragStart(event,'si',${idx})"
      ondragend="onFieldDragEnd(event)"
      ondragover="onFieldDragOver(event,'si',${idx})"
      ondragleave="onFieldDragLeave(event)"
      ondrop="onFieldDrop(event,'si',${idx})"
      style="cursor:default;transition:border-color .15s,opacity .15s">
      <div class="ff-info">
        <span style="color:var(--tx3);font-size:18px;cursor:grab;margin-left:6px;user-select:none" title="اسحب لإعادة الترتيب">⠿</span>
        <div class="ff-icon" style="background:${col}22">${ico.replace('currentColor', col)}</div>
        <div>
          <div class="ff-name">${f.label}${f.required ? ' <span style="color:var(--er);font-size:11px">*</span>' : ''}</div>
          <div class="ff-meta">${fieldTypeLabels[f.type] || f.type} · ${f.visible ? 'مرئي' : 'مخفي'}${optsText}</div>
        </div>
      </div>
      <div class="ff-acts">
        <button class="ff-tog ${f.visible ? 'on' : ''}" onclick="toggleSchoolInfoField('${f.id}')" title="${f.visible ? 'إخفاء' : 'إظهار'}"></button>
        <button class="ab ab-ed" onclick="editSchoolInfoField('${f.id}')" title="تعديل الحقل">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>تعديل
        </button>
        <button class="ab ab-dl" onclick="deleteSchoolInfoField('${f.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>حذف
        </button>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="fm-wrap">
    <div class="fm-hdr">
      <div class="fm-title" style="color:#1a3a5c">بيانات المدرسة</div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="badge b-blue">${fields.length} حقل · ${fields.filter(f => f.visible).length} مرئي</span>
        <button class="btn btn-pr btn-sm" onclick="openAddSchoolInfoFieldModal()" style="font-size:11px">+ إضافة حقل جديد</button>
        <button class="btn btn-sm" onclick="resetSchoolInfoFields()" style="font-size:11px;color:var(--er)">↺ إعادة ضبط</button>
      </div>
    </div>
    <div style="padding:8px 14px;font-size:11px;color:var(--in);background:var(--in-l);border-bottom:1px solid var(--bd)">
      هذه الحقول تظهر في صفحة <strong>بيانات المدرسة</strong> — كل مدرسة تُدخل بياناتها الخاصة
    </div>
    <div class="fm-fields">${rows}</div>
  </div>`;
}

function toggleSchoolInfoField(fid) {
  const fields = getSchoolInfoFields();
  const f = fields.find(x => x.id === fid);
  if (f) {
    f.visible = !f.visible;
    saveSchoolInfoFields(fields);
    renderSchoolInfoFieldMgr();
    renderSchoolInfoPage();
    if (window.FieldManagerUI?.loadFields) window.FieldManagerUI.loadFields();
  }
}

function editSchoolInfoField(fid) {
  const fields = getSchoolInfoFields();
  const f = fields.find(x => x.id === fid);
  if (!f) return;

  const titleEl = document.getElementById('modal-title');
  if (titleEl) titleEl.textContent = 'تعديل الحقل — بيانات المدرسة';
  
  const curOptsStr = Array.isArray(f.options) ? f.options.join(', ') : (f.options || '');
  const isSelectType = (f.type === 'select' || f.type === 'multiselect' || f.type === 'checkboxes');

  const bodyEl = document.getElementById('modal-body');
  if (bodyEl) {
    bodyEl.innerHTML = `
      <div class="fg">
        <div class="fgr">
          <label>اسم الحقل <span class="req">*</span></label>
          <input id="si-lbl" value="${(f.label || '').replace(/"/g, '&quot;')}" placeholder="اسم الحقل" style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;font-family:'Cairo',sans-serif;font-size:13px">
        </div>
        <div class="fgr">
          <label>نوع الحقل</label>
          <select id="si-type" onchange="onSiAddTypeChange()" style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;font-family:'Cairo',sans-serif;font-size:13px">
            <option value="text" ${f.type === 'text' ? 'selected' : ''}>نص قصير</option>
            <option value="textarea" ${f.type === 'textarea' ? 'selected' : ''}>نص طويل</option>
            <option value="number" ${f.type === 'number' ? 'selected' : ''}>رقم</option>
            <option value="date" ${f.type === 'date' ? 'selected' : ''}>تاريخ</option>
            <option value="select" ${f.type === 'select' ? 'selected' : ''}>📋 قائمة منسدلة</option>
            <option value="multiselect" ${f.type === 'multiselect' ? 'selected' : ''}>☑️ قائمة متعددة الاختيار</option>
            <option value="checkboxes" ${f.type === 'checkboxes' ? 'selected' : ''}>✅ مربعات اختيار</option>
          </select>
        </div>
        <div class="fgr s2" id="si-opts-editor" style="display:${isSelectType ? 'flex' : 'none'};flex-direction:column;gap:6px">
          <label>الخيارات (مفصولة بفاصلة) <span class="req">*</span></label>
          <input id="si-opts-input" value="${curOptsStr.replace(/"/g, '&quot;')}" placeholder="خيار1, خيار2, خيار3" style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;font-family:'Cairo',sans-serif;font-size:13px">
          <small style="color:var(--tx3);font-size:11px">مثال: بغداد, البصرة, الموصل</small>
        </div>
        <div class="fgr s2" style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
            <input type="checkbox" id="si-req" ${f.required ? 'checked' : ''} style="accent-color:var(--pr);width:14px;height:14px"> حقل إلزامي
          </label>
          <button type="button" class="btn btn-ac btn-sm" onclick="previewSiFieldModal()" style="padding:6px 14px;font-size:12px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            معاينة الحقل
          </button>
        </div>
        <div id="si-preview-box" style="display:none;margin-top:12px;padding:12px;background:var(--sf2);border:1.5px dashed var(--pr-m);border-radius:10px">
          <div style="font-size:12px;font-weight:700;color:var(--pr-d);margin-bottom:8px">معاينة الحقل في النموذج:</div>
          <div id="si-preview-body"></div>
        </div>
      </div>
    `;
  }

  const saveBtn = document.querySelector('#modal .mf .btn-pr');
  if (saveBtn) {
    saveBtn.onclick = () => saveEditedSchoolInfoFieldModal(fid);
    saveBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>حفظ التغييرات';
  }
  const modalEl = document.getElementById('modal');
  if (modalEl) modalEl.classList.add('open');
}

function saveEditedSchoolInfoFieldModal(fid) {
  const lbl = document.getElementById('si-lbl')?.value?.trim();
  if (!lbl) {
    alert('يرجى كتابة اسم الحقل');
    return;
  }
  const tp = document.getElementById('si-type')?.value || 'text';
  const req = document.getElementById('si-req')?.checked || false;
  const optsStr = document.getElementById('si-opts-input')?.value || '';
  const opts = optsStr.split(/[,،]/).map(s => s.trim()).filter(Boolean);

  if ((tp === 'select' || tp === 'multiselect' || tp === 'checkboxes') && opts.length === 0) {
    alert('يرجى كتابة خيار واحد على الأقل مفصول بفاصلة');
    return;
  }

  const fields = getSchoolInfoFields();
  const f = fields.find(x => x.id === fid);
  if (!f) return;

  f.label = lbl;
  f.type = tp;
  f.required = req;
  if (tp === 'select' || tp === 'multiselect' || tp === 'checkboxes') {
    f.options = opts;
  } else {
    delete f.options;
  }

  saveSchoolInfoFields(fields);
  if (window.closeModal) window.closeModal();
  renderSchoolInfoFieldMgr();
  renderSchoolInfoPage();
  if (window.FieldManagerUI?.loadFields) window.FieldManagerUI.loadFields();
  alert('✅ تم تعديل الحقل بنجاح');
}

function deleteSchoolInfoField(fid) {
  const fields = getSchoolInfoFields();
  const f = fields.find(x => x.id === fid || x.field_name === fid);
  const label = f ? (f.label || f.field_label || fid) : fid;

  showConfirm(`هل أنت متأكد من حذف حقل "<strong>${label}</strong>" من بيانات المدرسة نهائياً؟`, async () => {
    const updated = fields.filter(x => x.id !== fid && x.field_name !== fid);
    saveSchoolInfoFields(updated);
    if (window.CloudConfigManager && window.CloudConfigManager.deleteSchoolInfoField) {
      await window.CloudConfigManager.deleteSchoolInfoField(fid).catch(() => {});
    }
    renderSchoolInfoFieldMgr();
    renderSchoolInfoPage();
    if (window.FieldManagerUI?.loadFields) {
      await window.FieldManagerUI.loadFields();
    }
  });
}

function resetSchoolInfoFields() {
  showConfirm('إعادة ضبط حقول بيانات المدرسة إلى الافتراضية؟', () => {
    saveSchoolInfoFields([...SCHOOL_INFO_DEFAULTS]);
    renderSchoolInfoFieldMgr();
    renderSchoolInfoPage();
    if (window.FieldManagerUI?.loadFields) window.FieldManagerUI.loadFields();
  });
}

function addSchoolInfoFieldPrompt() {
  openAddSchoolInfoFieldModal();
}

function openAddSchoolInfoFieldModal() {
  document.getElementById('modal-title').textContent = 'إضافة حقل جديد — بيانات المدرسة';
  document.getElementById('modal-body').innerHTML = `
    <div class="fg">
      <div class="fgr">
        <label>اسم الحقل الجديد <span class="req">*</span></label>
        <input id="si-lbl" placeholder="مثال: الموقع الجغرافي، رقم الوثيقة، عدد القاعات..." style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;font-family:'Cairo',sans-serif;font-size:13px">
      </div>
      <div class="fgr">
        <label>نوع الحقل</label>
        <select id="si-type" onchange="onSiAddTypeChange()" style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;font-family:'Cairo',sans-serif;font-size:13px">
          <option value="text">نص قصير</option>
          <option value="textarea">نص طويل</option>
          <option value="number">رقم</option>
          <option value="date">تاريخ</option>
          <option value="select">📋 قائمة منسدلة</option>
          <option value="multiselect">☑️ قائمة متعددة الاختيار</option>
          <option value="checkboxes">✅ مربعات اختيار</option>
        </select>
      </div>
      <div class="fgr s2" id="si-opts-editor" style="display:none;flex-direction:column;gap:6px">
        <label>الخيارات (مفصولة بفاصلة) <span class="req">*</span></label>
        <input id="si-opts-input" placeholder="خيار1, خيار2, خيار3" style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;font-family:'Cairo',sans-serif;font-size:13px">
        <small style="color:var(--tx3);font-size:11px">مثال: بغداد, البصرة, الموصل</small>
      </div>
      <div class="fgr s2" style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="checkbox" id="si-req" style="accent-color:var(--pr);width:14px;height:14px"> حقل إلزامي
        </label>
        <button type="button" class="btn btn-ac btn-sm" onclick="previewSiFieldModal()" style="padding:6px 14px;font-size:12px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          معاينة الحقل
        </button>
      </div>
      <div id="si-preview-box" style="display:none;margin-top:12px;padding:12px;background:var(--sf2);border:1.5px dashed var(--pr-m);border-radius:10px">
        <div style="font-size:12px;font-weight:700;color:var(--pr-d);margin-bottom:8px">معاينة الحقل في النموذج:</div>
        <div id="si-preview-body"></div>
      </div>
    </div>
  `;

  const saveBtn = document.querySelector('#modal .mf .btn-pr');
  if (saveBtn) {
    saveBtn.onclick = saveNewSchoolInfoFieldModal;
    saveBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>إضافة الحقل';
  }
  document.getElementById('modal').classList.add('open');
}

function onSiAddTypeChange() {
  const tp = document.getElementById('si-type')?.value;
  const ed = document.getElementById('si-opts-editor');
  if (ed) {
    ed.style.display = (tp === 'select' || tp === 'multiselect' || tp === 'checkboxes') ? 'flex' : 'none';
  }
  const box = document.getElementById('si-preview-box');
  if (box && box.style.display !== 'none') previewSiFieldModal();
}

function previewSiFieldModal() {
  const lbl = document.getElementById('si-lbl')?.value?.trim() || 'اسم الحقل المعاين';
  const tp = document.getElementById('si-type')?.value || 'text';
  const req = document.getElementById('si-req')?.checked || false;
  const optsStr = document.getElementById('si-opts-input')?.value || '';
  const opts = optsStr.split(/[,،]/).map(s => s.trim()).filter(Boolean);
  if ((tp === 'select' || tp === 'multiselect' || tp === 'checkboxes') && opts.length === 0) opts.push('الخيار الأول', 'الخيار الثاني');

  const box = document.getElementById('si-preview-box');
  const body = document.getElementById('si-preview-body');
  if (!box || !body) return;

  const reqStar = req ? '<span style="color:var(--er);margin-right:2px;font-weight:bold">*</span>' : '';
  const safeLabel = lbl.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let fieldInputHtml = '';

  if (tp === 'text') {
    fieldInputHtml = `<input type="text" placeholder="إدخال ${safeLabel}..." style="padding:8px 12px;border:1px solid var(--bd);border-radius:8px;width:100%;font-size:13px">`;
  } else if (tp === 'textarea') {
    fieldInputHtml = `<textarea rows="2" placeholder="إدخال ${safeLabel}..." style="padding:8px 12px;border:1px solid var(--bd);border-radius:8px;width:100%;font-size:13px"></textarea>`;
  } else if (tp === 'number') {
    fieldInputHtml = `<input type="number" placeholder="0" style="padding:8px 12px;border:1px solid var(--bd);border-radius:8px;width:100%;font-size:13px">`;
  } else if (tp === 'date') {
    fieldInputHtml = `<input type="date" style="padding:8px 12px;border:1px solid var(--bd);border-radius:8px;width:100%;font-size:13px">`;
  } else if (tp === 'select') {
    const optsHtml = opts.map(o => `<option>${o}</option>`).join('');
    fieldInputHtml = `<select style="padding:8px 12px;border:1px solid var(--bd);border-radius:8px;width:100%;font-size:13px"><option value="">-- اختر ${safeLabel} --</option>${optsHtml}</select>`;
  } else if (tp === 'multiselect') {
    const optsHtml = opts.map(o => `<option>${o}</option>`).join('');
    fieldInputHtml = `<select multiple style="padding:8px 12px;border:1px solid var(--bd);border-radius:8px;width:100%;min-height:80px;font-size:13px">${optsHtml}</select>`;
  } else if (tp === 'checkboxes') {
    const pills = opts.map((o, idx) => `
      <label class="chk-pill">
        <input type="checkbox" id="si-prev-chk-${idx}">
        <span>${o}</span>
      </label>
    `).join('');
    fieldInputHtml = `<div class="chk-grid">${pills}</div>`;
  }

  body.innerHTML = `
    <div class="fgr" style="margin:0">
      <label style="font-size:11px;font-weight:700;color:var(--tx2);margin-bottom:4px;display:block">
        ${safeLabel} ${reqStar}
      </label>
      ${fieldInputHtml}
    </div>
  `;
  box.style.display = 'block';
}

function saveNewSchoolInfoFieldModal() {
  const lbl = document.getElementById('si-lbl')?.value?.trim();
  if (!lbl) {
    alert('يرجى كتابة اسم الحقل');
    return;
  }
  const tp = document.getElementById('si-type')?.value || 'text';
  const req = document.getElementById('si-req')?.checked || false;
  const optsStr = document.getElementById('si-opts-input')?.value || '';
  const opts = optsStr.split(/[,،]/).map(s => s.trim()).filter(Boolean);

  if ((tp === 'select' || tp === 'multiselect' || tp === 'checkboxes') && opts.length === 0) {
    alert('يرجى كتابة خيار واحد على الأقل مفصول بفاصلة');
    return;
  }

  const fields = getSchoolInfoFields();
  const newField = {
    id: 'si_' + Date.now(),
    label: lbl,
    type: tp,
    required: req,
    visible: true
  };
  if (tp === 'select' || tp === 'multiselect' || tp === 'checkboxes') {
    newField.options = opts;
  }

  fields.push(newField);
  saveSchoolInfoFields(fields);
  closeModal();
  renderSchoolInfoFieldMgr();
  renderSchoolInfoPage();
  if (window.FieldManagerUI?.loadFields) window.FieldManagerUI.loadFields();
  alert(`✅ تم إضافة حقل "${lbl}" إلى بيانات المدرسة بنجاح`);
}

function toggleField(type, fid) {
  const fields = getFields(type);
  const f = fields.find(x => x.id === fid);
  if (!f) return;
  f.visible = !f.visible;
  saveFields(type, fields);
  renderFieldMgr();
  buildTableHeaders(type);
  renderTbl(type);
}

function deleteField(type, fid) {
  const fields = getFields(type);
  const f = fields.find(x => x.id === fid || x.field_name === fid);
  if (!f) return;

  const fLabel = f.label || f.field_label || fid;

  // فحص وجود بيانات فعلية في هذا الحقل
  const allRecords = (typeof gdb === 'function' ? gdb(type) : []) || [];
  const recordsWithData = allRecords.filter(r => {
    const v = r[fid];
    return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
  });
  const dataCount = recordsWithData.length;

  let msg = '';
  if (dataCount > 0) {
    msg = `⚠️ الحقل "<strong>${fLabel}</strong>" يحتوي على بيانات في <strong>${dataCount}</strong> سجل.<br>` +
          `هل أنت متأكد من حذف هذا الحقل نهائياً من النظام؟<br>` +
          `<span style="font-size:12px;color:var(--tx3)">سيتم إزالة الحقل من النماذج والجداول وتصدير Excel.</span>`;
  } else {
    msg = `هل أنت متأكد من حذف حقل "<strong>${fLabel}</strong>" نهائياً؟`;
  }

  showConfirm(msg, async () => {
    const updated = fields.filter(x => x.id !== fid && x.field_name !== fid);
    saveFields(type, updated);

    if (window.CloudConfigManager && window.CloudConfigManager.deleteField) {
      await window.CloudConfigManager.deleteField(fid, fLabel).catch(() => {});
    }

    if (window.ActivityLogger) {
      window.ActivityLogger.local('حذف حقل', type, { id: fid, name1: fLabel });
    }

    renderFieldMgr();
    if (window.FieldManagerUI?.loadFields) {
      await window.FieldManagerUI.loadFields();
    }
    buildTableHeaders(type);
    renderTbl(type);
    renderDashboard();
  });
}

function resetFieldsToDefault(type) {
  showConfirm(`إعادة ضبط حقول "${typeNames[type]}" إلى الافتراضية؟ سيعود الترتيب والحقول لوضعها الأصلي.`, () => {
    const defaults = (typeof getFieldConfigDefaults === 'function') ? getFieldConfigDefaults(type) : ([...(CORE_FIELDS[type] || [])]);
    saveFields(type, JSON.parse(JSON.stringify(defaults)));
    renderFieldMgr();
    buildTableHeaders(type);
    renderTbl(type);
  });
}

let editingFieldType = null;
let editingFieldId = null;

function openEditField(type, fieldId) {
  const fields = (type === 'si' || type === 'school') ? getSchoolInfoFields() : getFields(type);
  const field = fields.find(f => f.id === fieldId);
  if (!field) return;

  editingFieldType = type;
  editingFieldId = fieldId;

  const titles = { teach: 'تعديل حقل - كادر المدرسة', stud: 'تعديل حقل - الطلاب الموهوبين', si: 'تعديل حقل - بيانات المدرسة', school: 'تعديل حقل - بيانات المدرسة' };
  const titleEl = document.getElementById('modal-title');
  if (titleEl) titleEl.textContent = titles[type] || 'تعديل حقل';

  const bodyEl = document.getElementById('modal-body');
  if (bodyEl) bodyEl.innerHTML = buildFieldEditForm(field);

  const saveBtn = document.querySelector('#modal .mf .btn-pr');
  if (saveBtn) {
    saveBtn.onclick = function () {
      saveEditedField();
    };
    saveBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>حفظ التعديل';
  }
  const modalEl = document.getElementById('modal');
  if (modalEl) modalEl.classList.add('open');
}

function buildFieldEditForm(field) {
  const typeOptions = [
    { value: 'text', label: 'نص قصير' },
    { value: 'textarea', label: 'نص طويل' },
    { value: 'number', label: 'رقم' },
    { value: 'date', label: 'تاريخ' },
    { value: 'select', label: '📋 قائمة منسدلة' },
    { value: 'multiselect', label: '☑️ قائمة متعددة الاختيار' },
    { value: 'checkboxes', label: '✅ مربعات اختيار' }
  ];

  const fieldType = field.type || field.field_type || 'text';
  const fieldLabel = field.label || field.field_label || '';
  const isOptionField = fieldType === 'select' || fieldType === 'multiselect' || fieldType === 'checkboxes';
  const currentOpts = Array.isArray(field.options) ? field.options.join(', ') : (field.options || '');
  const isSchoolInfo = editingFieldType === 'si' || editingFieldType === 'school';
  const schools = (typeof SCHOOLS !== 'undefined' && Array.isArray(SCHOOLS)) ? SCHOOLS : [];
  const currentScope = field.school_scope || 'all';

  const optionsHtml = `
    <div class="fgr s2" id="edit-field-options" style="display:${isOptionField ? 'flex' : 'none'};flex-direction:column;gap:6px">
      <label>الخيارات (مفصولة بفاصلة) <span class="req">*</span></label>
      <input id="ef-options" value="${currentOpts.replace(/"/g, '&quot;')}" placeholder="خيار1, خيار2, خيار3" style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;font-family:Cairo,sans-serif;font-size:13px">
      <small style="color:var(--tx3);font-size:11px">مثال: رياضيات, فيزياء, كيمياء</small>
    </div>
  `;

  const scopeHtml = !isSchoolInfo ? `
    <div class="fgr">
      <label>نطاق المدرسة</label>
      <select id="ef-school-scope" style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;font-family:Cairo,sans-serif;font-size:13px">
        <option value="all" ${currentScope === 'all' ? 'selected' : ''}>🌐 جميع المدارس (عام)</option>
        ${schools.map(s => `<option value="${s}" ${currentScope === s ? 'selected' : ''}>🏫 مدرسة: ${s}</option>`).join('')}
      </select>
    </div>
  ` : '';

  return `
    <div class="fg">
      <div class="fgr">
        <label>اسم الحقل <span class="req">*</span></label>
        <input id="ef-label" value="${fieldLabel.replace(/"/g, '&quot;')}" placeholder="اسم الحقل" style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;font-family:Cairo,sans-serif;font-size:13px">
      </div>
      <div class="fgr">
        <label>نوع الحقل</label>
        <select id="ef-type" onchange="toggleFieldOptionsEdit()" style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;font-family:Cairo,sans-serif;font-size:13px">
          ${typeOptions.map(o => `<option value="${o.value}" ${fieldType === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </div>
      ${scopeHtml}
      ${optionsHtml}
      <div class="fgr s2" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-top:8px">
        <div style="display:flex;align-items:center;gap:14px">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
            <input type="checkbox" id="ef-required" ${field.required ? 'checked' : ''} style="accent-color:var(--pr);width:15px;height:15px"> حقل إلزامي
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
            <input type="checkbox" id="ef-visible" ${field.visible !== false ? 'checked' : ''} style="accent-color:var(--pr);width:15px;height:15px"> مرئي في الجداول والنماذج
          </label>
        </div>
        <button type="button" class="btn btn-ac btn-sm" onclick="previewEditFieldModal()" style="padding:6px 14px;font-size:12px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          معاينة الحقل
        </button>
      </div>
      <div id="ef-preview-box" style="display:none;margin-top:12px;padding:12px;background:var(--sf2);border:1.5px dashed var(--pr-m);border-radius:10px">
        <div style="font-size:12px;font-weight:700;color:var(--pr-d);margin-bottom:8px">معاينة الحقل في النموذج:</div>
        <div id="ef-preview-body"></div>
      </div>
    </div>
  `;
}

function toggleFieldOptionsEdit() {
  const type = document.getElementById('ef-type')?.value;
  const optsDiv = document.getElementById('edit-field-options');
  if (optsDiv) {
    optsDiv.style.display = (type === 'select' || type === 'multiselect' || type === 'checkboxes') ? 'flex' : 'none';
  }
  const previewBox = document.getElementById('ef-preview-box');
  if (previewBox && previewBox.style.display !== 'none') {
    previewEditFieldModal();
  }
}

function previewEditFieldModal() {
  const lbl = document.getElementById('ef-label')?.value?.trim() || 'اسم الحقل';
  const tp = document.getElementById('ef-type')?.value || 'text';
  const req = document.getElementById('ef-required')?.checked || false;
  const optsStr = document.getElementById('ef-options')?.value || '';
  const opts = optsStr.split(/[,،]/).map(s => s.trim()).filter(Boolean);
  if ((tp === 'select' || tp === 'multiselect' || tp === 'checkboxes') && opts.length === 0) {
    opts.push('الخيار الأول', 'الخيار الثاني', 'الخيار الثالث');
  }

  const box = document.getElementById('ef-preview-box');
  const body = document.getElementById('ef-preview-body');
  if (!box || !body) return;

  const reqStar = req ? '<span style="color:var(--er);margin-right:2px;font-weight:bold">*</span>' : '';
  const safeLabel = lbl.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let fieldInputHtml = '';

  if (tp === 'text') {
    fieldInputHtml = `<input type="text" placeholder="إدخال ${safeLabel}..." style="padding:8px 12px;border:1px solid var(--bd);border-radius:8px;width:100%;font-size:13px" disabled>`;
  } else if (tp === 'textarea') {
    fieldInputHtml = `<textarea rows="2" placeholder="إدخال ${safeLabel}..." style="padding:8px 12px;border:1px solid var(--bd);border-radius:8px;width:100%;font-size:13px" disabled></textarea>`;
  } else if (tp === 'number') {
    fieldInputHtml = `<input type="number" placeholder="0" style="padding:8px 12px;border:1px solid var(--bd);border-radius:8px;width:100%;font-size:13px" disabled>`;
  } else if (tp === 'date') {
    fieldInputHtml = `<input type="date" style="padding:8px 12px;border:1px solid var(--bd);border-radius:8px;width:100%;font-size:13px" disabled>`;
  } else if (tp === 'select') {
    const optsHtml = opts.map(o => `<option>${o}</option>`).join('');
    fieldInputHtml = `<select style="padding:8px 12px;border:1px solid var(--bd);border-radius:8px;width:100%;font-size:13px"><option value="">-- اختر ${safeLabel} --</option>${optsHtml}</select>`;
  } else if (tp === 'multiselect') {
    const optsHtml = opts.map(o => `<option>${o}</option>`).join('');
    fieldInputHtml = `<select multiple style="padding:8px 12px;border:1px solid var(--bd);border-radius:8px;width:100%;min-height:80px;font-size:13px">${optsHtml}</select>`;
  } else if (tp === 'checkboxes') {
    const pills = opts.map((o, idx) => `
      <label class="chk-pill" style="display:inline-flex;align-items:center;gap:5px;background:var(--sf);padding:5px 10px;border-radius:6px;border:1px solid var(--bd);margin:3px;font-size:12px">
        <input type="checkbox" id="ef-prev-chk-${idx}">
        <span>${o}</span>
      </label>
    `).join('');
    fieldInputHtml = `<div style="display:flex;flex-wrap:wrap;gap:4px">${pills}</div>`;
  }

  body.innerHTML = `
    <div class="fgr" style="margin:0">
      <label style="font-size:12px;font-weight:700;color:var(--tx2);margin-bottom:4px;display:block">
        ${safeLabel} ${reqStar}
      </label>
      ${fieldInputHtml}
    </div>
  `;
  box.style.display = 'block';
}

function saveEditedField() {
  const label = document.getElementById('ef-label')?.value?.trim();
  const type = document.getElementById('ef-type')?.value || 'text';
  const required = document.getElementById('ef-required')?.checked || false;
  const visible = document.getElementById('ef-visible')?.checked || false;
  const schoolScope = document.getElementById('ef-school-scope')?.value || 'all';

  if (!label) {
    if (typeof showModalAlert === 'function') showModalAlert('يرجى إدخال اسم الحقل');
    else alert('يرجى إدخال اسم الحقل');
    return;
  }

  let options = undefined;
  if (type === 'select' || type === 'multiselect' || type === 'checkboxes') {
    const optsStr = document.getElementById('ef-options')?.value || '';
    options = optsStr.split(/[,،]/).map(s => s.trim()).filter(Boolean);
    if (options.length === 0) {
      if (typeof showModalAlert === 'function') showModalAlert('يرجى كتابة خيار واحد على الأقل مفصول بفاصلة');
      else alert('يرجى كتابة خيار واحد على الأقل مفصول بفاصلة');
      return;
    }
  }

  const currentType = editingFieldType || 'stud';
  const currentId = editingFieldId;

  if (currentType === 'si' || currentType === 'school') {
    const fields = getSchoolInfoFields();
    const f = fields.find(x => x.id === currentId);
    if (f) {
      f.label = label;
      f.type = type;
      f.required = required;
      f.visible = visible;
      if (options) f.options = options;
      else delete f.options;
      saveSchoolInfoFields(fields);
    }
  } else {
    const fields = getFields(currentType);
    const f = fields.find(x => x.id === currentId);
    if (f) {
      f.label = label;
      f.field_label = label;
      f.type = type;
      f.field_type = type;
      f.required = required;
      f.visible = visible;
      f.school_scope = schoolScope;
      if (options) f.options = options;
      else delete f.options;
      saveFields(currentType, fields);
    }
  }

  // Reset editing pointers
  editingFieldType = null;
  editingFieldId = null;

  // Restore save button for record modal
  const saveBtn = document.querySelector('#modal .mf .btn-pr');
  if (saveBtn) {
    saveBtn.onclick = saveModal;
    saveBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>حفظ السجل';
  }

  closeModal();

  // Refresh field managers & tables
  if (typeof renderFieldMgr === 'function') renderFieldMgr();
  if (typeof renderSchoolInfoFieldMgr === 'function') renderSchoolInfoFieldMgr();
  if (window.FieldManagerUI?.loadFields) window.FieldManagerUI.loadFields();

  if (currentType === 'teach' || currentType === 'stud') {
    buildTableHeaders(currentType);
    renderTbl(currentType);
  }
  if (currentType === 'si' || currentType === 'school') {
    renderSchoolInfoPage();
  }

  alert(`✅ تم حفظ تعديلات الحقل "${label}" بنجاح`);
}

function buildAddFieldCard() {
  return `<div class="fm-add-card" id="afc-inner">
    <h4>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
      إضافة حقل جديد
    </h4>
    <div class="fg" style="gap:12px">
      <div class="fgr">
        <label>اسم الحقل الجديد <span class="req">*</span></label>
        <input id="aff-lbl" placeholder="مثال: رقم الوثيقة، المنطقة السكنية...">
      </div>
      <div class="fgr">
        <label>نوع الحقل</label>
        <select id="aff-type" onchange="onAddTypeChange()">
          <option value="select">قائمة منسدلة (الأكثر استخداماً)</option>
          <option value="multiselect">قائمة متعددة الاختيار</option>
          <option value="text">نص قصير</option>
          <option value="number">رقم</option>
          <option value="date">تاريخ</option>
          <option value="textarea">نص طويل</option>
        </select>
      </div>
      <div class="fgr s2 opts-editor" id="opts-editor">
        <label>خيارات القائمة المنسدلة <span class="req">*</span></label>
        <div class="opts-list" id="opts-pills"></div>
        <div class="opt-add-row">
          <input id="opt-inp" placeholder="اكتب خياراً ثم اضغط إضافة أو Enter" onkeydown="if(event.key==='Enter')addOpt()">
          <button class="btn btn-sm" onclick="addOpt()">إضافة خيار</button>
        </div>
        <div style="font-size:11px;color:var(--tx3);margin-top:6px">أو أدخل عدة خيارات مفصولة بفاصلة: <input id="bulk-opts" placeholder="خيار1, خيار2, خيار3" style="border:1px solid var(--bd);border-radius:6px;padding:4px 8px;font-family:'Cairo',sans-serif;font-size:12px;width:220px" onkeydown="if(event.key==='Enter')addBulkOpts()"> <button class="btn btn-sm" onclick="addBulkOpts()">إضافة</button></div>
      </div>
      <div class="fgr s2">
        <label>تطبيق على الفئات</label>
        <div class="apply-cats">
          <label class="cat-check checked" id="cc-teach">
            <input type="checkbox" value="teach" checked onchange="toggleCatCheck(this)"> كادر المدرسة
          </label>
          <label class="cat-check checked" id="cc-stud">
            <input type="checkbox" value="stud" checked onchange="toggleCatCheck(this)"> الطلاب الموهوبون
          </label>
          <label class="cat-check" id="cc-si">
            <input type="checkbox" value="si" onchange="toggleCatCheck(this)"> بيانات المدرسة
          </label>
        </div>
      </div>
      <div class="fgr s2" style="display:flex;flex-direction:row;align-items:center;gap:12px;justify-content:space-between;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;cursor:pointer">
          <input type="checkbox" id="aff-req" style="accent-color:var(--pr);width:14px;height:14px"> حقل إلزامي
        </label>
        <div style="display:flex;align-items:center;gap:10px">
          <button type="button" class="btn btn-ac" id="btn-preview-field" onclick="previewFieldGlobal()" style="padding:8px 16px;font-size:13px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            معاينة الحقل
          </button>
          <button class="btn btn-pr" onclick="addFieldGlobal()" style="min-width:140px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            إضافة الحقل
          </button>
        </div>
      </div>
      <div id="field-preview-container" class="fgr s2" style="display:none;margin-top:12px;padding:16px;background:var(--sf2);border:2px dashed var(--pr-m);border-radius:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;border-bottom:1px solid var(--bd);padding-bottom:8px">
          <div style="font-size:13px;font-weight:700;color:var(--pr-d);display:flex;align-items:center;gap:6px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            معاينة كيفية ظهور الحقل في نموذج بيانات الطالب / الكادر
          </div>
          <span class="badge b-teal" id="preview-target-badge">نموذج الطلاب والكادر</span>
        </div>
        <div id="field-preview-body" style="background:var(--sf);padding:16px;border-radius:10px;border:1px solid var(--bd)"></div>
        <div style="font-size:11px;color:var(--tx3);margin-top:8px">
          * هذه المعاينة التفاعلية تتيح للأدمن رؤية شكل وتجاوب الحقل قبل حفظه رسمياً.
        </div>
      </div>
    </div>
  </div>`;
}

let tempOpts = [];

function initAddFieldCard() {
  tempOpts = [];
  renderOptPills();
  onAddTypeChange();

  const updatePreviewIfActive = () => {
    const container = document.getElementById('field-preview-container');
    if (container && container.style.display !== 'none') {
      previewFieldGlobal();
    }
  };

  ['aff-lbl', 'aff-req'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updatePreviewIfActive);
      el.addEventListener('change', updatePreviewIfActive);
    }
  });
}

function previewFieldGlobal() {
  const label = document.getElementById('aff-lbl')?.value?.trim() || 'اسم الحقل المعاين';
  const type = document.getElementById('aff-type')?.value || 'select';
  const req = document.getElementById('aff-req')?.checked || false;
  const isTeach = document.querySelector('#cc-teach input')?.checked;
  const isStud = document.querySelector('#cc-stud input')?.checked;
  const isSi = document.querySelector('#cc-si input')?.checked;

  const container = document.getElementById('field-preview-container');
  const body = document.getElementById('field-preview-body');
  const badge = document.getElementById('preview-target-badge');

  if (!container || !body) return;

  const selectedNames = [];
  if (isTeach) selectedNames.push('الكادر');
  if (isStud) selectedNames.push('الطلاب');
  if (isSi) selectedNames.push('بيانات المدرسة');
  
  if (badge) badge.textContent = selectedNames.length ? 'تطبيق على: ' + selectedNames.join('، ') : 'لم يتم اختيار فئة';

  const reqStar = req ? '<span class="req" style="color:var(--er);margin-right:2px;font-weight:bold">*</span>' : '';
  const opts = tempOpts.length > 0 ? tempOpts : ['الخيار الأول', 'الخيار الثاني', 'الخيار الثالث'];

  let fieldInputHtml = '';
  const safeLabel = label.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  if (type === 'text') {
    fieldInputHtml = `<input type="text" placeholder="مثال لإدخال ${safeLabel}..." style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;width:100%;font-family:'Cairo',sans-serif;font-size:13px;background:var(--sf)">`;
  } else if (type === 'textarea') {
    fieldInputHtml = `<textarea rows="3" placeholder="أدخل بيانات ${safeLabel}..." style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;width:100%;font-family:'Cairo',sans-serif;font-size:13px;background:var(--sf);resize:vertical"></textarea>`;
  } else if (type === 'number') {
    fieldInputHtml = `<input type="number" placeholder="0" style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;width:100%;font-family:'Cairo',sans-serif;font-size:13px;background:var(--sf)">`;
  } else if (type === 'date') {
    fieldInputHtml = `<input type="date" style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;width:100%;font-family:'Cairo',sans-serif;font-size:13px;background:var(--sf)">`;
  } else if (type === 'select') {
    const optsHtml = opts.map(o => `<option>${o.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</option>`).join('');
    fieldInputHtml = `<select style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;width:100%;font-family:'Cairo',sans-serif;font-size:13px;background:var(--sf)"><option value="">-- اختر ${safeLabel} --</option>${optsHtml}</select>`;
  } else if (type === 'multiselect') {
    const optsHtml = opts.map(o => `<option>${o.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</option>`).join('');
    fieldInputHtml = `<select multiple style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;width:100%;min-height:95px;font-family:'Cairo',sans-serif;font-size:13px;background:var(--sf)">${optsHtml}</select><span style="font-size:11px;color:var(--tx3);display:block;margin-top:4px">يمكن التحديد المتعدد باستخدام مفتاح Ctrl / Cmd</span>`;
  }

  body.innerHTML = `
    <div class="fgr" style="margin:0">
      <label style="font-size:11px;font-weight:700;color:var(--tx2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;display:block">
        ${safeLabel} ${reqStar}
      </label>
      ${fieldInputHtml}
    </div>
  `;

  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function onAddTypeChange() {
  const tp = document.getElementById('aff-type')?.value;
  const ed = document.getElementById('opts-editor');
  const lbl = document.querySelector('#opts-editor label');
  if (ed) {
    const showOpts = tp === 'select' || tp === 'multiselect';
    ed.style.display = showOpts ? 'flex' : 'none';
    if (lbl) lbl.innerHTML = (tp === 'multiselect' ? 'خيارات القائمة متعددة الاختيار' : 'خيارات القائمة المنسدلة') + ' <span class="req">*</span>';
  }
  const container = document.getElementById('field-preview-container');
  if (container && container.style.display !== 'none') {
    previewFieldGlobal();
  }
}

function toggleCatCheck(inp) {
  const lbl = inp.closest('.cat-check');
  if (lbl) lbl.classList.toggle('checked', inp.checked);
  const container = document.getElementById('field-preview-container');
  if (container && container.style.display !== 'none') {
    previewFieldGlobal();
  }
}

function addOpt() {
  const inp = document.getElementById('opt-inp');
  const val = (inp?.value || '').trim();
  if (!val) return;
  if (!tempOpts.includes(val)) { tempOpts.push(val); renderOptPills(); }
  inp.value = '';
  inp.focus();
  const container = document.getElementById('field-preview-container');
  if (container && container.style.display !== 'none') {
    previewFieldGlobal();
  }
}

function addBulkOpts() {
  const inp = document.getElementById('bulk-opts');
  const vals = (inp?.value || '').split(/[,،]/).map(s => s.trim()).filter(Boolean);
  vals.forEach(v => { if (!tempOpts.includes(v)) tempOpts.push(v); });
  renderOptPills();
  inp.value = '';
  const container = document.getElementById('field-preview-container');
  if (container && container.style.display !== 'none') {
    previewFieldGlobal();
  }
}

function removeOpt(v) {
  tempOpts = tempOpts.filter(x => x !== v);
  renderOptPills();
  const container = document.getElementById('field-preview-container');
  if (container && container.style.display !== 'none') {
    previewFieldGlobal();
  }
}

function renderOptPills() {
  const el = document.getElementById('opts-pills');
  if (!el) return;
  el.innerHTML = tempOpts.map(v => `<span class="opt-pill">${v}<button onclick="removeOpt('${v.replace(/'/g, "\\'")}')">×</button></span>`).join('') || '<span style="font-size:12px;color:var(--tx3);padding:4px">لم تُضَف خيارات بعد</span>';
}

function addFieldGlobal() {
  const lbl = (document.getElementById('aff-lbl')?.value || '').trim();
  if (!lbl) { alert('يرجى كتابة اسم الحقل'); return; }
  const tp = document.getElementById('aff-type')?.value || 'select';
  const req = document.getElementById('aff-req')?.checked || false;

  if ((tp === 'select' || tp === 'multiselect') && tempOpts.length === 0) { alert('يرجى إضافة خيار واحد على الأقل للقائمة المنسدلة'); return; }

  const cats = ['teach', 'stud', 'si'].filter(c => {
    const cb = document.querySelector(`#cc-${c} input`);
    return cb && cb.checked;
  });
  if (!cats.length) { alert('يرجى اختيار فئة واحدة على الأقل'); return; }

  const fid = 'cf_' + Date.now();
  cats.forEach(cat => {
    if (cat === 'si') {
      const newField = { id: fid, label: lbl, type: tp, required: req, visible: true };
      if (tp === 'select' || tp === 'multiselect') newField.options = [...tempOpts];
      const fields = getSchoolInfoFields();
      fields.push(newField);
      saveSchoolInfoFields(fields);
      renderSchoolInfoFieldMgr();
      renderSchoolInfoPage();
    } else {
      const newField = { id: fid, label: lbl, type: tp, required: req, core: false, visible: true };
      if (tp === 'select' || tp === 'multiselect') newField.options = [...tempOpts];
      const fields = getFields(cat);
      fields.push(newField);
      saveFields(cat, fields);
      buildTableHeaders(cat);
      renderTbl(cat);
    }
  });

  renderFieldMgr();
  const labelMap = { teach: 'كادر المدرسة', stud: 'الطلاب الموهوبون', si: 'بيانات المدرسة' };
  alert(`✅ تم إضافة الحقل "${lbl}" إلى: ${cats.map(c => labelMap[c] || c).join('، ')}`);
}

// دوال السحب والإفلات للحقول
function onFieldDragStart(e, type, idx) {
  dragSrcType = type;
  dragSrcIdx = idx;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.style.opacity = '0.5';
}

function onFieldDragEnd(e) { e.currentTarget.style.opacity = '1'; }

function onFieldDragOver(e, type, idx) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (dragSrcType === type && dragSrcIdx !== idx) {
    e.currentTarget.style.borderColor = 'var(--pr)';
  }
}

function onFieldDragLeave(e) { e.currentTarget.style.borderColor = ''; }

function onFieldDrop(e, type, idx) {
  e.preventDefault();
  e.currentTarget.style.borderColor = '';
  if (dragSrcType !== type || dragSrcIdx === idx) return;
  if (type === 'si') {
    const fields = getSchoolInfoFields();
    const moved = fields.splice(dragSrcIdx, 1)[0];
    fields.splice(idx, 0, moved);
    saveSchoolInfoFields(fields);
    renderSchoolInfoFieldMgr();
    return;
  }
  const fields = getFields(type);
  const moved = fields.splice(dragSrcIdx, 1)[0];
  fields.splice(idx, 0, moved);
  saveFields(type, fields);
  renderFieldMgr();
}

// دوال النماذج والإضافة والتعديل
function openAdd(type) {
  resetRecordSaveButton();
  modalType = type;
  editId = null;
  curPhoto = null;
  const titles = { teach: 'إضافة عضو كادر المدرسة', stud: 'إضافة طالب موهوب' };
  document.getElementById('modal-title').textContent = titles[type] || 'إضافة سجل';
  document.getElementById('modal-body').innerHTML = buildForm(type, null);
  if (CU?.school) { const el = document.getElementById('ff-school'); if (el) { el.value = CU.school; el.disabled = true; } }
  if (type === 'teach') { const rt = document.getElementById('ff-jobRole'); if (rt) onRoleTypeChange(rt.value); }
  document.getElementById('modal').classList.add('open');
}

function openEdit(type, id) { openFormEdit(type, id); }

function openView(type, id) {
  const rec = gdb(type).find(r => r.id === id);
  if (!rec) return;
  const fields = getFields(type);
  const typeLabel = { teach: 'كادر المدرسة', stud: 'طالب موهوب' };
  const typeBadge = { teach: 'b-teal', stud: 'b-amber' };
  const fullname = [rec.name1, rec.name2, rec.name3, rec.name4].filter(Boolean).join(' ');
  const avatarSrc = getRecordAvatar(rec, type);
  const photoHtml = `<img class="pv-photo" src="${avatarSrc}" alt="صورة">`;
  const secDefs = {
    teach: [{ t: 'البيانات الشخصية', ids: ['name1', 'name2', 'name3', 'name4', 'nid', 'dob', 'gender'] },
    { t: 'البيانات الوظيفية', ids: ['school', 'jobRole', 'subject', 'targetStages', 'spec', 'degree', 'grade', 'hire', 'service'] },
    { t: 'التواصل والسكن', ids: ['phone', 'email', 'address', 'achievements'] }],
    stud: [{ t: 'البيانات الشخصية', ids: ['name1', 'name2', 'name3', 'name4', 'dob', 'gender'] },
    { t: 'البيانات الدراسية', ids: ['school', 'stage', 'talent', 'gpa'] },
    { t: 'التواصل والسكن', ids: ['parentPhone', 'studentPhone', 'address', 'achievements'] }]
  };
  const knownIds = new Set((secDefs[type] || []).flatMap(s => s.ids));
  const customF = fields.filter(f => !knownIds.has(f.id) && f.visible && rec[f.id]);
  let bodyHtml = '';
  (secDefs[type] || []).forEach(sec => {
    const secF = fields.filter(f => sec.ids.includes(f.id) && f.visible);
    if (!secF.length) return;
    bodyHtml += `<div class="pv-section"><div class="pv-section-title">${sec.t}</div><div class="pv-grid">`;
    secF.forEach(f => {
      const val = displayFieldValue(rec, f.id);
      const isEmpty = !val || val === '';
      const isWide = f.type === 'textarea' || f.id === 'address' || f.id === 'notes' || f.id === 'achievements';
      bodyHtml += `<div class="pv-field ${isWide ? 'span3' : ''}">
        <div class="pv-field-lbl">${f.label}</div>
        <div class="pv-field-val ${isEmpty ? 'empty' : ''}">${isEmpty ? 'غير مُدخل' : val}</div></div>`;
    });
    bodyHtml += `</div></div>`;
  });
  if (customF.length) {
    bodyHtml += `<div class="pv-section"><div class="pv-section-title">حقول إضافية</div><div class="pv-grid">`;
    customF.forEach(f => { bodyHtml += `<div class="pv-field"><div class="pv-field-lbl">${f.label}</div><div class="pv-field-val">${rec[f.id] || '—'}</div></div>`; });
    bodyHtml += `</div></div>`;
  }
  document.getElementById('pv-hero').innerHTML = `${photoHtml}<div class="pv-hero-info">
    <div class="pv-name">${fullname || '—'}</div>
    <div class="pv-meta">
      <span class="badge ${typeBadge[type]}">${typeLabel[type]}</span>
      ${rec.school ? `<span class="badge b-teal">${rec.school}</span>` : ''}
      ${rec.job ? `<span class="badge b-gray">${rec.job}</span>` : ''}
      ${displayFieldValue(rec, 'subject') ? `<span class="badge b-gray">${displayFieldValue(rec, 'subject')}</span>` : ''}
      ${rec.stage ? `<span class="badge b-gray">${rec.stage}</span>` : ''}
      ${rec.talent ? `<span class="badge b-purple">${rec.talent}</span>` : ''}
      ${rec.gpa ? `<span style="font-size:12px;color:var(--pr-d);font-weight:700">معدل: ${rec.gpa}</span>` : ''}
    </div>
    <div style="font-size:12px;color:var(--tx3);margin-top:4px">
      ${rec.phone ? `هاتف: ${rec.phone}` : ''}
      ${rec.parentPhone ? `هاتف ولي الأمر: ${rec.parentPhone}` : ''}
    </div>
  </div>
  ${type === 'stud' ? `<div style="margin-right:auto; flex-shrink:0;"><button class="btn btn-pr" onclick="openStudentReportModal('${rec.id}')" style="background:var(--pr-d); color:#fff; display:inline-flex; align-items:center; gap:6px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>تصدير تقرير PDF الشامل</button></div>` : ''}`;

  document.getElementById('pv-body').innerHTML = bodyHtml;
  document.getElementById('pv-edit-btn').onclick = () => { closePV(); openFormEdit(type, id); };
  document.getElementById('pv-del-btn').onclick = () => deleteRec(type, id, true);

  const reportBtn = document.getElementById('pv-report-btn');
  if (reportBtn) {
    if (type === 'stud') {
      reportBtn.style.display = 'inline-flex';
      reportBtn.onclick = () => openStudentReportModal(id);
    } else {
      reportBtn.style.display = 'none';
    }
  }

  document.getElementById('pv-overlay').classList.add('open');
}

function closePV() { document.getElementById('pv-overlay').classList.remove('open'); }

function openFormEdit(type, id) {
  const rec = gdb(type).find(r => r.id === id);
  if (!rec) return;
  resetRecordSaveButton();
  modalType = type;
  editId = id;
  curPhoto = rec.photo || null;
  const titles = { teach: 'تعديل بيانات كادر المدرسة', stud: 'تعديل بيانات طالب' };
  document.getElementById('modal-title').textContent = titles[type];
  document.getElementById('modal-body').innerHTML = buildForm(type, rec);
  if (type === 'teach') { const rt = document.getElementById('ff-jobRole'); if (rt) onRoleTypeChange(rt.value); }
  document.getElementById('modal').classList.add('open');
}

function resetRecordSaveButton() {
  const m = document.getElementById('modal');
  if (m) {
    const mb = m.querySelector('.mb');
    if (mb) mb.classList.remove('mb-extra-wide');
    const mf = m.querySelector('.mf');
    if (mf) mf.style.display = '';
  }
  const saveBtn = document.querySelector('#modal .mf .btn-pr');
  if (!saveBtn) return;
  saveBtn.removeAttribute('onclick');
  saveBtn.onclick = null;
  saveBtn.setAttribute('onclick', 'saveModal()');
  saveBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>حفظ السجل';
}

function buildForm(type, rec) {
  curPhoto = rec ? rec.photo || null : null;
  const fields = getFields(type);
  const defaultAvatar = getDefaultAvatar(type, rec ? rec.gender : '');
  const preview = curPhoto
    ? `<img src="${curPhoto}" alt="صورة" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<img src="${defaultAvatar}" alt="صورة افتراضية" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  let html = `<div class="fg">`;
  html += `<div class="puw" style="grid-column:1/-1">
    <div class="ppb" id="pp">${preview}</div>
    <div class="pui">
      <h4>الصورة الشخصية</h4>
      <p>JPG أو PNG · أقصى 2 ميغابايت · اختياري (تتوفر صورة كارتونية أنيقة تلقائياً حسب الجنس والصفة)</p>
      <label class="pub"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>رفع صورة مخصصة<input type="file" accept="image/*" class="pfile" onchange="handlePhoto(event)"></label>
      <button class="pub" id="btn-clear-photo" onclick="clearPhoto()" style="margin-right:6px; ${curPhoto ? '' : 'display:none'}">إزالة الصورة المخصصة</button>
    </div>
  </div>`;

  let lastSection = '';
  const sections = { name1: 'البيانات الشخصية', school: 'البيانات الوظيفية', phone: 'التواصل والسكن' };
  const teachSections = { name1: 'البيانات الشخصية', school: 'البيانات التدريسية', phone: 'التواصل والسكن' };
  const studSections = { name1: 'البيانات الشخصية', school: 'البيانات الدراسية', parentPhone: 'التواصل والسكن' };
  const sectionMap = type === 'teach' ? teachSections : type === 'stud' ? studSections : sections;

  fields.filter(f => f.visible && f.type !== 'checkboxes').forEach(f => {
    if (sectionMap[f.id] && sectionMap[f.id] !== lastSection) {
      lastSection = sectionMap[f.id];
      html += `<div class="fsec">${lastSection}</div>`;
    }
    let val = rec ? displayFieldValue(rec, f.id) || '' : '';
    if (Array.isArray(val)) val = val.join('، ');
    if (!rec && f.id === 'academicYear' && ACTIVE_YEAR) val = ACTIVE_YEAR;
    const span = f.type === 'textarea' || f.id === 'address' ? 's2' : '';
    const wrapId = f.teachOnly ? ` id="wrap-${f.id}"` : '';
    const wrapStyle = f.teachOnly ? ' style="display:none"' : '';
    html += `<div class="fgr ${span}"${wrapId}${wrapStyle}><label>${f.label}${f.required ? '<span class="req"> *</span>' : ''}</label>`;
    if (f.type === 'text') {
      html += `<input id="ff-${f.id}" value="${val}" placeholder="${f.label}">`;
    } else if (f.type === 'number') {
      html += `<input id="ff-${f.id}" type="number" value="${val}" placeholder="0" min="0">`;
    } else if (f.type === 'date') {
      html += `<input id="ff-${f.id}" type="date" value="${val}">`;
    } else if (f.type === 'textarea') {
      html += `<textarea id="ff-${f.id}">${val}</textarea>`;
    } else if (f.type === 'select') {
      const opts = (f.id === 'school' && CU?.school) ? [CU.school] : (f.options || getSchoolsList());
      const dis = f.id === 'school' && CU?.school ? 'disabled' : '';
      const onchg = f.id === 'jobRole' ? `onchange="onRoleTypeChange(this.value)"` : (f.id === 'gender' ? `onchange="onGenderChange(this.value)"` : '');
      html += `<select id="ff-${f.id}" ${dis} ${onchg}>`;
      if (!(f.id === 'school' && CU?.school)) {
        const _emptyLbls = { academicYear: 'اختر السنة الدراسية', gender: 'اختر الجنس', jobRole: 'اختر الوظيفة', stage: 'اختر المرحلة', talent: 'اختر نوع الموهبة', degree: 'اختر الشهادة', grade: 'اختر الدرجة', job: 'اختر العنوان الوظيفي', attendance: 'اختر حالة الدوام', subject: 'اختر المادة' };
        html += `<option value="">${_emptyLbls[f.id] || 'اختر...'}</option>`;
      }
      opts.forEach(o => html += `<option ${val === o ? 'selected' : ''}>${o}</option>`);
      html += `</select>`;
    } else if (f.type === 'multiselect') {
      const selectedVals = val ? val.split('،').map(s => s.trim()) : [];
      html += `<div class="chk-grid">`;
      (f.options || []).forEach(opt => {
        const checked = selectedVals.includes(opt) ? 'checked' : '';
        html += `<label style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border:1px solid ${checked ? 'var(--pr)' : 'var(--bd)'};border-radius:7px;cursor:pointer;font-size:12px;background:${checked ? 'var(--pr-l)' : 'var(--sf)'};transition:all .15s;user-select:none">`;
        html += `<input type="checkbox" value="${opt}" ${checked} style="accent-color:var(--pr);width:14px;height:14px" onchange="syncCheckboxField('${f.id}',this)">${opt}`;
        html += `</label>`;
      });
      html += `</div><input type="hidden" id="ff-${f.id}" value="${val}">`;
    }
    if (f.type !== 'checkboxes') {
      html += `</div>`;
    }
  });

  fields.filter(f => f.visible && f.type === 'checkboxes').forEach(f => {
    let val = rec ? displayFieldValue(rec, f.id) || '' : '';
    if (Array.isArray(val)) val = val.join('، ');
    const selectedVals = val ? val.split('،').map(s => s.trim()) : [];
    const wrapId = `id="wrap-${f.id}"`;
    const wrapStyle = f.teachOnly ? 'display:none' : '';
    html += `<div class="fgr s2" ${wrapId} style="${wrapStyle}">
      <label>${f.label}${f.required ? '<span class="req"> *</span>' : ''}</label>
      <div class="chk-grid">`;
    (f.options || []).forEach(opt => {
      const checked = selectedVals.includes(opt) ? 'checked' : '';
      html += `<label class="chk-pill ${checked ? 'checked' : ''}">
        <input type="checkbox" value="${opt}" ${checked} onchange="syncCheckboxField('${f.id}',this)">
        ${opt}
      </label>`;
    });
    html += `</div>
      <input type="hidden" id="ff-${f.id}" value="${val}">
    </div>`;
  });

  html += `</div>`;
  return html;
}

function syncCheckboxField(fieldId, changedEl) {
  if (changedEl) {
    const lbl = changedEl.closest('label');
    if (lbl) {
      lbl.classList.toggle('checked', changedEl.checked);
    }
  }
  const hidden = document.getElementById('ff-' + fieldId);
  const wrap = hidden?.closest('.fgr') || document.getElementById('wrap-' + fieldId);
  if (!wrap || !hidden) return;
  const checked = [...wrap.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value);
  hidden.value = checked.join('،');
}

function handlePhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { alert('حجم الصورة كبير جداً — الحد 2 ميغابايت'); return; }
  const r = new FileReader();
  r.onload = ev => {
    curPhoto = ev.target.result;
    document.getElementById('pp').innerHTML = `<img src="${curPhoto}" alt="صورة" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    const clearBtn = document.getElementById('btn-clear-photo');
    if (clearBtn) clearBtn.style.display = 'inline-flex';
  };
  r.readAsDataURL(file);
}

function clearPhoto() {
  curPhoto = null;
  const currentGender = document.getElementById('ff-gender')?.value || '';
  const avatarSrc = getDefaultAvatar(modalType, currentGender);
  document.getElementById('pp').innerHTML = `<img src="${avatarSrc}" alt="صورة افتراضية" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  const clearBtn = document.getElementById('btn-clear-photo');
  if (clearBtn) clearBtn.style.display = 'none';
}

function onGenderChange(val) {
  if (!curPhoto) {
    const pp = document.getElementById('pp');
    if (pp) {
      const avatarSrc = getDefaultAvatar(modalType, val);
      pp.innerHTML = `<img src="${avatarSrc}" alt="صورة افتراضية" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    }
  }
}

function onRoleTypeChange(val) {
  const isTeacher = val === 'تدريسي';
  ['subject', 'targetStages'].forEach(id => {
    const wrap = document.getElementById('wrap-' + id);
    if (wrap) wrap.style.display = isTeacher ? '' : 'none';
  });
  if (!isTeacher) {
    const subject = document.getElementById('ff-subject');
    if (subject) subject.value = '';
    const stages = document.getElementById('ff-targetStages');
    if (stages) stages.value = '';
    const wrap = document.getElementById('wrap-targetStages');
    if (wrap) wrap.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = false; cb.closest('label')?.classList.remove('checked'); });
  }
}

function saveModal() {
  try {
    clearInvalidFields();
    const fields = getFields(modalType);
    const rec = { photo: curPhoto };

    const _invalidIds = [];
    fields.filter(f => f.visible).forEach(f => {
      const el = document.getElementById('ff-' + f.id);
      if (!el) {
        if (f.id === 'school' && CU?.school) { rec[f.id] = CU.school; }
        else if (f.required) { _invalidIds.push(f.id); }
        return;
      }
      let val = '';
      if (f.type === 'multiselect' && el.multiple) {
        val = Array.from(el.selectedOptions).map(o => o.value.trim()).filter(Boolean).join('، ');
      } else {
        val = el.value.trim();
      }
      rec[f.id] = val;
      if (el.style) el.style.borderColor = '';
      if (f.required && !val) { _invalidIds.push(f.id); }
    });

    if (_invalidIds.length) {
      _invalidIds.forEach(id => markInvalidField(id));
      const _firstInv = document.getElementById('ff-' + _invalidIds[0]);
      if (_firstInv) _firstInv.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showModalAlert('يرجى ملء جميع الحقول الإلزامية (*)');
      return false;
    }

    if (modalType === 'teach') {
      rec.jobRole = rec.jobRole || rec.role_type || '';
      if (rec.jobRole !== 'تدريسي') {
        rec.subject = '';
        rec.targetStages = [];
      } else {
        rec.targetStages = typeof rec.targetStages === 'string' && rec.targetStages ? rec.targetStages.split('،').map(s => s.trim()).filter(Boolean) : [];
      }
      delete rec.role_type;
      delete rec.job;
      delete rec.teach_stages;
    }

    if (modalType === 'teach') {
      if (rec.jobRole === 'تدريسي') {
        if (!hasEntryValue(rec.subject)) { markInvalidField('subject'); showModalAlert('عند اختيار تدريسي يجب إدخال المادة الدراسية'); return false; }
        if (!hasEntryValue(rec.targetStages)) { markInvalidField('targetStages'); showModalAlert('عند اختيار تدريسي يجب اختيار مرحلة دراسية واحدة على الأقل'); return false; }
      }
    }

    if (rec.attendance === 'غير مستمر' && !(rec.attendanceNotes || '').trim()) {
      const notesEl = document.getElementById('ff-attendanceNotes');
      if (notesEl) notesEl.style.borderColor = 'var(--er)';
      showModalAlert('عند اختيار "غير مستمر" يجب إدخال ملاحظات حالة الدوام');
      return false;
    }

    if (CU?.school) rec.school = CU.school;
    const recFullName = getFullNameParts(rec);
    if (recFullName.split(' ').length >= 2) {
      const targetSchool = rec.school || (CU?.school ? CU.school : null);
      const existingDup = findDuplicateRecord(modalType, recFullName, editId, targetSchool, rec.stage, rec.academicYear);
      if (existingDup) {
        if (window._forceReplaceDupId === existingDup.id) {
          editId = existingDup.id;
          delete window._forceReplaceDupId;
        } else {
          showDuplicateReplacePrompt(modalType, recFullName, existingDup);
          return false;
        }
      }
    }
    const db = gdb(modalType);
    const wasEdit = !!editId;
    if (editId) {
      const idx = db.findIndex(r => r.id === editId);
      if (idx >= 0) { rec.id = editId; rec.ts = db[idx].ts; rec.tsEdit = Date.now(); db[idx] = rec; }
    } else {
      rec.id = nid();
      rec.ts = Date.now();
      db.push(rec);
    }
    // ختم السجل بالطوابع الأمنية (global_id, createdAt, updatedAt, tsEdit)
    if (window.Security?.stampRecord) Security.stampRecord(rec, modalType);
    sdb(modalType, db);
    logAction(wasEdit ? 'تعديل' : 'إضافة', modalType, rec);
    // تسجيل سحابي للنشاط
    if (window.ActivityLogger) {
      wasEdit ? window.ActivityLogger.edit(modalType, rec) : window.ActivityLogger.add(modalType, rec);
    }
    closeModal();
    buildTableHeaders(modalType);
    renderTbl(modalType);
    renderDashboard();
    try { if (window.renderOpsLog) renderOpsLog(); } catch (e) { }
    try { if (window.renderRelations) renderRelations(); } catch (e) { }

    // Delta Sync — إرسال سجل واحد إلى Supabase
    if (navigator.onLine && window.DeltaSyncManager) {
      setTimeout(() => DeltaSyncManager.upsertRecord(modalType, rec, rec.school || (window.CU?.school) || '').catch(() => {}), 0);
    } else if (navigator.onLine && window.CloudSyncManager) {
      setTimeout(() => CloudSyncManager.sendData(modalType, gdata(modalType), rec.school), 0);
    } else {
      addToQueue(modalType, gdata(modalType));
    }
    return true;
  } catch (err) {
    console.error('[saveModal] خطأ غير متوقع:', err);
    showModalAlert('حدث خطأ غير متوقع أثناء الحفظ. يرجى المحاولة مجدداً');
    return false;
  }
}

function clearInvalidFields() {
  document.querySelectorAll('.field-error-msg').forEach(m => m.remove());
  document.querySelectorAll('.fgr.invalid').forEach(w => {
    w.classList.remove('invalid');
    w.style.border = '';
    w.style.borderRadius = '';
    w.style.padding = '';
    w.style.background = '';
    const label = w.querySelector('label');
    if (label) label.style.color = '';
    const grid = w.querySelector('.chk-grid');
    if (grid) { grid.style.borderColor = ''; grid.style.background = ''; }
  });
  document.querySelectorAll('[id^="ff-"]').forEach(el => { if (el.style) { el.style.borderColor = ''; el.style.boxShadow = ''; } });
}

function hasEntryValue(v) {
  if (Array.isArray(v)) return v.length > 0;
  return String(v || '').trim() !== '';
}

function markInvalidField(id) {
  const el = document.getElementById('ff-' + id);
  const wrap = (el && el.closest('.fgr')) || document.getElementById('wrap-' + id);
  if (wrap) {
    wrap.classList.add('invalid');
    wrap.style.border = '2px solid var(--er)';
    wrap.style.borderRadius = '10px';
    wrap.style.padding = '6px';
    wrap.style.background = '#fff5f5';
    const label = wrap.querySelector('label');
    if (label) label.style.color = 'var(--er)';
    const grid = wrap.querySelector('.chk-grid');
    if (grid) { grid.style.borderColor = 'var(--er)'; grid.style.background = '#fff5f5'; }
    if (!wrap.querySelector('.field-error-msg')) {
      const msg = document.createElement('div');
      msg.className = 'field-error-msg';
      msg.textContent = 'هذا الحقل مطلوب';
      msg.style.cssText = 'color:var(--er);font-size:11px;font-weight:700;margin-top:3px';
      wrap.appendChild(msg);
    }
  }
  if (el) {
    el.style.borderColor = 'var(--er)';
    el.style.boxShadow = '0 0 0 3px rgba(198,40,40,.16)';
  }
}

function deleteRec(type, id, fromView) {
  showConfirm('هل تريد حذف هذا السجل نهائياً؟', async () => {
    const all = gdb(type);
    const target = all.find(r => r.id === id);
    if (!target) return;
    if (!Security.can('delete', target)) {
      alert('⛔ ليس لديك صلاحية حذف هذا السجل');
      return;
    }
    sdb(type, all.filter(r => r.id !== id));
    logAction('حذف', type, target);
    if (window.ActivityLogger) window.ActivityLogger.del(type, target);
    // Delta Sync — حذف من السحابة
    if (window.DeltaSyncManager) {
      DeltaSyncManager.deleteRecord(type, id, target.school).catch(() => {});
    }
    try { if (window.renderOpsLog) renderOpsLog(); } catch (e) { }
    if (fromView) closePV();
    buildTableHeaders(type);
    renderTbl(type);
    renderDashboard();
    renderSchools();
  });
}

/* ============================================================
 * دوال تصدير وتخصيص الحقول (Excel و PDF) والقوالب الافتراضية
 * ============================================================ */

function getExportableFields(type) {
  if (type === 'teach') {
    const list = [
      { id: 'fullName', label: 'الاسم الرباعي' },
      { id: 'school', label: 'المدرسة' },
      { id: 'jobRole', label: 'الوظيفة' },
      { id: 'degree', label: 'الشهادة' },
      { id: 'grade', label: 'الدرجة الوظيفية' },
      { id: 'subject', label: 'المادة / التخصص' },
      { id: 'attendance', label: 'حالة الدوام' },
      { id: 'phone', label: 'رقم الهاتف' },
      { id: 'dob', label: 'تاريخ الميلاد' },
      { id: 'gender', label: 'الجنس' },
      { id: 'targetStages', label: 'المراحل التدريسية' },
      { id: 'address', label: 'العنوان / السكن' },
      { id: 'notes', label: 'الملاحظات' }
    ];
    const configFields = typeof getFields === 'function' ? getFields('teach') : [];
    configFields.forEach(f => {
      if (['name1', 'name2', 'name3', 'name4', 'school', 'photo'].includes(f.id)) return;
      if (!list.some(item => item.id === f.id)) {
        list.push({ id: f.id, label: f.label || f.id });
      }
    });
    return list;
  }

  if (type === 'stud') {
    const list = [
      { id: 'fullName', label: 'الاسم الرباعي' },
      { id: 'school', label: 'المدرسة' },
      { id: 'academicYear', label: 'السنة الدراسية' },
      { id: 'stage', label: 'المرحلة الدراسية' },
      { id: 'gender', label: 'الجنس' },
      { id: 'dob', label: 'تاريخ الميلاد' },
      { id: 'talent', label: 'نوع الموهبة' },
      { id: 'gpa', label: 'المعدل' },
      { id: 'attendance', label: 'حالة الدوام' },
      { id: 'parentPhone', label: 'رقم هاتف ولي الأمر' },
      { id: 'studentPhone', label: 'رقم هاتف الطالب' },
      { id: 'address', label: 'العنوان / السكن' },
      { id: 'notes', label: 'الملاحظات' }
    ];
    const configFields = typeof getFields === 'function' ? getFields('stud') : [];
    configFields.forEach(f => {
      if (['name1', 'name2', 'name3', 'name4', 'school', 'photo'].includes(f.id)) return;
      if (!list.some(item => item.id === f.id)) {
        list.push({ id: f.id, label: f.label || f.id });
      }
    });
    return list;
  }

  if (type === 'archived') {
    const list = [
      { id: 'fullName', label: 'الاسم الرباعي' },
      { id: 'school', label: 'المدرسة' },
      { id: 'stage', label: 'آخر مرحلة دراسية' },
      { id: 'academicYear', label: 'السنة الدراسية للتخرج' },
      { id: 'archiveReason', label: 'سبب الأرشفة / التخرج' },
      { id: 'archiveDate', label: 'تاريخ الأرشفة' },
      { id: 'acceptedBy', label: 'الجهة المقبول بها' },
      { id: 'university', label: 'الجامعة' },
      { id: 'college', label: 'الكلية' },
      { id: 'department', label: 'القسم' },
      { id: 'admissionYear', label: 'سنة القبول' },
      { id: 'studyType', label: 'نوع الدراسة' },
      { id: 'gender', label: 'الجنس' },
      { id: 'dob', label: 'تاريخ الميلاد' },
      { id: 'talent', label: 'نوع الموهبة' },
      { id: 'gpa', label: 'المعدل' },
      { id: 'parentPhone', label: 'رقم هاتف ولي الأمر' },
      { id: 'studentPhone', label: 'رقم هاتف الطالب' },
      { id: 'address', label: 'العنوان / السكن' },
      { id: 'archiveNotes', label: 'ملاحظات الأرشفة' },
      { id: 'achievements', label: 'الإنجازات والمشاركات' },
      { id: 'notes', label: 'الملاحظات' }
    ];
    const configFields = typeof getFields === 'function' ? getFields('stud') : [];
    configFields.forEach(f => {
      if (['name1', 'name2', 'name3', 'name4', 'school', 'photo'].includes(f.id)) return;
      if (!list.some(item => item.id === f.id)) {
        list.push({ id: f.id, label: f.label || f.id });
      }
    });
    return list;
  }

  return [];
}

function getFieldValueForExport(r, fieldId) {
  if (fieldId === 'fullName') return fullName(r);
  if (fieldId === 'school') return r.school || '';
  let val = displayFieldValue(r, fieldId);
  if (Array.isArray(val)) val = val.join('، ');
  if (val === null || val === undefined) return '';
  return String(val);
}

function getFilteredExportData(type) {
  if (type === 'all') return null;
  if (type === 'archived') {
    const sc = document.getElementById('ar-sc')?.value || '';
    const yr = document.getElementById('ar-year')?.value || '';
    const q = (document.getElementById('ar-q')?.value || '').trim().toLowerCase();

    let list = gdata('stud').filter(r => (r.attendance || 'مستمر') === 'غير مستمر');
    if (sc) list = list.filter(r => r.school === sc);
    if (yr) list = list.filter(r => r.academicYear === yr);
    if (q) list = list.filter(r => fullName(r).toLowerCase().includes(q));
    list.sort(arabicSort);
    return list;
  }
  return gdata(type).filter(r => {
    if (ACTIVE_YEAR && type === 'stud' && r.academicYear !== ACTIVE_YEAR) return false;
    const sc = document.getElementById(type === 'teach' ? 'ft-sc' : 'fs-sc')?.value;
    if (sc && r.school !== sc) return false;
    const att = document.getElementById(type === 'teach' ? 'ft-att' : 'fs-att')?.value || '';
    if (att && (r.attendance || 'مستمر') !== att) return false;
    const q = document.getElementById(type === 'teach' ? 'ft-q' : 'fs-q')?.value?.toLowerCase() || '';
    if (q && !fullName(r).toLowerCase().includes(q)) return false;
    return true;
  });
}

function openExportModal(format, type) {
  const formatLabel = format === 'excel' ? 'Excel 📊' : 'PDF 📄';
  let typeLabel = 'كادر المدرسة';
  if (type === 'stud') typeLabel = 'الطلاب الموهوبين';
  if (type === 'archived') typeLabel = 'الطلاب الخريجون';
  if (type === 'all') typeLabel = 'جميع البيانات (الكادر والطلاب)';

  document.getElementById('modal-title').textContent = `⚙️ تخصيص حقول تصدير ${formatLabel} — ${typeLabel}`;

  const templateKey = `gft_export_tmpl_${format}_${type}`;
  let savedSelectedIds = null;
  try {
    const raw = localStorage.getItem(templateKey);
    if (raw) savedSelectedIds = JSON.parse(raw);
  } catch(e) {}

  let fieldsHtml = '';

  if (type === 'all') {
    const teachFields = getExportableFields('teach');
    const studFields = getExportableFields('stud');
    
    let savedTeachIds = savedSelectedIds?.teach || teachFields.map(f => f.id);
    let savedStudIds = savedSelectedIds?.stud || studFields.map(f => f.id);

    fieldsHtml = `
      <div style="margin-bottom:16px">
        <h4 style="font-weight:700;color:var(--pr-d);font-size:13.5px;margin-bottom:8px;border-bottom:2px solid var(--pr);padding-bottom:4px">
          👨‍🏫 حقول كادر المدرسة:
        </h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(160px, 1fr));gap:8px">
          ${teachFields.map(f => {
            const checked = savedTeachIds.includes(f.id) ? 'checked' : '';
            return `
              <label style="display:flex;align-items:center;gap:6px;background:var(--bg);padding:7px 10px;border:1px solid var(--bd);border-radius:6px;cursor:pointer;font-size:12.5px">
                <input type="checkbox" class="export-field-chk-teach" value="${f.id}" ${checked} style="accent-color:var(--pr)">
                <span>${f.label}</span>
              </label>
            `;
          }).join('')}
        </div>
      </div>

      <div style="margin-bottom:16px">
        <h4 style="font-weight:700;color:var(--pr-d);font-size:13.5px;margin-bottom:8px;border-bottom:2px solid var(--pr);padding-bottom:4px">
          🎓 حقول الطلاب الموهوبين:
        </h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(160px, 1fr));gap:8px">
          ${studFields.map(f => {
            const checked = savedStudIds.includes(f.id) ? 'checked' : '';
            return `
              <label style="display:flex;align-items:center;gap:6px;background:var(--bg);padding:7px 10px;border:1px solid var(--bd);border-radius:6px;cursor:pointer;font-size:12.5px">
                <input type="checkbox" class="export-field-chk-stud" value="${f.id}" ${checked} style="accent-color:var(--pr)">
                <span>${f.label}</span>
              </label>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } else {
    const fields = getExportableFields(type);
    let selectedIds = savedSelectedIds || fields.map(f => f.id);

    fieldsHtml = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(170px, 1fr));gap:8px;max-height:48vh;overflow-y:auto;padding-left:4px">
        ${fields.map(f => {
          const checked = selectedIds.includes(f.id) ? 'checked' : '';
          return `
            <label style="display:flex;align-items:center;gap:6px;background:var(--bg);padding:8px 10px;border:1px solid var(--bd);border-radius:6px;cursor:pointer;font-size:12.5px">
              <input type="checkbox" class="export-field-chk" value="${f.id}" ${checked} style="accent-color:var(--pr)">
              <span style="font-weight:500">${f.label}</span>
            </label>
          `;
        }).join('')}
      </div>
    `;
  }

  const hasTemplate = !!savedSelectedIds;
  const templateBadge = hasTemplate ? `<span class="badge b-teal" style="font-size:11px;margin-right:6px">تم تحميل القالب الافتراضي المحفوظ 💾</span>` : '';

  const bodyHtml = `
    <div style="direction:rtl;text-align:right;padding:4px">
      <div style="font-size:13px;color:var(--tx2);margin-bottom:10px;line-height:1.5">
        اختر الحقول التي ترغب في تضمينها في ملف الـ <strong>${format === 'excel' ? 'Excel' : 'PDF'}</strong>: ${templateBadge}
      </div>

      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
        <button type="button" class="btn btn-sm btn-sec" onclick="toggleAllExportFields(true)" style="font-size:11.5px;padding:3px 10px">☑️ تحديد الكل</button>
        <button type="button" class="btn btn-sm btn-sec" onclick="toggleAllExportFields(false)" style="font-size:11.5px;padding:3px 10px">☒ إلغاء تحديد الكل</button>
        <button type="button" class="btn btn-sm btn-sec" onclick="resetExportTemplate('${format}', '${type}')" style="font-size:11.5px;padding:3px 10px;color:#b91c1c">🗑️ مسح القالب</button>
      </div>

      ${fieldsHtml}

      <div style="margin-top:14px;background:var(--pr-l);border:1px solid var(--bd);padding:9px 12px;border-radius:8px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12.5px;font-weight:700;color:var(--pr-d);margin:0">
          <input type="checkbox" id="chk-save-export-template" checked style="width:16px;height:16px;accent-color:var(--pr)">
          💾 حفظ الحقول المحددة كقالب افتراضي لـ (${format === 'excel' ? 'Excel' : 'PDF'})
        </label>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
        <button type="button" class="btn btn-pr" onclick="confirmAndRunExport('${format}', '${type}')" style="padding:7px 20px;font-weight:700;font-size:13.5px">
          🚀 تصدير الآن (${format === 'excel' ? 'Excel' : 'PDF'})
        </button>
        <button type="button" class="btn btn-sec" onclick="closeModal()">إلغاء</button>
      </div>
    </div>
  `;

  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal').classList.add('open');
}

function toggleAllExportFields(status) {
  const chks = document.querySelectorAll('.export-field-chk, .export-field-chk-teach, .export-field-chk-stud');
  chks.forEach(cb => cb.checked = !!status);
}

function resetExportTemplate(format, type) {
  const templateKey = `gft_export_tmpl_${format}_${type}`;
  localStorage.removeItem(templateKey);
  openExportModal(format, type);
}

function confirmAndRunExport(format, type) {
  const saveTemplate = document.getElementById('chk-save-export-template')?.checked;

  if (type === 'all') {
    const teachChks = Array.from(document.querySelectorAll('.export-field-chk-teach:checked')).map(c => c.value);
    const studChks = Array.from(document.querySelectorAll('.export-field-chk-stud:checked')).map(c => c.value);

    if (teachChks.length === 0 && studChks.length === 0) {
      alert('⚠️ يرجى اختيار حقل واحد على الأقل للتصدير');
      return;
    }

    const payload = { teach: teachChks, stud: studChks };

    if (saveTemplate) {
      localStorage.setItem(`gft_export_tmpl_${format}_${type}`, JSON.stringify(payload));
    }

    closeModal();
    if (format === 'excel') doExportExcel('all', payload);
    else doExportPDF('all', payload);
  } else {
    const chks = Array.from(document.querySelectorAll('.export-field-chk:checked')).map(c => c.value);
    if (chks.length === 0) {
      alert('⚠️ يرجى اختيار حقل واحد على الأقل للتصدير');
      return;
    }

    if (saveTemplate) {
      localStorage.setItem(`gft_export_tmpl_${format}_${type}`, JSON.stringify(chks));
    }

    closeModal();
    if (format === 'excel') doExportExcel(type, chks);
    else doExportPDF(type, chks);
  }
}

function exportPDF(type, selectedFields) {
  if (!selectedFields) {
    openExportModal('pdf', type);
    return;
  }
  doExportPDF(type, selectedFields);
}

function exportExcel(type, selectedFields) {
  if (!selectedFields) {
    openExportModal('excel', type);
    return;
  }
  doExportExcel(type, selectedFields);
}

function doExportPDF(type, selectedFields) {
  const isArchived = type === 'archived';
  const archYr = isArchived ? document.getElementById('ar-year')?.value : '';
  const yearLabel = isArchived 
    ? (archYr ? ` — السنة الدراسية ${archYr}` : '') 
    : (ACTIVE_YEAR ? ` — السنة الدراسية ${ACTIVE_YEAR}` : '');
  const logoSrc = (typeof window !== 'undefined' && window.GIFTED_OFFICIAL_LOGO) ? window.GIFTED_OFFICIAL_LOGO : '';

  const renderPdfTableSection = (sType, fieldIds) => {
    const data = getFilteredExportData(sType) || gdata(sType);
    const availableFields = getExportableFields(sType);
    const activeFieldDefs = availableFields.filter(f => fieldIds.includes(f.id));
    let title = 'تقرير كادر المدرسة والتدريسيين';
    if (sType === 'stud') title = 'تقرير الطلاب الموهوبين';
    if (sType === 'archived') title = 'تقرير الطلاب الخريجين';

    const headerCells = `<th style="padding:8px;background:#00695C;color:#fff;font-size:11px;border:1px solid #005548;width:30px;text-align:center">#</th>` +
      activeFieldDefs.map(f => `<th style="padding:8px;background:#00695C;color:#fff;font-size:11px;border:1px solid #005548;white-space:nowrap">${f.label}</th>`).join('');

    const tableRows = data.map((r, i) => {
      const cells = activeFieldDefs.map(f => {
        const v = getFieldValueForExport(r, f.id) || '—';
        return `<td style="padding:6px 8px;border:1px solid #ddd;font-size:11px">${v}</td>`;
      }).join('');
      return `<tr><td style="padding:6px 8px;border:1px solid #ddd;font-size:11px;text-align:center">${i + 1}</td>${cells}</tr>`;
    }).join('');

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #00695C;padding-bottom:12px;margin-bottom:16px;margin-top:16px;">
        <div style="text-align:right">
          <div style="font-size:13px;font-weight:800;color:#00695C">جمهورية العراق — وزارة التربية</div>
          <div style="font-size:12px;font-weight:700;color:#1a3a5c;margin-top:2px">هيأة رعاية الموهوبين</div>
          <div style="font-size:11px;color:#475569;margin-top:2px">${title}</div>
        </div>
        <div style="text-align:center">
          ${logoSrc ? `<img src="${logoSrc}" alt="شعار هيأة رعاية الموهوبين" style="width:52px;height:52px;object-fit:contain;border-radius:50%"/>` : ''}
          <div style="font-size:15px;font-weight:900;color:#00695C;margin-top:4px">${title}${yearLabel}</div>
        </div>
        <div style="text-align:left;font-size:10px;color:#64748b">
          <div><strong>إجمالي السجلات:</strong> ${data.length}</div>
          <div style="margin-top:2px"><strong>تاريخ التصدير:</strong> ${new Date().toLocaleDateString('ar-IQ')}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    `;
  };

  let bodyContent = '';
  let docTitle = '';

  if (type === 'all') {
    docTitle = 'جميع البيانات';
    const teachIds = selectedFields?.teach || getExportableFields('teach').map(f => f.id);
    const studIds = selectedFields?.stud || getExportableFields('stud').map(f => f.id);

    bodyContent = renderPdfTableSection('teach', teachIds) + renderPdfTableSection('stud', studIds);
  } else {
    docTitle = type === 'teach' ? 'كادر المدرسة' : (type === 'archived' ? 'الطلاب الخريجون' : 'الطلاب الموهوبون');
    const fieldIds = Array.isArray(selectedFields) ? selectedFields : getExportableFields(type).map(f => f.id);
    bodyContent = renderPdfTableSection(type, fieldIds);
  }

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
    <title>${docTitle}${yearLabel}</title>
    <style>
      body{font-family:'Cairo',Tahoma,sans-serif;direction:rtl;font-size:12px;margin:20px}
      table{width:100%;border-collapse:collapse}
      tr:nth-child(even) td{background:#f5f5f5}
      @media print{body{margin:0}}
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
  </head><body>
    ${bodyContent}
    <script>window.onload=()=>{window.print();}<\/script>
  </body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
  else { alert('يرجى السماح بفتح نوافذ منبثقة لتصدير PDF'); }
}

async function doExportExcel(type, selectedFields) {
  // المحاولة بالأولوية باستخدام ExcelJS
  if (typeof ExcelJS !== 'undefined') {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'نظام هيأة رعاية الموهوبين';
      workbook.created = new Date();

      const addExcelJSSheet = (sname, sType, fieldIds) => {
        const worksheet = workbook.addWorksheet(sname, {
          views: [{ rightToLeft: true, showGridLines: true, state: 'frozen', xSplit: 0, ySplit: 1 }]
        });

        const data = getFilteredExportData(sType) || gdata(sType);
        const availableFields = getExportableFields(sType);
        const activeFieldDefs = availableFields.filter(f => fieldIds.includes(f.id));

        const hdrs = ['#', ...activeFieldDefs.map(f => f.label)];
        const tableColumns = hdrs.map(h => ({ name: h, filterButton: true }));

        const tableRows = data.map((r, i) => [
          String(i + 1),
          ...activeFieldDefs.map(f => getFieldValueForExport(r, f.id))
        ]);

        const safeTableName = 'Table_' + (sType === 'teach' ? 'Teachers' : sType === 'archived' ? 'Archived' : 'Students') + '_' + Math.floor(Math.random() * 10000);

        worksheet.addTable({
          name: safeTableName,
          ref: 'A1',
          headerRow: true,
          totalsRow: false,
          style: {
            theme: 'TableStyleMedium9',
            showRowStripes: true,
          },
          columns: tableColumns,
          rows: tableRows,
        });

        hdrs.forEach((h, ci) => {
          let maxLen = h.length;
          tableRows.forEach(r => {
            const v = String(r[ci] || '');
            if (v.length > maxLen) maxLen = v.length;
          });
          const col = worksheet.getColumn(ci + 1);
          col.width = Math.min(Math.max(maxLen + 4, 12), 48);
        });

        const rowCount = tableRows.length + 1;
        const colCount = hdrs.length;

        const headerRow = worksheet.getRow(1);
        headerRow.height = 28;
        for (let c = 1; c <= colCount; c++) {
          const cell = headerRow.getCell(c);
          cell.font = { name: 'Cairo', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00695C' } };
          cell.alignment = { horizontal: c === 1 ? 'center' : 'right', vertical: 'middle', wrapText: true };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFB0C4D0' } },
            left: { style: 'thin', color: { argb: 'FFB0C4D0' } },
            bottom: { style: 'medium', color: { argb: 'FF004D40' } },
            right: { style: 'thin', color: { argb: 'FFB0C4D0' } }
          };
        }

        for (let r = 2; r <= rowCount; r++) {
          const row = worksheet.getRow(r);
          row.height = 22;
          const isEven = (r % 2 === 0);
          const bgArgb = isEven ? 'FFEAF4F1' : 'FFFFFFFF';

          for (let c = 1; c <= colCount; c++) {
            const cell = row.getCell(c);
            cell.font = { name: 'Cairo', size: 10.5 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
            cell.alignment = { horizontal: c === 1 ? 'center' : 'right', vertical: 'middle' };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
            };
          }
        }
      };

      if (type === 'teach' || type === 'all') {
        const teachIds = (type === 'all' ? selectedFields?.teach : selectedFields) || getExportableFields('teach').map(f => f.id);
        addExcelJSSheet('كادر المدرسة', 'teach', teachIds);
      }
      if (type === 'stud' || type === 'all') {
        const studIds = (type === 'all' ? selectedFields?.stud : selectedFields) || getExportableFields('stud').map(f => f.id);
        addExcelJSSheet('الطلاب الموهوبون', 'stud', studIds);
      }
      if (type === 'archived') {
        const archIds = selectedFields || getExportableFields('archived').map(f => f.id);
        addExcelJSSheet('الطلاب الخريجون', 'archived', archIds);
      }

      const fname = (type === 'all' ? 'كل_البيانات' : type === 'teach' ? 'كادر_المدرسة' : type === 'archived' ? 'الطلاب_الخريجون' : 'الطلاب') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      return;
    } catch (err) {
      console.warn('ExcelJS export error, falling back to XLSX:', err);
    }
  }

  // Fallback XLSX
  if (typeof XLSX === 'undefined') { alert('مكتبة Excel لم تُحمَّل بعد، أعد المحاولة.'); return; }
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  const bdr = { style: 'thin', color: { rgb: 'B0C4D0' } };
  const borders = { top: bdr, bottom: bdr, left: bdr, right: bdr };
  const hdrStyle = { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 14, name: 'Arial' }, fill: { fgColor: { rgb: '00695C' } }, alignment: { horizontal: 'right', vertical: 'center', wrapText: true, readingOrder: 2 }, border: borders };
  const evenStyle = { font: { sz: 13, name: 'Arial' }, fill: { fgColor: { rgb: 'EAF4F1' } }, alignment: { horizontal: 'right', vertical: 'center', readingOrder: 2 }, border: borders };
  const oddStyle = { font: { sz: 13, name: 'Arial' }, fill: { fgColor: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'right', vertical: 'center', readingOrder: 2 }, border: borders };

  function addSheet(sname, sType, fieldIds) {
    const ws = {};
    const data = getFilteredExportData(sType) || gdata(sType);
    const availableFields = getExportableFields(sType);
    const activeFieldDefs = availableFields.filter(f => fieldIds.includes(f.id));

    const hdrs = ['#', ...activeFieldDefs.map(f => f.label)];
    const rows = data.map((r, i) => [
      i + 1,
      ...activeFieldDefs.map(f => getFieldValueForExport(r, f.id))
    ]);

    const rng = { s: { c: 0, r: 0 }, e: { c: hdrs.length - 1, r: rows.length } };
    hdrs.forEach((h, ci) => { ws[XLSX.utils.encode_cell({ r: 0, c: ci })] = { v: h, t: 's', s: hdrStyle }; });
    rows.forEach((row, ri) => {
      const rStyle = (ri % 2 === 0) ? oddStyle : evenStyle;
      row.forEach((val, ci) => {
        const s = ci === 0 ? { ...rStyle, alignment: { horizontal: 'center', vertical: 'center' } } : rStyle;
        ws[XLSX.utils.encode_cell({ r: ri + 1, c: ci })] = { v: String(val == null ? '' : val), t: 's', s };
      });
    });
    const colWidths = hdrs.map((h, ci) => {
      let max = h.length + 3;
      rows.forEach(row => { const v = String(row[ci] == null ? '' : row[ci]); if (v.length > max) max = v.length; });
      return { wch: Math.min(Math.max(max, 8), 42) };
    });
    ws['!ref'] = XLSX.utils.encode_range(rng);
    ws['!autofilter'] = { ref: XLSX.utils.encode_range(rng) };
    ws['!cols'] = colWidths;
    ws['!rows'] = [{ hpt: 28 }, ...rows.map(() => ({ hpt: 20 }))];
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };
    ws['!views'] = [{ RTL: true, rightToLeft: true }];
    ws['!sheetView'] = { rightToLeft: true, showGridLines: true };
    XLSX.utils.book_append_sheet(wb, ws, sname);
  }

  if (type === 'teach' || type === 'all') {
    const teachIds = (type === 'all' ? selectedFields?.teach : selectedFields) || getExportableFields('teach').map(f => f.id);
    addSheet('كادر المدرسة', 'teach', teachIds);
  }
  if (type === 'stud' || type === 'all') {
    const studIds = (type === 'all' ? selectedFields?.stud : selectedFields) || getExportableFields('stud').map(f => f.id);
    addSheet('الطلاب الموهوبون', 'stud', studIds);
  }
  if (type === 'archived') {
    const archIds = selectedFields || getExportableFields('archived').map(f => f.id);
    addSheet('الطلاب الخريجون', 'archived', archIds);
  }

  const fname = (type === 'all' ? 'كل_البيانات' : type === 'teach' ? 'كادر_المدرسة' : type === 'archived' ? 'الطلاب_الخريجون' : 'الطلاب') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
  XLSX.writeFile(wb, fname);
}

function exportCSV(type) {
  const fields = visibleFields(type);
  const hdrs = ['#', 'الاسم الرباعي', 'المدرسة', ...fields.filter(f => f.id !== 'name1' && f.id !== 'name2' && f.id !== 'name3' && f.id !== 'name4' && f.id !== 'school').map(f => f.label)];
  const rows = gdata(type).map((r, i) => [i + 1, fullName(r), r.school || '', ...fields.filter(f => f.id !== 'name1' && f.id !== 'name2' && f.id !== 'name3' && f.id !== 'name4' && f.id !== 'school').map(f => r[f.id] || '')]);
  const csv = '\uFEFF' + [hdrs, ...rows].map(r => r.map(c => '"' + String(c || '').replace(/"/g, '""') + '"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = (type === 'emp' ? 'الموظفون' : type === 'teach' ? 'التدريسيون' : 'الطلاب') + '_' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function loadSample() {
  const teaches = [
    { id: nid(), name1: 'أحمد', name2: 'محمد', name3: 'حسين', name4: 'الجبوري', nid: '19721234567', dob: '1972-05-14', school: 'بغداد', jobRole: 'إداري', spec: 'إدارة تربوية', degree: 'ماجستير', grade: 'مدير', hire: '2002-09-01', phone: '07901234567', email: 'ahmed@gifted.edu.iq', address: 'بغداد / الكرخ / حي الجامعة', attendance: 'مستمر', ts: Date.now() },
    { id: nid(), name1: 'فاطمة', name2: 'حسن', name3: 'جاسم', name4: 'النجار', nid: '19761234569', dob: '1976-09-10', school: 'النجف', jobRole: 'إداري', spec: 'تربية وعلم نفس', degree: 'دكتوراه', grade: 'مدير', hire: '2006-09-01', phone: '07701234569', address: 'النجف / المركز', attendance: 'مستمر', ts: Date.now() },
    { id: nid(), name1: 'ليلى', name2: 'صالح', name3: 'محمود', name4: 'العبيدي', nid: '19781234575', dob: '1978-03-15', school: 'بغداد', jobRole: 'تدريسي', subject: 'رياضيات', targetStages: ['الأول متوسط', 'الثاني متوسط'], spec: 'رياضيات تطبيقية', degree: 'ماجستير', grade: 'مدرس ممتاز', hire: '2008-09-01', phone: '07901234575', email: 'layla@gifted.edu.iq', address: 'بغداد / الكرخ', attendance: 'مستمر', achievements: 'بحثان منشوران', ts: Date.now() }
  ];
  const studs = [
    { id: nid(), name1: 'محمد', name2: 'أمير', name3: 'سلام', name4: 'الهاشمي', dob: '2007-03-14', gender: 'ذكر', school: 'بغداد', academicYear: '2024-2025', stage: 'السادس الإعدادي', talent: 'رياضيات', gpa: '98.7', parentPhone: '07901112233', address: 'بغداد / الكرخ', attendance: 'مستمر', achievements: 'المركز الأول أولمبياد الرياضيات', ts: Date.now() },
    { id: nid(), name1: 'سارة', name2: 'حسن', name3: 'جليل', name4: 'المالكي', dob: '2008-07-22', gender: 'أنثى', school: 'النجف', academicYear: '2024-2025', stage: 'الخامس الإعدادي', talent: 'علوم طبيعية', gpa: '97.2', parentPhone: '07811112234', address: 'النجف', attendance: 'مستمر', achievements: 'جائزة العلوم المحافظة', ts: Date.now() }
  ];
  sdb('teach', teaches);
  sdb('stud', studs);
  renderDashboard();
  ['teach', 'stud'].forEach(t => { buildTableHeaders(t); renderTbl(t); });
  renderSchools();
  renderBkStats();
  alert('تم تحميل البيانات التجريبية بنجاح');
}

function clearAll() {
  sdb('teach', []);
  sdb('stud', []);
  renderDashboard();
  ['teach', 'stud'].forEach(t => { buildTableHeaders(t); renderTbl(t); });
  renderSchools();
  renderBkStats();
}

function renderBkStats() {
  const tc = gdata('teach').length, sc = gdata('stud').length;
  const el = document.getElementById('bk-stats');
  if (el) el.textContent = `كادر المدرسة: ${tc} · الطلاب: ${sc} · الإجمالي: ${tc + sc} سجل`;
}

function exportFullBackup() {
  const school = CU?.school || 'all';
  const teachData = CU?.school ? gdb('teach').filter(r => r.school === CU.school) : gdb('teach');
  const studData = CU?.school ? gdb('stud').filter(r => r.school === CU.school) : gdb('stud');
  const schoolInfoData = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('gft_si_')) {
      try { schoolInfoData[key] = JSON.parse(localStorage.getItem(key) || '{}'); } catch { schoolInfoData[key] = {}; }
    }
  }
  const payload = {
    _version: 'v11', _date: new Date().toISOString(), _school: school,
    teach: teachData, stud: studData,
    fields_teach: JSON.stringify(CONFIG_DATA.fields.teach || []),
    fields_stud: JSON.stringify(CONFIG_DATA.fields.stud || []),
    fields_emp: null,
    schools: CU?.isAdmin ? localStorage.getItem('gft_schools_list') || null : null,
    targets: CU?.isAdmin ? localStorage.getItem('gft_targets') || null : null,
    users: localStorage.getItem('gft_users') || null,
    usernames: localStorage.getItem('gft_usernames') || null,
    users_map: localStorage.getItem('gft_users_map') || null,
    school_info_fields: JSON.stringify(CONFIG_DATA.schoolInfoFields || []),
    school_info_data: Object.keys(schoolInfoData).length ? schoolInfoData : null,
    sync_config: localStorage.getItem(SYNC_CONFIG_KEY) || null,
    sync_queue: localStorage.getItem(SYNC_QUEUE_KEY) || null,
    sync_log: localStorage.getItem(SYNC_LOG_KEY) || null,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `نسخة_احتياطية_${school}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  const msgEl = document.getElementById('backup-restore-msg');
  if (msgEl) { msgEl.innerHTML = `<div class="alert a-ok">✅ تم تنزيل النسخة الاحتياطية — احفظها في مكان آمن (USB أو حاسبة)</div>`; setTimeout(() => msgEl.innerHTML = '', 5000); }
}

function importFullBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';
  const msgEl = document.getElementById('backup-restore-msg');
  showConfirm('هل تريد استرجاع البيانات من هذه النسخة؟ سيتم دمج البيانات مع الموجود (لا يُحذف شيء).', () => {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data._version) throw new Error('الملف ليس نسخة احتياطية صالحة من هذا النظام');
        let addedT = 0, updT = 0, addedS = 0, updS = 0;
        (['teach', 'stud']).forEach(tp => {
          if (!data[tp] || !Array.isArray(data[tp])) return;
          const existing = gdb(tp);
          const idMap = {};
          existing.forEach((r, i) => idMap[r.id] = i);
          data[tp].forEach(r => {
            if (CU?.school && r.school && r.school !== CU.school) return;
            if (idMap[r.id] !== undefined) {
              existing[idMap[r.id]] = { ...existing[idMap[r.id]], ...r };
              tp === 'teach' ? updT++ : updS++;
            } else {
              existing.push({ ...r, ts: r.ts || Date.now() });
              tp === 'teach' ? addedT++ : addedS++;
            }
          });
          sdb(tp, existing);
        });
        if (CU?.isAdmin) {
          if (data.schools) localStorage.setItem('gft_schools_list', data.schools);
          if (data.targets) localStorage.setItem('gft_targets', data.targets);
          if (data.fields_teach) saveFields('teach', JSON.parse(data.fields_teach));
          if (data.fields_stud) saveFields('stud', JSON.parse(data.fields_stud));
          if (data.school_info_fields) saveSchoolInfoFields(JSON.parse(data.school_info_fields));
          refreshAllSchoolSelects();
        }
        if (data.users) localStorage.setItem('gft_users', data.users);
        if (data.usernames) localStorage.setItem('gft_usernames', data.usernames);
        if (data.users_map) localStorage.setItem('gft_users_map', data.users_map);
        if (data.sync_config) localStorage.setItem(SYNC_CONFIG_KEY, data.sync_config);
        if (data.sync_queue) localStorage.setItem(SYNC_QUEUE_KEY, data.sync_queue);
        if (data.sync_log) localStorage.setItem(SYNC_LOG_KEY, data.sync_log);
        if (data.school_info_data && typeof data.school_info_data === 'object') {
          Object.entries(data.school_info_data).forEach(([key, val]) => {
            if (key && key.startsWith('gft_si_')) {
              localStorage.setItem(key, JSON.stringify(val || {}));
            }
          });
        }
        ['teach', 'stud'].forEach(t => { buildTableHeaders(t); renderTbl(t); });
        renderDashboard();
        renderBkStats();
        const bkDate = data._date ? new Date(data._date).toLocaleDateString('ar-IQ') : '';
        if (msgEl) msgEl.innerHTML = `<div class="alert a-ok">✅ تم الاسترجاع — كادر: أُضيف ${addedT} وحُدِّث ${updT} · طلاب: أُضيف ${addedS} وحُدِّث ${updS}${bkDate ? ' · من نسخة ' + bkDate : ''}</div>`;
        setTimeout(() => { if (msgEl) msgEl.innerHTML = ''; }, 7000);
      } catch (err) {
        if (msgEl) msgEl.innerHTML = `<div class="alert a-er">❌ خطأ: ${err.message}</div>`;
      }
    };
    reader.readAsText(file, 'utf-8');
  });
}

function toggleSidebar() { document.querySelector('.sidebar').classList.toggle('open'); }

// ==================== إدارة المظهر والوضع الليلي (Dark Mode) ====================
function getSavedTheme() {
  return localStorage.getItem('gft_theme') || 'auto';
}

function applyThemeMode(mode) {
  if (!mode) mode = getSavedTheme();
  const root = document.documentElement;
  root.setAttribute('data-theme', mode);

  const iconEl = document.getElementById('theme-toggle-icon');
  const labelEl = document.getElementById('theme-toggle-label');
  const btnEl = document.getElementById('theme-toggle-btn');

  if (iconEl && labelEl) {
    if (mode === 'dark') {
      iconEl.textContent = '🌙';
      labelEl.textContent = 'ليلي';
      if (btnEl) btnEl.title = 'المظهر الحالي: ليلي (انقر للتبديل إلى نهاري)';
    } else if (mode === 'light') {
      iconEl.textContent = '☀️';
      labelEl.textContent = 'نهاري';
      if (btnEl) btnEl.title = 'المظهر الحالي: نهاري (انقر للتبديل إلى تلقائي/النظام)';
    } else {
      const isSystemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      iconEl.textContent = '🌓';
      labelEl.textContent = 'تلقائي';
      if (btnEl) btnEl.title = `المظهر الحالي: تلقائي حسب النظام (${isSystemDark ? 'ليلي' : 'نهاري'}) — انقر للتبديل إلى ليلي`;
    }
  }
}

function cycleTheme() {
  const current = getSavedTheme();
  let next = 'dark';
  if (current === 'auto') next = 'dark';
  else if (current === 'dark') next = 'light';
  else if (current === 'light') next = 'auto';

  localStorage.setItem('gft_theme', next);
  applyThemeMode(next);

  if (typeof showToast === 'function') {
    const labels = { dark: 'الوضع الليلي 🌙', light: 'الوضع النهاري ☀️', auto: 'الوضع التلقائي (حسب النظام) 🌓' };
    showToast('تم تغيير المظهر إلى: ' + labels[next], 'info');
  }
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getSavedTheme() === 'auto') {
      applyThemeMode('auto');
    }
  });
}

function initApp() {
  applyThemeMode();
  ConfigManager.load();
  StorageManager.initDB().then(() => { });
  AutoSaveSystem.start();

  populateFilters();
  populateYearSelectors();

  const _ftAtt = document.getElementById('ft-att'); if (_ftAtt) _ftAtt.value = 'مستمر';
  const _fsAtt = document.getElementById('fs-att'); if (_fsAtt) _fsAtt.value = 'مستمر';
  const _fsYear = document.getElementById('fs-year'); if (_fsYear && ACTIVE_YEAR) _fsYear.value = ACTIVE_YEAR;

  // تحديث تسمية حقل الوظيفة إذا كانت محملة كـ "نوع الوظيفة"
  if (window.FIELD_CONFIG && Array.isArray(window.FIELD_CONFIG.staff)) {
    const jr = window.FIELD_CONFIG.staff.find(f => f.id === 'jobRole');
    if (jr && (jr.label === 'نوع الوظيفة' || !jr.label)) jr.label = 'الوظيفة';
  }
  if (window.CORE_FIELDS && Array.isArray(CORE_FIELDS.teach)) {
    const jr = CORE_FIELDS.teach.find(f => f.id === 'jobRole');
    if (jr && (jr.label === 'نوع الوظيفة' || !jr.label)) jr.label = 'الوظيفة';
  }

  renderDashboard();
  buildTableHeaders('teach');
  buildTableHeaders('stud');
  const _cv = document.getElementById('cfg-version'); if (_cv) _cv.textContent = CONFIG_DATA.version || '5.0.0';
  const _cu = document.getElementById('cfg-updated-at'); if (_cu) _cu.textContent = CONFIG_DATA.updatedAt ? new Date(CONFIG_DATA.updatedAt).toLocaleDateString('ar-IQ') : 'لم يُحدَّث بعد';
  renderTbl('teach');
  renderTbl('stud');
  renderSchools();
  renderAccounts();
  renderBkStats();
  document.getElementById('dash-date').textContent = new Date().toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  if (CU?.school) {
    document.getElementById('dash-sub').textContent = 'بيانات مدرسة ' + CU.school;
    const sl = document.getElementById('sync-school-label');
    if (sl) sl.value = CU.school;
  } else {
    const sl = document.getElementById('sync-school-label');
    if (sl) sl.value = CU?.isAdmin ? 'جميع المدارس' : '';
  }
  const syncUrlEl = document.getElementById('sync-url');
  const syncTokenEl = document.getElementById('sync-token');
  const syncSaveBtn = document.querySelector('button[onclick="saveSyncConfig()"]');
  if (syncUrlEl) syncUrlEl.removeAttribute('readonly');
  if (syncTokenEl) syncTokenEl.removeAttribute('readonly');
  if (syncSaveBtn) syncSaveBtn.disabled = false;
  document.querySelectorAll('.admin-only').forEach(el => {
    if (CU && CU.isAdmin) {
      const tag = el.tagName ? el.tagName.toUpperCase() : '';
      if (tag === 'BUTTON' || tag === 'A' || el.classList.contains('btn') || el.classList.contains('badge')) {
        el.style.display = 'inline-flex';
      } else if (el.classList.contains('ni') || el.classList.contains('two') || el.style.flexDirection === 'row') {
        el.style.display = 'flex';
      } else {
        el.style.display = (tag === 'DIV' || tag === 'SECTION' || tag === 'FORM') ? 'block' : '';
      }
    } else {
      el.style.display = 'none';
    }
  });
  updateMyCredBadge();
  if (CU?.isAdmin) { renderFieldMgr(); renderSchoolsMgmt(); renderDataEntryStatus(); }
  renderCompletionBars();
  initSyncEngine();
  if (window.CloudConfigManager) {
    const cc = CloudConfigManager.loadConnectionConfig();
    if (cc.url) {
      CloudConfigManager.init(cc.url, cc.token);
      CloudConfigManager.fetchAllConfig().then(() => {
        if (CU?.isAdmin) renderFieldMgr();
        buildTableHeaders('teach');
        buildTableHeaders('stud');
        renderTbl('teach');
        renderTbl('stud');
        if (CU?.school) renderSchoolInfoPage();
      }).catch(err => console.warn('[CentralSchema] cloud load failed:', err));
    }
  }
  if (CU?.school) renderSchoolInfoPage();

  setTimeout(() => autoImportFromSupabase(), 600);
  // تهيئة البحث المُبطّأ (debounce) للأداء مع 5000+ سجل
  setTimeout(() => {
    if (window.PerformanceManager) PerformanceManager.initDebouncedSearch();
  }, 500);
}

async function autoImportFromSupabase() {
  const cfg = getSyncConfig?.();
  if (!cfg || !cfg.url || !cfg.token || !navigator.onLine) return;
  try {
    if (window.showToast) {
      window.showToast('🔄 جاري استرجاع ومزامنة البيانات من Supabase عند بدء التشغيل...', 'info', 2500);
    }
    await CloudSyncManager.restoreFromSupabase({ auto: true });
    if (window.addSyncLog) addSyncLog('🔄 تم استرجاع ومزامنة أحدث البيانات من Supabase بنجاح', 'info');
  } catch (e) {
    console.warn('[AutoImport] فشل الاستيراد التلقائي من Supabase:', e);
  }
}
async function autoImportFromSheets() { return autoImportFromSupabase(); }

function updatePendingBadge() { QueueManager.updateBadge(); }

// ربط الأحداث
document.addEventListener('DOMContentLoaded', () => {
  applyThemeMode();
  const lp = document.getElementById('lp');
  if (lp) {
    lp.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  }
});

// تصدير الإعدادات محمّلةً داخل ملف HTML
function exportUpdatedHTML() {
  if (!CU || !CU.isAdmin) { alert('⛔ هذه الوظيفة للأدمن فقط'); return; }
  try {
    const usersJson = localStorage.getItem('gft_users') || '{}';
    const usernamesJson = localStorage.getItem('gft_usernames') || '{}';
    const usersMapJson = localStorage.getItem('gft_users_map') || '{}';
    const fieldsTeach = JSON.stringify(getFields('teach') || []);
    const fieldsStud = JSON.stringify(getFields('stud') || []);
    const schoolsList = JSON.stringify(getSchoolsList() || []);
    const siFields = JSON.stringify(typeof getSchoolInfoFields === 'function' ? getSchoolInfoFields() : []);
    const configVersion = CONFIG_DATA.version || '5.0.0';
    const exportNote = `\n<!-- EXPORTED: ${new Date().toISOString()} by ${CU.username} | v${configVersion} -->\n`;
    fetch(window.location.href)
      .then(r => r.text())
      .then(html => {
        let updated = html;
        // حقن بيانات الإعداد كإعدادات افتراضية في السكريبت
        const injectScript = `<script id="gft-exported-config">
(function(){
  try {
    if (!localStorage.getItem('gft_users')) localStorage.setItem('gft_users', ${JSON.stringify(usersJson)});
    if (!localStorage.getItem('gft_usernames')) localStorage.setItem('gft_usernames', ${JSON.stringify(usernamesJson)});
    if (!localStorage.getItem('gft_users_map')) localStorage.setItem('gft_users_map', ${JSON.stringify(usersMapJson)});
    if (!localStorage.getItem('gft_schools_list')) localStorage.setItem('gft_schools_list', ${JSON.stringify(schoolsList)});
  } catch(e) {}
})();
<\/script>`;
        // أضف السكريبت قبل السكريبتات الرئيسية
        updated = updated.replace('<script src="js/config.js">', injectScript + '\n<script src="js/config.js">');
        updated = '<!-- ' + exportNote + ' -->\n' + updated;
        const blob = new Blob([updated], { type: 'text/html;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `نظام_الموهوبين_v${configVersion}_${new Date().toISOString().slice(0,10)}.html`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        alert('✅ تم تصدير الملف بنجاح! احفظه مع مجلد js/');
      })
      .catch(() => alert('⚠️ تعذّر تصدير الملف. جرّب تشغيل النظام محلياً.'));
  } catch(e) { alert('خطأ: ' + e.message); }
}
window.exportUpdatedHTML = exportUpdatedHTML;

// حفظ المصادقة العامة
window.CU = () => CU;
window.gdb = gdb;
window.sdb = sdb;
window.gdata = gdata;
window.fullName = fullName;
window.nid = nid;
window.refreshAll = refreshAll;
window.getSavedTheme = getSavedTheme;
window.applyThemeMode = applyThemeMode;
window.cycleTheme = cycleTheme;
window.visibleFields = visibleFields;
window.getFields = getFields;
window.saveFields = saveFields;
window.getSchoolsList = getSchoolsList;
window.saveSchoolsList = saveSchoolsList;
window.getSubjects = getSubjects;
window.saveSubjects = saveSubjects;
window.getCurrentAcademicYear = getCurrentAcademicYear;
window.nav = nav;
window.doLogin = doLogin;
window.doLogout = doLogout;
window.saveModal = saveModal;
window.closeModal = closeModal;
window.deleteRec = deleteRec;
window.openAdd = openAdd;
window.openEdit = openEdit;
window.openView = openView;
window.sortTable = sortTable;
window.exportPDF = exportPDF;
window.exportExcel = exportExcel;
window.doExportPDF = doExportPDF;
window.exportCurrentSchoolReportPDF = exportCurrentSchoolReportPDF;
window.doExportExcel = doExportExcel;
window.openExportModal = openExportModal;
window.toggleAllExportFields = toggleAllExportFields;
window.resetExportTemplate = resetExportTemplate;
window.confirmAndRunExport = confirmAndRunExport;
window.exportCSV = exportCSV;
window.loadSample = loadSample;
window.clearAll = clearAll;
window.showConfirm = showConfirm;
window.closeConfirm = closeConfirm;
window.saveTargets = saveTargets;
window.addSchool = addSchool;
window.removeSchool = removeSchool;
window.resetSchools = resetSchools;
window.saveSyncConfig = saveSyncConfig;
window.syncNow = syncNow;
window.flushQueue = flushQueue;
window.sendToSheets = sendToSheets;
window.clearSyncLog = clearSyncLog;
window.exportFullBackup = exportFullBackup;
window.importFullBackup = importFullBackup;
window.toggleSidebar = toggleSidebar;
window.renderSchoolInfoPage = renderSchoolInfoPage;
window.pullSchoolInfoFromSupabase = pullSchoolInfoFromSupabase;
window.uploadSchoolInfoToSupabase = uploadSchoolInfoToSupabase;
window.saveSchoolInfo = saveSchoolInfo;
window.renderFieldMgr = renderFieldMgr;
window.ensureFieldConfigLoaded = ensureFieldConfigLoaded;
window.syncFieldConfigFromUI = syncFieldConfigFromUI;
window.downloadFieldConfigJS = downloadFieldConfigJS;
window.downloadFieldConfigBackup = downloadFieldConfigBackup;
window.downloadFieldConfigFile = downloadFieldConfigFile;
window.triggerFieldConfigImport = triggerFieldConfigImport;
window.handleFieldConfigImport = handleFieldConfigImport;
window.toggleField = toggleField;
window.deleteField = deleteField;
window.resetFieldsToDefault = resetFieldsToDefault;
window.openEditField = openEditField;
window.onFieldDragStart = onFieldDragStart;
window.onFieldDragEnd = onFieldDragEnd;
window.onFieldDragOver = onFieldDragOver;
window.onFieldDragLeave = onFieldDragLeave;
window.onFieldDrop = onFieldDrop;
window.onAddTypeChange = onAddTypeChange;
window.toggleCatCheck = toggleCatCheck;
window.addOpt = addOpt;
window.addBulkOpts = addBulkOpts;
window.removeOpt = removeOpt;
window.addFieldGlobal = addFieldGlobal;
window.toggleFieldOptionsEdit = toggleFieldOptionsEdit;
window.handlePhoto = handlePhoto;
window.clearPhoto = clearPhoto;
window.syncCheckboxField = syncCheckboxField;
window.onRoleTypeChange = onRoleTypeChange;
window.markInvalidField = markInvalidField;
window.clearInvalidFields = clearInvalidFields;
window.getSchoolInfoFields = getSchoolInfoFields;
window.toggleSchoolInfoField = toggleSchoolInfoField;
window.editSchoolInfoField = editSchoolInfoField;
window.saveEditedSchoolInfoFieldModal = saveEditedSchoolInfoFieldModal;
window.deleteSchoolInfoField = deleteSchoolInfoField;
window.resetSchoolInfoFields = resetSchoolInfoFields;
window.addSchoolInfoFieldPrompt = addSchoolInfoFieldPrompt;
window.getSchoolInfoData = getSchoolInfoData;
window.saveSchoolInfoData = saveSchoolInfoData;
window.renderSchoolInfoFieldMgr = renderSchoolInfoFieldMgr;
window.renderDataEntryStatus = renderDataEntryStatus;
window.renderOpsLog = renderOpsLog;
window.clearOpsLog = clearOpsLog;
window.renderAccounts = renderAccounts;
window.resetAllUsers = resetAllUsers;
window.openEditUser = openEditUser;
window.saveMyCredentials = saveMyCredentials;
window.updateMyCredBadge = updateMyCredBadge;
window.closePV = closePV;
// ============================================================
// إصلاح دالة حفظ إعدادات المزامنة
// ============================================================

// التأكد من وجود الدوال الأساسية
if (typeof CloudConfigManager === 'undefined') {
    console.error('CloudConfigManager not loaded!');
}

// دالة حفظ إعدادات المزامنة - Supabase
window.saveSyncConfig = function() {
    console.log('[Sync] saveSyncConfig called');
    
    // جلب القيم من حقول الإدخال
    const urlInput = document.getElementById('sync-url');
    const tokenInput = document.getElementById('sync-token');
    
    const url = urlInput ? urlInput.value.trim() : '';
    const token = tokenInput ? tokenInput.value.trim() : '';
    
    console.log('[Sync] Supabase URL:', url);
    
    // التحقق من صحة الرابط ومفتاح الوصول
    if (!url) {
        showSyncMessage('❌ الرجاء إدخال رابط موقع Supabase (URL)', 'error');
        return;
    }
    
    if (!url.includes('supabase.co') && !url.startsWith('http')) {
        showSyncMessage('❌ الرابط يجب أن يكون رابط موقع Supabase صالح (مثال: https://xyz.supabase.co)', 'error');
        return;
    }

    if (!token) {
        showSyncMessage('❌ الرجاء إدخال مفتاح الوصول (Supabase Anon Key)', 'error');
        return;
    }
    
    // عرض رسالة جاري الحفظ
    showSyncMessage('⏳ جاري حفظ إعدادات Supabase واختبار الاتصال...', 'info');
    
    // حفظ الإعدادات في localStorage وفي CloudSyncManager
    try {
        const config = { url: url, token: token, savedAt: new Date().toISOString() };
        localStorage.setItem('gft_sync_config', JSON.stringify(config));
        localStorage.setItem('gft_cloud_config_url', url);
        localStorage.setItem('gft_cloud_config_token', token);
        localStorage.setItem('gft_supabase_url', url);
        localStorage.setItem('gft_supabase_anon_key', token);

        if (window.CloudSyncManager?.saveConfig) {
            window.CloudSyncManager.saveConfig(url, token);
        }
        if (window.SUPABASE_CONFIG) {
            window.SUPABASE_CONFIG.url = url;
            window.SUPABASE_CONFIG.anonKey = token;
        }
        if (window.supabase && url && token) {
            window.supabaseClient = window.supabase.createClient(url, token);
        }
        console.log('[Sync] Supabase config saved');
    } catch(e) {
        console.error('[Sync] Failed to save config:', e);
    }
    
    // اختبار الاتصال بـ Supabase
    testCloudConnection(url, token).then(result => {
        if (result.ok) {
            showSyncMessage('✅ تم حفظ إعدادات Supabase واختبار الاتصال بنجاح!', 'success');
            
            if (typeof CloudConfigManager !== 'undefined') {
                CloudConfigManager.init(url, token);
                CloudConfigManager.fetchAllConfig().then(() => {
                    showSyncMessage('✅ تم الاتصال وقراءة إعدادات الحقول بنجاح', 'success');
                    if (typeof FieldManagerUI !== 'undefined') {
                        FieldManagerUI.render();
                    } else if (typeof renderFieldMgr !== 'undefined') {
                        renderFieldMgr();
                    }
                }).catch(err => {
                    console.error('[Sync] Field fetch note:', err);
                });
            }
        } else {
            showSyncMessage('❌ فشل اختبار الاتصال بـ Supabase: ' + (result.error || 'unknown error'), 'error');
        }
    }).catch(err => {
        console.error('[Sync] Test connection error:', err);
        showSyncMessage('❌ فشل اختبار الاتصال بـ Supabase: ' + err.message, 'error');
    });
};

// دالة اختبار الاتصال بـ Supabase
async function testCloudConnection(url, token) {
    console.log('[Sync] Testing Supabase connection to:', url);
    
    try {
        if (!window.supabase) {
            throw new Error('مكتبة Supabase غير محملة في المتصفح');
        }
        const client = window.supabase.createClient(url, token);
        
        // إجراء استعلام بسيط للتحقق من الصحة
        const { data, error } = await client.from('settings').select('key').limit(1);
        if (error) {
            const isMissingTable = error.message?.includes('table') || error.message?.includes('schema cache') || error.code === 'PGRST200' || error.code === '42P01';
            if (isMissingTable) {
                return { 
                    ok: true, 
                    needSchema: true, 
                    message: 'تم الاتصال بـ Supabase بنجاح! ولكن يلزم تنفيذ كود إنشاء الجداول (SQL) في مشروعك.' 
                };
            }
            // try students table
            const { error: err2 } = await client.from('students').select('id').limit(1);
            if (err2) {
                const isMissingTable2 = err2.message?.includes('table') || err2.message?.includes('schema cache') || err2.code === 'PGRST200' || err2.code === '42P01';
                if (isMissingTable2) {
                    return { 
                        ok: true, 
                        needSchema: true, 
                        message: 'تم الاتصال بـ Supabase بنجاح! ولكن يلزم تنفيذ كود إنشاء الجداول (SQL) في مشروعك.' 
                    };
                }
                throw err2;
            }
        }
        
        return { ok: true, message: 'الاتصال بـ Supabase يعمل بنجاح وقواعد البيانات جاهزة' };
    } catch (err) {
        console.error('[Sync] Supabase test failed:', err);
        const msg = err.message || '';
        if (msg.includes('table') || msg.includes('schema cache') || msg.includes('does not exist')) {
            return { ok: true, needSchema: true, message: 'تم الاتصال بـ Supabase بنجاح! يلزم فقط إنشاء الجداول بالضغط على (نسخ كود الجداول).' };
        }
        return { ok: false, error: err.message };
    }
}

// دالة نسخ كود SQL لإنشاء الجداول في Supabase
window.copySupabaseSQL = function() {
  if (typeof CU !== 'undefined' && CU && !CU.isAdmin) {
    if (window.showToast) window.showToast('⛔ هذه الخاصية متاحة لحساب الأدمن فقط', 'warning');
    else alert('⛔ هذه الخاصية متاحة لحساب الأدمن فقط');
    return;
  }
  const sql = `-- ====================================================================
-- مخطط قاعدة بيانات Supabase (PostgreSQL) - نظام هيأة رعاية الموهوبين v6.0
-- متوافق 100% مع معمارية Google Apps Script (Code.gs v6.0)
-- ====================================================================

-- 1. جدول الطلاب (students)
create table if not exists public.students (
  id text primary key,
  school text,
  name text,
  class text,
  details jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. جدول الكادر التدريسي والإداري (staff)
create table if not exists public.staff (
  id text primary key,
  school text,
  name text,
  role text,
  details jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. جدول الإعدادات والحقول الديناميكية (settings)
create table if not exists public.settings (
  key text primary key,
  value jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. جدول سجل التتبع الأكاديمي السنوي للطلاب (student_history)
create table if not exists public.student_history (
  history_id text primary key,
  student_id text references public.students(id) on delete cascade,
  academic_year text not null,
  stage text,
  grade text,
  attendance_status text default 'مستمر',
  talent_type text,
  gpa text,
  achievements text,
  certificate text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 5. جدول المدارس (schools)
create table if not exists public.schools (
  school_id text primary key,
  name text not null,
  gov_name text,
  district text,
  address text,
  phone text,
  email text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 6. جدول سجل العمليات والحركات (logs)
create table if not exists public.logs (
  log_id text primary key default gen_random_uuid()::text,
  ts timestamp with time zone default timezone('utc'::text, now()),
  action text not null,
  entity text,
  entity_id text,
  school text,
  username text,
  details text,
  version text default '6.0.0'
);

-- 7. الفهارس لسرعة الاستعلامات والفلترة
create index if not exists idx_students_school on public.students(school);
create index if not exists idx_staff_school on public.staff(school);
create index if not exists idx_student_history_student_id on public.student_history(student_id);
create index if not exists idx_student_history_year on public.student_history(academic_year);
create index if not exists idx_logs_ts on public.logs(ts desc);

-- 8. سياسات الأمان والحماية (Row Level Security - RLS)
alter table public.students enable row level security;
alter table public.staff enable row level security;
alter table public.settings enable row level security;
alter table public.student_history enable row level security;
alter table public.schools enable row level security;
alter table public.logs enable row level security;

drop policy if exists "Allow anon full access on students" on public.students;
create policy "Allow anon full access on students" on public.students for all using (true) with check (true);

drop policy if exists "Allow anon full access on staff" on public.staff;
create policy "Allow anon full access on staff" on public.staff for all using (true) with check (true);

drop policy if exists "Allow anon full access on settings" on public.settings;
create policy "Allow anon full access on settings" on public.settings for all using (true) with check (true);

drop policy if exists "Allow anon full access on student_history" on public.student_history;
create policy "Allow anon full access on student_history" on public.student_history for all using (true) with check (true);

drop policy if exists "Allow anon full access on schools" on public.schools;
create policy "Allow anon full access on schools" on public.schools for all using (true) with check (true);

drop policy if exists "Allow anon full access on logs" on public.logs;
create policy "Allow anon full access on logs" on public.logs for all using (true) with check (true);

-- 9. تفعيل المزامنة الفورية (Supabase Realtime)
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime for table public.students, public.staff, public.settings, public.student_history, public.schools, public.logs;
commit;
`;

  navigator.clipboard.writeText(sql).then(() => {
    alert('✅ تم نسخ كود إنشاء الجداول (SQL) بنجاح!\n\nالخطوة التالية بداخل موقع Supabase:\n1. افتح مشروعك في Supabase.\n2. من القائمة الجانبية اليسرى اضغط على "SQL Editor".\n3. اضغط "New Query".\n4. الصق الكود ثم اضغط زر "Run" الأخضر في الأسفل.\n\nوستصبح قاعدة البيانات جاهزة فوراً!');
  }).catch(() => {
    prompt('نسخ كود SQL يدوياً:', sql);
  });
};

// دالة إنشاء عنصر الرسائل إذا لم يكن موجوداً
function createMessageDiv() {
    let msgDiv = document.getElementById('sync-config-message');
    if (!msgDiv) {
        const syncCard = document.querySelector('#pg-sync .card');
        if (syncCard) {
            msgDiv = document.createElement('div');
            msgDiv.id = 'sync-config-message';
            msgDiv.style.marginTop = '12px';
            syncCard.querySelector('.cb').appendChild(msgDiv);
        }
    }
    return msgDiv;
}

// دالة عرض الرسائل
function showSyncMessage(message, type) {
    console.log('[Sync] Message:', type, message);
    
    // Trigger toast notification
    if (window.showToast) {
        window.showToast(message, type);
    }
    
    const msgDiv = document.getElementById('sync-config-message') || createMessageDiv();
    if (!msgDiv) return;
    
    const icons = {
        error: `<div style="width:34px; height:34px; border-radius:50%; background:#fee2e2; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px;">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
        </div>`,
        warning: `<div style="width:34px; height:34px; border-radius:50%; background:#fef3c7; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px;">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
        </div>`,
        success: `<div style="width:34px; height:34px; border-radius:50%; background:#dcfce7; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px;">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
        </div>`,
        info: `<div style="width:34px; height:34px; border-radius:50%; background:#dbeafe; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px;">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
        </div>`
    };

    const colors = {
        success: { bg: '#f0fdf4', border: '#86efac', text: '#15803d' },
        error: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
        warning: { bg: '#fffbeb', border: '#fcd34d', text: '#b45309' },
        info: { bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' }
    };
    
    const style = colors[type] || colors.info;
    const iconHtml = icons[type] || icons.info;
    
    msgDiv.innerHTML = `
        <div class="alert alert-${type}" style="background:${style.bg}; border:1px solid ${style.border}; border-radius:12px; padding:12px 16px; margin-top:12px; display:flex; align-items:center; gap:12px; box-shadow:0 3px 10px rgba(0,0,0,0.04);">
            ${iconHtml}
            <span style="color:${style.text}; font-size:13px; font-weight:600; flex:1; line-height:1.5">${message}</span>
            <button onclick="this.parentElement.parentElement.style.display='none'" style="background:none; border:none; cursor:pointer; color:${style.text}; font-size:16px; opacity:0.7; padding:4px;" title="إغلاق">✕</button>
        </div>
    `;
    
    // اختفاء تلقائي بعد 8 ثوانٍ للرسائل الناجحة
    if (type === 'success') {
        setTimeout(() => {
            if (msgDiv) msgDiv.innerHTML = '';
        }, 8000);
    }
}

// دالة بديلة إذا كانت الدالة الأصلية لا تعمل
window.saveSyncConfigAlt = window.saveSyncConfig;

// التأكد من وجود زر الحفظ وإضافة حدث click له
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        const saveBtn = document.querySelector('#pg-sync .btn-pr');
        if (saveBtn && saveBtn.textContent.includes('حفظ الإعدادات')) {
            console.log('[Sync] Attaching click handler to save button');
            // إزالة المستمعات القديمة وإضافة مستمع جديد
            const newSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
            newSaveBtn.onclick = function(e) {
                e.preventDefault();
                window.saveSyncConfig();
            };
        }
    }, 1000);
});

/* ============================================================
 * دوال معالجة واستبدال وفحص الأسماء الرباعية المكررة
 * ============================================================ */
window.showDuplicateReplacePrompt = function(modalType, recFullName, existingDup) {
  const typeLabel = modalType === 'teach' ? 'كادر المدرسة' : 'الطلاب الموهوبين';
  const schoolInfo = existingDup.school ? ` (مدرسة: ${existingDup.school})` : '';
  const extraInfo = modalType === 'stud' 
    ? `<div style="font-size:11.5px;color:var(--tx2);margin-top:4px">📌 المرحلة: <strong>${existingDup.stage || 'غير محدد'}</strong> · السنة الدراسية: <strong>${existingDup.academicYear || 'غير محدد'}</strong></div>`
    : '';

  showModalAlert(`
    <div style="text-align:right;direction:rtl;padding:4px">
      <div style="font-size:14px;font-weight:700;color:#c62828;margin-bottom:6px;display:flex;align-items:center;gap:6px">
        ⚠️ تم العثور على اسم مكرر في ${typeLabel}
      </div>
      <div style="font-size:12.5px;color:var(--tx);line-height:1.6;margin-bottom:12px">
        الاسم الرباعي <strong>«${recFullName}»</strong> موجود بالفعل في السجلات لنفس المرحلة والسنة الدراسية${schoolInfo}.<br>
        ${extraInfo}
        هل ترغب في <strong>استبدال السجل السابق</strong> وتحديث بياناته بالجديدة، أم إلغاء الحفظ لتعديل الاسم؟
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
        <button type="button" class="btn btn-sm" style="background:#00695c;color:#fff;border:none;font-weight:600" onclick="confirmReplaceDuplicate('${existingDup.id}')">
          🔄 نعم، استبدال السجل السابق
        </button>
        <button type="button" class="btn btn-sm btn-sec" onclick="cancelDuplicateReplace()">
          ❌ لا، إلغاء لتغيير الاسم
        </button>
      </div>
    </div>
  `);
};

window.confirmReplaceDuplicate = function(dupId) {
  window._forceReplaceDupId = dupId;
  saveModal();
};

window.cancelDuplicateReplace = function() {
  delete window._forceReplaceDupId;
  const b = document.getElementById('modal-body');
  if (b) {
    const a = b.querySelector('.m-alert');
    if (a) a.remove();
  }
};

window.openDuplicateScanner = function(type, customSchoolScope) {
  const typeLabel = type === 'teach' ? 'كادر المدرسة' : 'الطلاب الموهوبين';
  const isSchoolUser = !!(CU && CU.school);
  const schoolsList = typeof getSchoolsList === 'function' ? getSchoolsList() : (window.CONFIG_DATA?.schools || []);

  // Set modal to extra wide and hide default modal form footer
  const modalEl = document.getElementById('modal');
  if (modalEl) {
    const mb = modalEl.querySelector('.mb');
    if (mb) mb.classList.add('mb-extra-wide');
    const mf = modalEl.querySelector('.mf');
    if (mf) mf.style.display = 'none';
  }

  // Determine active school scope
  let activeScope = 'all';
  if (isSchoolUser) {
    activeScope = CU.school;
  } else if (customSchoolScope !== undefined) {
    activeScope = decodeURIComponent(customSchoolScope);
  } else {
    // Read from active filter on the page
    const filterEl = type === 'teach' ? document.getElementById('ft-sc') : document.getElementById('fs-sc');
    if (filterEl && filterEl.value) {
      activeScope = filterEl.value;
    } else {
      activeScope = 'all';
    }
  }

  const db = gdb(type) || [];
  
  // Filter by active scope if specific school
  const recordsToScan = (activeScope && activeScope !== 'all')
    ? db.filter(r => r.school === activeScope)
    : db;

  const groupMap = {};
  recordsToScan.forEach(r => {
    const name = getFullNameParts(r).trim().replace(/\s+/g, ' ');
    if (!name || name.split(' ').length < 2) return;
    const lower = name.toLowerCase();

    // Grouping criteria:
    // For students ('stud'): Same full name + Same Stage + Same Academic Year
    // (Students with different stage or different academic year are considered DIFFERENT and NOT duplicates)
    // For staff ('teach'): Same full name
    let groupKey = lower;
    let groupStage = '';
    let groupYear = '';

    if (type === 'stud') {
      groupStage = (r.stage || '').trim();
      groupYear = (r.academicYear || '').trim();
      groupKey = `${lower}:::${groupStage.toLowerCase()}:::${groupYear.toLowerCase()}`;
    }

    if (!groupMap[groupKey]) {
      groupMap[groupKey] = {
        key: groupKey,
        displayName: name,
        stage: groupStage,
        academicYear: groupYear,
        records: []
      };
    }
    groupMap[groupKey].records.push(r);
  });

  const dupGroups = Object.values(groupMap).filter(g => g.records.length > 1);
  const totalRedundantRecords = dupGroups.reduce((acc, g) => acc + (g.records.length - 1), 0);

  document.getElementById('modal-title').textContent = `🔍 فحص وتصفية الأسماء المكررة — ${typeLabel}`;

  // Build Scope Selector toolbar HTML
  let scopeSelectorHTML = '';
  if (isSchoolUser) {
    scopeSelectorHTML = `
      <div class="dup-scanner-header">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">🏫</span>
          <div>
            <span style="font-size:13.5px;font-weight:700;color:var(--tx)">نطاق الفحص الحالي:</span>
            <span class="badge b-teal" style="font-size:13px;padding:4px 12px;margin-right:6px;font-weight:700">مدرسة ${CU.school}</span>
          </div>
        </div>
        <span style="font-size:12px;color:var(--tx3)">يتم البحث والتصفية فقط ضمن سجلات مدرستك</span>
      </div>
    `;
  } else {
    // Admin Scope Control
    scopeSelectorHTML = `
      <div class="dup-scanner-header">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="font-size:20px">🎯</span>
          <label style="font-size:13.5px;font-weight:700;color:var(--tx)" for="dup-scope-select">تحديد نطاق المدرسة:</label>
          <select id="dup-scope-select" onchange="openDuplicateScanner('${type}', this.value)" style="padding:8px 16px;border-radius:9px;border:1.5px solid var(--pr);font-family:Cairo,sans-serif;font-size:13.5px;font-weight:700;color:var(--tx);background:var(--sf);cursor:pointer;min-width:240px">
            <option value="all" ${activeScope === 'all' ? 'selected' : ''}>🌐 جميع المدارس (بحث شامل عبر النظام)</option>
            ${schoolsList.map(sc => `<option value="${sc}" ${activeScope === sc ? 'selected' : ''}>🏫 مدرسة ${sc} فقط</option>`).join('')}
          </select>
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--tx2);background:var(--sf);padding:6px 12px;border-radius:8px;border:1px solid var(--bd)">
          ${activeScope === 'all' ? '🔍 فحص التشابه عبر جميع مدارس الهيأة' : `🔍 فحص مخصص لمدرسة (${activeScope})`}
        </div>
      </div>
    `;
  }

  const scopeLabel = activeScope === 'all' ? 'جميع المدارس' : `مدرسة ${activeScope}`;
  const criteriaDetail = type === 'stud'
    ? ' (المطابقة بالاسم الرباعي والمرحلة الدراسية والسنة الدراسية)'
    : ' (المطابقة بالاسم الرباعي الكامل)';

  if (!dupGroups.length) {
    document.getElementById('modal-body').innerHTML = `
      ${scopeSelectorHTML}
      <div style="text-align:center;padding:45px 20px;background:var(--sf);border-radius:14px;border:1px solid var(--bd)">
        <div style="width:68px;height:68px;border-radius:50%;background:#ecfdf5;color:#059669;font-size:32px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;box-shadow:0 4px 12px rgba(5,150,105,0.15)">✓</div>
        <h3 style="font-size:18px;font-weight:800;color:var(--ok);margin-bottom:8px">لا توجد أي سجلات مكررة!</h3>
        <p style="font-size:14px;color:var(--tx2);max-width:560px;margin:0 auto 20px;line-height:1.6">
          جميع السجلات في <strong>${typeLabel}</strong> ضمن (${scopeLabel}) فريدة وسليمة 100% بدون أي تكرار${criteriaDetail}.
          ${type === 'stud' ? '<br><span style="font-size:12px;color:var(--tx3)">ملاحظة: السجلات المتشابهة بالاسم في مراحل أو سنوات دراسية مختلفة تُعتبر سجلات متميزة ومستقلة.</span>' : ''}
        </p>
        <button class="btn btn-pr" onclick="closeModal()" style="padding:9px 24px;font-size:13.5px;font-weight:700">إغلاق النافذة</button>
      </div>
    `;
    document.getElementById('modal').classList.add('open');
    return;
  }

  let html = `
    ${scopeSelectorHTML}
    
    <div class="dup-alert-banner">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:22px">⚠️</span>
        <div>
          <div style="font-size:14px;font-weight:800;color:var(--tx)">
            تم اكتشاف <strong>${dupGroups.length}</strong> حالة تكرار (إجمالي <strong>${totalRedundantRecords}</strong> سجل فائض يمكن تنظيفه)
          </div>
          <div style="font-size:12px;color:var(--tx2);margin-top:2px">
            ضمن نطاق: <strong>«${scopeLabel}»</strong>${type === 'stud' ? ' — تم احتساب التكرار فقط عند تطابق (الاسم + المرحلة الدراسية + السنة الدراسية)' : ''} — راجع تفاصيل كل سجل أدناه لاتخاذ قرار التعديل أو الحذف أو المعاينة.
          </div>
        </div>
      </div>
      <button class="btn btn-sec btn-sm" onclick="closeModal()" style="font-size:13px;padding:7px 18px;font-weight:700">
        ✕ إغلاق
      </button>
    </div>

    <div class="dup-groups-scroll-area">
  `;

  dupGroups.forEach((group, gIdx) => {
    // Sort group records by ts descending so index 0 is newest
    group.records.sort((a, b) => (b.ts || 0) - (a.ts || 0));

    const stageParam = encodeURIComponent(group.stage || '');
    const yearParam = encodeURIComponent(group.academicYear || '');

    html += `
      <div class="dup-group-card">
        <!-- Group Header -->
        <div class="dup-group-head">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:18px">${type === 'stud' ? '🎓' : '👤'}</span>
            <span style="font-weight:800;font-size:15.5px;color:var(--pr-d)">${group.displayName}</span>
            ${type === 'stud' && group.stage ? `<span class="badge b-blue" style="font-size:11.5px;font-weight:700;padding:2px 8px">المرحلة: ${group.stage}</span>` : ''}
            ${type === 'stud' && group.academicYear ? `<span class="badge b-teal" style="font-size:11.5px;font-weight:700;padding:2px 8px">السنة: ${group.academicYear}</span>` : ''}
            <span class="badge b-red" style="font-size:12px;font-weight:700;padding:3px 10px">${group.records.length} سجلات مكررة</span>
          </div>
          <button class="btn btn-sm" style="background:#00695c;color:#fff;border:none;font-size:12px;font-weight:700;padding:7px 14px;border-radius:8px;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(0,105,92,0.25)" onclick="autoResolveDupGroup('${type}', '${encodeURIComponent(group.displayName)}', '${encodeURIComponent(activeScope)}', '${stageParam}', '${yearParam}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            الإبقاء على أحدث سجل وحذف المكرر
          </button>
        </div>

        <!-- Records List -->
        <div class="dup-rec-list">
    `;

    group.records.forEach((r, rIdx) => {
      const isNewest = rIdx === 0;
      const avatarSrc = typeof getRecordAvatar === 'function' ? getRecordAvatar(r, type) : (r.photo || getDefaultAvatar(type, r.gender));
      const schoolName = r.school || 'غير محدد';
      const roleOrStage = type === 'teach' 
        ? (r.jobRole || r.role_type || r.job || 'تدريسي') 
        : (r.stage || 'غير محدد');
      const subjectOrTalent = type === 'teach'
        ? (r.subject ? `📚 المادة: ${r.subject}` : (r.spec ? `🎓 الاختصاص: ${r.spec}` : ''))
        : (r.talent ? `⭐ الموهبة: ${r.talent}` : (r.gpa ? `📊 المعدل: ${r.gpa}%` : ''));
      const phoneNum = r.phone || r.parentPhone || r.studentPhone || '';
      const dateStr = r.ts ? new Date(r.ts).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' }) : 'سجل سابق';

      html += `
        <div class="dup-rec-row ${isNewest ? 'is-newest' : ''}">
          <!-- Record Info Left/Right -->
          <div class="dup-rec-info">
            <!-- Avatar -->
            <img src="${avatarSrc}" alt="صورة" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid ${isNewest ? 'var(--pr)' : 'var(--bd)'};flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,0.06)">
            
            <!-- Details -->
            <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span class="badge ${isNewest ? 'b-teal' : 'b-gray'}" style="font-size:11.5px;font-weight:700;padding:2px 8px">
                  ${isNewest ? '⭐ سجل #1 (الأحدث)' : `سجل #${rIdx + 1}`}
                </span>
                <span style="font-size:13.5px;font-weight:700;color:var(--tx)">
                  🏫 مدرسة: <strong style="color:var(--pr-d)">${schoolName}</strong>
                </span>
                <span class="badge b-blue" style="font-size:11.5px;font-weight:600;padding:2px 8px">
                  ${type === 'teach' ? `💼 ${roleOrStage}` : `🎓 مرحلة: ${roleOrStage}`}
                </span>
                ${type === 'stud' && r.academicYear ? `<span class="badge b-teal" style="font-size:11.5px;font-weight:600;padding:2px 8px">📅 سنة: ${r.academicYear}</span>` : ''}
              </div>

              <div style="display:flex;align-items:center;gap:12px;font-size:12.5px;color:var(--tx2);flex-wrap:wrap;margin-top:2px">
                ${subjectOrTalent ? `<span>${subjectOrTalent}</span>` : ''}
                ${phoneNum ? `<span>📞 ${phoneNum}</span>` : ''}
                <span style="color:var(--tx3);font-size:11.5px">📅 ${dateStr}</span>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="dup-rec-actions">
            <!-- Preview Profile Overlay -->
            <button class="btn btn-sm btn-sec" onclick="openView('${type}', '${r.id}')" title="معاينة الملف الكامل">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>معاينة</span>
            </button>

            <!-- Edit Button -->
            <button class="btn btn-sm btn-pr" onclick="closeModal(); openEdit('${type}', '${r.id}')" title="تعديل هذا السجل">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              <span>تعديل</span>
            </button>

            <!-- Delete Button -->
            <button class="btn btn-sm btn-er" onclick="deleteSingleDupRecord('${type}', '${r.id}', '${encodeURIComponent(activeScope)}')" title="حذف هذا السجل فقط">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
              <span>حذف</span>
            </button>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  html += `
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:16px;padding-top:12px;border-top:1px solid var(--bd)">
      <button class="btn btn-pr" onclick="closeModal()" style="padding:9px 26px;font-size:13.5px;font-weight:700">
        ✓ إتمام وإغلاق النافذة
      </button>
    </div>
  `;

  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal').classList.add('open');
};

window.autoResolveDupGroup = function(type, encodedName, encodedSchoolScope, encodedStage, encodedYear) {
  const name = decodeURIComponent(encodedName || '');
  const schoolScope = encodedSchoolScope ? decodeURIComponent(encodedSchoolScope) : 'all';
  const stage = encodedStage !== undefined ? decodeURIComponent(encodedStage) : '';
  const academicYear = encodedYear !== undefined ? decodeURIComponent(encodedYear) : '';

  const db = gdb(type) || [];
  const lower = name.toLowerCase().trim();
  
  let matching = db.filter(r => getFullNameParts(r).toLowerCase().trim() === lower);
  if (schoolScope && schoolScope !== 'all') {
    matching = matching.filter(r => r.school === schoolScope);
  }
  if (type === 'stud') {
    if (stage) {
      matching = matching.filter(r => (r.stage || '').trim().toLowerCase() === stage.toLowerCase());
    }
    if (academicYear) {
      matching = matching.filter(r => (r.academicYear || '').trim().toLowerCase() === academicYear.toLowerCase());
    }
  }
  if (matching.length <= 1) return;

  matching.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const removeRecords = matching.slice(1);
  const removeIds = removeRecords.map(r => r.id);

  const desc = (type === 'stud' && (stage || academicYear))
    ? `(${name} — ${stage ? `مرحلة: ${stage}` : ''} ${academicYear ? `سنة: ${academicYear}` : ''})`
    : `(${name})`;

  showConfirm(`هل أنت متأكد من الإبقاء على أحدث سجل وحذف ${removeIds.length} سجل مكرر لـ ${desc}؟`, () => {
    const updatedDb = db.filter(r => !removeIds.includes(r.id));
    sdb(type, updatedDb);

    removeRecords.forEach(rec => {
      logAction('حذف مكرر آلي', type, rec);
      if (window.ActivityLogger) window.ActivityLogger.del(type, rec);
      if (window.DeltaSyncManager) {
        DeltaSyncManager.deleteRecord(type, rec.id, rec.school).catch(() => {});
      }
    });
    try { if (window.renderOpsLog) renderOpsLog(); } catch (e) { }

    buildTableHeaders(type);
    renderTbl(type);
    renderDashboard();
    openDuplicateScanner(type, schoolScope);
  });
};

window.deleteSingleDupRecord = function(type, recId, encodedSchoolScope) {
  const schoolScope = encodedSchoolScope ? decodeURIComponent(encodedSchoolScope) : 'all';
  const all = gdb(type) || [];
  const target = all.find(r => r.id === recId);
  if (!target) return;

  if (typeof Security !== 'undefined' && !Security.can('delete', target)) {
    if (typeof showModalAlert === 'function') {
      showModalAlert('⛔ ليس لديك صلاحية حذف هذا السجل');
    } else {
      alert('⛔ ليس لديك صلاحية حذف هذا السجل');
    }
    return;
  }

  showConfirm(`هل أنت متأكد من حذف هذا السجل المكرر نهائياً؟`, () => {
    const updatedDb = all.filter(r => r.id !== recId);
    sdb(type, updatedDb);
    
    logAction('حذف سجل مكرر', type, target);
    if (window.ActivityLogger) window.ActivityLogger.del(type, target);
    if (window.DeltaSyncManager) {
      DeltaSyncManager.deleteRecord(type, recId, target.school).catch(() => {});
    }
    try { if (window.renderOpsLog) renderOpsLog(); } catch (e) { }

    buildTableHeaders(type);
    renderTbl(type);
    renderDashboard();
    openDuplicateScanner(type, schoolScope);
  });
};
