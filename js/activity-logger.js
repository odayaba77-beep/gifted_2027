// ============================================================
// ActivityLogger — نظام تسجيل العمليات المحلي + السحابي
// المرحلة التاسعة: نظام السجلات الشامل
// ============================================================

const ActivityLogger = (() => {
  'use strict';

  const LOCAL_KEY = 'gft_oplog';
  const MAX_LOCAL = 2000;
  const ACTIONS = {
    LOGIN: 'تسجيل دخول',
    LOGOUT: 'تسجيل خروج',
    ADD: 'إضافة',
    EDIT: 'تعديل',
    DELETE: 'حذف',
    SYNC: 'مزامنة',
    IMPORT: 'استيراد',
    EXPORT: 'تصدير',
    FIELD_ADD: 'إضافة حقل',
    FIELD_HIDE: 'إخفاء حقل',
    FIELD_DELETE: 'حذف حقل',
    BACKUP: 'نسخ احتياطي',
    RESTORE: 'استعادة'
  };

  function _getUser() {
    return window.CU ? { username: window.CU.username, name: window.CU.name, school: window.CU.school || '' } : { username: 'نظام', name: 'النظام', school: '' };
  }

  function _nid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // تسجيل محلي
  function local(action, type, record, details) {
    try {
      const user = _getUser();
      const typeLabel = type === 'teach' ? 'كادر' : (type === 'stud' ? 'طالب' : (type || ''));
      const name = record ? [record.name1, record.name2, record.name3, record.name4].filter(Boolean).join(' ') : '';
      const entry = {
        id: _nid(),
        ts: Date.now(),
        action,
        type: typeLabel,
        recordId: record?.id || '',
        globalId: record?.global_id || '',
        name,
        school: record?.school || user.school || '',
        academicYear: record?.academicYear || '',
        user: user.name || user.username,
        username: user.username,
        details: details || ''
      };
      const log = _readLocal();
      log.unshift(entry);
      if (log.length > MAX_LOCAL) log.length = MAX_LOCAL;
      localStorage.setItem(LOCAL_KEY, JSON.stringify(log));
      return entry;
    } catch (e) {
      console.error('[ActivityLogger] local log failed:', e);
      return null;
    }
  }

  // تسجيل سحابي (إرسال إلى Supabase و Google Sheets)
  async function cloud(action, type, record, details) {
    const entry = local(action, type, record, details);
    if (!entry) return;

    // 1. إرسال إلى Supabase قاعدة البيانات السحابية
    if (window.recordActivityLogToSupabase) {
      window.recordActivityLogToSupabase(entry).catch(err => console.warn('[ActivityLogger Supabase warn]:', err));
    }

    const cfg = _getSyncConfig();
    if (!cfg.url) return;

    try {
      const payload = {
        action: 'oplog',
        token: cfg.token || '',
        record: {
          ts: new Date(entry.ts).toISOString(),
          action: entry.action,
          type: entry.type,
          name: entry.name,
          school: entry.school,
          user: entry.username,
          details: entry.details || ''
        }
      };
      // إرسال بدون انتظار النتيجة (fire-and-forget)
      fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors'
      }).catch(() => {});
    } catch { }
  }

  function _readLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
  }

  function _getSyncConfig() {
    if (window.CloudSyncManager?.getConfig) return window.CloudSyncManager.getConfig();
    try { return JSON.parse(localStorage.getItem('gft_sync_config') || '{}'); } catch { return {}; }
  }

  // تسجيل تسجيل الدخول
  function login(username) {
    return cloud(ACTIONS.LOGIN, 'auth', { name1: username, id: '' });
  }

  // تسجيل تسجيل الخروج
  function logout(username) {
    return cloud(ACTIONS.LOGOUT, 'auth', { name1: username, id: '' });
  }

  // تسجيل إضافة سجل
  function add(type, record) {
    return cloud(ACTIONS.ADD, type, record);
  }

  // تسجيل تعديل سجل
  function edit(type, record) {
    return cloud(ACTIONS.EDIT, type, record);
  }

  // تسجيل حذف سجل
  function del(type, record) {
    return cloud(ACTIONS.DELETE, type, record);
  }

  // تسجيل مزامنة
  function sync(type, count) {
    return cloud(ACTIONS.SYNC, type, null, `${count} سجل`);
  }

  // تسجيل استيراد
  function imp(type, count) {
    return cloud(ACTIONS.IMPORT, type, null, `${count} سجل`);
  }

  // تسجيل تصدير
  function exp(type, count) {
    return cloud(ACTIONS.EXPORT, type, null, `${count} سجل`);
  }

  // قراءة السجلات
  function getAll() { return _readLocal(); }

  // مسح السجلات
  function clear() {
    localStorage.removeItem(LOCAL_KEY);
    if (window.renderOpsLog) window.renderOpsLog();
  }

  // تسجيل عام
  function log(action, typeOrMsg, recordOrDetails, details) {
    if (typeof recordOrDetails === 'object' && recordOrDetails && !recordOrDetails.name1 && !recordOrDetails.id) {
      return local(action, 'system', null, typeof typeOrMsg === 'string' ? `${typeOrMsg}: ${JSON.stringify(recordOrDetails)}` : JSON.stringify(recordOrDetails));
    }
    return local(action, typeOrMsg, recordOrDetails, details);
  }

  return { local, cloud, log, login, logout, add, edit, del, sync, imp, exp, getAll, clear, ACTIONS };
})();

window.ActivityLogger = ActivityLogger;
