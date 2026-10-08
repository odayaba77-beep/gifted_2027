// ============================================================
// CloudSyncManager — مدير المزامنة السحابية عبر Supabase
// ============================================================

const SYNC_CONFIG_KEY = 'gft_sync_config';
const SYNC_QUEUE_KEY = 'gft_sync_queue';
const SYNC_LOG_KEY = 'gft_sync_log';

const CloudSyncManager = {
  _syncTimer: null,
  _token: null,

  saveConfig(url, token) {
    const cleanUrl = url.trim();
    const cleanToken = (token || '').trim();
    const cfg = { url: cleanUrl, token: cleanToken, savedAt: new Date().toISOString() };
    StorageManager.set('gft_sync_config', cfg);
    localStorage.setItem('gft_supabase_url', cleanUrl);
    localStorage.setItem('gft_supabase_anon_key', cleanToken);
    
    if (window.SUPABASE_CONFIG) {
      window.SUPABASE_CONFIG.url = cleanUrl;
      window.SUPABASE_CONFIG.anonKey = cleanToken;
    }
    if (window.supabase && cleanUrl && cleanToken) {
      try {
        window.supabaseClient = window.supabase.createClient(cleanUrl, cleanToken);
      } catch (e) {
        console.warn('[Supabase Re-init Warning]:', e);
      }
    }
    ConfigManager.save('syncUrl', cleanUrl);
    this._token = cleanToken;
    return true;
  },

  getConfig() {
    const stored = StorageManager.get('gft_sync_config') || {};
    const url = localStorage.getItem('gft_supabase_url') || stored.url || window.SUPABASE_CONFIG?.url || '';
    const token = localStorage.getItem('gft_supabase_anon_key') || stored.token || window.SUPABASE_CONFIG?.anonKey || '';
    return { url, token };
  },

  _normalizeValue(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
  },

  _recordKey(type, record) {
    if (!record || typeof record !== 'object') return null;
    const preferredIds = ['global_id','globalId','exam_number','examNumber','employee_number','employeeNumber','national_id','nationalId','nid'];
    for (const idField of preferredIds) {
      const val = record[idField];
      if (val) return `uid:${this._normalizeValue(val)}`;
    }
    const school = this._normalizeValue(record.school || '');
    const name = ['name1','name2','name3','name4'].map(k => this._normalizeValue(record[k])).filter(Boolean).join(' ');
    const dob = this._normalizeValue(record.dob || record.birthdate || record.dateOfBirth);
    if (name && dob) return `${type}:name:${name}|${dob}|${school}`;
    const phone = this._normalizeValue(record.phone || record.parentPhone || record.studentPhone || record.mobile);
    if (phone) return `${type}:phone:${phone}|${school}`;
    return null;
  },

  async sendData(type, records, school) {
    const cfg = this.getConfig();
    if (!cfg.url || !cfg.token) {
      if (window.addSyncLog) window.addSyncLog('⚠️ لم يُضبط رابط ومفتاح Supabase بعد', 'warn');
      return false;
    }
    if (!records || !Array.isArray(records)) {
      if (window.addSyncLog) window.addSyncLog('⚠️ بيانات غير صالحة', 'warn');
      return false;
    }

    const safeRecords = records.map(r => {
      const { photo, ...rest } = r;
      return rest;
    });
    const school_ = school || (CU?.school || 'all');
    const typeLabel = type === 'teach' || type === 'staff' ? 'كادر المدرسة' : 'الطلاب';
    const tableName = (type === 'teach' || type === 'staff') ? 'staff' : 'students';

    try {
      if (window.addSyncLog) window.addSyncLog(`⏳ جاري رفع ${typeLabel} (${safeRecords.length} سجل) إلى Supabase — مدرسة ${school_}...`, 'info', { count: safeRecords.length, entity: type, school: school_ });
      
      const client = window.supabaseClient || (window.supabase && window.supabase.createClient(cfg.url, cfg.token));
      if (!client) throw new Error('عميل Supabase غير مهيّأ');

      // Attempt upsert to Supabase
      for (const rec of safeRecords) {
        const rowId = rec.id || (window.nid ? window.nid() : String(Date.now()));
        const rowSchool = rec.school || school_;
        const studentName = [rec.name1, rec.name2, rec.name3, rec.name4].filter(Boolean).join(' ') || rec.name || '';
        
        let upsertObj = {
          id: rowId,
          school: rowSchool,
          name: studentName || rec.name || '',
          details: rec,
          ...rec,
          updated_at: new Date().toISOString()
        };

        const { error } = await client.from(tableName).upsert(upsertObj, { onConflict: 'id' });
        if (error) {
          // If schema is strict on columns, upsert standard columns + details
          const standardObj = {
            id: rowId,
            school: rowSchool,
            name: studentName || rec.name || '',
            details: rec,
            updated_at: new Date().toISOString()
          };
          if (tableName === 'students') {
            standardObj.class = rec.class || rec.stage || '';
          } else {
            standardObj.role = rec.role || rec.jobTitle || '';
          }
          const { error: err2 } = await client.from(tableName).upsert(standardObj, { onConflict: 'id' });
          if (err2) {
            // Fallback: try upserting as JSON value in settings table
            await client.from('settings').upsert({
              key: `record_${tableName}_${rowId}`,
              value: { ...rec, id: rowId, school: rowSchool },
              updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
          }
        }
      }

      if (window.addSyncLog) window.addSyncLog(`✅ تم رفع ${typeLabel} (${safeRecords.length} سجل) إلى Supabase بنجاح`, 'success', { count: safeRecords.length, entity: type, school: school_ });
      if (window.SyncSummaryManager) {
        window.SyncSummaryManager.recordSuccess({
          action: `رفع بيانات ${typeLabel} إلى Supabase`,
          entity: type,
          entityLabel: typeLabel,
          school: school_,
          added: 0,
          updated: safeRecords.length,
          deleted: 0,
          total: safeRecords.length,
          details: `تم رفع وحفظ ${safeRecords.length} سجل في جدول ${tableName}`
        });
      }
      this._logOp('upload', type, safeRecords.length, school_);
      QueueManager.updateBadge();
      return true;
    } catch (err) {
      if (window.addSyncLog) window.addSyncLog(`❌ فشل الرفع إلى Supabase — ${typeLabel} (${safeRecords.length} سجل): ${err.message}`, 'error', { count: safeRecords.length, entity: type, school: school_ });
      QueueManager.add({ type, records: safeRecords, school: school_ });
      return false;
    }
  },

  async downloadData(type, school) {
    const cfg = this.getConfig();
    if (!cfg.url || !cfg.token) {
      alert('يرجى ضبط إعدادات الاتصال بـ Supabase أولاً');
      return null;
    }
    const school_ = school || (CU?.school || 'all');
    const tableName = (type === 'teach' || type === 'staff') ? 'staff' : 'students';

    try {
      if (window.addSyncLog) window.addSyncLog(`⏳ جاري تحميل البيانات من Supabase...`, 'info');
      
      const client = window.supabaseClient || (window.supabase && window.supabase.createClient(cfg.url, cfg.token));
      if (!client) throw new Error('عميل Supabase غير مهيّأ');

      let query = client.from(tableName).select('*');
      if (school_ && school_ !== 'all') {
        query = query.eq('school', school_);
      }
      
      const { data, error } = await query;
      let records = data || [];

      if (error || !records.length) {
        // Fallback check settings table
        const { data: setLogs } = await client.from('settings').select('*').like('key', `record_${tableName}_%`);
        if (setLogs && setLogs.length) {
          records = setLogs.map(s => s.value).filter(Boolean);
          if (school_ && school_ !== 'all') {
            records = records.filter(r => r.school === school_);
          }
        }
      }

      records = records.map(r => {
        if (!r) return null;
        if (r.details && typeof r.details === 'object') {
          const { details, ...rest } = r;
          return { ...details, ...rest };
        }
        return r;
      }).filter(Boolean);

      if (window.addSyncLog) window.addSyncLog(`✅ تم تحميل ${records.length} سجل من Supabase`, 'success');
      return records;
    } catch (err) {
      if (window.addSyncLog) window.addSyncLog(`❌ فشل التحميل من Supabase: ${err.message}`, 'error');
      return null;
    }
  },

  mergeData(type, remoteRecords) {
    if (!remoteRecords?.length) return { added: 0, updated: 0, skipped: 0 };
    const local = window.gdb ? window.gdb(type) : [];
    const byId = {};
    const byKey = {};
    local.forEach(item => {
      if (item && item.id) byId[item.id] = item;
      const key = this._recordKey(type, item);
      if (key) byKey[key] = item;
    });
    let added = 0;
    let updated = 0;
    let skipped = 0;
    remoteRecords.forEach(raw => {
      if (!raw || typeof raw !== 'object') return;
      const record = { ...raw };
      let existing = record.id && byId[record.id] ? byId[record.id] : null;
      const key = this._recordKey(type, record);
      if (!existing && key && byKey[key]) {
        existing = byKey[key];
      }
      if (existing) {
        const localTs = existing.tsEdit || existing.ts || 0;
        const remoteTs = record.tsEdit || record.ts || (record.updated_at ? Date.parse(record.updated_at) : 0) || Date.now();
        if (remoteTs >= localTs || !localTs) {
          const merged = { ...existing, ...record, id: existing.id };
          byId[existing.id] = merged;
          if (key) byKey[key] = merged;
          updated += 1;
        } else {
          skipped += 1;
        }
      } else {
        record.id = record.id || (window.nid ? window.nid() : Date.now().toString());
        byId[record.id] = record;
        if (key) byKey[key] = record;
        added += 1;
      }
    });
    if (window.sdb) window.sdb(type, Object.values(byId));
    const typeLabel = type === 'teach' || type === 'staff' ? 'كادر المدرسة' : 'الطلاب';
    if (window.addSyncLog) window.addSyncLog(`🔀 تم دمج ${added} سجل جديد و${updated} سجل محدث في ${typeLabel}`, 'info');
    return { added, updated, skipped };
  },

  async syncAll() {
    if (!navigator.onLine) {
      if (window.showToast) {
        window.showToast('⚠️ لا يوجد اتصال بالإنترنت لإتمام المزامنة مع قاعدة البيانات', 'warn', 3500);
      } else {
        alert('⚠️ أنت غير متصل بالإنترنت');
      }
      QueueManager.add({ type: 'teach', records: window.gdata ? window.gdata('teach') : [], school: CU?.school || 'all' });
      QueueManager.add({ type: 'stud', records: window.gdata ? window.gdata('stud') : [], school: CU?.school || 'all' });
      return;
    }
    const teachList = window.gdata ? window.gdata('teach') : [];
    const studList = window.gdata ? window.gdata('stud') : [];
    const totalCount = teachList.length + studList.length;
    const currentSchool = (window.CU && typeof window.CU === 'function' ? window.CU()?.school : (window.CU?.school || 'الكل')) || 'الكل';

    if (window.showToast) {
      window.showToast(`🔄 بدء المزامنة الكاملة ورفع كافة البيانات (${totalCount} سجل) إلى Supabase...`, 'info', 3000);
    }
    if (window.addSyncLog) window.addSyncLog(`🔄 بدء المزامنة الكاملة مع قاعدة بيانات Supabase (${totalCount} سجل)...`, 'info', { count: totalCount, entity: 'all', school: currentSchool });
    
    try {
      if (window.syncSchoolsListToSupabase) {
        const schools = window.getSchoolsList ? window.getSchoolsList() : [];
        await window.syncSchoolsListToSupabase(schools);
        for (const sc of schools) {
          const info = window.getSchoolInfoData ? window.getSchoolInfoData(sc) : null;
          if (info && Object.keys(info).length) {
            await window.syncSchoolInfoToSupabase(sc, info);
          }
        }
      }
      if (window.saveSettingsToSupabase) {
        try {
          const u = JSON.parse(localStorage.getItem('gft_usernames') || '{}');
          if (Object.keys(u).length) await window.saveSettingsToSupabase('gft_usernames', u);
          const t = JSON.parse(localStorage.getItem('gft_targets') || '{}');
          if (Object.keys(t).length) await window.saveSettingsToSupabase('gft_targets', t);
        } catch (e) {}
      }
      const teachOk = await this.sendData('teach', teachList, CU?.school);
      const studOk = await this.sendData('stud', studList, CU?.school);
      await QueueManager.flush();

      if (teachOk !== false && studOk !== false) {
        const successMsg = `✅ اكتملت المزامنة الكاملة مع قاعدة بيانات Supabase بنجاح (${teachList.length} كادر · ${studList.length} طالب)`;
        if (window.showToast) window.showToast(successMsg, 'success', 4000);
        if (window.addSyncLog) window.addSyncLog(successMsg, 'success', { count: totalCount, entity: 'all', school: currentSchool, details: `${teachList.length} كادر · ${studList.length} طالب` });
        if (window.SyncSummaryManager) {
          window.SyncSummaryManager.recordSuccess({
            action: 'مزامنة شاملة لجميع السجلات مع Supabase',
            entity: 'all',
            entityLabel: 'كافة البيانات (كادر وطلاب)',
            school: currentSchool,
            added: 0,
            updated: totalCount,
            deleted: 0,
            total: totalCount,
            details: `${teachList.length} كادر · ${studList.length} طالب`
          });
        }
      } else {
        if (window.showToast) window.showToast('⚠️ تم حفظ بعض السجلات في رتل الانتظار لتعذر رفعها فوراً', 'warn', 3500);
      }
    } catch (err) {
      const errMsg = `❌ فشلت المزامنة مع قاعدة البيانات: ${err.message || err}`;
      if (window.addSyncLog) window.addSyncLog(errMsg, 'error', { count: totalCount, entity: 'all', school: currentSchool });
      if (window.showToast) window.showToast(errMsg, 'error', 4500);
    }
    QueueManager.updateBadge();
  },

  async backupToSupabase() {
    const cfg = this.getConfig();
    if (!cfg.url || !cfg.token) {
      if (window.showToast) {
        window.showToast('⚠️ يرجى ضبط إعدادات الاتصال بـ Supabase أولاً', 'warn', 3000);
      } else {
        alert('يرجى ضبط إعدادات الاتصال بـ Supabase أولاً');
      }
      return;
    }
    
    if (!navigator.onLine) {
      if (window.showToast) {
        window.showToast('⚠️ لا يوجد اتصال بالإنترنت لإتمام عملية الرفع إلى Supabase', 'warn', 3000);
      } else {
        alert('⚠️ لا يوجد اتصال بالإنترنت لإتمام عملية الرفع إلى Supabase');
      }
      return;
    }

    const schoolLabel = (window.CU && typeof window.CU === 'function' ? window.CU()?.school : (window.CU?.school || 'الكل')) || 'الكل';
    try {
      const snapshot = await BackupManager.createFull('نسخة احتياطية سحابية');
      const teachCount = (snapshot.teach || []).length;
      const studCount = (snapshot.stud || []).length;
      const totalCount = teachCount + studCount;

      if (window.addSyncLog) {
        window.addSyncLog(`☁️ جاري رفع النسخة الاحتياطية الشاملة إلى Supabase (${totalCount} سجل)...`, 'info', { count: totalCount, entity: 'backup', school: schoolLabel });
      }

      if (window.syncSchoolsListToSupabase) {
        const schools = window.getSchoolsList ? window.getSchoolsList() : [];
        await window.syncSchoolsListToSupabase(schools);
        for (const sc of schools) {
          const info = window.getSchoolInfoData ? window.getSchoolInfoData(sc) : null;
          if (info && Object.keys(info).length) {
            await window.syncSchoolInfoToSupabase(sc, info);
          }
        }
      }

      if (window.saveSettingsToSupabase) {
        await window.saveSettingsToSupabase('full_backup_snapshot', snapshot);
      }

      const teachOk = await this.sendData('teach', snapshot.teach || [], window.CU?.school || (typeof window.CU === 'function' ? window.CU()?.school : null));
      const studOk = await this.sendData('stud', snapshot.stud || [], window.CU?.school || (typeof window.CU === 'function' ? window.CU()?.school : null));

      const successMsg = `✅ تم رفع النسخة الاحتياطية إلى Supabase بنجاح (${teachCount} كادر · ${studCount} طالب)`;
      if (window.addSyncLog) window.addSyncLog(successMsg, 'success', { count: totalCount, entity: 'backup', school: schoolLabel, details: `${teachCount} كادر · ${studCount} طالب` });
      if (window.SyncSummaryManager) {
        window.SyncSummaryManager.recordSuccess({
          action: 'رفع نسخة احتياطية شاملة إلى Supabase',
          entity: 'backup',
          entityLabel: 'نسخة احتياطية شاملة',
          school: schoolLabel,
          added: 0,
          updated: totalCount,
          deleted: 0,
          total: totalCount,
          details: `${teachCount} كادر · ${studCount} طالب`
        });
      }
    } catch (e) {
      const errMsg = '❌ فشل رفع النسخة الاحتياطية إلى Supabase: ' + e.message;
      if (window.addSyncLog) window.addSyncLog(errMsg, 'error', { entity: 'backup', school: schoolLabel });
    }
  },

  async restoreFromSupabase(opts = {}) {
    const cfg = this.getConfig();
    if (!cfg.url || !cfg.token) {
      if (window.showToast) {
        window.showToast('⚠️ يرجى ضبط رابط ومفتاح Supabase في إعدادات المزامنة أولاً', 'warn', 3500);
      } else {
        alert('يرجى ضبط إعدادات Supabase أولاً');
      }
      return;
    }
    const confirmed = opts.auto ? true : confirm('هل تريد استرجاع البيانات من Supabase؟\nسيتم دمجها مع البيانات المحلية.');
    if (!confirmed) return;
    const school_ = (window.CU && typeof window.CU === 'function' ? window.CU()?.school : (window.CU?.school || 'all')) || 'all';
    
    if (window.showToast && !opts.auto) {
      window.showToast('📥 جاري استرجاع ودمج البيانات من قاعدة بيانات Supabase...', 'info', 2500);
    }
    if (window.addSyncLog) window.addSyncLog('📥 جاري استرجاع البيانات من Supabase...', 'info', { school: school_ });

    try {
      if (window.loadSettingsFromSupabase) {
        await window.loadSettingsFromSupabase().catch(() => {});
      }
      const teach = await this.downloadData('teach', school_);
      const stud = await this.downloadData('stud', school_);
      let summary = [];
      let totalRestored = 0;
      let totalAdded = 0;
      let totalUpdated = 0;
      if (teach && Array.isArray(teach)) {
        const result = this.mergeData('teach', teach);
        summary.push(`كادر: أُضيف ${result.added} وحُدِّث ${result.updated}`);
        totalRestored += (teach.length || 0);
        totalAdded += (result.added || 0);
        totalUpdated += (result.updated || 0);
      }
      if (stud && Array.isArray(stud)) {
        const result = this.mergeData('stud', stud);
        summary.push(`طلاب: أُضيف ${result.added} وحُدِّث ${result.updated}`);
        totalRestored += (stud.length || 0);
        totalAdded += (result.added || 0);
        totalUpdated += (result.updated || 0);
      }
      if (summary.length) {
        if (window.refreshAll) window.refreshAll();
        const message = `✅ تم استرجاع ودمج البيانات من Supabase بنجاح — ${summary.join(' · ')}`;
        if (window.addSyncLog) window.addSyncLog(message, 'success', { count: totalRestored, school: school_ });
        if (window.showToast) window.showToast(message, 'success', 4000);
        if (window.SyncSummaryManager) {
          window.SyncSummaryManager.recordSuccess({
            action: 'استرجاع ودمج البيانات من Supabase',
            entity: 'all',
            entityLabel: 'كافة البيانات (كادر وطلاب)',
            school: school_,
            added: totalAdded,
            updated: totalUpdated,
            deleted: 0,
            total: totalRestored,
            details: summary.join(' · ')
          });
        }
      } else {
        const message = '⚠️ تم الاتصال بـ Supabase ولكن لم تُسترجع أي سجلات. تأكد من وجود بيانات في قاعدة البيانات.';
        if (window.addSyncLog) window.addSyncLog(message, 'warn', { school: school_ });
        if (window.showToast) window.showToast(message, 'warn', 3500);
      }
    } catch (err) {
      const errMsg = `❌ فشل استرجاع البيانات من قاعدة بيانات Supabase: ${err.message || err}`;
      if (window.addSyncLog) window.addSyncLog(errMsg, 'error', { school: school_ });
      if (window.showToast) window.showToast(errMsg, 'error', 4500);
    }
  },

  // Backward-compatible alias method names
  backupToSheets() { return this.backupToSupabase(); },
  restoreFromSheets(opts) { return this.restoreFromSupabase(opts); },

  _logOp(action, type, count, school) {
    const ops = StorageManager.get('gft_cloud_ops') || [];
    ops.unshift({ action, type, count, school, user: CU?.username || '?', ts: new Date().toISOString() });
    if (ops.length > 100) ops.splice(100);
    StorageManager.set('gft_cloud_ops', ops);
  },

  startAutoSync() {
    // تم إلغاء المؤقت الدوري للمزامنة لتعمل فقط عند فتح البرنامج وعند الإضافة أو التعديل أو الحذف
    if (this._syncTimer) {
      clearInterval(this._syncTimer);
      this._syncTimer = null;
    }
  },

  stopAutoSync() {
    if (this._syncTimer) {
      clearInterval(this._syncTimer);
      this._syncTimer = null;
    }
  }
};

function getSyncConfig() {
  return CloudSyncManager.getConfig();
}

function saveSyncConfig() {
  const url = (document.getElementById('sync-url')?.value || '').trim();
  const token = (document.getElementById('sync-token')?.value || '').trim();
  if (!url) {
    alert('يرجى إدخال رابط موقع Supabase (URL)');
    return;
  }
  if (!url.includes('supabase.co') && !url.startsWith('http')) {
    alert('الرابط يجب أن يكون رابط موقع Supabase صالح (مثال: https://xyz.supabase.co)');
    return;
  }
  if (!token) {
    alert('يرجى إدخال مفتاح الوصول (Supabase Anon Key)');
    return;
  }
  const ok = CloudSyncManager.saveConfig(url, token);
  if (ok) {
    alert('✅ تم حفظ إعدادات Supabase بنجاح');
    QueueManager.updateBadge();
  } else {
    alert('⚠️ هذه الإعدادات متاحة لمسؤول النظام فقط');
  }
}

async function checkSyncLink() {
  const cfg = CloudSyncManager.getConfig();
  const url = (document.getElementById('sync-url')?.value || cfg.url || '').trim();
  const token = (document.getElementById('sync-token')?.value || cfg.token || '').trim();
  if (!url || !token) {
    alert('يرجى إدخال رابط Supabase ومفتاح الوصول أولاً');
    return;
  }
  try {
    if (window.addSyncLog) window.addSyncLog('⏳ جاري اختبار الاتصال بـ Supabase...', 'info');
    const client = window.supabase ? window.supabase.createClient(url, token) : null;
    if (!client) throw new Error('تعذر إنشاء الاتصال بـ Supabase');
    
    // Test query on settings or students table
    const { error } = await client.from('settings').select('key').limit(1);
    let needSchema = false;
    if (error) {
      if (error.message?.includes('table') || error.message?.includes('schema cache') || error.code === 'PGRST200' || error.code === '42P01') {
        needSchema = true;
      } else {
        const { error: err2 } = await client.from('students').select('id').limit(1);
        if (err2) {
          if (err2.message?.includes('table') || err2.message?.includes('schema cache') || err2.code === 'PGRST200' || err2.code === '42P01') {
            needSchema = true;
          } else {
            throw err2;
          }
        }
      }
    }
    
    if (needSchema) {
      if (window.addSyncLog) window.addSyncLog('⚠️ الاتصال ناجح بـ Supabase ولكن يجب إنشاء الجداول (SQL).', 'warn');
      alert('✅ الاتصال بمشروع Supabase ناجح ومفتاح الوصول صحيح!\n\n⚠️ يتبقى خطوة واحدة بسيطة:\nالجداول (students, staff, settings) غير موجودة بعد في مشروعك.\n\nاضغط على زر "📋 نسخ كود الجداول (SQL)" ثم قم بلصقه وتنفيذه في (SQL Editor) بموقع Supabase.');
    } else {
      if (window.addSyncLog) window.addSyncLog('✅ الاتصال بـ Supabase يعمل بنجاح وقاعدة البيانات جاهزة!', 'success');
      alert('✅ الاتصال بـ Supabase يعمل بنجاح وقاعدة البيانات جاهزة لاستقبال البيانات!');
    }
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('table') || msg.includes('schema cache')) {
      if (window.addSyncLog) window.addSyncLog('⚠️ تم الاتصال بـ Supabase بنجاح! يلزم إنشاء الجداول.', 'warn');
      alert('✅ الاتصال بـ Supabase ناجح ومفتاح الوصول صحيح!\n\n⚠️ يتبقى فقط إنشاء الجداول (SQL). اضغط زر "نسخ كود الجداول (SQL)" والصقه في Supabase SQL Editor.');
    } else {
      if (window.addSyncLog) window.addSyncLog(`❌ فشل اختبار الاتصال بـ Supabase: ${err.message}`, 'error');
      alert('❌ فشل اختبار الاتصال بـ Supabase: ' + err.message);
    }
  }
}

function getQueue() {
  return QueueManager.getAll();
}

function addToQueue(type, records) {
  QueueManager.add({ type, records, school: CU?.school || 'all' });
}

function updatePendingBadge() {
  QueueManager.updateBadge();
}

function renderPendingList() {
  const el = document.getElementById('pending-queue-list');
  if (!el) return;
  const q = getQueue();
  if (!q.length) {
    el.innerHTML = '<p style="font-size:12px;color:var(--ok);padding:8px 0">✅ لا توجد سجلات معلّقة — كل البيانات أُرسلت</p>';
    return;
  }
  el.innerHTML = q.map(item => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd);font-size:12px">
      <span><strong>${item.type === 'teach' || item.type === 'staff' ? 'كادر المدرسة' : 'الطلاب'}</strong> — مدرسة ${item.school} (${item.records.length} سجل)</span>
      <span style="color:var(--tx3);font-size:11px">${new Date(item.addedAt).toLocaleString('ar-IQ')}</span>
    </div>`).join('');
}

// ============================================================
// Toast Notification Engine (Global Window Function)
// Duration: 3 seconds (3000ms) with strict Deduplication
// ============================================================
const _activeToastMap = new Map();

window.showToast = function(message, type = 'success', duration = 3000) {
  try {
    if (!message || typeof message !== 'string') return;
    const cleanMsg = message.trim();
    if (!cleanMsg) return;

    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const normKey = `${type}:::${cleanMsg.replace(/\s+/g, ' ')}`;

    // Deduplication: If already showing identical toast, refresh timer & pulse without duplicating
    if (_activeToastMap.has(normKey)) {
      const existing = _activeToastMap.get(normKey);
      if (existing && existing.el && existing.el.parentNode) {
        clearTimeout(existing.timeoutId);
        
        // Pulse animation to notify user of refreshed state
        existing.el.classList.remove('toast-pulse');
        void existing.el.offsetWidth; // force reflow
        existing.el.classList.add('toast-pulse');

        // Restart progress bar
        if (existing.progressEl) {
          existing.progressEl.style.animation = 'none';
          void existing.progressEl.offsetWidth;
          existing.progressEl.style.animation = '';
          existing.progressEl.style.animationDuration = `${duration}ms`;
        }

        const dismissExisting = () => {
          existing.el.classList.remove('toast-show');
          existing.el.classList.add('toast-hide');
          setTimeout(() => {
            if (existing.el && existing.el.parentNode) existing.el.parentNode.removeChild(existing.el);
            _activeToastMap.delete(normKey);
          }, 320);
        };

        existing.timeoutId = setTimeout(dismissExisting, duration);
        existing.el.onmouseenter = () => clearTimeout(existing.timeoutId);
        existing.el.onmouseleave = () => {
          clearTimeout(existing.timeoutId);
          existing.timeoutId = setTimeout(dismissExisting, duration);
        };
        return; // Suppress duplicate toast creation
      }
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconHtml = '';
    const officialLogo = window.GIFTED_OFFICIAL_LOGO;
    const isSyncRelated = /مزامنة|supabase|سحاب|قاعدة البيانات|استرجاع|رفع|سحب|رتل|طابور/i.test(cleanMsg);

    if (officialLogo && (type === 'success' || isSyncRelated)) {
      iconHtml = `<img src="${officialLogo}" alt="شعار النظام" />`;
    } else if (type === 'success') {
      iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:20px;height:20px"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === 'error') {
      iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:20px;height:20px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else if (type === 'warning' || type === 'warn') {
      iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:20px;height:20px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    } else {
      iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:20px;height:20px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    let titleText = '';
    if (isSyncRelated) {
      if (type === 'success') titleText = 'نجاح المزامنة السحابية';
      else if (type === 'error') titleText = 'خطأ في المزامنة السحابية';
      else if (type === 'warning' || type === 'warn') titleText = 'تنبيه المزامنة';
      else titleText = 'المزامنة السحابية';
    } else {
      const titles = {
        success: 'نجاح العملية',
        error: 'تنبيه خطأ',
        warning: 'تحذير',
        warn: 'تحذير',
        info: 'إشعار النظام'
      };
      titleText = titles[type] || 'إشعار';
    }

    toast.innerHTML = `
      <div class="toast-icon">${iconHtml}</div>
      <div class="toast-content">
        <div class="toast-title">${titleText}</div>
        <div class="toast-msg">${cleanMsg}</div>
      </div>
      <button class="toast-close" title="إغلاق">&times;</button>
      <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    const progressEl = toast.querySelector('.toast-progress');

    let timeoutId;
    const dismiss = () => {
      clearTimeout(timeoutId);
      toast.classList.remove('toast-show');
      toast.classList.add('toast-hide');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
        _activeToastMap.delete(normKey);
      }, 320);
    };

    if (closeBtn) closeBtn.onclick = dismiss;

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    timeoutId = setTimeout(dismiss, duration);
    toast.onmouseenter = () => clearTimeout(timeoutId);
    toast.onmouseleave = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(dismiss, duration);
    };

    _activeToastMap.set(normKey, { el: toast, timeoutId, progressEl });
  } catch (err) {
    console.warn('[showToast error]:', err);
  }
};

