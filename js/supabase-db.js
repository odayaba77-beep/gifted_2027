// ============================================================
// Supabase Database Engine — Supabase Single Source of Truth
// Online-Only Engine with Realtime, RLS Enforcement & Storage
// ============================================================

const SUPABASE_CONFIG = {
  url: localStorage.getItem('gft_supabase_url') || (typeof StorageManager !== 'undefined' ? StorageManager.get('gft_sync_config')?.url : '') || window.env?.VITE_SUPABASE_URL || window.env?.SUPABASE_URL || '',
  anonKey: localStorage.getItem('gft_supabase_anon_key') || (typeof StorageManager !== 'undefined' ? StorageManager.get('gft_sync_config')?.token : '') || window.env?.VITE_SUPABASE_ANON_KEY || window.env?.SUPABASE_ANON_KEY || ''
};

let supabaseClient = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (window.supabaseClient) {
    supabaseClient = window.supabaseClient;
    return supabaseClient;
  }
  const cfg = (typeof CloudSyncManager !== 'undefined' && CloudSyncManager.getConfig) 
    ? CloudSyncManager.getConfig() 
    : {
        url: localStorage.getItem('gft_supabase_url') || (typeof StorageManager !== 'undefined' ? StorageManager.get('gft_sync_config')?.url : '') || window.env?.VITE_SUPABASE_URL || window.env?.SUPABASE_URL || '',
        token: localStorage.getItem('gft_supabase_anon_key') || (typeof StorageManager !== 'undefined' ? StorageManager.get('gft_sync_config')?.token : '') || window.env?.VITE_SUPABASE_ANON_KEY || window.env?.SUPABASE_ANON_KEY || ''
      };
  const url = (cfg.url || SUPABASE_CONFIG.url || '').trim();
  const token = (cfg.token || SUPABASE_CONFIG.anonKey || '').trim();
  if (window.supabase && url && token) {
    try {
      supabaseClient = window.supabase.createClient(url, token);
      window.supabaseClient = supabaseClient;
      return supabaseClient;
    } catch(e) {
      console.warn('[getSupabaseClient Error]:', e);
    }
  }
  return null;
}

function initSupabaseEngine() {
  const client = getSupabaseClient();
  if (client) {
    setupRealtimeSubscriptions();
    loadSettingsFromSupabase();
  }
}

