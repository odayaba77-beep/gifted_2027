// ============================================================
// StorageManager — مدير التخزين الموحد (localStorage + IndexedDB)
// ============================================================

const StorageManager = {
  _db: null,

  async initDB() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('gifted_db', 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('backups')) db.createObjectStore('backups', { keyPath: 'id' });
        };
        req.onsuccess = (e) => { this._db = e.target.result; resolve(true); };
        req.onerror = () => resolve(false);
      } catch { resolve(false); }
    });
  },

  async writeIDB(type, records) {
    if (!this._db) return;
    const tx = this._db.transaction('records', 'readwrite');
    const store = tx.objectStore('records');
    records.forEach(r => store.put({ ...r, _type: type }));
  },

  async readIDB(type) {
    if (!this._db) return null;
    return new Promise((resolve) => {
      const tx = this._db.transaction('records', 'readonly');
      const store = tx.objectStore('records');
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []).filter(r => r._type === type));
      req.onerror = () => resolve(null);
    });
  },

  async saveBackupIDB(label, data) {
    if (!this._db) return;
    const tx = this._db.transaction('backups', 'readwrite');
    tx.objectStore('backups').put({ id: Date.now().toString(), label, data, ts: new Date().toISOString() });
  },

  set(key, value) {
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (e) {
      console.warn('[StorageManager] localStorage ممتلئة:', e);
      try {
        localStorage.removeItem('gft_sync_log');
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        alert('مساحة التخزين ممتلئة. يُرجى عمل نسخة احتياطية وتصدير الملف.');
      }
    }
  },

  get(key) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch { return null; }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[StorageManager] remove error:', e);
    }
  }
};

// ============================================================
// ConfigManager — مدير الإعدادات الدائمة
// ============================================================

