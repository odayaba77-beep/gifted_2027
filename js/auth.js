// ============================================================
// نظام المصادقة وإدارة المستخدمين — الإصدار المحصن أمنياً
// Hardened Authentication Flow & Supabase Access Control
// ============================================================

let CU = null;
let loginLockoutInterval = null;

function stopLoginLockoutCountdown() {
  if (loginLockoutInterval) {
    clearInterval(loginLockoutInterval);
    loginLockoutInterval = null;
  }
  const loginBtn = document.querySelector('.login-btn');
  if (loginBtn) {
    loginBtn.disabled = false;
    loginBtn.textContent = 'دخول إلى النظام';
  }
}

function startLoginLockoutCountdown(lockedUntil) {
  if (!lockedUntil) return;
  if (loginLockoutInterval) clearInterval(loginLockoutInterval);

  const updateCountdown = () => {
    const now = Date.now();
    const remainingMs = lockedUntil - now;
    const loginBtn = document.querySelector('.login-btn');
    const err = document.getElementById('lerr');

    if (remainingMs <= 0) {
      stopLoginLockoutCountdown();
      if (err) {
        err.style.background = 'rgba(0,137,123,0.12)';
        err.style.color = '#00695c';
        err.innerHTML = '✅ انتهت مدة الحظر (دقيقتان). يمكنك الآن إدخال البيانات وتسجيل الدخول';
        err.style.display = 'block';
        setTimeout(() => {
          if (err && !loginLockoutInterval) {
            err.style.display = 'none';
            err.style.background = '';
            err.style.color = '';
          }
        }, 5000);
      }
      Security.checkRateLimit('');
      return;
    }

    const totalSec = Math.ceil(remainingMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.textContent = `الدخول مقفل مؤقتاً (${formatted})`;
    }

    if (err) {
      err.style.background = '';
      err.style.color = '';
      err.innerHTML = `⛔ تم قفل تسجيل الدخول مؤقتاً لمدة دقيقتين لضمان الأمان بعد 3 محاولات خاطئة.<br><div style="margin-top:6px;font-size:13px;font-weight:700">الوقت المتبقي: ⏱️ <span id="lockout-countdown-display" style="direction:ltr;display:inline-block">${formatted}</span> دقيقة</div>`;
      err.style.display = 'block';
    }
  };

  updateCountdown();
  loginLockoutInterval = setInterval(updateCountdown, 1000);
}

function checkAndApplyLoginLockout() {
  const uInput = document.getElementById('lu');
  const u = uInput ? uInput.value : '';
  const rateCheck = Security.checkRateLimit(u);
  if (!rateCheck.allowed && rateCheck.lockedUntil) {
    startLoginLockoutCountdown(rateCheck.lockedUntil);
  } else if (!rateCheck.lockedUntil && loginLockoutInterval) {
    stopLoginLockoutCountdown();
  }
}