// ------------------------------------------------------------
// Realtime Subscriptions
// ------------------------------------------------------------
function setupRealtimeSubscriptions() {
  const client = getSupabaseClient();
  if (!client) return;

  const channel = client.channel('db-changes');
  
  channel
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, (payload) => {
      console.log('[Realtime] New Log inserted:', payload);
      const newLog = payload.new;
      if (newLog) {
        const sc = newLog.school_id || '';
        const act = newLog.action || 'نشاط';
        const usr = newLog.user_id || 'المستخدم';
        const det = newLog.details || '';
        
        // Show rich notification to admin or relevant users
        if (window.showToast) {
          const toastMsg = sc 
            ? `🔔 إشعار إداري: قامت مدرسة «${sc}» بعملية (${act}) بواسطة ${usr}`
            : `🔔 إشعار إداري: عملية (${act}) بواسطة ${usr}`;
          window.showToast(toastMsg, 'info', 4500);
        }

        // Add to local logs if not present
        try {
          const localLogs = JSON.parse(localStorage.getItem('gft_oplog') || '[]');
          const newEntry = {
            id: newLog.id || Date.now().toString(36),
            ts: newLog.created_at ? new Date(newLog.created_at).getTime() : Date.now(),
            action: act,
            type: sc ? 'مدرسة' : 'عام',
            name: sc ? `بيانات مدرسة ${sc}` : '',
            school: sc,
            user: usr,
            username: usr,
            details: det
          };
          if (!localLogs.some(l => l.id === newEntry.id || (l.ts === newEntry.ts && l.school === sc))) {
            localLogs.unshift(newEntry);
            if (localLogs.length > 2000) localLogs.length = 2000;
            localStorage.setItem('gft_oplog', JSON.stringify(localLogs));
          }
        } catch(e) {}

        if (window.renderDataEntryStatus) window.renderDataEntryStatus();
        if (window.renderOpsLog) window.renderOpsLog();
        if (window.renderSchools) window.renderSchools();
        if (window.renderDashboard) window.renderDashboard();
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, (payload) => {
      console.log('[Realtime] Students update:', payload);
      if (window.showToast) window.showToast('🔄 تم استلام تحديثات سحابية فورية للطلاب من Supabase', 'info', 3000);
      if (window.refreshAll) window.refreshAll();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, (payload) => {
      console.log('[Realtime] Staff update:', payload);
      if (window.showToast) window.showToast('🔄 تم استلام تحديثات سحابية فورية للكادر من Supabase', 'info', 3000);
      if (window.refreshAll) window.refreshAll();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'student_history' }, (payload) => {
      console.log('[Realtime] History update:', payload);
      if (window.showToast) window.showToast('🔄 تم استلام تحديثات سحابية للسجل الأكاديمي', 'info', 3000);
      if (window.refreshAll) window.refreshAll();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'schools' }, (payload) => {
      console.log('[Realtime] Schools update:', payload);
      const scName = payload.new?.name || payload.new?.school_name || '';
      if (window.showToast) {
        window.showToast(scName ? `🏫 تم استلام تحديثات سحابية لبيانات مدرسة «${scName}»` : '🏫 تم استلام تحديثات سحابية لبيانات المدارس من Supabase', 'info', 3500);
      }
      loadSettingsFromSupabase();
      if (window.renderDataEntryStatus) window.renderDataEntryStatus();
      if (window.renderOpsLog) window.renderOpsLog();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
      console.log('[Realtime] Settings update:', payload);
      if (payload.new) {
        const k = payload.new.key;
        let val = payload.new.value;
        if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
          try { val = JSON.parse(val); } catch(e) {}
        }
        if (k === 'school_info_fields' && Array.isArray(val)) {
          if (window.CONFIG_DATA) CONFIG_DATA.schoolInfoFields = val;
          if (window.FIELD_CONFIG) window.FIELD_CONFIG.school = val;
          if (window.renderSchoolInfoFieldMgr) window.renderSchoolInfoFieldMgr();
          if (window.renderSchoolInfoPage) window.renderSchoolInfoPage();
          if (window.FieldManagerUI?.loadFields) window.FieldManagerUI.loadFields();
          if (window.showToast) window.showToast('⚙️ تم تحديث نموذج حقول بيانات المدرسة سحابياً', 'info', 3000);
        } else if (k === 'schools_list' && Array.isArray(val)) {
          if (window.CONFIG_DATA) CONFIG_DATA.schools = val;
          localStorage.setItem('gft_schools_list', JSON.stringify(val));
          if (window.refreshAllSchoolSelects) window.refreshAllSchoolSelects();
          if (window.renderSchoolsMgmt) window.renderSchoolsMgmt();
          if (window.renderSchools) window.renderSchools();
          if (window.renderDashboard) window.renderDashboard();
          if (window.showToast) window.showToast('🏫 تم تحديث قائمة المدارس المعتمدة في النظام', 'info', 3000);
        } else if (k === 'gft_usernames' && val && typeof val === 'object') {
          localStorage.setItem('gft_usernames', JSON.stringify(val));
          if (window.renderAccounts) window.renderAccounts();
          if (window.updateMyCredBadge) window.updateMyCredBadge();
          if (window.showToast) window.showToast('👥 تم تحديث بيانات حسابات المستخدمين', 'info', 3000);
        } else if (k === 'gft_targets' && val && typeof val === 'object') {
          localStorage.setItem('gft_targets', JSON.stringify(val));
          if (window.renderSchools) window.renderSchools();
          if (window.renderCompletionBars) window.renderCompletionBars();
          if (window.renderDashboard) window.renderDashboard();
          if (window.showToast) window.showToast('🎯 تم تحديث الأعداد المستهدفة للمدارس', 'info', 3000);
        } else if (k === 'gft_latest_school_update' && val && typeof val === 'object') {
          const scName = val.school || '';
          const byUser = val.user || '';
          const act = val.action || 'تحديث بيانات المدرسة';
          const det = val.details || '';
          if (window.showToast && scName) {
            window.showToast(`🏫 إشعار إداري: قامت مدرسة «${scName}» بـ (${act}) بواسطة ${byUser}`, 'info', 4500);
          }
          try {
            const localLogs = JSON.parse(localStorage.getItem('gft_oplog') || '[]');
            const entry = {
              id: Date.now().toString(36),
              ts: Date.now(),
              action: act,
              type: 'مدرسة',
              name: `بيانات مدرسة ${scName}`,
              school: scName,
              user: byUser,
              username: byUser,
              details: det
            };
            if (!localLogs.some(l => l.school === scName && (Date.now() - l.ts < 5000))) {
              localLogs.unshift(entry);
              if (localLogs.length > 2000) localLogs.length = 2000;
              localStorage.setItem('gft_oplog', JSON.stringify(localLogs));
            }
          } catch(e) {}
          if (window.renderDataEntryStatus) window.renderDataEntryStatus();
          if (window.renderOpsLog) window.renderOpsLog();
          if (window.renderSchools) window.renderSchools();
          if (window.renderDashboard) window.renderDashboard();
          if (window.renderSchoolInfoPage) window.renderSchoolInfoPage();
        } else if (k && k.startsWith('gft_si_') && val) {
          localStorage.setItem(k, JSON.stringify(val));
          let scName = (val && typeof val === 'object' && val.name) ? val.name : '';
          if (!scName) {
            try {
              const b64 = k.replace('gft_si_', '');
              scName = decodeURIComponent(atob(b64));
            } catch(e) {}
          }
          if (window.showToast && scName) {
            window.showToast(`🏫 قامت مدرسة «${scName}» بتحديث بياناتها في السحابة بنجاح`, 'info', 3500);
          }
          if (window.renderSchoolInfoPage) window.renderSchoolInfoPage();
          if (window.renderSchools) window.renderSchools();
          if (window.renderDashboard) window.renderDashboard();
          if (window.renderDataEntryStatus) window.renderDataEntryStatus();
          if (window.renderOpsLog) window.renderOpsLog();
        } else {
          if (window.showToast) window.showToast('⚙️ تم استلام تحديثات سحابية لإعدادات النظام', 'info', 3000);
        }
      }
    })
    .subscribe((status) => {
      console.log('[Supabase Realtime Status]:', status);
      updateOnlineBadgeStatus(status === 'SUBSCRIBED');
      if (status === 'SUBSCRIBED' && window.showToast) {
        window.showToast('🟢 متصل بالبث المباشر (Supabase Realtime Active)', 'success', 2500);
      }
    });
}

// ------------------------------------------------------------
// Settings & Schools Persistence API for Supabase
// ------------------------------------------------------------
async function saveSettingsToSupabase(key, value) {
  verifyOnlineOnly();
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const { error } = await client
      .from('settings')
      .upsert({
        key: key,
        value: value,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (error) {
      console.warn('[Supabase Settings Upsert Fallback]:', error);
      const { data: existing } = await client.from('settings').select('id').eq('key', key);
      if (existing && existing.length > 0) {
        await client.from('settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
      } else {
        await client.from('settings').insert({ key, value, updated_at: new Date().toISOString() });
      }
    }
    console.log(`[Supabase Settings] Saved "${key}" successfully`);
  } catch (e) {
    console.error('[Supabase Save Settings Exception]:', e);
  }
}

async function deleteSchoolFromSupabase(schoolName) {
  if (!schoolName) return { ok: false, error: 'اسم المدرسة مطلوب' };
  
  const siKey = 'gft_si_' + btoa(encodeURIComponent(schoolName)).replace(/=/g, '');
  try {
    localStorage.removeItem(siKey);
  } catch (e) {}

  const client = getSupabaseClient();
  if (!client) {
    return { ok: true };
  }

  try {
    // 1. Delete from schools table (by school_id or name)
    const { error: delSchoolErr } = await client
      .from('schools')
      .delete()
      .or(`school_id.eq.${schoolName},name.eq.${schoolName}`);
    if (delSchoolErr) console.warn('[Supabase Delete School Table Warning]:', delSchoolErr);

    // 2. Delete school info from settings table
    const { error: delSettingErr } = await client
      .from('settings')
      .delete()
      .eq('key', siKey);
    if (delSettingErr) console.warn('[Supabase Delete School Settings Warning]:', delSettingErr);

    // 3. Update schools_list in settings table
    const currentList = (window.getSchoolsList ? window.getSchoolsList() : (window.CONFIG_DATA?.schools || [])).filter(s => s !== schoolName);
    await saveSettingsToSupabase('schools_list', currentList);

    console.log(`[Supabase Delete School] Successfully deleted school "${schoolName}"`);
    return { ok: true };
  } catch (err) {
    console.error('[Supabase deleteSchoolFromSupabase Exception]:', err);
    return { ok: false, error: err.message || err };
  }
}

async function syncSchoolsListToSupabase(schoolsList) {
  if (!Array.isArray(schoolsList)) return;
  await saveSettingsToSupabase('schools_list', schoolsList);

  const client = getSupabaseClient();
  if (!client) return;
  try {
    // 1. Clean up deleted schools from Supabase 'schools' table and 'settings' table
    const { data: existingSchools } = await client
      .from('schools')
      .select('school_id, name');

    if (existingSchools && Array.isArray(existingSchools)) {
      const toDelete = existingSchools.filter(s => {
        const idMatch = s.school_id && schoolsList.includes(s.school_id);
        const nameMatch = s.name && schoolsList.includes(s.name);
        return !idMatch && !nameMatch;
      });

      for (const item of toDelete) {
        const targetId = item.school_id || item.name;
        if (targetId) {
          await client
            .from('schools')
            .delete()
            .or(`school_id.eq.${targetId},name.eq.${targetId}`);
          const sKey = 'gft_si_' + btoa(encodeURIComponent(targetId)).replace(/=/g, '');
          await client
            .from('settings')
            .delete()
            .eq('key', sKey);
          try { localStorage.removeItem(sKey); } catch(e) {}
        }
      }
    }

    // 2. Upsert current active schools
    if (schoolsList.length > 0) {
      const rows = schoolsList.map(sc => {
        const info = typeof window.getSchoolInfoData === 'function' ? window.getSchoolInfoData(sc) : {};
        return {
          school_id: sc,
          name: info.name || sc,
          gov_name: info.si_govname || info.gov_name || info.governorate || null,
          district: info.si_district || info.district || null,
          address: info.si_address || info.address || null,
          phone: info.si_phone || info.phone || null,
          email: info.si_email || info.email || null,
          notes: typeof info === 'object' ? JSON.stringify(info) : (info.si_notes || info.notes || null),
          updated_at: new Date().toISOString()
        };
      });
      const { error } = await client
        .from('schools')
        .upsert(rows, { onConflict: 'school_id' });
      if (error) console.warn('[Supabase Schools Table Upsert Warning]:', error);
      else console.log('[Supabase Schools Table] Upserted', rows.length, 'schools');
    }
  } catch (err) {
    console.error('[Supabase syncSchoolsListToSupabase Exception]:', err);
  }
}

async function syncSchoolInfoToSupabase(school, data) {
  if (!school) return;
  const cleanData = (data && typeof data === 'object') ? data : {};
  const key = 'gft_si_' + btoa(encodeURIComponent(school)).replace(/=/g, '');
  
  // 1. Save to settings table
  await saveSettingsToSupabase(key, cleanData);

  // 2. Upsert to schools table
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const row = {
      school_id: school,
      name: cleanData.name || cleanData.si_name || school,
      gov_name: cleanData.si_govname || cleanData.gov_name || cleanData.governorate || null,
      district: cleanData.si_district || cleanData.district || null,
      address: cleanData.si_address || cleanData.address || null,
      phone: cleanData.si_phone || cleanData.phone || null,
      email: cleanData.si_email || cleanData.email || null,
      notes: JSON.stringify(cleanData),
      updated_at: new Date().toISOString()
    };
    const { error } = await client
      .from('schools')
      .upsert(row, { onConflict: 'school_id' });
    if (error) console.warn('[Supabase School Record Upsert Warning]:', error);
    else console.log(`[Supabase School Info] Synced school "${school}" to cloud successfully`);
  } catch (err) {
    console.error('[Supabase syncSchoolInfoToSupabase Exception]:', err);
  }
}

// Fetch single school info directly from Supabase (settings and schools table)
async function fetchSchoolInfoFromSupabase(schoolName) {
  if (!schoolName) return null;
  const key = 'gft_si_' + btoa(encodeURIComponent(schoolName)).replace(/=/g, '');
  const client = getSupabaseClient();
  if (!client) {
    return typeof window.getSchoolInfoData === 'function' ? window.getSchoolInfoData(schoolName) : {};
  }

  try {
    let result = {};
    // 1. Query settings table
    const { data: settingRow } = await client
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (settingRow && settingRow.value) {
      let parsed = settingRow.value;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch(e) {}
      }
      if (parsed && typeof parsed === 'object') {
        result = { ...result, ...parsed };
      }
    }

    // 2. Query schools table
    const { data: schoolRow } = await client
      .from('schools')
      .select('*')
      .or(`school_id.eq.${schoolName},name.eq.${schoolName}`)
      .maybeSingle();

    if (schoolRow) {
      let extraObj = {};
      if (schoolRow.notes) {
        try {
          extraObj = typeof schoolRow.notes === 'string' && schoolRow.notes.startsWith('{')
            ? JSON.parse(schoolRow.notes)
            : schoolRow.notes;
        } catch(e) {}
      }
      if (extraObj && typeof extraObj === 'object') {
        result = { ...extraObj, ...result };
      }
      if (schoolRow.gov_name && !result.si_govname) result.si_govname = schoolRow.gov_name;
      if (schoolRow.district && !result.si_district) result.si_district = schoolRow.district;
      if (schoolRow.address && !result.si_address) result.si_address = schoolRow.address;
      if (schoolRow.phone && !result.si_phone) result.si_phone = schoolRow.phone;
      if (schoolRow.email && !result.si_email) result.si_email = schoolRow.email;
      if (schoolRow.name && !result.name) result.name = schoolRow.name;
    }

    if (Object.keys(result).length > 0) {
      localStorage.setItem(key, JSON.stringify(result));
      return result;
    }
  } catch (err) {
    console.warn('[fetchSchoolInfoFromSupabase Exception]:', err);
  }

  return typeof window.getSchoolInfoData === 'function' ? window.getSchoolInfoData(schoolName) : {};
}

async function loadSettingsFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const { data: settingsData } = await client
      .from('settings')
      .select('*');

    let refreshed = false;
    let cloudSchoolsList = null;

    if (settingsData && Array.isArray(settingsData)) {
      settingsData.forEach(item => {
        if (!item.key || !item.value) return;

        let valObj = item.value;
        if (typeof valObj === 'string' && (valObj.startsWith('{') || valObj.startsWith('['))) {
          try { valObj = JSON.parse(valObj); } catch(e) {}
        }

        if (item.key === 'school_info_fields' && Array.isArray(valObj)) {
          if (window.CONFIG_DATA) CONFIG_DATA.schoolInfoFields = valObj;
          if (window.FIELD_CONFIG) window.FIELD_CONFIG.school = valObj;
          refreshed = true;
        }

        if (item.key === 'schools_list' && Array.isArray(valObj) && valObj.length > 0) {
          cloudSchoolsList = valObj;
          if (window.CONFIG_DATA) CONFIG_DATA.schools = valObj;
          localStorage.setItem('gft_schools_list', JSON.stringify(valObj));
          refreshed = true;
        }

        if (item.key === 'gft_usernames' && valObj && typeof valObj === 'object') {
          localStorage.setItem('gft_usernames', JSON.stringify(valObj));
          refreshed = true;
        }

        if (item.key === 'gft_targets' && valObj && typeof valObj === 'object') {
          localStorage.setItem('gft_targets', JSON.stringify(valObj));
          refreshed = true;
        }

        if ((item.key === 'field_config_teach' || item.key === 'field_config_staff') && Array.isArray(valObj)) {
          if (window.FIELD_CONFIG) window.FIELD_CONFIG.staff = valObj;
          refreshed = true;
        }

        if ((item.key === 'field_config_stud' || item.key === 'field_config_students') && Array.isArray(valObj)) {
          if (window.FIELD_CONFIG) window.FIELD_CONFIG.students = valObj;
          refreshed = true;
        }

        if (item.key.startsWith('gft_si_') && valObj && typeof valObj === 'object') {
          localStorage.setItem(item.key, JSON.stringify(valObj));
          refreshed = true;
        }
      });
    }

    const { data: schoolsData } = await client
      .from('schools')
      .select('*');

    if (schoolsData && Array.isArray(schoolsData)) {
      // If schools_list was not explicitly in settings, initialize it from schools table
      if (!cloudSchoolsList && schoolsData.length > 0) {
        const dbSchools = schoolsData.map(s => s.school_id || s.name).filter(Boolean);
        if (dbSchools.length > 0) {
          if (window.CONFIG_DATA) CONFIG_DATA.schools = dbSchools;
          localStorage.setItem('gft_schools_list', JSON.stringify(dbSchools));
          refreshed = true;
        }
      }

      // Load school metadata only for active schools
      const activeSchools = cloudSchoolsList || (window.CONFIG_DATA?.schools || []);
      schoolsData.forEach(s => {
        const scName = s.school_id || s.name;
        if (!scName || !activeSchools.includes(scName)) return;
        const key = 'gft_si_' + btoa(encodeURIComponent(scName)).replace(/=/g, '');
        const local = localStorage.getItem(key);
        let infoObj = {};
        try { 
          infoObj = JSON.parse(local || '{}');
          if (typeof infoObj === 'string') infoObj = JSON.parse(infoObj);
        } catch(e) {}

        let extraObj = {};
        if (s.notes) {
          try { 
            extraObj = typeof s.notes === 'string' && s.notes.startsWith('{') ? JSON.parse(s.notes) : s.notes; 
          } catch(e) {}
        }

        const mergedObj = {
          ...extraObj,
          ...infoObj,
          name: s.name || scName,
          si_govname: s.gov_name || infoObj.si_govname || extraObj.si_govname || '',
          si_district: s.district || infoObj.si_district || extraObj.si_district || '',
          si_address: s.address || infoObj.si_address || extraObj.si_address || '',
          si_phone: s.phone || infoObj.si_phone || extraObj.si_phone || '',
          si_email: s.email || infoObj.si_email || extraObj.si_email || ''
        };

        localStorage.setItem(key, JSON.stringify(mergedObj));
        refreshed = true;
      });
    }

    if (refreshed) {
      if (window.refreshAllSchoolSelects) window.refreshAllSchoolSelects();
      if (window.renderSchoolsMgmt) window.renderSchoolsMgmt();
      if (window.renderSchools) window.renderSchools();
      if (window.renderSchoolInfoPage) window.renderSchoolInfoPage();
      if (window.renderSchoolInfoFieldMgr) window.renderSchoolInfoFieldMgr();
      if (window.renderAccounts) window.renderAccounts();
      if (window.renderCompletionBars) window.renderCompletionBars();
      if (window.renderDashboard) window.renderDashboard();
      if (window.updateMyCredBadge) window.updateMyCredBadge();
    }
  } catch (e) {
    console.warn('[Supabase Load Settings Error]:', e);
  }
}