const ConfigManager = {
  load() {
    const lsSchools = this._lsGet('gft_schools_list');
    if (lsSchools) CONFIG_DATA.schools = lsSchools;
    const lsSync = this._lsGet('gft_sync_config');
    if (lsSync && lsSync.url) CONFIG_DATA.syncUrl = lsSync.url;
  },

  _lsGet(key) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch { return null; }
  },

  save(key, value) {
    if (key === 'schools') {
      CONFIG_DATA.schools = value;
      localStorage.setItem('gft_schools_list', JSON.stringify(value));
    } else if (key === 'syncUrl') {
      CONFIG_DATA.syncUrl = value;
    } else if (key === 'fields_teach') {
      CONFIG_DATA.fields.teach = value;
    } else if (key === 'fields_stud') {
      CONFIG_DATA.fields.stud = value;
    } else if (key === 'schoolInfoFields') {
      CONFIG_DATA.schoolInfoFields = value;
    } else if (key === 'users') {
      CONFIG_DATA.users = value;
    }
    CONFIG_DATA.updatedAt = Date.now();
  },

  getSchools() {
    return [...(CONFIG_DATA.schools || ['بغداد', 'النجف', 'البصرة', 'نينوى', 'الأنبار', 'ميسان', 'ذي قار'])];
  },

  exportHTML() {
    try {
      const html = document.documentElement.outerHTML;
      const configBlock = `<script id="embedded-config">\nconst CONFIG_DATA = ${JSON.stringify(CONFIG_DATA, null, 2)};\n<\/script>`;
      const updated = html.replace(/<script id="embedded-config">[\s\S]*?<\/script>/, configBlock);
      const blob = new Blob([updated], { type: 'text/html;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `نظام_هيأة_رعاية_الموهوبين_v${CONFIG_DATA.version}_${new Date().toISOString().slice(0, 10)}.html`;
      a.click();
      URL.revokeObjectURL(a.href);
      if (window.addSyncLog) addSyncLog('💾 تم تصدير نسخة الملف المحدثة بنجاح', 'success');
      return true;
    } catch (e) {
      alert('خطأ في تصدير الملف: ' + e.message);
      return false;
    }
  }
};

// ============================================================
// QueueManager — مدير الطابور Offline
// ============================================================

const QueueManager = {
  _key: 'gft_op_queue',

  getAll() {
    return StorageManager.get(this._key) || [];
  },

  add(op) {
    const q = this.getAll();
    const filtered = q.filter(o => !(o.type === op.type && o.school === op.school));
    filtered.push({ ...op, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), addedAt: new Date().toISOString(), attempts: 0 });
    StorageManager.set(this._key, filtered);
    this.updateBadge();
  },

  remove(id) {
    const q = this.getAll().filter(o => o.id !== id);
    StorageManager.set(this._key, q);
    this.updateBadge();
  },

  clear() {
    StorageManager.set(this._key, []);
    this.updateBadge();
  },

  updateBadge() {
    const q = this.getAll();
    const badge = document.getElementById('nb-pending');
    const cb = document.getElementById('pending-count-badge');
    if (badge) {
      badge.textContent = q.length;
      badge.style.display = q.length > 0 ? 'inline-flex' : 'none';
    }
    if (cb) cb.textContent = q.length + ' سجل معلّق';
    const dot = document.getElementById('cloud-status-dot');
    const lbl = document.getElementById('cloud-status-lbl');
    if (dot && lbl) {
      if (!navigator.onLine) {
        dot.className = 'cloud-dot red';
        lbl.textContent = '🔴 غير متصل';
      } else if (q.length > 0) {
        dot.className = 'cloud-dot yellow';
        lbl.textContent = '🟡 عمليات معلقة: ' + q.length;
      } else {
        dot.className = 'cloud-dot green';
        lbl.textContent = '🟢 متصل بالسحابة';
      }
    }
    if (window.renderPendingList) window.renderPendingList();
  },

  async flush() {
    if (!navigator.onLine) return;
    const q = this.getAll();
    if (!q.length) return;
    const cfg = CloudSyncManager?.getConfig?.() || StorageManager.get('gft_sync_config') || {};
    if (!cfg?.url) return;
    for (const op of q) {
      const ok = await CloudSyncManager?.sendData?.(op.type, op.records, op.school) || false;
      if (ok) this.remove(op.id);
      await new Promise(r => setTimeout(r, 300));
    }
  }
};

// ============================================================
// EventSystem — نظام الأحداث الداخلي
// ============================================================

const EventSystem = {
  _handlers: {},
  on(event, fn) { (this._handlers[event] = this._handlers[event] || []).push(fn); },
  emit(event, data) { (this._handlers[event] || []).forEach(fn => { try { fn(data); } catch (e) { } }); },
  off(event, fn) { this._handlers[event] = (this._handlers[event] || []).filter(h => h !== fn); }
};

// ============================================================
// BackupManager — مدير النسخ الاحتياطية
// ============================================================

const BackupManager = {
  async createFull(label = '') {
    const snapshot = {
      id: Date.now().toString(),
      label: label || `نسخة_${new Date().toLocaleString('ar-IQ')}`,
      ts: new Date().toISOString(),
      version: CONFIG_DATA.version,
      teach: window.gdb ? window.gdb('teach') : [],
      stud: window.gdb ? window.gdb('stud') : [],
      config: JSON.parse(JSON.stringify(CONFIG_DATA))
    };
    const bks = this.getAll();
    bks.unshift(snapshot);
    if (bks.length > 5) bks.splice(5);
    StorageManager.set('gft_backups_full', bks);
    await StorageManager.saveBackupIDB(snapshot.label, snapshot);
    if (window.addSyncLog) window.addSyncLog(`💾 تم إنشاء نسخة احتياطية: ${snapshot.label}`, 'success');
    return snapshot;
  },

  getAll() {
    return StorageManager.get('gft_backups_full') || [];
  },

  restore(id) {
    const bks = this.getAll();
    const bk = bks.find(b => b.id === id);
    if (!bk) {
      alert('النسخة الاحتياطية غير موجودة');
      return;
    }
    if (!confirm(`هل تريد استعادة نسخة: "${bk.label}"؟\nسيتم استبدال البيانات الحالية.`)) return;
    if (window.sdb) {
      window.sdb('teach', bk.teach || []);
      window.sdb('stud', bk.stud || []);
    }
    if (window.refreshAll) window.refreshAll();
    if (window.addSyncLog) window.addSyncLog(`✅ تم استعادة نسخة: ${bk.label}`, 'success');
    alert('✅ تم استعادة البيانات بنجاح');
  }
};

