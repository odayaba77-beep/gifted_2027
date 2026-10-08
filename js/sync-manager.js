// BatchSyncManager: local edit queue + single POST batch sync.
(function () {
  'use strict';

  const QUEUE_KEY = 'gft_field_grid_queue';

  function getSyncConfig() {
    if (window.CloudSyncManager?.getConfig) return window.CloudSyncManager.getConfig();
    if (window.StorageManager?.get) return window.StorageManager.get('gft_sync_config') || {};
    try { return JSON.parse(localStorage.getItem('gft_sync_config') || '{}'); } catch { return {}; }
  }

  function readQueue() {
    if (window.StorageManager?.get) return window.StorageManager.get(QUEUE_KEY) || [];
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
  }

  function writeQueue(queue) {
    if (window.StorageManager?.set) StorageManager.set(QUEUE_KEY, queue);
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    window.EventSystem?.emit?.('grid:queue-changed', { count: queue.length, queue });
  }

  function normalizeType(type) {
    if (type === 'students') return 'stud';
    if (type === 'staff') return 'teach';
    return type;
  }

  function stripLargeFields(record) {
    const { photo, image, attachment, ...safe } = record || {};
    return safe;
  }

  const BatchSyncManager = {
    getQueue: readQueue,

    count() {
      return readQueue().length;
    },

    enqueue(change) {
      const row = stripLargeFields(change.record || {});
      const type = normalizeType(change.type);
      const rowId = row.id || change.id;
      const queue = readQueue().filter(item => !(item.type === type && item.rowId === rowId));
      queue.push({
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        type,
        rowId,
        action: change.action || 'upsert',
        record: row,
        changedFields: change.changedFields || [],
        school: change.school || row.school || window.CU?.school || 'all',
        queuedAt: new Date().toISOString()
      });
      writeQueue(queue);
      return queue.length;
    },

    clear() {
      writeQueue([]);
    },

    async flush(options = {}) {
      const cfg = options.config || getSyncConfig();
      const queue = readQueue();
      if (!queue.length) return { ok: true, sent: 0, message: 'لا توجد تعديلات معلقة' };
      if (!cfg.url || !cfg.token) throw new Error('لم يتم ضبط إعدادات Supabase');

      // Group changes by type
      const teachRecords = queue.filter(q => q.type === 'teach' || q.type === 'staff').map(q => q.record);
      const studRecords = queue.filter(q => q.type === 'stud' || q.type === 'students').map(q => q.record);

      if (teachRecords.length && window.CloudSyncManager?.sendData) {
        await window.CloudSyncManager.sendData('teach', teachRecords, window.CU?.school);
      }
      if (studRecords.length && window.CloudSyncManager?.sendData) {
        await window.CloudSyncManager.sendData('stud', studRecords, window.CU?.school);
      }

      writeQueue([]);
      window.addSyncLog?.(`تم إرسال ${queue.length} تعديل دفعة واحدة إلى Supabase`, 'success');
      return { ok: true, sent: queue.length };
    }
  };

  window.BatchSyncManager = BatchSyncManager;
  window.saveAllGridChanges = async () => {
    try {
      const result = await BatchSyncManager.flush();
      const msg = result.sent ? `✅ تم حفظ ومزامنة ${result.sent} تعديل مع قاعدة البيانات بنجاح` : (result.message || 'لا توجد تعديلات معلقة');
      if (window.showToast) {
        window.showToast(msg, result.sent ? 'success' : 'info', 3500);
      } else {
        alert(msg);
      }
      return result;
    } catch (error) {
      const errMsg = `❌ فشل حفظ التعديلات في قاعدة البيانات: ${error.message || error}`;
      if (window.showToast) {
        window.showToast(errMsg, 'error', 4500);
      } else {
        alert(errMsg);
      }
      throw error;
    }
  };
})();
