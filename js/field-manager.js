// ============================================================
// FieldManagerUI — واجهة إدارة الحقول المتكاملة
// ============================================================

const FieldManagerUI = {
  
  // عرض إدارة الحقول
  render() {
    if (!window.CU || !window.CU.isAdmin) {
      document.getElementById('pg-fieldmgr').innerHTML = '<div class="alert a-er">⛔ هذه الصفحة للأدمن فقط</div>';
      return;
    }
    
    const container = document.getElementById('pg-fieldmgr');
    if (!container) return;
    
    // بناء واجهة إدارة الحقول
    container.innerHTML = `
      <div class="ph">
        <div><h2>إدارة الحقول</h2><p>تحكم كامل في حقول النماذج - التغييرات تظهر فوراً لجميع المدارس</p></div>
        <div class="ph-acts">
          <button class="btn btn-sm" onclick="FieldManagerUI.syncNow()" id="sync-fields-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9"/></svg>
            مزامنة مع السحابة
          </button>
        </div>
      </div>
      <div class="alert a-info" id="cloud-fields-status">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span id="cloud-status-text">جاري تحميل الحقول من السحابة...</span>
      </div>
      <div class="fg-3col" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:20px">
        <div id="fm-teach-container"></div>
        <div id="fm-stud-container"></div>
      </div>
      <div id="fm-add-card-container"></div>
      <div id="fm-school-info-container"></div>
    `;
    
    this.loadFields();
  },
  
  // تحميل الحقول وعرضها
  async loadFields() {
    try {
      // تحميل الحقول من السحابة
      if (CloudConfigManager.isConnected()) {
        await CloudConfigManager.fetchAllConfig();
      }
      
      const teachFields = CloudConfigManager.getStaffFields();
      const studFields = CloudConfigManager.getStudentFields();
      const schoolInfoFields = CloudConfigManager.getSchoolInfoFields();
      
      // عرض حقول الكادر
      const teachContainer = document.getElementById('fm-teach-container');
      if (teachContainer) {
        teachContainer.innerHTML = this.buildFieldListHTML(teachFields, 'staff', 'كادر المدرسة', '#00695C', 'b-teal');
      }
      
      // عرض حقول الطلاب
      const studContainer = document.getElementById('fm-stud-container');
      if (studContainer) {
        studContainer.innerHTML = this.buildFieldListHTML(studFields, 'students', 'الطلاب الموهوبون', '#c8922a', 'b-amber');
      }
      
      // عرض حقول بيانات المدرسة
      const schoolInfoContainer = document.getElementById('fm-school-info-container');
      if (schoolInfoContainer && window.CU.isAdmin) {
        schoolInfoContainer.innerHTML = this.buildSchoolInfoFieldsHTML(schoolInfoFields);
      }
      
      // عرض بطاقة إضافة حقل جديد
      const addCardContainer = document.getElementById('fm-add-card-container');
      if (addCardContainer && window.CU.isAdmin) {
        addCardContainer.innerHTML = this.buildAddFieldCard();
        this.initAddFieldCard();
      }
      
      // تحديث حالة الاتصال
      const statusText = document.getElementById('cloud-status-text');
      if (statusText) {
        if (CloudConfigManager.isConnected()) {
          statusText.innerHTML = '✅ الحقول متزامنة مع السحابة - التغييرات تظهر لجميع المدارس فوراً';
        } else {
          statusText.innerHTML = '⚠️ لم يتم إعداد الاتصال بالسحابة - الرجاء إدخال رابط Google Apps Script في صفحة المزامنة';
        }
      }
      
    } catch (e) {
      console.error('[FieldManagerUI] Error loading fields:', e);
      const statusText = document.getElementById('cloud-status-text');
      if (statusText) {
        statusText.innerHTML = '❌ خطأ في تحميل الحقول: ' + e.message;
      }
    }
  },
  
  // بناء قائمة الحقول
  buildFieldListHTML(fields, target, title, color, badgeClass) {
    if (!fields || fields.length === 0) {
      return `<div class="fm-wrap">
        <div class="fm-hdr">
          <div class="fm-title" style="color:${color}">${title}</div>
          <span class="badge ${badgeClass}">0 حقل</span>
        </div>
        <div class="fm-fields" style="padding:20px;text-align:center;color:var(--tx3)">
          لا توجد حقول مضافّة بعد
        </div>
      </div>`;
    }
    
    const rows = fields.map((f, idx) => {
      const col = this.getFieldColor(f.field_type);
      const ico = this.getFieldIcon(f.field_type);
      const isCore = f.id && (f.id.startsWith('fld_') || f.id.startsWith('tch_'));
      
      return `<div class="ff-row ${f.visible === false ? 'hidden-field' : ''}" data-field-id="${f.id}" data-target="${target}">
        <div class="ff-info">
          <span style="color:var(--tx3);font-size:18px;cursor:grab;margin-left:6px;user-select:none" title="اسحب لإعادة الترتيب">⠿</span>
          <div class="ff-icon" style="background:${col}22">${ico.replace('currentColor', col)}</div>
          <div>
            <div class="ff-name">${this.escapeHtml(f.field_label)}${f.required ? ' <span style="color:var(--er);font-size:11px">*</span>' : ''}</div>
            <div class="ff-meta">${this.getFieldTypeName(f.field_type)} · ${f.visible !== false ? 'مرئي' : 'مخفي'}</div>
            ${f.school_scope && f.school_scope !== 'all' ? `<div class="ff-meta" style="color:var(--pr-d)">📍 خاص بمدرسة: ${f.school_scope}</div>` : ''}
          </div>
        </div>
        <div class="ff-acts">
          <span class="ff-tag ${isCore ? 'ff-tag-core' : 'ff-tag-custom'}">${isCore ? 'أساسي' : 'مخصص'}</span>
          <button class="ff-tog ${f.visible !== false ? 'on' : ''}" onclick="FieldManagerUI.toggleField('${f.id}', '${target}')" title="${f.visible !== false ? 'إخفاء' : 'إظهار'}"></button>
          <button class="ab ab-ed" onclick="FieldManagerUI.editField('${f.id}', '${target}')" title="تعديل الحقل">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>تعديل
          </button>
          <button class="ab ab-dl" onclick="FieldManagerUI.deleteField('${f.id}', '${f.field_label}', '${target}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>حذف
          </button>
        </div>
      </div>`;
    }).join('');
    
    return `<div class="fm-wrap">
      <div class="fm-hdr">
        <div class="fm-title" style="color:${color}">${title}</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="badge ${badgeClass}">${fields.length} حقل · ${fields.filter(f => f.visible !== false).length} مرئي</span>
        </div>
      </div>
      <div style="padding:8px 14px;font-size:11px;color:var(--in);background:var(--in-l);border-bottom:1px solid var(--bd)">
        ⠿ اسحب لإعادة الترتيب · يمكن تعديل أو حذف أي حقل
      </div>
      <div class="fm-fields" id="fm-fields-${target}">${rows}</div>
    </div>`;
  },
  
  // بناء حقول بيانات المدرسة
  buildSchoolInfoFieldsHTML(fields) {
    if (!fields || fields.length === 0) {
      return `<div class="fm-wrap" style="margin-top:20px">
        <div class="fm-hdr">
          <div class="fm-title" style="color:#1a3a5c">بيانات المدرسة</div>
          <span class="badge b-blue">0 حقل</span>
        </div>
        <div class="fm-fields" style="padding:20px;text-align:center;color:var(--tx3)">
          لا توجد حقول مضافّة بعد
        </div>
      </div>`;
    }
    
    const rows = fields.map((f, idx) => {
      const col = this.getFieldColor(f.type);
      const ico = this.getFieldIcon(f.type);
      const optsText = (f.options && f.options.length) ? ' · (' + f.options.join(', ') + ')' : '';
      
      return `<div class="ff-row ${f.visible === false ? 'hidden-field' : ''}" data-field-id="${f.id}">
        <div class="ff-info">
          <span style="color:var(--tx3);font-size:18px;cursor:grab;margin-left:6px;user-select:none" title="اسحب لإعادة الترتيب">⠿</span>
          <div class="ff-icon" style="background:${col}22">${ico.replace('currentColor', col)}</div>
          <div>
            <div class="ff-name">${this.escapeHtml(f.label)}${f.required ? ' <span style="color:var(--er);font-size:11px">*</span>' : ''}</div>
            <div class="ff-meta">${this.getFieldTypeName(f.type)} · ${f.visible !== false ? 'مرئي' : 'مخفي'}${optsText}</div>
          </div>
        </div>
        <div class="ff-acts">
          <button class="ff-tog ${f.visible !== false ? 'on' : ''}" onclick="FieldManagerUI.toggleSchoolInfoField('${f.id}')" title="${f.visible !== false ? 'إخفاء' : 'إظهار'}"></button>
          <button class="ab ab-ed" onclick="FieldManagerUI.editSchoolInfoField('${f.id}')" title="تعديل الحقل">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>تعديل
          </button>
          <button class="ab ab-dl" onclick="FieldManagerUI.deleteSchoolInfoField('${f.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>حذف
          </button>
        </div>
      </div>`;
    }).join('');
    
    return `<div class="fm-wrap" style="margin-top:20px">
      <div class="fm-hdr">
        <div class="fm-title" style="color:#1a3a5c">بيانات المدرسة</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="badge b-blue">${fields.length} حقل · ${fields.filter(f => f.visible !== false).length} مرئي</span>
          <button class="btn btn-pr btn-sm" onclick="FieldManagerUI.addSchoolInfoField()" style="font-size:11px">+ إضافة حقل جديد</button>
        </div>
      </div>
      <div class="fm-fields">${rows}</div>
    </div>`;
  },
  
  // بناء بطاقة إضافة حقل
  buildAddFieldCard() {
    return `<div class="fm-add-card" id="fm-add-card">
      <h4>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        إضافة حقل جديد (يظهر لجميع المدارس فوراً)
      </h4>
      <div class="fg" style="gap:12px">
        <div class="fgr">
          <label>اسم الحقل الجديد <span class="req">*</span></label>
          <input type="text" id="new-field-label" placeholder="مثال: رقم الوثيقة، المسمى الوظيفي..." style="padding:10px 12px;border-radius:9px;border:1.5px solid var(--bd);width:100%">
        </div>
        <div class="fgr">
          <label>نوع الحقل</label>
          <select id="new-field-type" style="padding:10px 12px;border-radius:9px;border:1.5px solid var(--bd);width:100%">
            <option value="text">📝 نص قصير</option>
            <option value="textarea">📄 نص طويل (متعدد الأسطر)</option>
            <option value="number">🔢 رقم</option>
            <option value="date">📅 تاريخ</option>
            <option value="select">📋 قائمة منسدلة</option>
            <option value="multiselect">☑️ قائمة متعددة الاختيار</option>
            <option value="checkboxes">✅ مربعات اختيار</option>
          </select>
        </div>
        <div class="fgr s2" id="options-editor" style="display:none">
          <label>خيارات القائمة <span class="req">*</span></label>
          <div class="opts-list" id="options-list"></div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <input type="text" id="option-input" placeholder="اكتب خياراً ثم اضغط إضافة" style="flex:1;padding:8px 12px;border-radius:9px;border:1.5px solid var(--bd)">
            <button type="button" class="btn btn-sm" onclick="FieldManagerUI.addOption()">➕ إضافة</button>
          </div>
        </div>
        <div class="fgr s2">
          <label>تطبيق على</label>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="apply-to-staff" value="staff" checked style="width:16px;height:16px;accent-color:var(--pr)"> كادر المدرسة
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="apply-to-students" value="students" checked style="width:16px;height:16px;accent-color:var(--pr)"> الطلاب الموهوبون
            </label>
          </div>
        </div>
        <div class="fgr">
          <label>نطاق المدرسة (اختياري)</label>
          <select id="field-school-scope" style="padding:10px 12px;border-radius:9px;border:1.5px solid var(--bd);width:100%">
            <option value="all">🌍 جميع المدارس</option>
            ${(window.getSchoolsList ? window.getSchoolsList() : []).map(s => `<option value="${s}">🏫 فقط مدرسة ${s}</option>`).join('')}
          </select>
        </div>
        <div class="fgr s2" style="display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="field-required" style="width:16px;height:16px;accent-color:var(--pr)"> حقل إلزامي
          </label>
          <div style="display:flex;align-items:center;gap:10px">
            <button type="button" class="btn btn-ac" id="btn-preview-field" onclick="FieldManagerUI.previewField()" style="padding:10px 18px">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              معاينة الحقل
            </button>
            <button type="button" class="btn btn-pr" onclick="FieldManagerUI.addNewField()" style="padding:10px 24px">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              إضافة الحقل إلى السحابة
            </button>
          </div>
        </div>
        <div id="field-preview-container" class="fgr s2" style="display:none;margin-top:10px;padding:16px;background:var(--sf2);border:2px dashed var(--pr-m);border-radius:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;border-bottom:1px solid var(--bd);padding-bottom:8px">
            <div style="font-size:13px;font-weight:700;color:var(--pr-d);display:flex;align-items:center;gap:6px">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              معاينة كيفية ظهور الحقل في النموذج
            </div>
            <span class="badge b-teal" id="preview-target-badge">نموذج الطلاب والكادر</span>
          </div>
          <div id="field-preview-body" style="background:var(--sf);padding:16px;border-radius:10px;border:1px solid var(--bd)"></div>
          <div style="font-size:11px;color:var(--tx3);margin-top:8px;text-align:left">
            * هذه المعاينة التفاعلية توضح كيف سيظهر الحقل للمستخدمين عند إدخال البيانات.
          </div>
        </div>
      </div>
    </div>`;
  },
  
  // تهيئة بطاقة الإضافة
  initAddFieldCard() {
    const updatePreviewIfActive = () => {
      const container = document.getElementById('field-preview-container');
      if (container && container.style.display !== 'none') {
        this.previewField();
      }
    };

    const typeSelect = document.getElementById('new-field-type');
    if (typeSelect) {
      typeSelect.onchange = () => {
        const optionsEditor = document.getElementById('options-editor');
        const type = typeSelect.value;
        optionsEditor.style.display = (type === 'select' || type === 'multiselect' || type === 'checkboxes') ? 'block' : 'none';
        updatePreviewIfActive();
      };
    }

    ['new-field-label', 'field-required', 'apply-to-staff', 'apply-to-students'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', updatePreviewIfActive);
        el.addEventListener('change', updatePreviewIfActive);
      }
    });
    
    const optionInput = document.getElementById('option-input');
    if (optionInput) {
      optionInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.addOption();
        }
      };
    }
    
    this.fieldOptions = [];
    this.renderOptionsList();
  },
  
  fieldOptions: [],
  
  addOption() {
    const input = document.getElementById('option-input');
    const value = input?.value?.trim();
    if (value && !this.fieldOptions.includes(value)) {
      this.fieldOptions.push(value);
      this.renderOptionsList();
      input.value = '';
      const container = document.getElementById('field-preview-container');
      if (container && container.style.display !== 'none') {
        this.previewField();
      }
    }
  },
  
  removeOption(index) {
    this.fieldOptions.splice(index, 1);
    this.renderOptionsList();
    const container = document.getElementById('field-preview-container');
    if (container && container.style.display !== 'none') {
      this.previewField();
    }
  },
  
  renderOptionsList() {
    const container = document.getElementById('options-list');
    if (!container) return;
    
    if (this.fieldOptions.length === 0) {
      container.innerHTML = '<span style="color:var(--tx3);font-size:12px;">لا توجد خيارات مضافّة</span>';
      return;
    }
    
    container.innerHTML = this.fieldOptions.map((opt, idx) => `
      <span class="opt-pill">
        ${this.escapeHtml(opt)}
        <button onclick="FieldManagerUI.removeOption(${idx})">×</button>
      </span>
    `).join('');
  },

  // معاينة كيفية ظهور الحقل في النماذج
  previewField() {
    const label = document.getElementById('new-field-label')?.value?.trim() || 'اسم الحقل المعاين';
    const type = document.getElementById('new-field-type')?.value || 'text';
    const required = document.getElementById('field-required')?.checked || false;
    const applyToStaff = document.getElementById('apply-to-staff')?.checked || false;
    const applyToStudents = document.getElementById('apply-to-students')?.checked || false;
    const options = this.fieldOptions.length > 0 ? this.fieldOptions : ['الخيار الأول', 'الخيار الثاني', 'الخيار الثالث'];

    const container = document.getElementById('field-preview-container');
    const body = document.getElementById('field-preview-body');
    const badge = document.getElementById('preview-target-badge');

    if (!container || !body) return;

    let targetText = 'نموذج الطلاب والكادر';
    if (applyToStudents && !applyToStaff) targetText = 'نموذج الطلاب فقط';
    else if (applyToStaff && !applyToStudents) targetText = 'نموذج الكادر فقط';
    if (badge) badge.textContent = targetText;

    let fieldInputHtml = '';
    const safeLabel = this.escapeHtml(label);
    const reqStar = required ? '<span class="req" style="color:var(--er);margin-right:2px;font-weight:bold">*</span>' : '';

    if (type === 'text') {
      fieldInputHtml = `<input type="text" placeholder="مثال لإدخال ${safeLabel}..." style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;width:100%;font-family:'Cairo',sans-serif;font-size:13px;background:var(--sf)">`;
    } else if (type === 'textarea') {
      fieldInputHtml = `<textarea rows="3" placeholder="أدخل بيانات ${safeLabel}..." style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;width:100%;font-family:'Cairo',sans-serif;font-size:13px;background:var(--sf);resize:vertical"></textarea>`;
    } else if (type === 'number') {
      fieldInputHtml = `<input type="number" placeholder="0" style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;width:100%;font-family:'Cairo',sans-serif;font-size:13px;background:var(--sf)">`;
    } else if (type === 'date') {
      fieldInputHtml = `<input type="date" style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;width:100%;font-family:'Cairo',sans-serif;font-size:13px;background:var(--sf)">`;
    } else if (type === 'select') {
      const optsHtml = options.map(o => `<option>${this.escapeHtml(o)}</option>`).join('');
      fieldInputHtml = `<select style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;width:100%;font-family:'Cairo',sans-serif;font-size:13px;background:var(--sf)"><option value="">-- اختر ${safeLabel} --</option>${optsHtml}</select>`;
    } else if (type === 'multiselect') {
      const optsHtml = options.map(o => `<option>${this.escapeHtml(o)}</option>`).join('');
      fieldInputHtml = `<select multiple style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:9px;width:100%;min-height:95px;font-family:'Cairo',sans-serif;font-size:13px;background:var(--sf)">${optsHtml}</select><span style="font-size:11px;color:var(--tx3);display:block;margin-top:4px">يمكن التحديد المتعدد باستخدام مفتاح Ctrl / Cmd</span>`;
    } else if (type === 'checkboxes') {
      const pills = options.map((o, idx) => `
        <label class="chk-pill">
          <input type="checkbox" id="prev-chk-${idx}">
          <span>${this.escapeHtml(o)}</span>
        </label>
      `).join('');
      fieldInputHtml = `<div class="chk-grid">${pills}</div>`;
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
  },
  
  // إضافة حقل جديد
  async addNewField() {
    const label = document.getElementById('new-field-label')?.value?.trim();
    if (!label) {
      alert('الرجاء إدخال اسم الحقل');
      return;
    }
    
    const type = document.getElementById('new-field-type')?.value || 'text';
    const required = document.getElementById('field-required')?.checked || false;
    const schoolScope = document.getElementById('field-school-scope')?.value || 'all';
    const applyToStaff = document.getElementById('apply-to-staff')?.checked || false;
    const applyToStudents = document.getElementById('apply-to-students')?.checked || false;
    
    if (!applyToStaff && !applyToStudents) {
      alert('الرجاء اختيار فئة واحدة على الأقل');
      return;
    }
    
    if ((type === 'select' || type === 'multiselect' || type === 'checkboxes') && this.fieldOptions.length === 0) {
      alert('الرجاء إضافة خيار واحد على الأقل للقائمة');
      return;
    }
    
    let successCount = 0;
    
    if (applyToStaff) {
      const result = await CloudConfigManager.addField({
        field_name: label.replace(/\s/g, '_').toLowerCase() + '_staff',
        field_label: label,
        field_type: type,
        target: 'staff',
        visible: true,
        required: required,
        school_scope: schoolScope,
        options: this.fieldOptions
      });
      if (result.ok) successCount++;
    }
    
    if (applyToStudents) {
      const result = await CloudConfigManager.addField({
        field_name: label.replace(/\s/g, '_').toLowerCase() + '_students',
        field_label: label,
        field_type: type,
        target: 'students',
        visible: true,
        required: required,
        school_scope: schoolScope,
        options: this.fieldOptions
      });
      if (result.ok) successCount++;
    }
    
    if (successCount > 0) {
      alert(`✅ تم إضافة الحقل "${label}" بنجاح إلى ${successCount} فئة`);
      // تفريغ النموذج
      document.getElementById('new-field-label').value = '';
      this.fieldOptions = [];
      this.renderOptionsList();
      document.getElementById('options-editor').style.display = 'none';
      document.getElementById('field-required').checked = false;
      document.getElementById('field-school-scope').value = 'all';
      document.getElementById('apply-to-staff').checked = true;
      document.getElementById('apply-to-students').checked = true;
      // إعادة تحميل الحقول
      await this.loadFields();
      // تحديث الجداول
      if (window.renderTbl) {
        window.renderTbl('teach');
        window.renderTbl('stud');
      }
    } else {
      alert('❌ فشل إضافة الحقل، تأكد من اتصالك بالسحابة');
    }
  },
  
  // تبديل حالة الحقل (مرئي/مخفي)
  async toggleField(fieldId, target) {
    const fields = target === 'staff' ? CloudConfigManager.getStaffFields() : CloudConfigManager.getStudentFields();
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      const newVisible = field.visible === false ? true : false;
      const result = await CloudConfigManager.updateField(fieldId, { visible: newVisible });
      if (result.ok) {
        await this.loadFields();
        if (window.renderTbl) {
          window.renderTbl(target === 'staff' ? 'teach' : 'stud');
        }
      }
    }
  },
  
  // تعديل حقل
  async editField(fieldId, target) {
    const typeMap = { staff: 'teach', students: 'stud', schools: 'si', teach: 'teach', stud: 'stud', si: 'si' };
    const type = typeMap[target] || target || 'stud';
    if (window.openEditField) {
      window.openEditField(type, fieldId);
      return;
    }
    const fields = target === 'staff' ? CloudConfigManager.getStaffFields() : CloudConfigManager.getStudentFields();
    const field = fields.find(f => f.id === fieldId || f.field_name === fieldId);
    if (!field) return;
    
    const newLabel = prompt('اسم الحقل الجديد:', field.field_label || field.label);
    if (!newLabel || newLabel === (field.field_label || field.label)) return;
    
    const result = await CloudConfigManager.updateField(fieldId, { field_label: newLabel, label: newLabel });
    if (result.ok) {
      alert('✅ تم تحديث الحقل بنجاح');
      await this.loadFields();
      if (window.renderTbl) {
        window.renderTbl(target === 'staff' ? 'teach' : 'stud');
      }
    } else {
      alert('❌ فشل التحديث: ' + (result.error || 'خطأ غير معروف'));
    }
  },
  
  // حذف حقل
  deleteField(fieldId, fieldLabel, target) {
    const type = target === 'staff' ? 'teach' : 'stud';
    const fields = typeof getFields === 'function' ? getFields(type) : [];
    const allRecords = window.gdb ? (window.gdb(type) || []) : [];
    const dataCount = allRecords.filter(r => {
      const v = r[fieldId];
      return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
    }).length;

    let msg = '';
    if (dataCount > 0) {
      msg = `⚠️ الحقل "<strong>${fieldLabel}</strong>" يحتوي على بيانات في <strong>${dataCount}</strong> سجل.<br>` +
            `هل أنت متأكد من حذف هذا الحقل نهائياً من النظام؟<br>` +
            `<span style="font-size:12px;color:var(--tx3)">سيختفي من جميع المدارس والنماذج والجداول.</span>`;
    } else {
      msg = `⚠️ هل أنت متأكد من حذف حقل "<strong>${fieldLabel}</strong>" نهائياً؟<br>` +
            `<span style="font-size:12px;color:var(--tx3)">سيختفي من جميع المدارس والنماذج والجداول.</span>`;
    }

    showConfirm(msg, async () => {
      const updated = fields.filter(f => f.id !== fieldId && f.field_name !== fieldId);
      if (typeof saveFields === 'function') {
        saveFields(type, updated);
      }
      
      if (window.CloudConfigManager) {
        await CloudConfigManager.deleteField(fieldId, fieldLabel);
      }
      
      if (window.ActivityLogger) {
        window.ActivityLogger.local('حذف حقل', type, { id: fieldId, name1: fieldLabel });
      }
      
      if (typeof renderFieldMgr === 'function') renderFieldMgr();
      await this.loadFields();
      if (window.buildTableHeaders) window.buildTableHeaders(type);
      if (window.renderTbl) window.renderTbl(type);
      if (window.renderDashboard) window.renderDashboard();
    });
  },
  
  // تبديل حالة حقل بيانات المدرسة
  async toggleSchoolInfoField(fieldId) {
    const fields = CloudConfigManager.getSchoolInfoFields();
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      const newVisible = field.visible === false ? true : false;
      // تحديث في السحابة
      await CloudConfigManager.updateSchoolInfoField?.(fieldId, { visible: newVisible });
      await this.loadFields();
      if (window.renderSchoolInfoPage) window.renderSchoolInfoPage();
    }
  },
  
  // حذف حقل بيانات المدرسة
  deleteSchoolInfoField(fieldId) {
    const fields = typeof getSchoolInfoFields === 'function' ? getSchoolInfoFields() : CloudConfigManager.getSchoolInfoFields();
    const f = fields.find(x => x.id === fieldId || x.field_name === fieldId);
    const label = f ? (f.label || f.field_label || fieldId) : fieldId;

    showConfirm(`هل تريد حذف حقل "<strong>${label}</strong>" من بيانات المدرسة نهائياً؟`, async () => {
      if (typeof saveSchoolInfoFields === 'function') {
        const updated = fields.filter(x => x.id !== fieldId && x.field_name !== fieldId);
        saveSchoolInfoFields(updated);
      }
      if (window.CloudConfigManager?.deleteSchoolInfoField) {
        await CloudConfigManager.deleteSchoolInfoField(fieldId);
      }
      if (typeof renderSchoolInfoFieldMgr === 'function') renderSchoolInfoFieldMgr();
      await this.loadFields();
      if (window.renderSchoolInfoPage) window.renderSchoolInfoPage();
    });
  },
  
  // إضافة حقل بيانات مدرسة جديد
  addSchoolInfoField() {
    if (window.openAddSchoolInfoFieldModal) {
      window.openAddSchoolInfoFieldModal();
    } else {
      alert('تعذر فتح نافذة إضافة الحقل');
    }
  },

  // تعديل حقل بيانات مدرسة
  async editSchoolInfoField(fieldId) {
    if (window.editSchoolInfoField) {
      window.editSchoolInfoField(fieldId);
    } else {
      const fields = window.getSchoolInfoFields ? window.getSchoolInfoFields() : [];
      const field = fields.find(f => f.id === fieldId);
      if (!field) return;

      const newLabel = prompt('تعديل اسم الحقل:', field.label);
      if (newLabel === null) return;

      let newOptions = field.options;
      if (field.type === 'select' || field.type === 'multiselect' || field.type === 'checkboxes') {
        const currentOptsStr = Array.isArray(field.options) ? field.options.join(', ') : (field.options || '');
        const optsStr = prompt('خيارات القائمة (مفصولة بفاصلة):', currentOptsStr);
        if (optsStr !== null) {
          newOptions = optsStr.split(/[,،]/).map(s => s.trim()).filter(Boolean);
        }
      }

      field.label = newLabel.trim() || field.label;
      if (newOptions) field.options = newOptions;

      if (window.saveSchoolInfoFields) {
        window.saveSchoolInfoFields(fields);
      }
      await this.loadFields();
      if (window.renderSchoolInfoPage) window.renderSchoolInfoPage();
      if (window.renderSchoolInfoFieldMgr) window.renderSchoolInfoFieldMgr();
      alert('✅ تم تحديث الحقل بنجاح');
    }
  },
  
  // مزامنة مع السحابة
  async syncNow() {
    const btn = document.getElementById('sync-fields-btn');
    const originalText = btn?.innerHTML;
    if (btn) {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9"/></svg> جاري المزامنة...';
      btn.disabled = true;
    }
    
    const result = await CloudConfigManager.sync();
    
    if (btn) {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
    
    if (result.ok) {
      await this.loadFields();
      if (window.renderTbl) {
        window.renderTbl('teach');
        window.renderTbl('stud');
      }
      alert('✅ تمت المزامنة بنجاح');
    } else {
      alert('❌ فشل المزامنة: ' + (result.error || 'unknown error'));
    }
  },
  
  // دوال مساعدة
  getFieldTypeName(type) {
    const names = {
      text: 'نص قصير',
      textarea: 'نص طويل',
      number: 'رقم',
      date: 'تاريخ',
      select: 'قائمة منسدلة',
      multiselect: 'قائمة متعددة',
      checkboxes: 'مربعات اختيار'
    };
    return names[type] || type;
  },
  
  getFieldColor(type) {
    const colors = {
      text: '#1d4ed8',
      textarea: '#6d28d9',
      date: '#0f766e',
      select: '#c8922a',
      multiselect: '#7c3aed',
      number: '#b91c1c',
      checkboxes: '#15803d'
    };
    return colors[type] || '#888';
  },
  
  getFieldIcon(type) {
    const icons = {
      text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 6.1H3M21 12.1H3M15.1 18H3"/></svg>',
      textarea: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>',
      date: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      select: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>',
      multiselect: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h5M4 12h5M4 17h5M14 8l3 3-3 3"/></svg>',
      number: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
      checkboxes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
    };
    return icons[type] || icons.text;
  },
  
  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }
};

window.FieldManagerUI = FieldManagerUI;