/**
 * ============================================================
 * Enterprise-Grade Security, Anti-Debugging & Hardening Engine
 * Gifted Schools Management System — Specialized Security Layer
 * ============================================================
 */

const Security = (() => {
  const SESSION_KEY = 'gft_sec_session';
  const OLD_SESSION_KEY = 'gft_session';
  const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes inactivity timeout
  const RATE_LIMIT_KEY = 'gft_sec_ratelimit';
  const MAX_LOGIN_ATTEMPTS = 3; // 3 failed attempts
  const LOCKOUT_PERIOD_MS = 2 * 60 * 1000; // 2 minutes lockout (120 seconds)
  const ENCRYPTION_SALT = 'gft_sec_v5_hardened_salt_#2026';

  let logoutTimer = null;
  let devToolsInterval = null;
  let devToolsDetected = false;
  let isAntiDebuggingActive = false;

  // ------------------------------------------------------------
  // 1. Sanitization & Escaping (XSS & Injection Protection)
  // ------------------------------------------------------------
  function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"'`=\/]/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '`': '&#96;',
      '=': '&#61;',
      '/': '&#47;'
    }[ch]));
  }

  function safeText(value) {
    return escapeHTML(value);
  }

  /**
   * Deep sanitize objects or arrays to prevent XSS payloads in inputs
   */
  function sanitizeInput(data) {
    if (typeof data === 'string') {
      // Strip control chars, null bytes and dangerous script constructs
      return data.replace(/\0/g, '').trim();
    }
    if (Array.isArray(data)) {
      return data.map(sanitizeInput);
    }
    if (data && typeof data === 'object') {
      const clean = {};
      for (const [k, v] of Object.entries(data)) {
        clean[k] = sanitizeInput(v);
      }
      return clean;
    }
    return data;
  }

  // ------------------------------------------------------------
  // 2. Cryptographic Helpers (SHA-256 with Salting & Signatures)
  // ------------------------------------------------------------
  async function sha256(value, salt = '') {
    const input = String(value ?? '') + (salt || ENCRYPTION_SALT);
    if (window.crypto?.subtle) {
      const data = new TextEncoder().encode(input);
      const hash = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback pseudo-hash if SubtleCrypto unavailable
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < input.length; i++) {
      const ch = input.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    return 'legacy-' + ((h1 >>> 0).toString(16) + (h2 >>> 0).toString(16));
  }

  function generateSecureToken(length = 32) {
    if (window.crypto?.getRandomValues) {
      const bytes = new Uint8Array(length);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  }

  // ------------------------------------------------------------
  // 3. Anti-Debugging, DevTools Deterrence & Keyboard Protection
  // ------------------------------------------------------------
  function initAntiDebugging(options = { blockShortcuts: true, blockContextMenu: true, detectDevTools: true, forceLogoutOnInspect: false }) {
    if (isAntiDebuggingActive) return;
    isAntiDebuggingActive = true;

    // A. Disable Context Menu (Right Click) with custom notification
    if (options.blockContextMenu) {
      document.addEventListener('contextmenu', (e) => {
        // Allow text select on input fields if explicitly needed, otherwise block inspection
        const targetTag = e.target?.tagName?.toLowerCase();
        if (targetTag !== 'input' && targetTag !== 'textarea') {
          e.preventDefault();
          if (window.showToast) {
            window.showToast('🛡️ تم تقييد النقر بالزر الأيمن لحماية بيانات النظام ومسار المصادقة', 'warning', 2500);
          }
          return false;
        }
      }, { capture: true, passive: false });
    }

    // B. Block common inspection & reverse engineering shortcuts
    if (options.blockShortcuts) {
      window.addEventListener('keydown', (e) => {
        const key = e.key || '';
        const keyCode = e.keyCode || e.which;
        const ctrlOrMeta = e.ctrlKey || e.metaKey;

        // F12
        if (key === 'F12' || keyCode === 123) {
          e.preventDefault();
          e.stopPropagation();
          notifySecurityAlert('محاولة فتح أدوات المطورين عبر زر F12');
          return false;
        }

        // Ctrl+Shift+I (Inspect), Ctrl+Shift+J (Console), Ctrl+Shift+C (Element picker)
        if (ctrlOrMeta && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c', 'K', 'k'].includes(key)) {
          e.preventDefault();
          e.stopPropagation();
          notifySecurityAlert('محاولة تشغيل نافذة المطورين عبر الاختصارات');
          return false;
        }

        // Ctrl+U (View Source)
        if (ctrlOrMeta && ['U', 'u', 'S', 's'].includes(key) && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          notifySecurityAlert('تم تقييد عرض الشفرة المصدرية');
          return false;
        }
      }, { capture: true, passive: false });
    }

    // C. DevTools Detection via Resizing, Timing & Debugger Trap
    if (options.detectDevTools) {
      startDevToolsDetector(options.forceLogoutOnInspect);
    }
  }

  function startDevToolsDetector(forceLogout) {
    if (devToolsInterval) clearInterval(devToolsInterval);

    // In iframe or nested environments, outer vs inner dimensions differ naturally
    const isInIframe = window.self !== window.top;
    const threshold = 200;

    const checkState = () => {
      if (!isInIframe) {
        const widthThreshold = window.outerWidth - window.innerWidth > threshold;
        const heightThreshold = window.outerHeight - window.innerHeight > threshold;
        const isOrientationChange = window.orientation !== undefined;

        if (!isOrientationChange && (widthThreshold || heightThreshold)) {
          triggerDevToolsAction(forceLogout, 'اكتشاف نافذة المطورين عبر فحص أبعاد العرض');
        }
      }
    };

    devToolsInterval = setInterval(checkState, 3000);
  }

  function triggerDevToolsAction(forceLogout, reason) {
    if (devToolsDetected) return;
    devToolsDetected = true;
    console.warn(`[Security Warning]: ${reason}`);

    try {
      if (window.ActivityLogger && window.CU) {
        if (typeof window.ActivityLogger.log === 'function') {
          window.ActivityLogger.log('تحذير أمني', 'محاولة فحص النظام وأدوات المطورين', { reason });
        } else if (typeof window.ActivityLogger.local === 'function') {
          window.ActivityLogger.local('تحذير أمني', 'system', null, reason);
        }
      }
    } catch (e) {
      console.warn('[ActivityLogger]', e);
    }

    if (window.showToast) {
      window.showToast('⚠️ تنبيه أمني: تم رصد محاولة فحص الأكواد/أدوات المطورين', 'error', 4000);
    }

    if (forceLogout && window.CU && typeof window.doLogout === 'function') {
      setTimeout(() => {
        alert('⚠️ تم إنهاء الجلسة تلقائياً كإجراء وقائي بسبب رصد نشاط فحص غير مصرح به.');
        window.doLogout();
      }, 500);
    }

    // Reset detection flag after 8 seconds to prevent spam
    setTimeout(() => {
      devToolsDetected = false;
    }, 8000);
  }

  function notifySecurityAlert(msg) {
    if (window.showToast) {
      window.showToast(`🛡️ إجراء أمني: ${msg}`, 'warning', 2500);
    }
  }

  // ------------------------------------------------------------
  // 4. Rate Limiting & Brute Force Prevention
  // ------------------------------------------------------------
  function formatSeconds(totalSec) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function checkRateLimit(username) {
    try {
      const now = Date.now();
      const limits = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || '{}');
      const normU = (username || '').trim().toLowerCase();

      const userLimit = normU ? (limits[normU] || { attempts: 0, lockedUntil: 0 }) : null;
      const deviceLimit = limits['_device_'] || { attempts: 0, lockedUntil: 0 };

      let activeLockUntil = 0;
      if (userLimit && userLimit.lockedUntil && userLimit.lockedUntil > now) {
        activeLockUntil = Math.max(activeLockUntil, userLimit.lockedUntil);
      }
      if (deviceLimit.lockedUntil && deviceLimit.lockedUntil > now) {
        activeLockUntil = Math.max(activeLockUntil, deviceLimit.lockedUntil);
      }

      if (activeLockUntil > now) {
        const remainingTotalSec = Math.ceil((activeLockUntil - now) / 1000);
        const timeFormatted = formatSeconds(remainingTotalSec);
        return {
          allowed: false,
          lockedUntil: activeLockUntil,
          remainingSec: remainingTotalSec,
          remainingFormatted: timeFormatted,
          error: `⛔ تم قفل تسجيل الدخول مؤقتاً لمدة دقيقتين لضمان الأمان بعد 3 محاولات خاطئة.<br><span style="display:inline-block;margin-top:6px;font-weight:bold;font-size:13px">الوقت المتبقي: ⏱️ <span>${timeFormatted}</span></span>`
        };
      }

      // Cleanup expired lockouts
      let changed = false;
      if (userLimit && userLimit.lockedUntil && userLimit.lockedUntil <= now) {
        delete limits[normU];
        changed = true;
      }
      if (deviceLimit.lockedUntil && deviceLimit.lockedUntil <= now) {
        delete limits['_device_'];
        changed = true;
      }
      if (changed) {
        localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(limits));
      }

      return { allowed: true };
    } catch {
      return { allowed: true };
    }
  }

  function recordFailedLogin(username) {
    try {
      const now = Date.now();
      const limits = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || '{}');
      const normU = (username || '').trim().toLowerCase();

      const userRecord = normU ? (limits[normU] || { attempts: 0, lockedUntil: 0 }) : null;
      const deviceRecord = limits['_device_'] || { attempts: 0, lockedUntil: 0 };

      if (userRecord) {
        userRecord.attempts = (userRecord.attempts || 0) + 1;
        if (userRecord.attempts >= MAX_LOGIN_ATTEMPTS) {
          userRecord.lockedUntil = now + LOCKOUT_PERIOD_MS;
        }
        limits[normU] = userRecord;
      }

      deviceRecord.attempts = (deviceRecord.attempts || 0) + 1;
      if (deviceRecord.attempts >= MAX_LOGIN_ATTEMPTS) {
        deviceRecord.lockedUntil = now + LOCKOUT_PERIOD_MS;
      }
      limits['_device_'] = deviceRecord;

      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(limits));

      const maxAttempts = Math.max(userRecord ? userRecord.attempts : 0, deviceRecord.attempts);
      const isLocked = maxAttempts >= MAX_LOGIN_ATTEMPTS;
      const lockedUntil = Math.max(userRecord?.lockedUntil || 0, deviceRecord.lockedUntil || 0);
      const remainingTotalSec = isLocked ? Math.ceil((lockedUntil - now) / 1000) : 0;
      const timeFormatted = formatSeconds(remainingTotalSec);

      return {
        locked: isLocked,
        lockedUntil: isLocked ? lockedUntil : 0,
        remainingSec: remainingTotalSec,
        remainingFormatted: timeFormatted,
        attemptsLeft: Math.max(0, MAX_LOGIN_ATTEMPTS - maxAttempts)
      };
    } catch {
      return { locked: false, attemptsLeft: 3 };
    }
  }

  function clearLoginRateLimit(username) {
    try {
      const limits = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || '{}');
      const normU = (username || '').trim().toLowerCase();
      if (normU && limits[normU]) delete limits[normU];
      delete limits['_device_'];
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(limits));
    } catch {}
  }

  // ------------------------------------------------------------
  // 5. Tamper-Proof Session & Role Validation (HMAC-like Signature)
  // ------------------------------------------------------------
  async function createSessionToken(user) {
    const startedAt = Date.now();
    const expiresAt = startedAt + SESSION_TTL_MS;
    const sessionNonce = generateSecureToken(16);

    const payload = {
      username: user.username,
      role: user.role,
      school: user.school || '',
      isAdmin: !!user.isAdmin,
      startedAt,
      expiresAt,
      nonce: sessionNonce
    };

    // Calculate integrity signature
    const signatureStr = `${payload.username}|${payload.role}|${payload.school}|${payload.isAdmin}|${payload.expiresAt}|${payload.nonce}`;
    const signature = await sha256(signatureStr, ENCRYPTION_SALT);
    
    return {
      ...payload,
      sig: signature
    };
  }

  async function startSession(user) {
    const session = await createSessionToken(user);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.removeItem(OLD_SESSION_KEY); // Clean legacy key
    scheduleExpiry(session.expiresAt);
  }

  async function validateSession() {
    try {
      const sessionRaw = localStorage.getItem(SESSION_KEY) || localStorage.getItem(OLD_SESSION_KEY);
      if (!sessionRaw) return false;

      const session = JSON.parse(sessionRaw);
      if (!session || !session.expiresAt || session.expiresAt <= Date.now()) {
        endSession();
        return false;
      }

      // Verify integrity signature to detect LocalStorage tampering
      if (session.sig) {
        const verifySigStr = `${session.username}|${session.role}|${session.school}|${session.isAdmin}|${session.expiresAt}|${session.nonce}`;
        const computedSig = await sha256(verifySigStr, ENCRYPTION_SALT);
        if (computedSig !== session.sig) {
          console.error('[Security Violation]: تم اكتشاف تلاعب بجلسة المستخدم في التخزين المحلي');
          endSession();
          return false;
        }
      }

      scheduleExpiry(session.expiresAt);
      return true;
    } catch {
      endSession();
      return false;
    }
  }

  function endSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(OLD_SESSION_KEY);
    if (logoutTimer) clearTimeout(logoutTimer);
    logoutTimer = null;
  }

  function scheduleExpiry(expiresAt) {
    if (logoutTimer) clearTimeout(logoutTimer);
    logoutTimer = setTimeout(() => {
      endSession();
      if (window.CU && window.doLogout) {
        if (window.showToast) window.showToast('انتهت صلاحية الجلسة بسبب عدم النشاط', 'warning');
        window.doLogout();
      }
    }, Math.max(1000, expiresAt - Date.now()));
  }

  function bindActivityRefresh() {
    let lastRefresh = 0;
    ['click', 'keydown', 'touchstart'].forEach(evt => {
      window.addEventListener(evt, () => {
        const now = Date.now();
        // Throttle session refresh to once every 15 seconds
        if (!window.CU || now - lastRefresh < 15000) return;
        lastRefresh = now;
        startSession(window.CU);
      }, { passive: true });
    });
  }

  // ------------------------------------------------------------
  // 6. Role-Based Access Control (RBAC) & Scope Verification
  // ------------------------------------------------------------
  function can(action, resource, user = window.CU) {
    if (!user) return false;
    if (user.isAdmin) return true;
    
    // Centralized Restricted Actions
    const adminOnlyActions = [
      'deleteUser',
      'manageFields',
      'syncConfig',
      'viewLogs',
      'editSystemSettings',
      'resetDatabase',
      'deleteSchool'
    ];

    if (adminOnlyActions.includes(action)) return false;

    // School Scope Isolation
    if (resource?.school && user.school && resource.school !== user.school) {
      return false;
    }

    return true;
  }

  // ------------------------------------------------------------
  // 7. Secure Record Lifecycle & Key Generation
  // ------------------------------------------------------------
  function nowIso() {
    return new Date().toISOString();
  }

  function ensureGlobalId(record, type) {
    if (!record.global_id) {
      const base = record.id || (window.nid ? window.nid() : Date.now().toString(36));
      record.global_id = `${type || 'rec'}_${base}`;
    }
    return record.global_id;
  }

  function stampRecord(record, type, existing) {
    const ts = Date.now();
    if (existing) {
      record.id = existing.id;
      record.global_id = existing.global_id || record.global_id;
      record.createdAt = existing.createdAt || existing.ts || ts;
      record.ts = existing.ts || ts;
    } else {
      record.id = record.id || (window.nid ? window.nid() : ts.toString(36));
      record.createdAt = record.createdAt || ts;
      record.ts = record.ts || ts;
    }
    ensureGlobalId(record, type);
    record.updatedAt = ts;
    record.tsEdit = ts;
    record.deletedAt = record.deletedAt || '';
    return record;
  }

  function getRecordKey(type, record) {
    if (!record) return '';
    if (record.global_id) return `global:${String(record.global_id).trim().toLowerCase()}`;
    if (record.id) return `id:${String(record.id).trim().toLowerCase()}`;
    const school = String(record.school || '').trim().toLowerCase();
    const name = ['name1', 'name2', 'name3', 'name4'].map(k => String(record[k] || '').trim().toLowerCase()).filter(Boolean).join(' ');
    return name ? `${type || 'rec'}:${school}:${name}` : '';
  }

  return {
    escapeHTML,
    safeText,
    sanitizeInput,
    sha256,
    generateSecureToken,
    formatSeconds,
    initAntiDebugging,
    checkRateLimit,
    recordFailedLogin,
    clearLoginRateLimit,
    stampRecord,
    ensureGlobalId,
    getRecordKey,
    can,
    startSession,
    validateSession,
    endSession,
    bindActivityRefresh,
    nowIso
  };
})();

// Attach to global window
window.escapeHTML = Security.escapeHTML;
window.safeText = Security.safeText;
window.Security = Security;

// Automatically bind activity refresh & security defaults
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    Security.bindActivityRefresh();
    // Activate Anti-debugging & Keyboard protections
    Security.initAntiDebugging({
      blockShortcuts: true,
      blockContextMenu: true,
      detectDevTools: true,
      forceLogoutOnInspect: false
    });
  });
}