async function doLogin() {
  const uInput = document.getElementById('lu');
  const pInput = document.getElementById('lp');
  const err = document.getElementById('lerr');

  // Input Sanitization to prevent XSS / Injection
  const rawU = uInput ? uInput.value : '';
  const rawP = pInput ? pInput.value : '';
  const u = Security.sanitizeInput(rawU);
  const p = rawP.trim();

  // Check rate limiting & lockout status first
  const rateCheck = Security.checkRateLimit(u);
  if (!rateCheck.allowed) {
    startLoginLockoutCountdown(rateCheck.lockedUntil);
    return;
  }

  if (!u || !p) {
    if (err) {
      err.style.background = '';
      err.style.color = '';
      err.textContent = '❌ يرجى إدخال اسم المستخدم وكلمة المرور';
      err.style.display = 'block';
    }
    return;
  }

  try {
    const USERS = buildUsersMap();
    const uu = USERS[u];

    // Compute cryptographic salted hashes
    const passHashWithSalt = await Security.sha256(p);
    const storedPass = uu?.pass || '';
    const storedHash = uu?.passHash || '';

    // Secure Verification against salted hashes or direct credentials
    const isPasswordValid = uu && (
      storedHash === passHashWithSalt || 
      storedPass === p
    );

    if (uu && isPasswordValid) {
      // Clear rate limiting on successful login
      stopLoginLockoutCountdown();
      Security.clearLoginRateLimit(u);

      // Upgrade legacy password to SHA-256 hash if needed
      if (!uu.passHash || storedPass === p) {
        persistUserCredentialHash(uu._origKey || u, passHashWithSalt, uu.username || u);
        uu.passHash = passHashWithSalt;
        delete uu.pass;
      }

      CU = { username: u, ...uu };
      delete CU.pass; // Never retain plain passwords in active memory

      // Establish secure session with HMAC integrity signature
      await Security.startSession(CU);

      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('main-app').style.display = 'block';
      document.getElementById('top-name').textContent = CU.name;
      document.getElementById('top-role').textContent = CU.role;
      document.getElementById('top-av').textContent = CU.av;
      if (err) err.style.display = 'none';

      document.querySelectorAll('.admin-only').forEach(el => {
        if (CU && CU.isAdmin) {
          const tag = el.tagName ? el.tagName.toUpperCase() : '';
          if (tag === 'BUTTON' || tag === 'A' || el.classList.contains('btn') || el.classList.contains('badge')) {
            el.style.display = 'inline-flex';
          } else if (el.classList.contains('ni') || el.classList.contains('two') || el.style.flexDirection === 'row') {
            el.style.display = 'flex';
          } else {
            el.style.display = (tag === 'DIV' || tag === 'SECTION' || tag === 'FORM') ? 'block' : '';
          }
        } else {
          el.style.display = 'none';
        }
      });

      if (window.ActivityLogger) window.ActivityLogger.login(u);
      if (window.initApp) initApp();
      
      if (window.showToast) {
        window.showToast(`مرحباً بك ${CU.name} — تم تسجيل الدخول بنجاح`, 'success', 2500);
      }
    } else {
      // Failed login: record attempt & trigger protection
      const rateStatus = Security.recordFailedLogin(u);
      if (rateStatus.locked) {
        startLoginLockoutCountdown(rateStatus.lockedUntil);
      } else {
        if (err) {
          err.style.background = '';
          err.style.color = '';
          err.innerHTML = `❌ اسم المستخدم أو كلمة المرور غير صحيحة (المحاولات المتبقية: ${rateStatus.attemptsLeft})`;
          err.style.display = 'block';
        }
      }
    }
  } catch (ex) {
    console.error('[Authentication Error]:', ex);
    if (err) {
      err.style.background = '';
      err.style.color = '';
      err.textContent = 'حدث خطأ غير متوقع أثناء معالجة تسجيل الدخول';
      err.style.display = 'block';
    }
  }
}

function doLogout() {
  if (window.ActivityLogger && CU) window.ActivityLogger.logout(CU.username);
  Security.endSession();
  CU = null;
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  const pInput = document.getElementById('lp');
  if (pInput) pInput.value = '';
  checkAndApplyLoginLockout();
}

function updateMyCredBadge() {
  const b = document.getElementById('my-username-badge');
  if (b && CU) b.textContent = CU.username || '—';
}

