// ============================================================
// ترحيل البيانات (Student Promotion) + بيانات المؤرشفة (Archived Data)
// ============================================================
(function () {
  'use strict';

  const STAGE_ORDER = [
    'الأول المتوسط',
    'الثاني المتوسط',
    'الثالث المتوسط',
    'الرابع الإعدادي',
    'الخامس الإعدادي',
    'السادس الإعدادي'
  ];
  const FINAL_STAGE = 'السادس الإعدادي';
  const PROMO_LOG_KEY = 'gft_promotion_log';

  function nextAcademicYear(year) {
    if (!year || typeof year !== 'string' || !year.includes('-')) return '';
    const parts = year.split('-').map(s => parseInt(s, 10));
    if (parts.length !== 2 || parts.some(isNaN)) return '';
    return (parts[0] + 1) + '-' + (parts[1] + 1);
  }

  function nextStage(stage) {
    const idx = STAGE_ORDER.indexOf(stage);
    if (idx === -1 || idx === STAGE_ORDER.length - 1) return '';
    return STAGE_ORDER[idx + 1];
  }

  function isFinalStage(stage) { return stage === FINAL_STAGE; }

  function allYearsInUse() {
    const set = new Set(window.ACADEMIC_YEARS || []);
    (gdb('stud') || []).forEach(r => { if (r.academicYear) set.add(r.academicYear); });
    return Array.from(set).filter(Boolean).sort().reverse();
  }

  function promoSchoolsForUser() {
    return CU && CU?.school ? [CU.school] : getSchoolsList();
  }

  function readPromoLog() {
    try { return JSON.parse(localStorage.getItem(PROMO_LOG_KEY) || '[]'); } catch { return []; }
  }
  function writePromoLog(log) {
    try { localStorage.setItem(PROMO_LOG_KEY, JSON.stringify(log)); } catch (e) { console.warn('[promotion] فشل حفظ سجل الترحيل', e); }
  }

  // ------------------------------------------------------------
  // Page rendering
  // ------------------------------------------------------------
  function renderPromotionPage() {
    const scSel = document.getElementById('pr-school');
    const syrSel = document.getElementById('pr-syear');
    const tyrSel = document.getElementById('pr-tyear');
    const sstSel = document.getElementById('pr-sstage');
    if (!scSel || !syrSel || !tyrSel || !sstSel) return;

    const schools = promoSchoolsForUser();
    scSel.innerHTML = '<option value="">اختر المدرسة</option>' + schools.map(s => `<option value="${s}">${s}</option>`).join('');
    if (schools.length === 1) scSel.value = schools[0];

    const years = allYearsInUse();
    const yearsHtml = years.map(y => `<option value="${y}">${y}</option>`).join('');
    syrSel.innerHTML = '<option value="">السنة المصدر</option>' + yearsHtml;
    tyrSel.innerHTML = '<option value="">السنة الهدف</option>' + yearsHtml;
    if (ACTIVE_YEAR) syrSel.value = ACTIVE_YEAR;
    syrSel.onchange = () => {
      const nxt = nextAcademicYear(syrSel.value);
      if (nxt) {
        if (![...tyrSel.options].some(o => o.value === nxt)) tyrSel.add(new Option(nxt, nxt));
        tyrSel.value = nxt;
      }
    };
    if (syrSel.value) syrSel.onchange();

    sstSel.innerHTML = '<option value="">المرحلة المصدر</option>' + STAGE_ORDER.map(s => `<option value="${s}">${s}</option>`).join('');

    document.getElementById('promo-list-card').style.display = 'none';
    document.getElementById('promo-preview-card').style.display = 'none';
    document.getElementById('promo-alert-wrap').innerHTML = '';
    renderPromotionLog();
    updateUndoButton();
  }

  function alertBox(msg, type) {
    const cls = type === 'error' ? 'a-er' : type === 'warn' ? 'a-wn' : 'a-info';
    return `<div class="alert ${cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>${msg}</div>`;
  }

  let _promoStudents = [];
  let _promoSelected = new Set();

  function loadPromotionStudents() {
    const school = document.getElementById('pr-school').value;
    const sYear = document.getElementById('pr-syear').value;
    const sStage = document.getElementById('pr-sstage').value;
    const alertWrap = document.getElementById('promo-alert-wrap');
    alertWrap.innerHTML = '';

    if (!school) { alertWrap.innerHTML = alertBox('يرجى اختيار المدرسة', 'warn'); return; }
    if (!sYear) { alertWrap.innerHTML = alertBox('يرجى اختيار السنة الدراسية المصدر', 'warn'); return; }
    if (!sStage) { alertWrap.innerHTML = alertBox('يرجى اختيار المرحلة المصدر', 'warn'); return; }
    if (CU?.school && CU.school !== school) { alertWrap.innerHTML = alertBox('غير مصرح لك بالوصول إلى بيانات هذه المدرسة', 'error'); return; }

    const tYear = document.getElementById('pr-tyear').value || nextAcademicYear(sYear);
    const tSel = document.getElementById('pr-tstage');
    const tStage = isFinalStage(sStage) ? '' : nextStage(sStage);
    tSel.innerHTML = isFinalStage(sStage)
      ? '<option value="">تخرج / إضافة إلى الطلاب الخريجون</option>'
      : `<option value="${tStage}">${tStage || 'لا توجد مرحلة تالية'}</option>`;

    _promoStudents = gdb('stud').filter(r => r.school === school && r.academicYear === sYear && r.stage === sStage && (r.attendance || 'مستمر') !== 'غير مستمر');
    _promoSelected = new Set(_promoStudents.map(r => r.id));

    document.getElementById('promo-list-card').style.display = _promoStudents.length ? 'block' : 'none';
    document.getElementById('promo-preview-card').style.display = 'none';

    if (!_promoStudents.length) {
      alertWrap.innerHTML = alertBox('لا يوجد طلاب مطابقون لهذا الاختيار', 'warn');
      return;
    }

    document.getElementById('promo-check-all').checked = true;
    renderPromoTable(school, tYear, isFinalStage(sStage));
  }

  function renderPromoTable(school, tYear, isFinal) {
    const body = document.getElementById('promo-body');
    body.innerHTML = _promoStudents.map(r => `
      <tr>
        <td><input type="checkbox" class="promo-chk" data-id="${r.id}" ${_promoSelected.has(r.id) ? 'checked' : ''} onchange="togglePromoStudent('${r.id}', this.checked)"></td>
        <td>${escapeHTML(fullName(r))}</td>
        <td>${escapeHTML(r.school || '')}</td>
        <td>${escapeHTML(r.stage || '')}</td>
        <td>${escapeHTML(r.academicYear || '')}</td>
        <td>${isFinal ? '<span class="badge b-blue">إضافة إلى الطلاب الخريجون</span>' : `<span class="badge b-teal">ترحيل إلى ${escapeHTML(tYear)}</span>`}</td>
      </tr>`).join('');
    document.getElementById('promo-count').textContent = `${_promoSelected.size} من ${_promoStudents.length} محدد`;
  }

  function togglePromoStudent(id, checked) {
    if (checked) _promoSelected.add(id); else _promoSelected.delete(id);
    document.getElementById('promo-count').textContent = `${_promoSelected.size} من ${_promoStudents.length} محدد`;
  }

  function togglePromoAll(checked) {
    _promoSelected = checked ? new Set(_promoStudents.map(r => r.id)) : new Set();
    document.querySelectorAll('.promo-chk').forEach(cb => { cb.checked = checked; });
    document.getElementById('promo-count').textContent = `${_promoSelected.size} من ${_promoStudents.length} محدد`;
  }

  function previewPromotion() {
    const school = document.getElementById('pr-school').value;
    const sYear = document.getElementById('pr-syear').value;
    const sStage = document.getElementById('pr-sstage').value;
    const tYear = document.getElementById('pr-tyear').value || nextAcademicYear(sYear);
    const isFinal = isFinalStage(sStage);
    const tStage = isFinal ? '' : nextStage(sStage);

    if (!_promoSelected.size) { alert('يرجى تحديد طالب واحد على الأقل'); return; }
    if (!isFinal && !tStage) { alert('لا يمكن تحديد المرحلة الهدف — تأكد من المرحلة المصدر'); return; }
    if (!tYear) { alert('يرجى تحديد السنة الدراسية الهدف'); return; }

    const selectedStudents = _promoStudents.filter(r => _promoSelected.has(r.id));
    const existing = gdb('stud');
    let duplicateCount = 0;
    selectedStudents.forEach(r => {
      if (!isFinal) {
        const dup = existing.some(x => x.global_id && x.global_id === r.global_id && x.academicYear === tYear);
        if (dup) duplicateCount++;
      }
    });

    const card = document.getElementById('promo-preview-card');
    const body = document.getElementById('promo-preview-body');
    body.innerHTML = `
      <div><strong>المدرسة:</strong> ${escapeHTML(school)}</div>
      <div><strong>عدد الطلاب المحددين:</strong> ${selectedStudents.length}</div>
      <div><strong>من:</strong> ${escapeHTML(sYear)} — ${escapeHTML(sStage)}</div>
      <div><strong>إلى:</strong> ${isFinal ? `إضافة إلى قائمة الطلاب الخريجون (${escapeHTML(sYear)}) مع الاحتفاظ بسجلات السنوات السابقة كاملة` : `${escapeHTML(tYear)} — ${escapeHTML(tStage)}`}</div>
      ${duplicateCount ? `<div style="color:var(--er)">⚠️ يوجد ${duplicateCount} طالب لديهم سجل مسبق بنفس السنة الهدف وسيتم تجاوزهم لمنع التكرار</div>` : ''}
      <div style="margin-top:6px;color:var(--tx3);font-size:12px">السجلات السابقة لن تُحذف أو تُعدَّل، وسيتم إنشاء سجلات جديدة للمرحلة/التخرج تحمل نفس الرقم التعريفي (global_id)</div>
    `;
    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function executePromotion() {
    const school = document.getElementById('pr-school').value;
    const sYear = document.getElementById('pr-syear').value;
    const sStage = document.getElementById('pr-sstage').value;
    const tYear = document.getElementById('pr-tyear').value || nextAcademicYear(sYear);
    const isFinal = isFinalStage(sStage);
    const tStage = isFinal ? '' : nextStage(sStage);
    const selectedStudents = _promoStudents.filter(r => _promoSelected.has(r.id));
    if (!selectedStudents.length) return;

    const all = gdb('stud');
    const byId = {};
    all.forEach(r => { byId[r.id] = r; });

    const batchOps = [];
    const studentNames = [];
    let created = 0, archived = 0, skipped = 0;

    selectedStudents.forEach(orig => {
      const original = byId[orig.id];
      if (!original) return;
      const stName = fullName(original) || original.name || original.fullName || 'طالب';
      if (stName) studentNames.push(stName);

      if (isFinal) {
        // Check if student already has a graduated record in this final academic year
        const dupArchiveExists = Object.values(byId).some(x =>
          x.global_id && x.global_id === original.global_id &&
          (x.attendance || 'مستمر') === 'غير مستمر' &&
          x.academicYear === sYear &&
          x.id !== original.id
        );
        if (dupArchiveExists) {
          skipped++;
          return;
        }

        // Keep the original record for sYear intact (attendance: 'مستمر') to preserve study history across all previous years!
        // Create a new graduation record in the end of year / graduation year
        const grad = { ...original };
        delete grad.id;
        grad.global_id = original.global_id;
        grad.academicYear = sYear;
        grad.stage = original.stage || FINAL_STAGE;
        grad.attendance = 'غير مستمر';
        grad.archiveReason = original.archiveReason || 'تخرج (إكمال المرحلة الدراسية)';
        grad.archiveDate = original.archiveDate || new Date().toISOString().split('T')[0];
        grad.passStatus = original.passStatus || 'ناجح';
        grad.createdAt = undefined;
        grad.ts = undefined;
        grad.tsEdit = undefined;
        grad.updatedAt = undefined;

        Security.stampRecord(grad, 'stud', null);
        byId[grad.id] = grad;
        batchOps.push({ action: 'graduated', originalId: original.id, newId: grad.id, studentName: stName });
        archived++;
      } else {
        const dupExists = Object.values(byId).some(x => x.global_id && x.global_id === original.global_id && x.academicYear === tYear && x.id !== original.id);
        if (dupExists) { skipped++; return; }
        const clone = { ...original };
        delete clone.id;
        clone.global_id = original.global_id;
        clone.academicYear = tYear;
        clone.stage = tStage;
        clone.attendance = 'مستمر';
        clone.passStatus = 'ناجح';
        clone.createdAt = undefined;
        clone.ts = undefined;
        clone.tsEdit = undefined;
        clone.updatedAt = undefined;
        Security.stampRecord(clone, 'stud', null);
        byId[clone.id] = clone;
        batchOps.push({ action: 'promoted', originalId: original.id, newId: clone.id, studentName: stName });
        created++;
      }
    });

    const updatedAll = Object.values(byId);
    sdb('stud', updatedAll);

    const batch = {
      id: nid(),
      ts: new Date().toISOString(),
      user: CU?.username || '?',
      school, sourceYear: sYear, targetYear: tYear, sourceStage: sStage, targetStage: tStage || '(تخرج / نهاية المرحلة)',
      studentNames,
      created, archived, skipped,
      ops: batchOps
    };
    const log = readPromoLog();
    log.unshift(batch);
    if (log.length > 50) log.splice(50);
    writePromoLog(log);
    logPromotionOp(batch);

    // sync to cloud
    const schoolRecords = updatedAll.filter(r => r.school === school);
    if (window.CloudSyncManager) CloudSyncManager.sendData('stud', schoolRecords, school);
    if (window.CloudSyncManager && CloudSyncManager.getConfig().url) {
      const cfg = CloudSyncManager.getConfig();
      fetch(cfg.url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, mode: 'no-cors',
        body: JSON.stringify({ action: 'promoteStudents', school, sourceYear: sYear, targetYear: tYear, sourceStage: sStage, targetStage: tStage, records: schoolRecords.map(r => { const { photo, ...rest } = r; return rest; }), user: CU?.username || '', token: cfg.token || '' })
      }).catch(() => { });
    }

    document.getElementById('promo-preview-card').style.display = 'none';
    document.getElementById('promo-list-card').style.display = 'none';
    document.getElementById('promo-alert-wrap').innerHTML = alertBox(
      isFinal
        ? `تم إضافة ${archived} طالب بنجاح إلى قائمة الطلاب الخريجون مع الحفاظ على سجلاتهم السابقة كاملة${skipped ? ` — تم تجاوز ${skipped} طالب لوجود سجل تخرج مسبقاً` : ''}`
        : `تم ترحيل ${created} طالب بنجاح${skipped ? ` — تم تجاوز ${skipped} طالب لوجود سجل مكرر مسبقاً` : ''}`,
      'info');

    if (window.refreshAll) refreshAll();
    renderPromotionLog();
    updateUndoButton();
  }

  function undoLastPromotion() {
    const log = readPromoLog();
    if (!log.length) { alert('لا توجد عملية ترحيل لإجراء تراجع عنها'); return; }
    const idx = log.findIndex(b => !CU?.school || b.school === CU.school);
    if (idx === -1) { alert('لا توجد عملية ترحيل خاصة بمدرستك لإجراء تراجع عنها'); return; }
    const batch = log[idx];
    if (!confirm(`هل تريد التراجع عن عملية الترحيل بتاريخ ${new Date(batch.ts).toLocaleString('ar-IQ')}؟\nسيتم حذف السجلات الجديدة التي أُنشئت فقط، ولن تُمس السجلات القديمة.`)) return;

    const all = gdb('stud');
    const byId = {};
    all.forEach(r => { byId[r.id] = r; });

    batch.ops.forEach(op => {
      if (op.action === 'promoted' || op.action === 'graduated') {
        if (op.newId) delete byId[op.newId];
      } else if (op.action === 'archived') {
        if (op.newId) {
          delete byId[op.newId];
        } else {
          const rec = byId[op.studentId];
          if (rec) rec.attendance = op.prevAttendance || 'مستمر';
        }
      }
    });

    const updatedAll = Object.values(byId);
    sdb('stud', updatedAll);
    log.splice(idx, 1);
    writePromoLog(log);

    const schoolRecords = updatedAll.filter(r => r.school === batch.school);
    if (window.CloudSyncManager) CloudSyncManager.sendData('stud', schoolRecords, batch.school);

    alert('تم التراجع عن عملية الترحيل بنجاح');
    if (window.refreshAll) refreshAll();
    renderPromotionLog();
    updateUndoButton();
  }

  function updateUndoButton() {
    const btn = document.getElementById('promo-undo-btn');
    if (!btn) return;
    const log = readPromoLog();
    const has = log.some(b => !CU?.school || b.school === CU.school);
    btn.style.display = has ? 'inline-flex' : 'none';
  }

  let _activePromoModalNames = [];

  function openPromoStudentsModal(batchId) {
    const log = readPromoLog();
    const batch = log.find((b, idx) => (b.id === batchId || ('promo_batch_' + idx) === batchId));
    if (!batch) {
      if (window.showToast) window.showToast('تعذر العثور على تفاصيل العملية', 'error');
      else alert('تعذر العثور على تفاصيل العملية');
      return;
    }

    const allStuds = gdb('stud') || [];
    const studMap = {};
    allStuds.forEach(s => { studMap[s.id] = fullName(s) || s.name || s.fullName || ''; });

    let names = batch.studentNames || [];
    if ((!names || !names.length) && batch.ops && batch.ops.length) {
      names = batch.ops.map(op => {
        if (op.studentName) return op.studentName;
        if (op.originalId && studMap[op.originalId]) return studMap[op.originalId];
        if (op.newId && studMap[op.newId]) return studMap[op.newId];
        if (op.studentId && studMap[op.studentId]) return studMap[op.studentId];
        return null;
      }).filter(Boolean);
    }

    _activePromoModalNames = names;

    const modal = document.getElementById('promo-students-modal');
    const titleEl = document.getElementById('promo-modal-title');
    const bodyEl = document.getElementById('promo-modal-body');
    if (!modal || !bodyEl) return;

    if (titleEl) {
      titleEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span>قائمة الطلاب المرحلين (${names.length} طالب)</span>`;
    }

    const dateStr = new Date(batch.ts).toLocaleString('ar-IQ');
    const isGrad = (batch.targetStage || '').includes('تخرج');

    let html = `
      <div style="background:var(--sf2);border:1px solid var(--bd);border-radius:10px;padding:12px 14px;margin-bottom:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;font-size:12.5px">
        <div><span style="color:var(--tx3)">المدرسة:</span> <strong>${escapeHTML(batch.school || '—')}</strong></div>
        <div><span style="color:var(--tx3)">التاريخ:</span> <strong>${dateStr}</strong></div>
        <div><span style="color:var(--tx3)">المستخدم:</span> <strong>${escapeHTML(batch.user || '—')}</strong></div>
        <div><span style="color:var(--tx3)">المسار:</span> <strong>${escapeHTML(batch.sourceStage || '')} (${escapeHTML(batch.sourceYear || '')}) ⬅️ ${escapeHTML(batch.targetStage || '')} (${escapeHTML(batch.targetYear || '')})</strong></div>
        <div><span style="color:var(--tx3)">النتيجة:</span> <span class="badge b-teal" style="font-size:11.5px">${batch.created || 0} ترحيل / ${batch.archived || 0} تخرج</span></div>
      </div>

      <div style="margin-bottom:12px;position:relative">
        <input type="text" id="promo-modal-search" placeholder="🔍 بحث في أسماء الطلاب المرحلين..." oninput="window.filterPromoModalStudents(this.value)" style="width:100%;padding:9px 12px;border:1.5px solid var(--bd);border-radius:8px;font-family:'Cairo',sans-serif;font-size:13px">
      </div>

      <div id="promo-modal-students-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;max-height:360px;overflow-y:auto;padding:2px">
        ${renderPromoModalStudentsCards(names, isGrad)}
      </div>
    `;

    bodyEl.innerHTML = html;
    modal.classList.add('open');
  }

  function renderPromoModalStudentsCards(names, isGrad) {
    if (!names || !names.length) {
      return '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--tx3)">لا توجد أسماء مسجلة</div>';
    }
    return names.map((n, idx) => `
      <div class="promo-stud-card" data-name="${escapeHTML(n).toLowerCase()}" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--sf);border:1px solid var(--bd);border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.03)">
        <div style="width:24px;height:24px;border-radius:50%;background:var(--pr-l);color:var(--pr-d);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${idx + 1}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escapeHTML(n)}">
            ${escapeHTML(n)}
          </div>
          <div style="font-size:10.5px;color:var(--tx3);margin-top:1px">
            ${isGrad ? '🎓 خريج / مؤرشف' : '✅ تم الترحيل بنجاح'}
          </div>
        </div>
      </div>
    `).join('');
  }

  function filterPromoModalStudents(q) {
    const term = (q || '').trim().toLowerCase();
    const cards = document.querySelectorAll('.promo-stud-card');
    cards.forEach(card => {
      const name = card.dataset.name || '';
      if (!term || name.includes(term)) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  }

  function copyPromoStudentsList() {
    if (!_activePromoModalNames || !_activePromoModalNames.length) {
      if (window.showToast) window.showToast('لا توجد أسماء لنسخها', 'warn');
      return;
    }
    const text = _activePromoModalNames.map((n, i) => `${i + 1}. ${n}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      if (window.showToast) window.showToast(`✅ تم نسخ ${_activePromoModalNames.length} اسماً إلى الحافظة بنجاح`, 'success');
      else alert('تم نسخ الأسماء بنجاح');
    }).catch(() => {
      alert('تعذر النسخ التلقائي');
    });
  }

  function closePromoStudentsModal() {
    const modal = document.getElementById('promo-students-modal');
    if (modal) modal.classList.remove('open');
  }

  function togglePromoInlineExpand(batchId) {
    const el = document.getElementById('promo-inline-list-' + batchId);
    const btn = document.getElementById('promo-toggle-btn-' + batchId);
    if (!el) return;
    const isHidden = el.style.display === 'none';
    el.style.display = isHidden ? 'block' : 'none';
    if (btn) {
      const moreCount = btn.dataset.moreCount || '';
      btn.innerHTML = isHidden ? 'إخفاء ▴' : `+${moreCount} المزيد ▾`;
    }
  }

  function renderPromotionLog() {
    const body = document.getElementById('promo-log-body');
    if (!body) return;
    const log = readPromoLog().filter(b => !CU?.school || b.school === CU.school);
    if (!log.length) { body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--tx3);padding:16px">لا توجد عمليات ترحيل بعد</td></tr>'; return; }

    const allStuds = gdb('stud') || [];
    const studMap = {};
    allStuds.forEach(s => { studMap[s.id] = fullName(s) || s.name || s.fullName || ''; });

    body.innerHTML = log.map((b, idx) => {
      const safeId = b.id || ('promo_batch_' + idx);
      let names = b.studentNames || [];
      if ((!names || !names.length) && b.ops && b.ops.length) {
        names = b.ops.map(op => {
          if (op.studentName) return op.studentName;
          if (op.originalId && studMap[op.originalId]) return studMap[op.originalId];
          if (op.newId && studMap[op.newId]) return studMap[op.newId];
          if (op.studentId && studMap[op.studentId]) return studMap[op.studentId];
          return null;
        }).filter(Boolean);
      }

      let namesDisplay = '—';
      if (names.length === 1) {
        namesDisplay = `
          <div style="display:flex;align-items:center;gap:6px">
            <span class="badge b-teal" style="font-size:12px;padding:4px 9px;font-weight:600;display:inline-flex;align-items:center;gap:4px">
              🎓 ${escapeHTML(names[0])}
            </span>
          </div>`;
      } else if (names.length >= 2 && names.length <= 3) {
        namesDisplay = `
          <div style="display:flex;flex-direction:column;gap:5px;min-width:200px">
            <div style="display:flex;flex-wrap:wrap;gap:4px">
              ${names.map((n, i) => `<span class="badge b-teal" style="font-size:11px;padding:3px 7px;display:inline-flex;align-items:center;gap:3px;font-weight:600"><span style="opacity:0.75;font-size:9.5px">${i + 1}.</span> ${escapeHTML(n)}</span>`).join('')}
            </div>
            <button type="button" class="btn btn-xs" onclick="window.openPromoStudentsModal('${safeId}')" style="align-self:flex-start;font-size:10.5px;padding:2px 8px;background:var(--sf2);color:var(--pr-d);border:1px solid var(--bd);border-radius:5px;cursor:pointer;font-weight:600;margin-top:2px" title="عرض التفاصيل في نافذة منبثقة">
              👁️ عرض القائمة (${names.length})
            </button>
          </div>`;
      } else if (names.length > 3) {
        const moreCount = names.length - 2;
        namesDisplay = `
          <div style="display:flex;flex-direction:column;gap:5px;min-width:230px">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
              <span class="badge b-teal" style="font-size:11.5px;font-weight:700;padding:3px 8px;display:inline-flex;align-items:center;gap:4px">
                👥 <strong>${names.length}</strong> طلاب مرحلون
              </span>
              <button type="button" class="btn btn-xs btn-pr" onclick="window.openPromoStudentsModal('${safeId}')" style="font-size:11px;padding:3px 9px;border-radius:6px;font-weight:700;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;cursor:pointer" title="عرض قائمة الطلاب كاملة في نافذة منبثقة مع البحث والنسخ">
                👁️ عرض الكل (${names.length})
              </button>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center">
              ${names.slice(0, 2).map((n, i) => `<span class="badge b-teal" style="font-size:10.5px;padding:2px 6px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHTML(n)}"><span style="opacity:0.75;font-size:9.5px">${i + 1}.</span> ${escapeHTML(n)}</span>`).join('')}
              <button type="button" onclick="window.togglePromoInlineExpand('${safeId}')" id="promo-toggle-btn-${safeId}" data-more-count="${moreCount}" style="background:var(--ac-l);color:var(--ac);border:1px solid var(--bd);border-radius:6px;font-size:10.5px;padding:2px 7px;font-weight:700;cursor:pointer" title="توسيع أو طي القائمة مباشرة في الجدول">
                +${moreCount} المزيد ▾
              </button>
            </div>
            <div id="promo-inline-list-${safeId}" style="display:none;margin-top:3px;padding:6px 8px;background:var(--sf2);border:1px solid var(--bd);border-radius:6px;max-height:130px;overflow-y:auto">
              <div style="display:flex;flex-direction:column;gap:3px">
                ${names.map((n, i) => `<div style="font-size:11.5px;color:var(--tx);padding:2px 4px;border-bottom:1px dashed var(--bd);display:flex;align-items:center;gap:6px"><span style="color:var(--tx3);font-size:10px;min-width:18px">${i + 1}.</span><strong>${escapeHTML(n)}</strong></div>`).join('')}
              </div>
            </div>
          </div>`;
      }

      return `
        <tr>
          <td style="white-space:nowrap">${new Date(b.ts).toLocaleString('ar-IQ')}</td>
          <td>${escapeHTML(b.user || '')}</td>
          <td>${escapeHTML(b.school || '')}</td>
          <td style="line-height:1.5">${namesDisplay}</td>
          <td>${escapeHTML(b.sourceYear || '')} — ${escapeHTML(b.sourceStage || '')}</td>
          <td>${escapeHTML(b.targetYear || '')} — ${escapeHTML(b.targetStage || '')}</td>
          <td><span class="badge ${b.archived ? 'b-blue' : 'b-green'}">${b.created || 0} ترحيل / ${b.archived || 0} أرشفة</span></td>
        </tr>`;
    }).join('');
  }

  function logPromotionOp(batch) {
    try {
      const ops = JSON.parse(localStorage.getItem('gft_promotion_ops') || '[]');
      ops.unshift({
        user: batch.user, school: batch.school,
        sourceYear: batch.sourceYear, targetYear: batch.targetYear,
        sourceStage: batch.sourceStage, targetStage: batch.targetStage,
        created: batch.created, archived: batch.archived, skipped: batch.skipped,
        ts: batch.ts
      });
      if (ops.length > 200) ops.splice(200);
      localStorage.setItem('gft_promotion_ops', JSON.stringify(ops));
    } catch (e) { console.warn('[promotion] فشل تسجيل العملية', e); }
  }

  // ------------------------------------------------------------
  // Archived students page
  // ------------------------------------------------------------
  function renderArchivedPage() {
    const scSel = document.getElementById('ar-sc');
    const yrSel = document.getElementById('ar-year');
    if (scSel && scSel.options.length <= 1) {
      const schools = promoSchoolsForUser();
      scSel.innerHTML = '<option value="">جميع المدارس</option>' + schools.map(s => `<option value="${s}">${s}</option>`).join('');
    }
    if (yrSel && yrSel.options.length <= 1) {
      const currentYr = yrSel.value;
      const years = allYearsInUse();
      yrSel.innerHTML = '<option value="">جميع السنوات الدراسية</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
      if (currentYr) yrSel.value = currentYr;
    }

    const q = (document.getElementById('ar-q')?.value || '').trim().toLowerCase();
    const scFilter = scSel?.value || '';
    const yrFilter = yrSel?.value || '';

    let list = gdata('stud').filter(r => (r.attendance || 'مستمر') === 'غير مستمر');
    if (scFilter) list = list.filter(r => r.school === scFilter);
    if (yrFilter) list = list.filter(r => r.academicYear === yrFilter);
    if (q) list = list.filter(r => fullName(r).toLowerCase().includes(q));
    list.sort(arabicSort);

    const body = document.getElementById('archived-body');
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--tx3);padding:20px">لا توجد بيانات للطلاب الخريجين</td></tr>';
    } else {
      body.innerHTML = list.map(r => `
        <tr>
          <td>${escapeHTML(fullName(r))}</td>
          <td>${escapeHTML(r.school || '')}</td>
          <td>${escapeHTML(r.stage || '')}</td>
          <td>${escapeHTML(r.academicYear || '')}</td>
          <td>${escapeHTML(r.archiveReason || '—')}</td>
          <td>${escapeHTML(r.archiveDate || '—')}</td>
          <td>${escapeHTML(r.acceptedBy || '—')}</td>
          <td>
            <div style="display:inline-flex;gap:6px;align-items:center;justify-content:center;flex-wrap:nowrap">
              <button class="btn btn-sm" onclick="openArchiveModal('${r.id}')" title="تعديل بيانات الأرشفة والقبول" style="padding:4px 10px;font-size:11.5px">تعديل</button>
              <button class="btn btn-sm" onclick="deleteArchivedStudent('${r.id}')" title="حذف هذا الطالب نهائياً" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;padding:4px 10px;font-size:11.5px;display:inline-flex;align-items:center;gap:4px">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                <span>حذف</span>
              </button>
            </div>
          </td>
        </tr>`).join('');
    }
    document.getElementById('archived-cnt').textContent = `${list.length} سجل`;
    document.getElementById('nb-archived').textContent = gdata('stud').filter(r => (r.attendance || 'مستمر') === 'غير مستمر').length;
  }

  function deleteArchivedStudent(id) {
    const all = gdb('stud');
    const target = all.find(r => r.id === id);
    if (!target) return;

    if (typeof Security !== 'undefined' && Security.can && !Security.can('delete', target)) {
      if (typeof showToast === 'function') showToast('⛔ ليس لديك صلاحية حذف هذا السجل', 'error');
      else alert('⛔ ليس لديك صلاحية حذف هذا السجل');
      return;
    }

    const stName = typeof fullName === 'function' ? fullName(target) : (target.name1 || 'الطالب');

    const doDelete = async () => {
      const remaining = gdb('stud').filter(r => r.id !== id);
      sdb('stud', remaining);

      if (typeof logAction === 'function') logAction('حذف', 'stud', target);
      if (window.ActivityLogger && window.ActivityLogger.del) window.ActivityLogger.del('stud', target);

      if (window.DeltaSyncManager && window.DeltaSyncManager.deleteRecord) {
        DeltaSyncManager.deleteRecord('stud', id, target.school).catch(() => {});
      }
      if (window.CloudSyncManager && window.CloudSyncManager.sendData) {
        CloudSyncManager.sendData('stud', remaining.filter(r => r.school === target.school), target.school);
      }

      if (_archiveEditId === id) closeArchiveModal();

      if (typeof updateNavBadges === 'function') updateNavBadges();
      renderArchivedPage();
      try { if (typeof renderTbl === 'function') renderTbl('stud'); } catch (e) { }
      try { if (typeof renderDashboard === 'function') renderDashboard(); } catch (e) { }
      try { if (typeof renderSchools === 'function') renderSchools(); } catch (e) { }

      if (typeof showToast === 'function') {
        showToast(`تم حذف سجل الطالب "${stName}" بنجاح`, 'success');
      }
    };

    const confirmPrompt = `هل أنت متأكد من حذف سجل الطالب "${stName}" من قائمة الطلاب الخريجين نهائياً؟`;
    if (typeof window.showConfirm === 'function') {
      window.showConfirm(confirmPrompt, doDelete);
    } else if (typeof showConfirm === 'function') {
      showConfirm(confirmPrompt, doDelete);
    } else if (confirm(confirmPrompt)) {
      doDelete();
    }
  }

  const ARCHIVE_FIELDS = [
    { id: 'archiveReason', label: 'سبب الأرشفة', type: 'text' },
    { id: 'archiveDate', label: 'تاريخ الأرشفة', type: 'date' },
    { id: 'acceptedBy', label: 'الجهة المقبول بها', type: 'text' },
    { id: 'studyType', label: 'نوع الدراسة', type: 'text' },
    { id: 'university', label: 'الجامعة', type: 'text' },
    { id: 'college', label: 'الكلية', type: 'text' },
    { id: 'department', label: 'القسم', type: 'text' },
    { id: 'admissionYear', label: 'سنة القبول', type: 'text' },
    { id: 'archiveNotes', label: 'ملاحظات', type: 'textarea' }
  ];
  let _archiveEditId = null;

  function openArchiveModal(id) {
    const rec = gdb('stud').find(r => r.id === id);
    if (!rec) return;
    _archiveEditId = id;
    let html = `<div class="fg">`;
    ARCHIVE_FIELDS.forEach(f => {
      const val = rec[f.id] || '';
      const span = f.type === 'textarea' ? 's2' : '';
      html += `<div class="fgr ${span}"><label>${f.label}</label>`;
      if (f.type === 'textarea') html += `<textarea id="am-${f.id}">${val}</textarea>`;
      else html += `<input id="am-${f.id}" type="${f.type}" value="${val}">`;
      html += `</div>`;
    });
    html += `</div>`;
    document.getElementById('archive-modal-body').innerHTML = html;
    document.getElementById('archive-modal').classList.add('open');
  }

  function closeArchiveModal() {
    document.getElementById('archive-modal').classList.remove('open');
    _archiveEditId = null;
  }

  function saveArchiveDetails() {
    if (!_archiveEditId) return;
    const all = gdb('stud');
    const idx = all.findIndex(r => r.id === _archiveEditId);
    if (idx === -1) { closeArchiveModal(); return; }
    const rec = { ...all[idx] };
    ARCHIVE_FIELDS.forEach(f => {
      const el = document.getElementById('am-' + f.id);
      if (el) rec[f.id] = el.value;
    });
    Security.stampRecord(rec, 'stud', all[idx]);
    all[idx] = rec;
    sdb('stud', all);
    if (window.CloudSyncManager) CloudSyncManager.sendData('stud', all.filter(r => r.school === rec.school), rec.school);
    closeArchiveModal();
    renderArchivedPage();
  }

  function deleteCurrentArchiveRecord() {
    if (_archiveEditId) {
      deleteArchivedStudent(_archiveEditId);
    }
  }

  window.renderPromotionPage = renderPromotionPage;
  window.loadPromotionStudents = loadPromotionStudents;
  window.togglePromoStudent = togglePromoStudent;
  window.togglePromoAll = togglePromoAll;
  window.previewPromotion = previewPromotion;
  window.executePromotion = executePromotion;
  window.undoLastPromotion = undoLastPromotion;
  window.renderArchivedPage = renderArchivedPage;
  window.openArchiveModal = openArchiveModal;
  window.closeArchiveModal = closeArchiveModal;
  window.saveArchiveDetails = saveArchiveDetails;
  window.deleteArchivedStudent = deleteArchivedStudent;
  window.deleteCurrentArchiveRecord = deleteCurrentArchiveRecord;
  window.openPromoStudentsModal = openPromoStudentsModal;
  window.closePromoStudentsModal = closePromoStudentsModal;
  window.togglePromoInlineExpand = togglePromoInlineExpand;
  window.filterPromoModalStudents = filterPromoModalStudents;
  window.copyPromoStudentsList = copyPromoStudentsList;
})();
