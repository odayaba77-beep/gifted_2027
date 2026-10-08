// ============================================================
// CloudConfigManager — نظام الإدارة المركزية للحقول
// ============================================================

const CloudConfigManager = {
  _configUrl: null,
  _token: null,
  _cache: {
    fields: { students: [], staff: [], schools: [] },
    schoolInfoFields: [],
    version: 0,
    lastSync: null
  },
  _syncInterval: null,
  _listeners: {},

  // تهيئة المدير
  init(url, token) {
    this._configUrl = url;
    this._token = token;
    this._loadFromCache();
    return this;
  },

  // تحميل من cache مؤقت
  _loadFromCache() {
    try {
      const saved = localStorage.getItem('gft_cloud_config_cache');
      if (saved) {
        this._cache = JSON.parse(saved);
      }
    } catch(e) {}
    return this._cache;
  },

  // حفظ في cache
  _saveToCache() {
    try {
      localStorage.setItem('gft_cloud_config_cache', JSON.stringify(this._cache));
    } catch(e) {}
  },

  // جلب الحقول من السحابة
  async fetchFields(target = 'all', school = null) {
    if (!this._configUrl) {
      return null;
    }

    if (this._configUrl.includes('supabase.co') || !this._configUrl.startsWith('https://script.google.com')) {
      await this.fetchAllConfig();
      if (target === 'students') return this.getStudentFields(school);
      if (target === 'staff') return this.getStaffFields(school);
      if (target === 'schools') return this.getSchoolInfoFields();
      return this._cache.fields;
    }

    try {
      const url = `${this._configUrl}?action=getFields&target=${target}&school=${school || ''}&token=${this._token}&ts=${Date.now()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data && data.ok) {
        if (target === 'all') {
          const studentsFields = (data.fields || []).filter(f => f.target === 'students');
          const staffFields = (data.fields || []).filter(f => f.target === 'staff');
          const schoolsFields = (data.fields || []).filter(f => f.target === 'schools');
          
          this._cache.fields = {
            students: studentsFields,
            staff: staffFields,
            schools: schoolsFields
          };
          this._cache.version = data.version || Date.now();
          this._cache.lastSync = new Date().toISOString();
          this._saveToCache();
        }
        
        this._notifyListeners('fields-updated', { target, fields: data.fields });
        return data.fields;
      }
      return null;
    } catch (err) {
      console.warn('[CloudConfig] fetchFields warning:', err.message || err);
      return null;
    }
  },

  // جلب جميع الإعدادات
  async fetchAllConfig() {
    if (!this._configUrl) return this._cache;

    // دعم Supabase
    if (this._configUrl.includes('supabase.co') || !this._configUrl.startsWith('https://script.google.com')) {
      try {
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
          const { data } = await supabaseClient.from('settings').select('*').in('key', ['fields_config', 'school_info_fields']);
          if (data && data.length > 0) {
            data.forEach(item => {
              if (item.key === 'fields_config' && item.value) {
                this._cache.fields = item.value;
              }
              if (item.key === 'school_info_fields' && Array.isArray(item.value)) {
                this._cache.schoolInfoFields = item.value;
              }
            });
          }
        }
      } catch (e) {
        console.warn('[CloudConfig] Supabase fetch settings warning:', e.message || e);
      }
      this._notifyListeners('config-loaded', this._cache);
      return this._cache;
    }

    try {
      const url = `${this._configUrl}?action=getAllConfig&token=${this._token}&ts=${Date.now()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data && data.ok) {
        const studentsFields = (data.fields || []).filter(f => f.target === 'students');
        const staffFields = (data.fields || []).filter(f => f.target === 'staff');
        const schoolsFields = (data.fields || []).filter(f => f.target === 'schools');
        
        this._cache.fields = {
          students: studentsFields,
          staff: staffFields,
          schools: schoolsFields
        };
        this._cache.schoolInfoFields = data.schoolInfoFields || [];
        this._cache.version = data.version || Date.now();
        this._cache.lastSync = new Date().toISOString();
        this._saveToCache();
        
        this._notifyListeners('config-loaded', this._cache);
        return this._cache;
      }
      return this._cache;
    } catch (err) {
      console.warn('[CloudConfig] fetchAllConfig network issue:', err.message || err);
      return this._cache;
    }
  },

  // إضافة حقل جديد
  async addField(fieldData) {
    const target = fieldData.target || 'students';
    if (!this._cache.fields[target]) this._cache.fields[target] = [];
    const idx = this._cache.fields[target].findIndex(f => f.id === fieldData.id || f.field_name === fieldData.id);
    if (idx >= 0) {
      this._cache.fields[target][idx] = { ...this._cache.fields[target][idx], ...fieldData };
    } else {
      this._cache.fields[target].push({
        id: fieldData.id || fieldData.field_name,
        field_name: fieldData.field_name || fieldData.id,
        field_label: fieldData.field_label || fieldData.label,
        field_type: fieldData.field_type || fieldData.type || 'text',
        target,
        required: !!fieldData.required,
        visible: fieldData.visible !== false,
        sort_order: fieldData.sort_order || 0,
        options: fieldData.options || []
      });
    }
    this._saveToCache();
    if (window.saveSettingsToSupabase) {
      window.saveSettingsToSupabase('fields_config', this._cache.fields);
    }
    this._notifyListeners('field-added', fieldData);

    if (!this._configUrl || !this._configUrl.startsWith('https://script.google.com')) {
      return { ok: true };
    }

    try {
      const response = await fetch(this._configUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'addField',
          token: this._token,
          ...fieldData
        })
      });
      const data = await response.json();
      if (data.ok) {
        await this.fetchAllConfig();
      }
      return data;
    } catch (err) {
      console.warn('[CloudConfig] addField fetch warning (fallback to local/supabase):', err.message || err);
      return { ok: true, offline: true };
    }
  },

  // تحديث حقل
  async updateField(fieldId, updates) {
    let updatedLocal = false;
    ['students', 'staff', 'schools'].forEach(target => {
      if (Array.isArray(this._cache.fields[target])) {
        const field = this._cache.fields[target].find(f => f.id === fieldId || f.field_name === fieldId);
        if (field) {
          if (updates.visible !== undefined) field.visible = updates.visible;
          if (updates.field_label) { field.field_label = updates.field_label; field.label = updates.field_label; }
          if (updates.label) { field.label = updates.label; field.field_label = updates.label; }
          if (updates.field_type) { field.field_type = updates.field_type; field.type = updates.field_type; }
          if (updates.type) { field.field_type = updates.type; field.type = updates.type; }
          if (updates.required !== undefined) field.required = updates.required;
          if (updates.options !== undefined) field.options = updates.options;
          if (updates.school_scope !== undefined) field.school_scope = updates.school_scope;
          updatedLocal = true;
        }
      }
    });
    if (Array.isArray(this._cache.schoolInfoFields)) {
      const field = this._cache.schoolInfoFields.find(f => f.id === fieldId);
      if (field) {
        if (updates.visible !== undefined) field.visible = updates.visible;
        if (updates.field_label) { field.field_label = updates.field_label; field.label = updates.field_label; }
        if (updates.label) { field.label = updates.label; field.field_label = updates.label; }
        if (updates.field_type) { field.field_type = updates.field_type; field.type = updates.field_type; }
        if (updates.type) { field.field_type = updates.type; field.type = updates.type; }
        if (updates.required !== undefined) field.required = updates.required;
        if (updates.options !== undefined) field.options = updates.options;
        updatedLocal = true;
      }
    }
    if (window.FIELD_CONFIG) {
      ['students', 'staff', 'school'].forEach(t => {
        if (Array.isArray(window.FIELD_CONFIG[t])) {
          const f = window.FIELD_CONFIG[t].find(x => x.id === fieldId);
          if (f) {
            if (updates.field_label) f.label = updates.field_label;
            if (updates.label) f.label = updates.label;
            if (updates.field_type) f.type = updates.field_type;
            if (updates.type) f.type = updates.type;
            if (updates.required !== undefined) f.required = updates.required;
            if (updates.visible !== undefined) f.visible = updates.visible;
            if (updates.options !== undefined) f.options = updates.options;
            if (updates.school_scope !== undefined) f.school_scope = updates.school_scope;
          }
        }
      });
    }
    this._saveToCache();
    if (window.saveSettingsToSupabase) {
      window.saveSettingsToSupabase('fields_config', this._cache.fields);
    }
    this._notifyListeners('field-updated', { id: fieldId, updates });

    if (!this._configUrl || !this._configUrl.startsWith('https://script.google.com')) {
      return { ok: true };
    }

    try {
      const response = await fetch(this._configUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'updateField',
          token: this._token,
          id: fieldId,
          ...updates
        })
      });
      const data = await response.json();
      if (data.ok) {
        await this.fetchAllConfig();
      }
      return data;
    } catch (err) {
      console.warn('[CloudConfig] updateField fetch warning (fallback to local/supabase):', err.message || err);
      return { ok: true, offline: true };
    }
  },

  // حذف حقل
  async deleteField(fieldId, fieldLabel) {
    ['students', 'staff', 'schools'].forEach(target => {
      if (Array.isArray(this._cache.fields[target])) {
        this._cache.fields[target] = this._cache.fields[target].filter(f => f.id !== fieldId && f.field_name !== fieldId);
      }
    });
    this._saveToCache();
    if (window.saveSettingsToSupabase) {
      window.saveSettingsToSupabase('fields_config', this._cache.fields);
    }
    this._notifyListeners('field-deleted', { id: fieldId });

    if (!this._configUrl || !this._configUrl.startsWith('https://script.google.com')) {
      return { ok: true };
    }

    try {
      const response = await fetch(this._configUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deleteField',
          token: this._token,
          id: fieldId,
          field_label: fieldLabel
        })
      });
      const data = await response.json();
      if (data.ok) {
        await this.fetchAllConfig();
      }
      return data;
    } catch (err) {
      console.warn('[CloudConfig] deleteField fetch warning (fallback to local/supabase):', err.message || err);
      return { ok: true, offline: true };
    }
  },

  async addSchoolInfoField(fieldData) {
    return this._postSchoolInfoField('addSchoolInfoField', fieldData);
  },

  async updateSchoolInfoField(fieldId, updates) {
    return this._postSchoolInfoField('updateSchoolInfoField', { id: fieldId, ...updates });
  },

  async deleteSchoolInfoField(fieldId) {
    if (!Array.isArray(this._cache.schoolInfoFields)) this._cache.schoolInfoFields = [];
    this._cache.schoolInfoFields = this._cache.schoolInfoFields.filter(f => f.id !== fieldId);
    this._saveToCache();
    if (window.saveSettingsToSupabase) {
      window.saveSettingsToSupabase('school_info_fields', this._cache.schoolInfoFields);
    }

    if (!this._configUrl || !this._configUrl.startsWith('https://script.google.com')) {
      return { ok: true };
    }

    try {
      const response = await fetch(this._configUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteSchoolInfoField', token: this._token, id: fieldId })
      });
      const data = await response.json();
      if (data.ok) await this.fetchAllConfig();
      return data;
    } catch (err) {
      console.warn('[CloudConfig] deleteSchoolInfoField fetch warning:', err.message || err);
      return { ok: true, offline: true };
    }
  },

  async _postSchoolInfoField(action, fieldData) {
    if (!Array.isArray(this._cache.schoolInfoFields)) this._cache.schoolInfoFields = [];
    const fid = fieldData.id;
    const idx = this._cache.schoolInfoFields.findIndex(f => f.id === fid);
    const itemData = {
      id: fid,
      label: fieldData.label || fieldData.field_label || (idx >= 0 ? this._cache.schoolInfoFields[idx].label : ''),
      type: fieldData.type || fieldData.field_type || (idx >= 0 ? this._cache.schoolInfoFields[idx].type : 'text'),
      required: fieldData.required !== undefined ? !!fieldData.required : (idx >= 0 ? !!this._cache.schoolInfoFields[idx].required : false),
      visible: fieldData.visible !== undefined ? fieldData.visible !== false : (idx >= 0 ? this._cache.schoolInfoFields[idx].visible !== false : true),
      sort_order: fieldData.sort_order || fieldData.order || (idx >= 0 ? this._cache.schoolInfoFields[idx].sort_order : 0),
      options: fieldData.options || (idx >= 0 ? this._cache.schoolInfoFields[idx].options : [])
    };

    if (idx >= 0) {
      this._cache.schoolInfoFields[idx] = { ...this._cache.schoolInfoFields[idx], ...itemData };
    } else {
      this._cache.schoolInfoFields.push(itemData);
    }
    this._saveToCache();
    if (window.saveSettingsToSupabase) {
      window.saveSettingsToSupabase('school_info_fields', this._cache.schoolInfoFields);
    }

    if (!this._configUrl || !this._configUrl.startsWith('https://script.google.com')) {
      return { ok: true };
    }

    try {
      const response = await fetch(this._configUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action,
          token: this._token,
          id: itemData.id,
          label: itemData.label,
          type: itemData.type,
          required: itemData.required,
          visible: itemData.visible,
          sort_order: itemData.sort_order,
          options: itemData.options
        })
      });
      const data = await response.json();
      if (data.ok) await this.fetchAllConfig();
      return data;
    } catch (err) {
      console.warn('[CloudConfig] _postSchoolInfoField fetch warning:', err.message || err);
      return { ok: true, offline: true };
    }
  },

  // مزامنة مع السحابة
  async sync() {
    if (!this._configUrl) return { ok: false };

    try {
      await this.fetchAllConfig();
      this._notifyListeners('sync-complete', { version: this._cache.version });
      return { ok: true, changed: true };
    } catch (err) {
      console.error('[CloudConfig] sync error:', err);
      return { ok: false, error: err.message };
    }
  },

  // بدء المزامنة التلقائية
  startAutoSync(intervalMs = 60000) {
    if (this._syncInterval) clearInterval(this._syncInterval);
    this._syncInterval = setInterval(() => {
      if (navigator.onLine) {
        this.sync();
      }
    }, intervalMs);
  },

  // إيقاف المزامنة التلقائية
  stopAutoSync() {
    if (this._syncInterval) {
      clearInterval(this._syncInterval);
      this._syncInterval = null;
    }
  },

  // الحصول على حقول الطلاب
  getStudentFields(school = null) {
    let fields = this._cache.fields.students || [];
    if (school) {
      fields = fields.filter(f => f.school_scope === 'all' || f.school_scope === school);
    }
    return fields.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  },

  // الحصول على حقول الكادر
  getStaffFields(school = null) {
    let fields = this._cache.fields.staff || [];
    if (school) {
      fields = fields.filter(f => f.school_scope === 'all' || f.school_scope === school);
    }
    return fields.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  },

  // الحصول على حقول المدرسة
  getSchoolInfoFields() {
    return (this._cache.schoolInfoFields || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  },

  // إضافة مستمع للأحداث
  addEventListener(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  },

  _notifyListeners(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach(cb => {
        try { cb(data); } catch (e) {}
      });
    }
  },

  // حفظ إعدادات الاتصال
  saveConnectionConfig(url, token) {
    this._configUrl = url;
    this._token = token;
    if (window.CONFIG_DATA) {
      CONFIG_DATA.syncUrl = url;
      CONFIG_DATA.syncToken = token;
    }
    localStorage.setItem('gft_cloud_config_url', url);
    localStorage.setItem('gft_cloud_config_token', token);
  },

  // تحميل إعدادات الاتصال
  loadConnectionConfig() {
    const embedded = window.CENTRAL_SCHEMA_CONFIG || {};
    this._configUrl = localStorage.getItem('gft_cloud_config_url') || embedded.syncUrl || (window.CONFIG_DATA && CONFIG_DATA.syncUrl) || '';
    this._token = localStorage.getItem('gft_cloud_config_token') || embedded.syncToken || (window.CONFIG_DATA && CONFIG_DATA.syncToken) || '';
    return { url: this._configUrl, token: this._token };
  },
  
  // التحقق من وجود اتصال
  isConnected() {
    return !!this._configUrl;
  }
};

// تصدير للمتصفح
window.CloudConfigManager = CloudConfigManager;