window.getSupabaseClient = getSupabaseClient;
window.saveSettingsToSupabase = saveSettingsToSupabase;
window.deleteSchoolFromSupabase = deleteSchoolFromSupabase;
window.syncSchoolsListToSupabase = syncSchoolsListToSupabase;
window.syncSchoolInfoToSupabase = syncSchoolInfoToSupabase;
window.fetchSchoolInfoFromSupabase = fetchSchoolInfoFromSupabase;
window.loadSettingsFromSupabase = loadSettingsFromSupabase;

function updateOnlineBadgeStatus(isSubscribed) {
  const dot = document.getElementById('cloud-status-dot');
  const lbl = document.getElementById('cloud-status-lbl');
  if (dot && lbl) {
    if (!navigator.onLine) {
      dot.className = 'cloud-dot red';
      lbl.textContent = '🔴 غير متصل بالإنترنت (محظور)';
    } else if (isSubscribed) {
      dot.className = 'cloud-dot green';
      lbl.textContent = '🟢 متصل بالسحابة (Supabase Realtime)';
    } else {
      dot.className = 'cloud-dot green';
      lbl.textContent = '🟢 متصل بالإنترنت';
    }
  }
}

// ------------------------------------------------------------
// Online Connectivity Verification Guard
// ------------------------------------------------------------
function verifyOnlineOnly() {
  if (!navigator.onLine) {
    const errorMsg = '⚠️ لا يوجد اتصال بالإنترنت. هذا النظام يعمل بوضع الاتصال المباشر (Online Only). تم حظر العملية لعدم المزامنة.';
    alert(errorMsg);
    throw new Error('Offline_Operation_Blocked');
  }
}