// ============================================================
// Sync Log System with Filtering and Record Counts Details
// ============================================================
let currentSyncLogFilter = 'all'; // 'all' | 'success' | 'error'

window.setSyncLogFilter = function(filter) {
  currentSyncLogFilter = filter || 'all';
  renderSyncLog();
};

function getSyncLog() {
  try { return JSON.parse(localStorage.getItem(SYNC_LOG_KEY) || '[]'); } catch { return []; }
}

function addSyncLog(msg, type = 'info', meta = {}) {
  if (typeof meta === 'number') {
    meta = { count: meta };
  } else if (!meta || typeof meta !== 'object') {
    meta = {};
  }

  // Automatic count extraction if not provided
  let count = meta.count;
  if (count === undefined || count === null) {
    const match = String(msg).match(/(\d+)\s*(سجل|طالب|كادر|تعديل)/);
    if (match) {
      count = parseInt(match[1], 10);
    }
  }

  const logEntry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    msg: String(msg || ''),
    type: type || 'info',
    count: (count !== undefined && count !== null && !Number.isNaN(Number(count))) ? Number(count) : null,
    entity: meta.entity || '',
    school: meta.school || (window.CU && typeof window.CU === 'function' ? window.CU()?.school : window.CU?.school) || '',
    details: meta.details || '',
    time: new Date().toISOString()
  };

  const log = getSyncLog();
  log.unshift(logEntry);
  if (log.length > 100) log.length = 100;
  localStorage.setItem(SYNC_LOG_KEY, JSON.stringify(log));
  renderSyncLog();

  // Trigger Toast Notification automatically (respecting deduplication and 3s duration)
  if (window.showToast) {
    window.showToast(msg, type, 3000);
  }
}