// ============================================================
// AutoSaveSystem — نظام الحفظ التلقائي
// ============================================================

const AutoSaveSystem = {
  _timer: null,
  start() {
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => {
      BackupManager.createFull('حفظ_تلقائي_' + new Date().toLocaleTimeString('ar-IQ'));
    }, 30 * 60 * 1000);
  },
  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }
};

// دوال مساعدة للتخزين المؤقت
function getCurrentAcademicYear() {
  const m = new Date().getMonth() + 1, y = new Date().getFullYear();
  const s = (m >= 9) ? y : y - 1;
  return s + '-' + (s + 1);
}

function getSchoolsList() {
  try {
    const s = localStorage.getItem('gft_schools_list');
    if (s) {
      const a = JSON.parse(s);
      if (Array.isArray(a) && a.length) {
        CONFIG_DATA.schools = a;
        return a;
      }
    }
  } catch { }
  return [...(CONFIG_DATA.schools || SCHOOLS_DEFAULT)];
}

function saveSchoolsList(arr) {
  CONFIG_DATA.schools = arr;
  localStorage.setItem('gft_schools_list', JSON.stringify(arr));
  CONFIG_DATA.updatedAt = Date.now();
  if (window.syncSchoolsListToSupabase) {
    window.syncSchoolsListToSupabase(arr);
  } else if (window.saveSettingsToSupabase) {
    window.saveSettingsToSupabase('schools_list', arr);
  }
}

function getUsers() {
  try {
    const s = localStorage.getItem('gft_users');
    if (s) {
      const saved = JSON.parse(s);
      const merged = { ...USERS_DEFAULT };
      Object.keys(saved).forEach(k => {
        if (merged[k]) {
          merged[k] = { ...merged[k], pass: saved[k].pass, passHash: saved[k].passHash, username: saved[k].username || k };
        } else {
          merged[k] = saved[k];
        }
      });
      return merged;
    }
    return { ...USERS_DEFAULT };
  } catch { return { ...USERS_DEFAULT }; }
}

function persistUserCredentialHash(origKey, passHash, username) {
  const nameMap = JSON.parse(localStorage.getItem('gft_usernames') || '{}');
  if (!nameMap[origKey]) nameMap[origKey] = {};
  if (username && username !== origKey) nameMap[origKey].newUsername = username;
  nameMap[origKey].passHash = passHash;
  delete nameMap[origKey].pass;
  localStorage.setItem('gft_usernames', JSON.stringify(nameMap));
  if (window.saveSettingsToSupabase) {
    window.saveSettingsToSupabase('gft_usernames', nameMap);
  }
}

function buildUsersMap() {
  const base = getUsers();
  const nameMap = JSON.parse(localStorage.getItem('gft_usernames') || '{}');
  const result = {};
  Object.keys(base).forEach(origKey => {
    const override = nameMap[origKey];
    const loginKey = override && override.newUsername ? override.newUsername : origKey;
    result[loginKey] = {
      ...base[origKey],
      pass: override && override.pass ? override.pass : base[origKey].pass,
      passHash: override && override.passHash ? override.passHash : base[origKey].passHash,
      _origKey: origKey
    };
  });
  // dynamic schools
  Object.keys(nameMap).forEach(k => {
    if (k.startsWith('school_') && nameMap[k].newUsername && (nameMap[k].passHash || nameMap[k].pass)) {
      const schoolName = k.replace(/^school_/, '').replace(/_/g, ' ');
      if (!result[nameMap[k].newUsername]) {
        result[nameMap[k].newUsername] = {
          pass: nameMap[k].pass,
          passHash: nameMap[k].passHash,
          role: 'مدرسة ' + schoolName,
          name: 'مسؤول مدرسة ' + schoolName,
          school: schoolName,
          av: schoolName.substring(0, 2),
          isAdmin: false,
          _origKey: k
        };
      }
    }
  });
  return result;
}