// ------------------------------------------------------------
// Image Storage Upload Guard (Max 2MB)
// ------------------------------------------------------------
async function uploadStudentPhotoToSupabase(file, studentMasterId) {
  verifyOnlineOnly();

  if (!file) return null;

  // 2MB Limit Check
  const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
  if (file.size > MAX_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    if (window.showToast) window.showToast(`❌ حجم الصورة (${sizeMB} MB) يتجاوز الحد المسموح (2 MB)`, 'error');
    else alert(`❌ حجم الصورة (${sizeMB} MB) يتجاوز الحد المسموح به (2 MB). يُرجى اختيار صورة أصغر.`);
    throw new Error('File_Too_Large');
  }

  if (!supabaseClient) {
    // Return base64 preview as fallback if client not initialized
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  const fileExt = file.name.split('.').pop();
  const filePath = `students/${studentMasterId || Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

  const { data, error } = await supabaseClient.storage
    .from('student-photos')
    .upload(filePath, file, { upsert: true });

  if (error) {
    console.error('[Supabase Storage Error]:', error);
    if (window.showToast) window.showToast('❌ فشل رفع الصورة إلى Supabase Storage: ' + error.message, 'error');
    else alert('فشل رفع الصورة إلى Supabase Storage: ' + error.message);
    throw error;
  }

  const { data: publicUrlData } = supabaseClient.storage
    .from('student-photos')
    .getPublicUrl(filePath);

  if (window.showToast) window.showToast('📸 تم رفع صورة الطالب إلى Supabase Storage بنجاح', 'success', 2500);

  return publicUrlData.publicUrl;
}

// ------------------------------------------------------------
// Supabase Activity / Audit Logging & Notification API
// ------------------------------------------------------------
async function recordActivityLogToSupabase(entryOrAction, typeOrSchool, recordOrDetails, extraDetails) {
  if (!entryOrAction) return;
  const client = getSupabaseClient();
  
  let entry = null;
  if (typeof entryOrAction === 'object' && entryOrAction.action) {
    entry = entryOrAction;
  } else {
    const user = window.CU ? (window.CU.name || window.CU.username) : 'المستخدم';
    const school = (typeof recordOrDetails === 'object' && recordOrDetails?.school) ? recordOrDetails.school : (window.CU?.school || '');
    entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts: Date.now(),
      action: entryOrAction,
      type: typeOrSchool === 'teach' ? 'كادر' : (typeOrSchool === 'stud' ? 'طالب' : (typeOrSchool || 'مدرسة')),
      name: (typeof recordOrDetails === 'object' && recordOrDetails?.name1) ? recordOrDetails.name1 : (typeof recordOrDetails === 'string' ? recordOrDetails : (school ? `بيانات مدرسة ${school}` : '')),
      school: school,
      user: user,
      username: window.CU?.username || '',
      details: extraDetails || (typeof recordOrDetails === 'string' ? recordOrDetails : '')
    };
  }

  // 1. Update local storage oplog
  try {
    const localLogs = JSON.parse(localStorage.getItem('gft_oplog') || '[]');
    if (!localLogs.some(l => l.id === entry.id)) {
      localLogs.unshift(entry);
      if (localLogs.length > 2000) localLogs.length = 2000;
      localStorage.setItem('gft_oplog', JSON.stringify(localLogs));
    }
  } catch(e) {}

  if (!client || !navigator.onLine) return;

  try {
    // 2. Insert into Supabase `logs` table
    const dbRow = {
      user_id: entry.username || entry.user || window.CU?.username || 'user',
      school_id: entry.school || window.CU?.school || null,
      action: entry.action || 'نشاط',
      details: typeof entry.details === 'object' ? JSON.stringify(entry.details) : (entry.details || `${entry.type || ''}: ${entry.name || ''}`),
      created_at: new Date(entry.ts || Date.now()).toISOString()
    };
    const { error: logErr } = await client.from('logs').insert(dbRow);
    if (logErr) {
      console.warn('[Supabase logs table insert warn]:', logErr.message);
    }

    // 3. Save latest school/general update to settings table for Realtime sync across all connected clients
    if (entry.school || entry.type === 'مدرسة' || (entry.action && entry.action.includes('مدرسة'))) {
      const updatePayload = {
        type: 'school_update',
        school: entry.school || window.CU?.school || 'عام',
        action: entry.action,
        user: entry.user || entry.username || 'المستخدم',
        details: entry.details || '',
        timestamp: new Date().toISOString()
      };
      await saveSettingsToSupabase('gft_latest_school_update', updatePayload);
    }
  } catch (e) {
    console.warn('[recordActivityLogToSupabase Exception]:', e);
  }
}

window.recordActivityLogToSupabase = recordActivityLogToSupabase;

// ------------------------------------------------------------
// Supabase Data Adapter API
// ------------------------------------------------------------
const SupabaseDataEngine = {
  // Check online status before any operation
  async checkConnection() {
    return navigator.onLine;
  },

  // Log Audit Action to Database
  async logAction(action, details, extra) {
    return recordActivityLogToSupabase(action, 'نظام', details, extra);
  }
};

window.addEventListener('online', () => updateOnlineBadgeStatus(true));
window.addEventListener('offline', () => updateOnlineBadgeStatus(false));
document.addEventListener('DOMContentLoaded', initSupabaseEngine);