function renderSyncLog() {
  const el = document.getElementById('sync-log-list');
  if (!el) return;
  const allLogs = getSyncLog();

  // Calculate counts for filters
  const totalCount = allLogs.length;
  const successCount = allLogs.filter(e => e.type === 'success').length;
  const errorCount = allLogs.filter(e => e.type === 'error').length;

  // Update counter badges in header
  const countAllEl = document.getElementById('sync-count-all');
  const countSuccessEl = document.getElementById('sync-count-success');
  const countErrorEl = document.getElementById('sync-count-error');
  if (countAllEl) countAllEl.textContent = totalCount;
  if (countSuccessEl) countSuccessEl.textContent = successCount;
  if (countErrorEl) countErrorEl.textContent = errorCount;

  // Update button visual active state
  ['all', 'success', 'error'].forEach(f => {
    const btn = document.getElementById(`sync-filter-${f}`);
    if (btn) {
      if (f === currentSyncLogFilter) {
        btn.classList.add('active');
        btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
        btn.style.fontWeight = '700';
        if (f === 'all') {
          btn.style.background = 'var(--sf)';
          btn.style.borderColor = 'var(--pr)';
          btn.style.color = 'var(--pr)';
        } else if (f === 'success') {
          btn.style.background = '#dcfce7';
          btn.style.borderColor = '#86efac';
          btn.style.color = '#15803d';
        } else if (f === 'error') {
          btn.style.background = '#fee2e2';
          btn.style.borderColor = '#fca5a5';
          btn.style.color = '#b91c1c';
        }
      } else {
        btn.classList.remove('active');
        btn.style.boxShadow = 'none';
        btn.style.background = 'transparent';
        btn.style.borderColor = 'transparent';
        btn.style.fontWeight = '500';
        btn.style.color = f === 'success' ? 'var(--ok)' : (f === 'error' ? 'var(--er)' : 'var(--tx2)');
      }
    }
  });

  // Filter logs by selection
  let filtered = allLogs;
  if (currentSyncLogFilter === 'success') {
    filtered = allLogs.filter(e => e.type === 'success');
  } else if (currentSyncLogFilter === 'error') {
    filtered = allLogs.filter(e => e.type === 'error');
  }

  if (!filtered.length) {
    if (totalCount === 0) {
      el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--tx3);font-size:13px">لا توجد عمليات إرسال مسجلة بعد</div>';
    } else if (currentSyncLogFilter === 'success') {
      el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--tx3);font-size:13px">لا توجد عمليات إرسال ناجحة بعد</div>';
    } else if (currentSyncLogFilter === 'error') {
      el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--ok);font-size:13px">✅ لا توجد أي أخطاء مسجلة — جميع العمليات تمت بنجاح</div>';
    }
    return;
  }

  const itemsHtml = filtered.map(e => {
    const isSuccess = e.type === 'success';
    const isError = e.type === 'error';
    const isWarn = e.type === 'warn' || e.type === 'warning';

    const badgeClass = isSuccess ? 'b-green' : (isError ? 'b-red' : (isWarn ? 'b-amber' : 'b-blue'));
    const statusLabel = isSuccess ? 'ناجحة' : (isError ? 'خطأ' : (isWarn ? 'تنبيه' : 'معلومات'));
    const statusIcon = isSuccess ? '✔' : (isError ? '✖' : (isWarn ? '⚠' : 'ℹ'));

    // Count badge showing exact number of synced records
    let countBadge = '';
    if (e.count !== null && e.count !== undefined && !Number.isNaN(Number(e.count))) {
      countBadge = `<span class="badge b-teal" style="font-size:11px;font-weight:700;padding:2px 7px">📊 ${e.count} سجل</span>`;
    }

    // School badge
    let schoolBadge = '';
    if (e.school && e.school !== 'all' && e.school !== 'الكل') {
      schoolBadge = `<span class="badge b-gray" style="font-size:11px;padding:2px 7px">🏫 ${e.school}</span>`;
    }

    // Entity label
    let entityBadge = '';
    if (e.entity) {
      const entLabel = (e.entity === 'teach' || e.entity === 'staff') ? '👥 كادر' : (e.entity === 'stud' || e.entity === 'students') ? '🎓 طلاب' : (e.entity === 'backup') ? '☁️ نسخة شاملة' : (e.entity === 'all') ? '🌐 مزامنة عامة' : '';
      if (entLabel) entityBadge = `<span class="badge b-gray" style="font-size:11px;padding:2px 7px">${entLabel}</span>`;
    }

    const timeStr = new Date(e.time).toLocaleString('ar-IQ', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      day: '2-digit', month: '2-digit', year: 'numeric'
    });

    const bgStyle = isError ? 'background:rgba(239,68,68,0.04);' : (isSuccess ? 'background:rgba(34,197,94,0.02);' : '');

    return `
      <div style="padding:10px 12px;border-bottom:1px solid var(--bd);display:flex;flex-direction:column;gap:5px;${bgStyle}">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span class="badge ${badgeClass}" style="font-size:11px;padding:2px 7px;font-weight:700">${statusIcon} ${statusLabel}</span>
            ${countBadge}
            ${entityBadge}
            ${schoolBadge}
          </div>
          <span style="color:var(--tx3);font-size:11px;direction:ltr;font-family:monospace">${timeStr}</span>
        </div>
        <div style="color:var(--tx1);font-size:12.5px;line-height:1.5;font-weight:500">
          ${e.msg}
        </div>
        ${e.details ? `<div style="font-size:11px;color:var(--tx3)">📋 التفاصيل: ${e.details}</div>` : ''}
      </div>
    `;
  }).join('');

  el.innerHTML = itemsHtml;
}