const FIELD_TYPE_MAP = { teach: 'staff', stud: 'students', si: 'school' };

function getFieldConfigForType(type) {
  if (window.FIELD_CONFIG) {
    if (!Array.isArray(window.FIELD_CONFIG.staff)) window.FIELD_CONFIG.staff = [];
    if (!Array.isArray(window.FIELD_CONFIG.students)) window.FIELD_CONFIG.students = [];
    if (!Array.isArray(window.FIELD_CONFIG.school)) window.FIELD_CONFIG.school = [];
    if (type === 'teach') return window.FIELD_CONFIG.staff;
    if (type === 'stud') return window.FIELD_CONFIG.students;
    if (type === 'si') return window.FIELD_CONFIG.school;
  }
  return [];
}

function getFieldConfigDefaults(type) {
  if (window.FIELD_CONFIG_DEFAULTS) {
    if (type === 'teach') return FIELD_CONFIG_DEFAULTS.staff || [];
    if (type === 'stud') return FIELD_CONFIG_DEFAULTS.students || [];
    if (type === 'si') return FIELD_CONFIG_DEFAULTS.school || [];
  }
  return [];
}

function normalizeCentralField(f, index) {
  const id = f.id || f.field_name || ('field_' + index);
  return {
    id,
    label: f.label || f.field_label || id,
    type: f.type || f.field_type || 'text',
    required: !!f.required,
    core: f.core === true || f.is_core === true || f.core === 'TRUE',
    visible: f.visible !== false && f.visible !== 'FALSE',
    options: Array.isArray(f.options) ? f.options : (typeof f.options === 'string' && f.options ? f.options.split(/[,،]/).map(s => s.trim()).filter(Boolean) : undefined),
    sort_order: Number(f.sort_order || f.order || index + 1)
  };
}

function mergeCentralFields(type, remoteFields) {
  const core = getFieldConfigForType(type).length ? getFieldConfigForType(type) : (CORE_FIELDS[type] || []);
  const seen = new Set();
  const merged = [];
  (remoteFields || []).sort((a, b) => (Number(a.sort_order || a.order || 0) - Number(b.sort_order || b.order || 0))).forEach((raw, index) => {
    const sf = normalizeCentralField(raw, index);
    if (seen.has(sf.id)) return;
    seen.add(sf.id);
    const coreDef = core.find(c => c.id === sf.id);
    merged.push(coreDef ? { ...coreDef, ...sf, id: coreDef.id, core: true } : sf);
  });
  core.forEach(cf => {
    if (!seen.has(cf.id)) {
      seen.add(cf.id);
      merged.push({ ...cf });
    }
  });
  return merged;
}

function getEmbeddedSchemaFields(type) {
  const localConfig = getFieldConfigForType(type);
  if (Array.isArray(localConfig) && localConfig.length) return localConfig;
  const embedded = (window.CENTRAL_SCHEMA_CONFIG && window.CENTRAL_SCHEMA_CONFIG.fields) || CONFIG_DATA.fields || {};
  return embedded[type] || [];
}

function getFields(type) {
  const localConfig = getFieldConfigForType(type);
  return Array.isArray(localConfig) ? localConfig : [];
}