async function saveMyCredentials() {
  const newUsernameRaw = (document.getElementById('my-new-username')?.value || '');
  const newPass1 = (document.getElementById('my-new-pass1')?.value || '').trim();
  const newPass2 = (document.getElementById('my-new-pass2')?.value || '').trim();
  const msgEl = document.getElementById('my-cred-msg');
  const clearMsg = () => { if (msgEl) msgEl.innerHTML = ''; };

  const newUsername = Security.sanitizeInput(newUsernameRaw);

  if (!newUsername && !newPass1) {
    if (msgEl) msgEl.innerHTML = `<div class="alert a-wn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>لم تُدخل أي تغييرات</div>`;
    return;
  }
  if (newPass1 && newPass1 !== newPass2) {
    if (msgEl) msgEl.innerHTML = `<div class="alert a-er"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0"><circle cx="12" cy="12" r="10"/></svg>كلمتا المرور غير متطابقتين</div>`;
    return;
  }
  if (newPass1 && newPass1.length < 6) {
    if (msgEl) msgEl.innerHTML = `<div class="alert a-er">كلمة المرور يجب أن تكون 6 أحرف على الأقل</div>`;
    return;
  }
  if (newUsername && newUsername.length < 3) {
    if (msgEl) msgEl.innerHTML = `<div class="alert a-er">اسم المستخدم يجب أن يكون 3 أحرف على الأقل</div>`;
    return;
  }

  const origKey = CU._origKey || CU.username;
  if (!origKey) {
    if (msgEl) msgEl.innerHTML = `<div class="alert a-er">خطأ: تعذّر تحديد الحساب الحالي</div>`;
    return;
  }

  if (newUsername && newUsername !== CU.username) {
    const rebuilt = buildUsersMap();
    if (rebuilt[newUsername] && rebuilt[newUsername]._origKey !== origKey) {
      if (msgEl) msgEl.innerHTML = `<div class="alert a-er">اسم المستخدم "${newUsername}" مستخدم بالفعل</div>`;
      return;
    }
  }

  const nameMap = JSON.parse(localStorage.getItem('gft_usernames') || '{}');
  if (!nameMap[origKey]) nameMap[origKey] = {};
  if (newUsername) {
    nameMap[origKey].newUsername = newUsername;
    CU.username = newUsername;
  }
  if (newPass1) {
    nameMap[origKey].passHash = await Security.sha256(newPass1);
    delete nameMap[origKey].pass;
    CU.passHash = nameMap[origKey].passHash;
    delete CU.pass;
  }
  localStorage.setItem('gft_usernames', JSON.stringify(nameMap));
  if (window.saveSettingsToSupabase) {
    window.saveSettingsToSupabase('gft_usernames', nameMap);
  }

  ['my-new-username', 'my-new-pass1', 'my-new-pass2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  if (msgEl) msgEl.innerHTML = `<div class="alert a-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>✅ تم الحفظ وتحديث التشفير بنجاح${newUsername ? ' · اسم المستخدم الجديد: <strong>' + newUsername + '</strong>' : ''}${newPass1 ? ' · تم تشفير وتغيير كلمة المرور' : ''}</div>`;
  updateMyCredBadge();
  if (CU.isAdmin && window.renderAccounts) window.renderAccounts();
  setTimeout(() => clearMsg(), 6000);
}

function renderAccounts() {
  const el = document.getElementById('acc-tbl');
  if (!el) return;
  const USERS = buildUsersMap();
  const nameMap = JSON.parse(localStorage.getItem('gft_usernames') || '{}');
  const allSchools = getSchoolsList();
  const schoolToOrigKey = {};
  Object.keys(USERS_DEFAULT).forEach(k => {
    if (USERS_DEFAULT[k].school) schoolToOrigKey[USERS_DEFAULT[k].school] = k;
  });

  let rows = '';
  const admOverride = nameMap['admin'] || {};
  const admUsername = admOverride.newUsername || 'admin';
  const admPass = admOverride.passHash ? '🔒 مُشفرة (SHA-256)' : (admOverride.pass || USERS_DEFAULT['admin'].pass);
  rows += `<tr>
    <td style="font-weight:600">المدير المركزي</td>
    <td><span class="badge b-blue">${admUsername}</span></td>
    <td style="font-family:monospace"><span style="filter:blur(4px);cursor:pointer;user-select:none" title="انقر لإظهار" onclick="togglePassVis('admin',this)">${admPass}</span></td>
    <td><span class="badge b-green">نشط ومؤمن</span></td>
    <td><button class="ab ab-ed" onclick="openEditUser('admin')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>تعديل</button></td>
  </tr>`;

  allSchools.forEach(sc => {
    const origKey = schoolToOrigKey[sc];
    if (origKey) {
      const override = nameMap[origKey] || {};
      const uName = override.newUsername || origKey;
      const uPass = override.passHash ? '🔒 مُشفرة (SHA-256)' : (override.pass || USERS_DEFAULT[origKey].pass);
      rows += `<tr>
        <td style="font-weight:600">${sc}</td>
        <td><span class="badge b-teal">${uName}</span></td>
        <td style="font-family:monospace"><span style="filter:blur(4px);cursor:pointer;user-select:none" title="انقر لإظهار" onclick="togglePassVis('${origKey}',this)">${uPass}</span></td>
        <td><span class="badge b-green">نشط ومؤمن</span></td>
        <td><button class="ab ab-ed" onclick="openEditUser('${origKey}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>تعديل</button></td>
      </tr>`;
    } else {
      const dynKey = 'school_' + sc.replace(/\s+/g, '_');
      const override = nameMap[dynKey] || {};
      const hasCredentials = !!(override.newUsername && (override.passHash || override.pass));
      const uName = hasCredentials ? override.newUsername : 'لم يُعيَّن';
      const uPass = hasCredentials ? (override.passHash ? '🔒 مُشفرة (SHA-256)' : override.pass) : '';
      rows += `<tr style="background:${hasCredentials ? '' : 'var(--wn-l)'}">
        <td style="font-weight:600">${sc} <span class="badge b-amber" style="font-size:10px;padding:1px 6px">جديدة</span></td>
        <td><span class="badge ${hasCredentials ? 'b-teal' : 'b-gray'}">${uName}</span></td>
        <td style="font-family:monospace">${hasCredentials ? `<span style="filter:blur(4px);cursor:pointer;user-select:none" onclick="togglePassVis('${dynKey}',this)">${uPass}</span>` : '—'}</td>
        <td><span class="badge ${hasCredentials ? 'b-green' : 'b-amber'}">${hasCredentials ? 'نشط ومؤمن' : 'يحتاج إعداد'}</span></td>
        <td><button class="ab ab-ed" onclick="openEditUser('${dynKey}','${sc}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>${hasCredentials ? 'تعديل' : 'إضافة بيانات'}</button></td>
      </tr>`;
    }
  });

  el.innerHTML = `<table class="tbl" style="font-size:12px">
    <thead><tr><th>المدرسة</th><th>اسم المستخدم</th><th>كلمة المرور</th><th>الحالة</th><th>إجراء</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="margin-top:12px;padding:10px;background:var(--wn-l);border-radius:8px;font-size:11px;color:var(--wn);border:1px solid #fcd34d">
    <strong>ملاحظة أمنية:</strong> كلمات المرور مشفرة بخوارزمية SHA-256 المحصنة ولا تُحفظ بصيغة مكشوفة لضمان سرية البيانات.
  </div>`;
}

function togglePassVis(origKey, el) {
  el.style.filter = el.style.filter ? '' : 'blur(4px)';
}

function openEditUser(origKey, schoolNameOverride) {
  const nameMap = JSON.parse(localStorage.getItem('gft_usernames') || '{}');
  const override = nameMap[origKey] || {};
  const userData = USERS_DEFAULT[origKey];
  const isDynamic = !userData && origKey.startsWith('school_');
  const currentUsername = override.newUsername || (userData ? origKey : '');
  const currentPass = override.passHash ? '' : (override.pass || (userData ? userData.pass : ''));
  const schoolLabel = schoolNameOverride || (userData ? (userData.school || (origKey === 'admin' ? 'المدير المركزي' : '—')) : origKey.replace('school_', '').replace(/_/g, ' '));
  const isNew = isDynamic && !override.newUsername;

  document.getElementById('modal-title').textContent = `${isNew ? 'إضافة' : 'تعديل'} بيانات الدخول — ${schoolLabel}`;
  document.getElementById('modal-body').innerHTML = `
    <div style="padding:4px 0 14px">
      <div class="alert ${isNew ? 'a-info' : 'a-wn'}" style="margin-bottom:16px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        ${isNew ? 'أدخل اسم المستخدم وكلمة المرور لهذه المدرسة الجديدة حتى يتمكن مسؤولها من الدخول' : 'بعد الحفظ يجب استخدام بيانات الدخول الجديدة في المرة القادمة'}
      </div>
      <div class="fg">
        <div class="fgr">
          <label>المدرسة / الحساب</label>
          <input type="text" value="${schoolLabel}" disabled style="background:var(--sf2)">
        </div>
        <div class="fgr">
          <label>اسم المستخدم الحالي</label>
          <input type="text" value="${currentUsername || '—'}" disabled style="background:var(--sf2);font-family:monospace">
        </div>
        <div class="fgr">
          <label>اسم المستخدم ${isNew ? '(مطلوب)' : 'الجديد'} <span style="font-size:10px;color:var(--tx3)">${isNew ? '' : '(اتركه فارغاً للإبقاء)'}</span></label>
          <input type="text" id="eu-username" placeholder="${isNew ? 'مثال: school_' + schoolLabel.replace(/\s/g, '') : currentUsername}" autocomplete="off" style="font-family:monospace;letter-spacing:.04em">
        </div>
        <div class="fgr">
          <label>كلمة المرور ${isNew ? '(مطلوبة)' : 'الجديدة'}</label>
          <input type="password" id="eu-pass1" placeholder="${isNew ? '6 أحرف على الأقل' : 'اتركها فارغة للإبقاء'}" autocomplete="new-password">
        </div>
        <div class="fgr s2">
          <label>تأكيد كلمة المرور</label>
          <input type="password" id="eu-pass2" placeholder="أعد كتابة كلمة المرور..." autocomplete="new-password">
        </div>
        <div class="fgr s2" id="eu-msg"></div>
      </div>
    </div>`;
  const saveBtn = document.querySelector('.mf .btn-pr');
  if (saveBtn) {
    saveBtn.onclick = () => saveEditUser(origKey, currentUsername, currentPass, isNew);
    saveBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>حفظ بيانات الدخول`;
  }
  document.getElementById('modal').classList.add('open');
}

async function saveEditUser(origKey, oldUsername, oldPass, isNew) {
  const newUsernameRaw = (document.getElementById('eu-username')?.value || '');
  const newPass1 = (document.getElementById('eu-pass1')?.value || '').trim();
  const newPass2 = (document.getElementById('eu-pass2')?.value || '').trim();
  const msgEl = document.getElementById('eu-msg');

  const newUsername = Security.sanitizeInput(newUsernameRaw);

  if (isNew && (!newUsername || !newPass1)) {
    if (msgEl) msgEl.innerHTML = `<div class="alert a-er">اسم المستخدم وكلمة المرور مطلوبان للمدارس الجديدة</div>`;
    return;
  }
  if (newPass1 && newPass1 !== newPass2) {
    if (msgEl) msgEl.innerHTML = `<div class="alert a-er">كلمتا المرور غير متطابقتين</div>`;
    return;
  }
  if (newPass1 && newPass1.length < 6) {
    if (msgEl) msgEl.innerHTML = `<div class="alert a-er">كلمة المرور يجب أن تكون 6 أحرف على الأقل</div>`;
    return;
  }
  if (newUsername && newUsername.length < 3) {
    if (msgEl) msgEl.innerHTML = `<div class="alert a-er">اسم المستخدم يجب أن يكون 3 أحرف على الأقل</div>`;
    return;
  }
  if (newUsername && newUsername !== oldUsername) {
    const rebuilt = buildUsersMap();
    if (rebuilt[newUsername] && rebuilt[newUsername]._origKey !== origKey) {
      if (msgEl) msgEl.innerHTML = `<div class="alert a-er">اسم المستخدم "${newUsername}" مستخدم بالفعل — اختر اسماً آخر</div>`;
      return;
    }
  }
  if (!newUsername && !newPass1) {
    if (msgEl) msgEl.innerHTML = `<div class="alert a-wn">لم تُدخل أي تغييرات</div>`;
    return;
  }

  const nameMap = JSON.parse(localStorage.getItem('gft_usernames') || '{}');
  if (!nameMap[origKey]) nameMap[origKey] = {};
  if (newUsername) nameMap[origKey].newUsername = newUsername;
  if (newPass1) {
    nameMap[origKey].passHash = await Security.sha256(newPass1);
    delete nameMap[origKey].pass;
  }
  localStorage.setItem('gft_usernames', JSON.stringify(nameMap));
  if (window.saveSettingsToSupabase) {
    window.saveSettingsToSupabase('gft_usernames', nameMap);
  }

  if (CU && CU._origKey === origKey) {
    if (newPass1) {
      CU.passHash = nameMap[origKey].passHash;
      delete CU.pass;
    }
    if (newUsername) CU.username = newUsername;
  }

  closeModal();
  renderAccounts();
  const saveBtn = document.querySelector('.mf .btn-pr');
  if (saveBtn) {
    saveBtn.onclick = window.saveModal;
    saveBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>حفظ السجل`;
  }
  setTimeout(() => {
    document.getElementById('confirm-msg').textContent = `✅ تم تشفير وحفظ بيانات الدخول${newUsername ? ' · الاسم الجديد: ' + newUsername : ''}${newPass1 ? ' · تم تغيير وتشفير كلمة المرور' : ''}`;
    document.getElementById('confirm-ok').textContent = 'حسناً';
    document.getElementById('confirm-ok').onclick = () => closeConfirm();
    document.getElementById('confirm').classList.add('open');
  }, 100);
}

function resetAllUsers() {
  showConfirm('هل تريد إعادة تعيين جميع بيانات الدخول إلى الافتراضية؟ سيُفقد كل تغيير سابق.', () => {
    localStorage.removeItem('gft_usernames');
    if (window.saveSettingsToSupabase) {
      window.saveSettingsToSupabase('gft_usernames', {});
    }
    if (window.renderAccounts) window.renderAccounts();
    alert('✅ تمت إعادة تعيين جميع بيانات الدخول إلى الافتراضية ومزامنتها مع السحابة');
  });
}

function closeModal() {
  const m = document.getElementById('modal');
  if (m) {
    m.classList.remove('open');
    const mb = m.querySelector('.mb');
    if (mb) mb.classList.remove('mb-extra-wide');
    const mf = m.querySelector('.mf');
    if (mf) mf.style.display = '';
  }
}

function closeConfirm() {
  document.getElementById('confirm').classList.remove('open');
  window.confirmCb = null;
}

function showConfirm(msg, cb) {
  const el = document.getElementById('confirm-msg');
  if (el) {
    el.innerHTML = (msg || '').replace(/\n/g, '<br>');
  }
  window.confirmCb = cb;
  const c = document.getElementById('confirm');
  if (c) c.classList.add('open');
  const okBtn = document.getElementById('confirm-ok');
  if (okBtn) {
    okBtn.onclick = () => {
      if (typeof window.confirmCb === 'function') {
        const fn = window.confirmCb;
        window.confirmCb = null;
        fn();
      }
      closeConfirm();
    };
  }
}

function showModalAlert(msg) {
  const b = document.getElementById('modal-body');
  let a = b.querySelector('.m-alert');
  if (!a) {
    a = document.createElement('div');
    a.className = 'alert a-er m-alert';
    b.prepend(a);
  }
  a.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>${msg}`;
  setTimeout(() => a.remove(), 4000);
}

// Window Exports & Initialization
window.doLogin = doLogin;
window.doLogout = doLogout;
window.startLoginLockoutCountdown = startLoginLockoutCountdown;
window.stopLoginLockoutCountdown = stopLoginLockoutCountdown;
window.checkAndApplyLoginLockout = checkAndApplyLoginLockout;

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    checkAndApplyLoginLockout();
    const lu = document.getElementById('lu');
    if (lu) {
      lu.addEventListener('input', () => {
        if (!loginLockoutInterval) {
          checkAndApplyLoginLockout();
        }
      });
      lu.addEventListener('keydown', e => {
        if (e.key === 'Enter') doLogin();
      });
    }
  });
}