// ============================================================
// Sync Summary Manager — سجل ملخص المزامنة
// ============================================================
const SYNC_SUMMARY_KEY = 'gft_last_sync_summary';
const SYNC_SUMMARY_HISTORY_KEY = 'gft_sync_summary_history';

const SyncSummaryManager = {
  getLast() {
    try {
      const saved = JSON.parse(localStorage.getItem(SYNC_SUMMARY_KEY) || 'null');
      if (saved && saved.timestamp) return saved;
    } catch {}

    // Fallback: derive from recent successful sync log if available
    try {
      const logs = typeof getSyncLog === 'function' ? getSyncLog() : [];
      const lastSuccess = logs.find(l => l.type === 'success');
      if (lastSuccess) {
        const addedMatch = (lastSuccess.msg.match(/أُضيف\s*(\d+)/) || [])[1];
        const updatedMatch = (lastSuccess.msg.match(/حُدِّث\s*(\d+)/) || [])[1];
        const countMatch = (lastSuccess.msg.match(/(\d+)\s*سجل/) || [])[1];
        const isDelete = lastSuccess.msg.includes('حذف');
        const added = addedMatch ? parseInt(addedMatch, 10) : 0;
        const updated = updatedMatch ? parseInt(updatedMatch, 10) : (isDelete ? 0 : (lastSuccess.count || (countMatch ? parseInt(countMatch, 10) : 0)));
        const deleted = isDelete ? 1 : 0;
        const total = lastSuccess.count || (added + updated + deleted);

        return {
          id: 'derived_' + Date.now(),
          timestamp: lastSuccess.time,
          timeFormatted: new Date(lastSuccess.time).toLocaleString('ar-IQ', {
            weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          }),
          action: lastSuccess.msg.includes('استرجاع') || lastSuccess.msg.includes('سحب') ? 'سحب واسترجاع البيانات' : (isDelete ? 'حذف من السحابة' : 'رفع ومزامنة البيانات'),
          entity: lastSuccess.entity || 'all',
          entityLabel: this._getEntityLabel(lastSuccess.entity),
          school: lastSuccess.school || (window.CU?.school || 'جميع المدارس'),
          added: added,
          updated: updated,
          deleted: deleted,
          total: total,
          details: lastSuccess.msg,
          status: 'success'
        };
      }
    } catch {}
    return null;
  },

  getHistory() {
    try {
      return JSON.parse(localStorage.getItem(SYNC_SUMMARY_HISTORY_KEY) || '[]');
    } catch {
      return [];
    }
  },

  recordSuccess(data = {}) {
    const now = new Date().toISOString();
    const ent = data.entity || 'all';
    const addedCount = Number(data.added || 0);
    const updatedCount = Number(data.updated || 0);
    const deletedCount = Number(data.deleted || 0);
    const totalCount = data.total !== undefined ? Number(data.total) : (addedCount + updatedCount + deletedCount);

    const summary = {
      id: 'sync_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: now,
      timeFormatted: new Date(now).toLocaleString('ar-IQ', {
        weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }),
      action: data.action || 'مزامنة مع السحابة',
      entity: ent,
      entityLabel: data.entityLabel || this._getEntityLabel(ent),
      school: data.school || (window.CU?.school || 'جميع المدارس'),
      added: addedCount,
      updated: updatedCount,
      deleted: deletedCount,
      total: totalCount,
      details: data.details || '',
      status: 'success'
    };

    try {
      localStorage.setItem(SYNC_SUMMARY_KEY, JSON.stringify(summary));
      const history = this.getHistory();
      history.unshift(summary);
      if (history.length > 30) history.length = 30;
      localStorage.setItem(SYNC_SUMMARY_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('[SyncSummaryManager save error]:', e);
    }

    this.render();
    return summary;
  },

  _getEntityLabel(ent) {
    if (ent === 'teach' || ent === 'staff') return 'كادر المدرسة';
    if (ent === 'stud' || ent === 'students') return 'الطلاب الموهوبون';
    if (ent === 'schools') return 'بيانات المدارس';
    if (ent === 'school_info') return 'استمارة المدرسة';
    if (ent === 'backup') return 'نسخة احتياطية شاملة';
    if (ent === 'all') return 'كافة البيانات (كادر وطلاب)';
    return ent || 'عام';
  },

  render() {
    renderSyncSummary();
  }
};
window.SyncSummaryManager = SyncSummaryManager;

function renderSyncSummary() {
  const container = document.getElementById('sync-summary-body');
  if (!container) return;

  const summary = SyncSummaryManager.getLast();
  const history = SyncSummaryManager.getHistory();

  if (!summary) {
    container.innerHTML = `
      <div style="text-align:center;padding:24px 16px;background:var(--bg);border:1px dashed var(--bd);border-radius:10px">
        <div style="font-size:32px;margin-bottom:8px">☁️</div>
        <div style="font-weight:700;font-size:14px;color:var(--tx);margin-bottom:4px">لا يوجد سجل ملخص لآخر مزامنة بعد</div>
        <div style="font-size:12px;color:var(--tx2);max-width:480px;margin:0 auto 16px">
          تحدث المزامنة تلقائياً عند فتح التطبيق وعند إضافة أو تعديل أو حذف السجلات. يمكنك أيضاً بدء المزامنة يدوياً بالضغط أدناه.
        </div>
        <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap">
          <button class="btn btn-pr btn-sm" onclick="syncNow('all')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            بدء مزامنة الكل الآن
          </button>
          <button class="btn btn-sm" onclick="CloudSyncManager.restoreFromSupabase()" style="background:var(--sf);border-color:var(--bd)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>
            سحب البيانات من Supabase
          </button>
        </div>
      </div>
    `;
    const badge = document.getElementById('sync-summary-status-badge');
    if (badge) {
      badge.textContent = '● في انتظار أول عملية';
      badge.className = 'badge b-gray';
    }
    return;
  }

  const badge = document.getElementById('sync-summary-status-badge');
  if (badge) {
    badge.textContent = '✔ آخر مزامنة ناجحة';
    badge.className = 'badge b-green';
  }

  const historyRows = history.slice(0, 5).map(h => {
    return `
      <tr style="border-bottom:1px solid var(--bd);font-size:11.5px">
        <td style="padding:7px 10px;font-family:monospace;direction:ltr;text-align:right;color:var(--tx2)">${h.timeFormatted || new Date(h.timestamp).toLocaleTimeString('ar-IQ')}</td>
        <td style="padding:7px 10px;font-weight:600;color:var(--tx)">${h.action || 'مزامنة'}</td>
        <td style="padding:7px 10px"><span class="badge b-gray" style="font-size:10.5px">${h.school || 'الكل'}</span></td>
        <td style="padding:7px 10px;text-align:center"><span class="badge b-green" style="font-weight:700;padding:1px 6px">+${h.added}</span></td>
        <td style="padding:7px 10px;text-align:center"><span class="badge b-blue" style="font-weight:700;padding:1px 6px">✎ ${h.updated}</span></td>
        <td style="padding:7px 10px;text-align:center"><span class="badge ${h.deleted > 0 ? 'b-red' : 'b-gray'}" style="font-weight:700;padding:1px 6px">🗑 ${h.deleted}</span></td>
        <td style="padding:7px 10px;text-align:center;font-weight:700;color:var(--tx)">${h.total}</td>
        <td style="padding:7px 10px;text-align:center"><span class="badge b-green" style="font-size:10px">✔ ناجحة</span></td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <!-- Top Summary Banner -->
    <div style="background:var(--bg);border:1px solid var(--bd);border-radius:10px;padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="badge b-green" style="font-size:12px;padding:3px 10px;font-weight:700">✔ عملية ناجحة</span>
        <span style="font-weight:700;font-size:13.5px;color:var(--tx)">${summary.action}</span>
        <span class="badge b-teal" style="font-size:11px;padding:2px 8px">${summary.entityLabel}</span>
        <span class="badge b-gray" style="font-size:11px;padding:2px 8px">🏫 ${summary.school}</span>
      </div>
      <div style="color:var(--tx2);font-size:12px;font-family:monospace;direction:ltr;display:flex;align-items:center;gap:6px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>${summary.timeFormatted}</span>
      </div>
    </div>

    <!-- 4 Structured Metric Stat Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(135px, 1fr));gap:10px;margin-bottom:14px">
      <!-- Added -->
      <div style="background:var(--sf);border:1px solid #86efac;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:3px;box-shadow:0 1px 3px rgba(0,0,0,0.03)">
        <div style="font-size:11.5px;font-weight:700;color:#15803d;display:flex;align-items:center;gap:5px">
          <span style="font-size:14px">➕</span>
          <span>سجلات أُضيفت</span>
        </div>
        <div style="font-size:26px;font-weight:800;color:#16a34a;font-variant-numeric:tabular-nums;line-height:1.2">${summary.added}</div>
        <div style="font-size:11px;color:var(--tx3)">سجل جديد بالكامل</div>
      </div>

      <!-- Updated / Modified -->
      <div style="background:var(--sf);border:1px solid #7dd3fc;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:3px;box-shadow:0 1px 3px rgba(0,0,0,0.03)">
        <div style="font-size:11.5px;font-weight:700;color:#0369a1;display:flex;align-items:center;gap:5px">
          <span style="font-size:14px">✏️</span>
          <span>سجلات عُدِّلت</span>
        </div>
        <div style="font-size:26px;font-weight:800;color:#0284c7;font-variant-numeric:tabular-nums;line-height:1.2">${summary.updated}</div>
        <div style="font-size:11px;color:var(--tx3)">سجل تم تحديثه</div>
      </div>

      <!-- Deleted -->
      <div style="background:var(--sf);border:1px solid #fca5a5;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:3px;box-shadow:0 1px 3px rgba(0,0,0,0.03)">
        <div style="font-size:11.5px;font-weight:700;color:#b91c1c;display:flex;align-items:center;gap:5px">
          <span style="font-size:14px">🗑️</span>
          <span>سجلات حُذفت</span>
        </div>
        <div style="font-size:26px;font-weight:800;color:#dc2626;font-variant-numeric:tabular-nums;line-height:1.2">${summary.deleted}</div>
        <div style="font-size:11px;color:var(--tx3)">سجل محذوف من السحابة</div>
      </div>

      <!-- Total Processed -->
      <div style="background:var(--sf);border:1px solid #cbd5e1;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:3px;box-shadow:0 1px 3px rgba(0,0,0,0.03)">
        <div style="font-size:11.5px;font-weight:700;color:var(--pr-d);display:flex;align-items:center;gap:5px">
          <span style="font-size:14px">📊</span>
          <span>إجمالي المعالجة</span>
        </div>
        <div style="font-size:26px;font-weight:800;color:var(--pr);font-variant-numeric:tabular-nums;line-height:1.2">${summary.total}</div>
        <div style="font-size:11px;color:var(--tx3)">إجمالي السجلات المتأثرة</div>
      </div>
    </div>

    ${summary.details ? `
      <div style="background:rgba(0,137,123,0.05);border-right:3px solid var(--pr);padding:8px 12px;border-radius:6px;font-size:12px;color:var(--tx);margin-bottom:14px">
        <strong>📋 تفاصيل العملية:</strong> ${summary.details}
      </div>
    ` : ''}

    <!-- Recent History Mini-Table -->
    ${history.length > 1 ? `
      <div style="margin-top:14px;border-top:1px solid var(--bd);padding-top:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:12px;font-weight:700;color:var(--tx)">سجل آخر العمليات الناجحة (${history.length}):</span>
          <span style="font-size:11px;color:var(--tx3)">أحدث 5 عمليات</span>
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;text-align:right">
            <thead>
              <tr style="border-bottom:2px solid var(--bd);font-size:11px;color:var(--tx3);background:var(--bg)">
                <th style="padding:6px 10px;text-align:right">الوقت</th>
                <th style="padding:6px 10px">نوع العملية</th>
                <th style="padding:6px 10px">المدرسة / النطاق</th>
                <th style="padding:6px 10px;text-align:center">أُضيفت</th>
                <th style="padding:6px 10px;text-align:center">عُدِّلت</th>
                <th style="padding:6px 10px;text-align:center">حُذِفت</th>
                <th style="padding:6px 10px;text-align:center">الإجمالي</th>
                <th style="padding:6px 10px;text-align:center">الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${historyRows}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;
}
window.renderSyncSummary = renderSyncSummary;

function clearSyncLog() {
  const doClear = () => {
    localStorage.removeItem(SYNC_LOG_KEY);
    renderSyncLog();
    if (window.renderSyncSummary) window.renderSyncSummary();
    if (window.showToast) {
      window.showToast('🗑️ تم مسح سجل عمليات الإرسال بنجاح', 'info', 3000);
    }
  };

  if (typeof window.showConfirm === 'function') {
    window.showConfirm('هل أنت متأكد من مسح سجل عمليات الإرسال والمزامنة بالكامل؟', doClear);
  } else if (typeof showConfirm === 'function') {
    showConfirm('هل أنت متأكد من مسح سجل عمليات الإرسال والمزامنة بالكامل؟', doClear);
  } else {
    doClear();
  }
}
window.clearSyncLog = clearSyncLog;

function checkOnline() {
  const dot = document.getElementById('sync-dot');
  const lbl = document.getElementById('sync-status-lbl');
  const isOnline = navigator.onLine;
  if (dot) { dot.style.background = isOnline ? 'var(--ok)' : 'var(--er)'; }
  if (lbl) lbl.textContent = isOnline ? 'متصل بالإنترنت (Supabase)' : 'غير متصل';
  if (isOnline) QueueManager.flush();
}

async function sendToSheets(type, records) {
  return CloudSyncManager.sendData(type, records, CU?.school);
}

async function uploadDataToSupabase(type) {
  const normType = (type === 'teach' || type === 'staff') ? 'teach' : 'stud';
  const label = normType === 'teach' ? 'كادر المدرسة' : 'الطلاب الموهوبين';
  const btn = document.getElementById('btn-push-' + normType);
  const origHtml = btn ? btn.innerHTML : '';

  if (!navigator.onLine) {
    if (window.showToast) window.showToast('⚠️ لا يوجد اتصال بالإنترنت لإتمام الرفع إلى Supabase', 'warn', 3500);
    else alert('لا يوجد اتصال بالإنترنت');
    return false;
  }

  const cfg = CloudSyncManager.getConfig();
  if (!cfg.url || !cfg.token) {
    if (window.showToast) window.showToast('⚠️ يرجى ضبط رابط ومفتاح Supabase في إعدادات المزامنة أولاً', 'warn', 4000);
    else alert('يرجى ضبط إعدادات Supabase أولاً');
    return false;
  }

  const schoolScope = window.CU?.school || (typeof window.CU === 'function' ? window.CU()?.school : 'all') || 'all';
  let records = [];
  if (schoolScope && schoolScope !== 'all') {
    records = (window.gdb ? window.gdb(normType) : []).filter(r => r.school === schoolScope);
  } else {
    records = window.gdata ? window.gdata(normType) : (window.gdb ? window.gdb(normType) : []);
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> جاري الحفظ...`;
  }

  if (window.showToast) {
    window.showToast(`💾 جاري حفظ بيانات ${label} (${records.length} سجل) في قاعدة بيانات Supabase...`, 'info', 3000);
  }

  try {
    const ok = await CloudSyncManager.sendData(normType, records, schoolScope);
    if (ok) {
      if (window.showToast) {
        window.showToast(`✅ تم حفظ بيانات ${label} (${records.length} سجل) في قاعدة بيانات Supabase بنجاح`, 'success', 4000);
      } else {
        alert(`تم حفظ بيانات ${label} بنجاح`);
      }
      
      if (window.SyncSummaryManager) {
        window.SyncSummaryManager.recordSuccess({
          action: `حفظ بيانات ${label} في Supabase`,
          entity: normType,
          entityLabel: label,
          school: schoolScope,
          added: 0,
          updated: records.length,
          deleted: 0,
          total: records.length,
          details: `تم حفظ وتحديث ${records.length} سجل في قاعدة بيانات Supabase`
        });
      }

      if (window.ActivityLogger) {
        window.ActivityLogger.cloud('upload', normType, records.length, schoolScope, `حفظ بيانات ${label} في Supabase`);
      }
    } else {
      if (window.showToast) window.showToast(`⚠️ تعذر إتمام حفظ بيانات ${label} مباشرة — تم الحفظ في رتل المزامنة لإعادة المحاولة`, 'warn', 4000);
    }
    return ok;
  } catch (err) {
    console.error('[UploadToSupabase Error]:', err);
    if (window.showToast) window.showToast(`❌ خطأ أثناء حفظ بيانات ${label}: ${err.message}`, 'error', 4500);
    return false;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
}
window.uploadDataToSupabase = uploadDataToSupabase;

async function pullDataFromSupabase(type) {
  const normType = (type === 'teach' || type === 'staff') ? 'teach' : 'stud';
  const label = normType === 'teach' ? 'كادر المدرسة' : 'الطلاب الموهوبين';
  const btn = document.getElementById('btn-pull-' + normType);
  const origHtml = btn ? btn.innerHTML : '';

  if (!navigator.onLine) {
    if (window.showToast) window.showToast('⚠️ لا يوجد اتصال بالإنترنت لإتمام السحب من Supabase', 'warn', 3500);
    else alert('لا يوجد اتصال بالإنترنت');
    return false;
  }

  const cfg = CloudSyncManager.getConfig();
  if (!cfg.url || !cfg.token) {
    if (window.showToast) window.showToast('⚠️ يرجى ضبط رابط ومفتاح Supabase في إعدادات المزامنة أولاً', 'warn', 4000);
    else alert('يرجى ضبط إعدادات Supabase أولاً');
    return false;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> جاري الاسترجاع...`;
  }

  if (window.showToast) {
    window.showToast(`📥 جاري استرجاع بيانات ${label} من قاعدة بيانات Supabase...`, 'info', 3000);
  }

  try {
    const schoolScope = window.CU?.school || (typeof window.CU === 'function' ? window.CU()?.school : 'all') || 'all';

    if (window.loadSettingsFromSupabase) {
      await window.loadSettingsFromSupabase().catch(() => {});
    }

    const remoteRecords = await CloudSyncManager.downloadData(normType, schoolScope);
    
    if (remoteRecords && Array.isArray(remoteRecords)) {
      const mergeRes = CloudSyncManager.mergeData(normType, remoteRecords);
      
      // Update UI components
      if (window.buildTableHeaders) window.buildTableHeaders(normType);
      if (window.renderTbl) window.renderTbl(normType);
      if (window.renderDashboard) window.renderDashboard();
      if (window.renderCompletionBars) window.renderCompletionBars();
      if (window.renderDataEntryStatus && window.CU?.isAdmin) window.renderDataEntryStatus();
      if (window.renderBkStats) window.renderBkStats();

      const msg = `✅ تم سحب بيانات ${label} بنجاح (${remoteRecords.length} سجل من السحابة — أُضيف ${mergeRes.added} جديد، حُدِّث ${mergeRes.updated})`;
      if (window.showToast) window.showToast(msg, 'success', 4500);
      else alert(msg);

      if (window.SyncSummaryManager) {
        window.SyncSummaryManager.recordSuccess({
          action: `سحب ودمج بيانات ${label} من Supabase`,
          entity: normType,
          entityLabel: label,
          school: schoolScope,
          added: mergeRes.added,
          updated: mergeRes.updated,
          deleted: 0,
          total: remoteRecords.length,
          details: `سحب يدوي: أُضيف ${mergeRes.added} جديد، وعُدِّل ${mergeRes.updated} سجل من أصل ${remoteRecords.length} سجل سحابي`
        });
      }

      if (window.ActivityLogger) {
        window.ActivityLogger.cloud('download', normType, remoteRecords.length, schoolScope, `سحب بيانات ${label} يدوياً من Supabase`);
      }
      return true;
    } else {
      if (window.showToast) window.showToast(`ℹ️ تم الاتصال بـ Supabase بنجاح — لا توجد سجلات لـ ${label} في السحابة حالياً`, 'warn', 4000);
      return false;
    }
  } catch (err) {
    console.error('[PullDataFromSupabase Error]:', err);
    if (window.showToast) window.showToast(`❌ خطأ أثناء سحب بيانات ${label}: ${err.message}`, 'error', 4500);
    return false;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
}
window.pullDataFromSupabase = pullDataFromSupabase;

async function syncNow(typeOrAll) {
  if (typeOrAll === 'all') return CloudSyncManager.syncAll();
  const normType = (typeOrAll === 'teach' || typeOrAll === 'staff') ? 'teach' : 'stud';
  const label = normType === 'teach' ? 'كادر المدرسة' : 'الطلاب الموهوبين';
  const records = window.gdata ? window.gdata(normType) : [];
  
  if (window.showToast) {
    window.showToast(`⏳ جاري مزامنة ورفع بيانات ${label} (${records.length} سجل) إلى Supabase...`, 'info', 2500);
  }
  
  const ok = await CloudSyncManager.sendData(normType, records, CU?.school);
  if (ok) {
    if (window.showToast) {
      window.showToast(`✅ تمت مزامنة بيانات ${label} (${records.length} سجل) مع Supabase بنجاح`, 'success', 3500);
    }
  } else {
    if (window.showToast) {
      window.showToast(`⚠️ تعذر إتمام مزامنة بيانات ${label} مباشرة — تم الحفظ في رتل المزامنة`, 'warn', 3500);
    }
  }
  return ok;
}

async function flushQueue() {
  if (!navigator.onLine) {
    if (window.showToast) window.showToast('⚠️ لا يوجد اتصال بالإنترنت لإرسال السجلات المعلّقة', 'warn', 3500);
    return;
  }
  const q = QueueManager.getAll();
  if (!q.length) {
    if (window.showToast) window.showToast('✅ لا توجد سجلات معلّقة — كل البيانات متزامنة مع السحابة', 'info', 3000);
    return;
  }
  if (window.showToast) window.showToast(`⏳ جاري إرسال ومزامنة ${q.length} عملية معلّقة إلى Supabase...`, 'info', 2000);
  await QueueManager.flush();
  const remaining = QueueManager.getAll().length;
  if (remaining === 0) {
    if (window.showToast) window.showToast('✅ تمت مزامنة كافة العمليات المعلّقة مع قاعدة البيانات بنجاح', 'success', 3500);
  } else {
    if (window.showToast) window.showToast(`⚠️ تبقى ${remaining} عملية معلّقة تعذر إرسالها — ستتم إعادة المحاولة تلقائياً`, 'warn', 3500);
  }
}

function initSyncEngine() {
  window.addEventListener('online', () => {
    checkOnline();
    QueueManager.flush();
    CloudSyncManager.startAutoSync();
  });
  window.addEventListener('offline', () => {
    checkOnline();
    CloudSyncManager.stopAutoSync();
  });
  checkOnline();
  const cfg = CloudSyncManager.getConfig();
  const urlEl = document.getElementById('sync-url');
  const tokenEl = document.getElementById('sync-token');
  if (urlEl && cfg.url) urlEl.value = cfg.url;
  if (tokenEl && cfg.token) tokenEl.value = cfg.token;
  
  const intervalEl = document.getElementById('supabase-auto-sync-interval');
  if (intervalEl) {
    intervalEl.textContent = 'عند الفتح وعند الإضافة أو التعديل أو الحذف';
  }
  
  renderSyncLog();
  if (window.renderSyncSummary) renderSyncSummary();
  QueueManager.updateBadge();
  if (navigator.onLine) CloudSyncManager.startAutoSync();
  QueueManager.updateBadge();
}