async function publishCentralFields(type, fields) {
  if (!window.CloudConfigManager || !CloudConfigManager.isConnected()) {
    ConfigManager.save('fields_' + type, fields);
    return { ok: true, localOnly: true };
  }
  const target = FIELD_TYPE_MAP[type];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const payload = {
      id: f.id,
      field_name: f.id,
      field_label: f.label,
      field_type: f.type,
      target,
      required: !!f.required,
      visible: f.visible !== false,
      sort_order: i + 1,
      options: f.options || []
    };
    if (f._deleted) {
      const res = await CloudConfigManager.deleteField(f.id, f.label);
      if (!res.ok) return res;
    } else if (f._new) {
      const res = await CloudConfigManager.addField(payload);
      if (!res.ok) return res;
    } else {
      const res = await CloudConfigManager.updateField(f.id, payload);
      if (!res.ok) return res;
    }
  }
  await CloudConfigManager.fetchAllConfig();
  return { ok: true };
}

function saveFields(type, fields) {
  const normalized = fields.map((f, index) => ({ ...f, sort_order: index + 1 }));
  if (!window.FIELD_CONFIG) {
    window.FIELD_CONFIG = { staff: [], students: [], school: [] };
  }
  if (!Array.isArray(window.FIELD_CONFIG.staff)) window.FIELD_CONFIG.staff = [];
  if (!Array.isArray(window.FIELD_CONFIG.students)) window.FIELD_CONFIG.students = [];
  if (!Array.isArray(window.FIELD_CONFIG.school)) window.FIELD_CONFIG.school = [];
  
  if (type === 'teach' || type === 'staff') {
    if (window.CONFIG_DATA) {
      if (!CONFIG_DATA.fields) CONFIG_DATA.fields = {};
      CONFIG_DATA.fields.teach = normalized;
    }
    window.FIELD_CONFIG.staff = normalized;
    if (window.CORE_FIELDS) CORE_FIELDS.teach = normalized;
  } else if (type === 'stud' || type === 'students') {
    if (window.CONFIG_DATA) {
      if (!CONFIG_DATA.fields) CONFIG_DATA.fields = {};
      CONFIG_DATA.fields.stud = normalized;
    }
    window.FIELD_CONFIG.students = normalized;
    if (window.CORE_FIELDS) CORE_FIELDS.stud = normalized;
  } else if (type === 'si' || type === 'school') {
    if (window.CONFIG_DATA) CONFIG_DATA.schoolInfoFields = normalized;
    window.FIELD_CONFIG.school = normalized;
  }

  if (window.CONFIG_DATA) CONFIG_DATA.updatedAt = Date.now();

  try {
    ConfigManager.save('fields_' + type, normalized);
    localStorage.setItem('gft_fields_config', JSON.stringify(window.FIELD_CONFIG));
  } catch (e) {}

  if (window.CloudConfigManager) {
    const targetMap = { teach: 'staff', staff: 'staff', stud: 'students', students: 'students', si: 'schools', school: 'schools' };
    const targetKey = targetMap[type] || type;
    if (targetKey === 'schools') {
      CloudConfigManager._cache.schoolInfoFields = normalized;
    } else if (CloudConfigManager._cache.fields) {
      CloudConfigManager._cache.fields[targetKey] = normalized.map(f => ({
        id: f.id,
        field_name: f.id,
        field_label: f.label || f.field_label,
        field_type: f.type || f.field_type || 'text',
        target: targetKey,
        required: !!f.required,
        visible: f.visible !== false,
        sort_order: f.sort_order || 0,
        options: f.options || [],
        school_scope: f.school_scope || 'all'
      }));
    }
    CloudConfigManager._saveToCache();
  }

  if (window.saveSettingsToSupabase) {
    if (type === 'si' || type === 'school') {
      window.saveSettingsToSupabase('school_info_fields', normalized);
    } else {
      window.saveSettingsToSupabase('fields_config', window.FIELD_CONFIG);
    }
  }

  publishCentralFields(type, normalized).catch(err => {
    console.warn('[CentralSchema] publish note:', err.message || err);
  });
}

