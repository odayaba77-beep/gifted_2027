// ============================================================
// DeltaSyncManager — مزامنة دلتا (سجل واحد في كل طلب)
// المرحلة الثانية: تحويل المزامنة من كاملة إلى تفاضلية
// ============================================================

const DeltaSyncManager = (() => {
  'use strict';

  function _getConfig() {
    if (window.CloudSyncManager?.getConfig) return window.CloudSyncManager.getConfig();
    try { return JSON.parse(localStorage.getItem('gft_sync_config') || '{}'); } catch { return {}; }
  }

  function _normalizeType(type) {
    if (type === 'students') return 'stud';
    if (type === 'staff') return 'teach';
    return type;
  }

  function _stripPhoto(record) {
    const { photo, _type, ...rest } = record || {};
    return rest;
  }

  function _log(msg, level = 'info') {
    if (window.addSyncLog) window.addSyncLog(msg, level);
    else console.log('[DeltaSync]', msg);
  }

  // إرسال سجل واحد للسحابة Supabase (إضافة أو تعديل)
  async function upsertRecord(type, record, school) {
    const cfg = _getConfig();
    if (!cfg.url || !cfg.token) {
      _log('⚠️ لم يُضبط رابط ومفتاح Supabase — سيُضاف السجل إلى الطابور', 'warn');
      _queueUpsert(type, record, school);
      return { ok: false, queued: true };
    }

    const clean = _stripPhoto(record);
    const normType = _normalizeType(type);
    const school_ = school || record.school || (window.CU?.school) || 'all';

    try {
      if (window.CloudSyncManager?.sendData) {
        const ok = await window.CloudSyncManager.sendData(normType, [clean], school_);
        if (ok) {
          if (window.ActivityLogger?.cloud) window.ActivityLogger.cloud('upsert', type, record);
          if (window.SyncSummaryManager) {
            const isEdit = !!(record.tsEdit || record.isModified || (record.ts && (Date.now() - record.ts > 10000)));
            const entLabel = (normType === 'teach' || normType === 'staff') ? 'كادر المدرسة' : 'الطلاب';
            const recName = record.name || [record.name1, record.name2, record.name3].filter(Boolean).join(' ') || record.id || 'سجل';
            window.SyncSummaryManager.recordSuccess({
              action: isEdit ? `تعديل سجل في ${entLabel}` : `إضافة سجل جديد في ${entLabel}`,
              entity: normType,
              entityLabel: entLabel,
              school: school_,
              added: isEdit ? 0 : 1,
              updated: isEdit ? 1 : 0,
              deleted: 0,
              total: 1,
              details: `${isEdit ? 'تم تحديث' : 'تم إضافة'} السجل: "${recName}"`
            });
          }
          return { ok: true };
        }
      }
      _queueUpsert(type, record, school_);
      return { ok: false, queued: true };
    } catch (err) {
      _log(`⚠️ فشل إرسال السجل إلى Supabase — سيُحفظ في الطابور: ${err.message}`, 'warn');
      _queueUpsert(type, record, school);
      return { ok: false, queued: true, error: err.message };
    }
  }

  // حذف سجل من سحابة Supabase
  async function deleteRecord(type, id, school) {
    const cfg = _getConfig();
    if (!cfg.url || !cfg.token) {
      _log('⚠️ لم يُضبط إعداد Supabase — لن يُطبَّق الحذف على السحابة', 'warn');
      return { ok: false, reason: 'no-url' };
    }

    const normType = _normalizeType(type);
    const tableName = (normType === 'teach' || normType === 'staff') ? 'staff' : 'students';
    const school_ = school || (window.CU?.school) || 'all';

    try {
      const client = window.supabaseClient || (window.supabase && window.supabase.createClient(cfg.url, cfg.token));
      if (client) {
        await client.from(tableName).delete().eq('id', id);
        _log(`🗑️ تم حذف السجل من Supabase (${type}:${id})`, 'success');
        if (window.SyncSummaryManager) {
          const entLabel = (normType === 'teach' || normType === 'staff') ? 'كادر المدرسة' : 'الطلاب';
          window.SyncSummaryManager.recordSuccess({
            action: `حذف سجل من ${entLabel} في Supabase`,
            entity: normType,
            entityLabel: entLabel,
            school: school_,
            added: 0,
            updated: 0,
            deleted: 1,
            total: 1,
            details: `تم حذف السجل (معرف: ${id}) بنجاح من قاعدة البيانات السحابية`
          });
        }
        return { ok: true };
      }
      return { ok: false, reason: 'no-client' };
    } catch (err) {
      _log(`⚠️ فشل حذف السجل من Supabase: ${err.message}`, 'warn');
      return { ok: false, error: err.message };
    }
  }

  // وظائف Delta المعرَّفة في المواصفات
  function upsertStudent(student) {
    Security.stampRecord(student, 'stud');
    return upsertRecord('stud', student, student.school);
  }

  function upsertStaff(staff) {
    Security.stampRecord(staff, 'teach');
    return upsertRecord('teach', staff, staff.school);
  }

  function upsertSchoolInfo(school, data) {
    const sc = school || (window.CU?.school) || '';
    if (!sc) return Promise.resolve({ ok: false, reason: 'no-school' });
    if (window.syncSchoolInfoToSupabase) {
      return window.syncSchoolInfoToSupabase(sc, data)
        .then(() => ({ ok: true }))
        .catch(err => ({ ok: false, error: err.message }));
    }
    return Promise.resolve({ ok: true });
  }

  function deleteStudent(id, school) {
    return deleteRecord('stud', id, school);
  }

  function deleteStaff(id, school) {
    return deleteRecord('teach', id, school);
  }

  // إضافة إلى طابور الانتظار عند عدم الاتصال
  function _queueUpsert(type, record, school) {
    if (window.QueueManager) {
      const existing = window.gdb ? window.gdb(type) : [];
      window.QueueManager.add({ type, records: existing, school: school || record.school || 'all' });
    }
  }

  // مزامنة دلتا من القائمة المعلقة (BatchSyncManager)
  async function flushDeltaQueue() {
    if (!window.BatchSyncManager) return;
    const queue = window.BatchSyncManager.getQueue();
    if (!queue.length) return { ok: true, sent: 0 };
    try {
      const result = await window.BatchSyncManager.flush();
      return result;
    } catch (err) {
      _log(`❌ فشل تفريغ طابور التعديلات: ${err.message}`, 'error');
      return { ok: false, error: err.message };
    }
  }

  return {
    upsertRecord,
    deleteRecord,
    upsertStudent,
    upsertStaff,
    upsertSchoolInfo,
    deleteStudent,
    deleteStaff,
    flushDeltaQueue
  };
})();

window.DeltaSyncManager = DeltaSyncManager;