function visibleFields(type) {
  return getFields(type).filter(f => f.visible);
}

function getSchoolInfoFields() {
  if (window.FIELD_CONFIG) {
    if (!Array.isArray(window.FIELD_CONFIG.school) || window.FIELD_CONFIG.school.length === 0) {
      if (Array.isArray(CONFIG_DATA.schoolInfoFields) && CONFIG_DATA.schoolInfoFields.length > 0) {
        window.FIELD_CONFIG.school = [...CONFIG_DATA.schoolInfoFields];
      } else if (window.SCHOOL_INFO_DEFAULTS) {
        window.FIELD_CONFIG.school = [...SCHOOL_INFO_DEFAULTS];
      } else {
        window.FIELD_CONFIG.school = [];
      }
    }
    return window.FIELD_CONFIG.school.map(normalizeCentralField);
  }
  return (CONFIG_DATA.schoolInfoFields || window.SCHOOL_INFO_DEFAULTS || []).map(normalizeCentralField);
}

function saveSchoolInfoFields(arr) {
  const normalized = arr.map((f, index) => ({ ...f, sort_order: index + 1 }));
  if (!window.FIELD_CONFIG) {
    window.FIELD_CONFIG = { staff: [], students: [], school: [] };
  }
  if (!Array.isArray(window.FIELD_CONFIG.school)) window.FIELD_CONFIG.school = [];
  CONFIG_DATA.schoolInfoFields = normalized;
  window.FIELD_CONFIG.school = normalized;
  CONFIG_DATA.updatedAt = Date.now();

  if (window.saveSettingsToSupabase) {
    window.saveSettingsToSupabase('school_info_fields', normalized);
  }

  if (window.CloudConfigManager && CloudConfigManager.isConnected()) {
    CONFIG_DATA.schoolInfoFields.forEach((f, index) => {
      const payload = { ...f, sort_order: index + 1 };
      CloudConfigManager.updateSchoolInfoField(f.id, payload).then(res => {
        if (!res.ok) return CloudConfigManager.addSchoolInfoField(payload);
      }).catch(err => console.error('[CentralSchema] school field publish failed:', err));
    });
  }
}

function getSchoolInfoData(school) {
  if (!school) return {};
  const key = 'gft_si_' + btoa(encodeURIComponent(school)).replace(/=/g, '');
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    let parsed = JSON.parse(raw);
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch(e) {}
    }
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch { return {}; }
}

function saveSchoolInfoData(school, data) {
  if (!school) return;
  const key = 'gft_si_' + btoa(encodeURIComponent(school)).replace(/=/g, '');
  const cleanData = (data && typeof data === 'object') ? data : {};
  localStorage.setItem(key, JSON.stringify(cleanData));
  if (window.syncSchoolInfoToSupabase) {
    window.syncSchoolInfoToSupabase(school, cleanData);
  } else if (window.saveSettingsToSupabase) {
    window.saveSettingsToSupabase(key, cleanData);
  }
}

function getSubjects() {
  try {
    const s = localStorage.getItem('gft_subjects');
    if (s) {
      const a = JSON.parse(s);
      if (Array.isArray(a) && a.length) return a;
    }
  } catch (e) { }
  return [...CONFIG_DATA.subjects];
}

function saveSubjects(arr) {
  localStorage.setItem('gft_subjects', JSON.stringify(arr));
  CONFIG_DATA.subjects = arr;
  const staffFields = getFieldConfigForType('teach');
  const coreF = staffFields.find(f => f.id === 'subject');
  if (coreF) coreF.options = arr;
  if (window.FIELD_CONFIG) {
    const cfg = window.FIELD_CONFIG.staff || [];
    const subjectField = cfg.find(f => f.id === 'subject');
    if (subjectField) subjectField.options = arr;
  }
}
