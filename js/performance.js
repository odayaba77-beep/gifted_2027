// ============================================================
// PerformanceManager — تحسينات الأداء والبحث
// المراحل السادسة والسابعة: الأداء وتحسين الذاكرة
// ============================================================

const PerformanceManager = (() => {
  'use strict';

  // ============================================================
  // Search Optimizer — بحث محسَّن بـ Debounce للـ 5000+ سجل
  // ============================================================

  const _searchTimers = {};
  const _searchCache = new Map();
  const DEBOUNCE_MS = 200;
  const CACHE_TTL = 5000;

  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // بحث محسَّن مع فهرسة
  function buildSearchIndex(records) {
    return records.map(r => ({
      _idx: [r.name1, r.name2, r.name3, r.name4, r.school, r.nid, r.phone, r.parentPhone, r.studentPhone, r.email, r.academicYear, r.stage, r.talent, r.subject]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
      _record: r
    }));
  }

  function searchIndex(index, query) {
    if (!query) return index.map(i => i._record);
    const q = query.toLowerCase().trim();
    if (!q) return index.map(i => i._record);
    return index.filter(i => i._idx.includes(q)).map(i => i._record);
  }

  // ============================================================
  // Event Listener Manager — منع تكرار المستمعات
  // ============================================================

  const _registeredListeners = new WeakMap();

  function safeAddListener(element, event, handler, options) {
    if (!element) return;
    const key = `${event}`;
    const map = _registeredListeners.get(element) || {};
    if (map[key]) {
      element.removeEventListener(event, map[key]);
    }
    map[key] = handler;
    _registeredListeners.set(element, map);
    element.addEventListener(event, handler, options || { passive: true });
  }

  // ============================================================
  // Virtual Table — رسم جزئي للجداول الكبيرة (+1000 سجل)
  // ============================================================

  const VIRTUAL_THRESHOLD = 1000;
  const VIRTUAL_PAGE_SIZE = 50;

  function shouldUseVirtual(recordCount) {
    return recordCount >= VIRTUAL_THRESHOLD;
  }

  // تهيئة البحث بـ Debounce على حقول البحث
  function initDebouncedSearch() {
    const searchInputIds = ['ft-q', 'fs-q'];
    searchInputIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const debouncedRender = debounce(() => {
        const type = id === 'ft-q' ? 'teach' : 'stud';
        if (window.renderTbl) window.renderTbl(type);
      }, DEBOUNCE_MS);
      safeAddListener(el, 'input', debouncedRender);
    });

    // تطبيق Debounce على الفلاتر أيضاً
    const filterIds = ['ft-sc', 'ft-role', 'ft-subj', 'ft-dg', 'ft-att', 'fs-year', 'fs-sc', 'fs-st', 'fs-tl', 'fs-dg', 'fs-att'];
    filterIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const type = id.startsWith('ft-') ? 'teach' : 'stud';
      safeAddListener(el, 'change', () => { if (window.renderTbl) window.renderTbl(type); });
    });
  }

  // ============================================================
  // Memory Leak Prevention — منع تسرب الذاكرة
  // ============================================================

  const _domCleanupTasks = [];

  function registerCleanup(fn) {
    _domCleanupTasks.push(fn);
  }

  function cleanup() {
    _domCleanupTasks.forEach(fn => { try { fn(); } catch { } });
    _domCleanupTasks.length = 0;
    _searchCache.clear();
  }

  // ============================================================
  // بيانات اختبار للـ QA (5000 طالب، 1000 كادر)
  // ============================================================

  const _firstNames = ['محمد', 'أحمد', 'علي', 'حسين', 'عمر', 'يوسف', 'إبراهيم', 'مصطفى', 'عبدالله', 'كريم', 'فاطمة', 'زينب', 'مريم', 'سارة', 'نور', 'لمياء', 'رنا', 'هديل', 'هناء', 'بتول', 'دينا', 'ليلى'];
  const _secondNames = ['عبدالله', 'محمد', 'حسن', 'حسين', 'جاسم', 'صالح', 'كريم', 'علي', 'أحمد', 'خالد', 'سالم', 'طارق', 'ياسر', 'وليد', 'سعد', 'ناصر', 'رائد', 'زياد'];
  const _lastNames = ['الجبوري', 'العبيدي', 'الهاشمي', 'الحسيني', 'الكريمي', 'المالكي', 'الشمري', 'الربيعي', 'الدليمي', 'النجار', 'السامرائي', 'التكريتي', 'الموصلي', 'البصري', 'الكرخي', 'العلوي', 'السعدي'];
  const _schools = ['بغداد', 'النجف', 'البصرة', 'نينوى', 'الأنبار', 'ميسان', 'ذي قار', 'بابل', 'ديالى', 'كركوك', 'صلاح الدين', 'المثنى', 'القادسية', 'واسط', 'الكوت', 'عمارة', 'السليمانية', 'أربيل', 'دهوك', 'حلبجة'];
  const _talents = ['رياضيات', 'علوم طبيعية', 'فيزياء', 'كيمياء', 'أحياء', 'أدب عربي', 'لغة إنجليزية', 'حاسوب وتقنية', 'رياضة', 'فنون بصرية'];
  const _stages = ['الأول ابتدائي', 'الثاني ابتدائي', 'الثالث ابتدائي', 'الرابع ابتدائي', 'الخامس ابتدائي', 'السادس ابتدائي', 'الأول متوسط', 'الثاني متوسط', 'الثالث متوسط', 'الرابع إعدادي', 'الخامس الإعدادي', 'السادس الإعدادي'];
  const _degrees = ['بكالوريوس', 'ماجستير', 'دكتوراه', 'دبلوم عالٍ', 'دبلوم'];
  const _jobRoles = ['تدريسي', 'إداري'];
  const _subjects = ['رياضيات', 'فيزياء', 'كيمياء', 'أحياء', 'عربي', 'إنجليزي', 'تاريخ', 'جغرافية', 'تربية إسلامية', 'حاسوب', 'رياضة', 'رسم'];
  const _grades = ['مدرس', 'مدرس أول', 'مدرس ممتاز', 'مدير', 'معاون مدير', 'مشرف تربوي'];

  function _rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function _nid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function _rGPA() { return (90 + Math.random() * 9.9).toFixed(1); }
  function _rDate(start, end) {
    const d = new Date(start + Math.random() * (end - start));
    return d.toISOString().slice(0, 10);
  }

  function generateStudents(count = 5000) {
    const results = [];
    const schoolPool = window.getSchoolsList ? window.getSchoolsList() : _schools.slice(0, 7);
    const years = ['2022-2023', '2023-2024', '2024-2025'];
    const genders = ['ذكر', 'أنثى'];
    for (let i = 0; i < count; i++) {
      const gender = _rand(genders);
      const femaleFirst = ['فاطمة', 'زينب', 'مريم', 'سارة', 'نور', 'لمياء', 'رنا', 'هديل', 'هناء', 'بتول', 'دينا', 'ليلى'];
      const maleFirst = ['محمد', 'أحمد', 'علي', 'حسين', 'عمر', 'يوسف', 'إبراهيم', 'مصطفى', 'عبدالله', 'كريم'];
      const fn = gender === 'أنثى' ? _rand(femaleFirst) : _rand(maleFirst);
      const ts = Date.now() - Math.floor(Math.random() * 2 * 365 * 86400000);
      const rec = {
        id: _nid(),
        global_id: 'stud_' + _nid(),
        name1: fn,
        name2: _rand(_secondNames),
        name3: _rand(_secondNames),
        name4: _rand(_lastNames),
        dob: _rDate(new Date('2005-01-01').getTime(), new Date('2012-12-31').getTime()),
        gender,
        school: _rand(schoolPool),
        academicYear: _rand(years),
        stage: _rand(_stages),
        talent: _rand(_talents),
        gpa: _rGPA(),
        parentPhone: '07' + Math.floor(700000000 + Math.random() * 200000000),
        attendance: Math.random() > 0.15 ? 'مستمر' : 'غير مستمر',
        achievements: Math.random() > 0.7 ? 'مشاركة في الأولمبياد الوطني' : '',
        createdAt: ts,
        updatedAt: ts,
        tsEdit: ts,
        ts
      };
      results.push(rec);
    }
    return results;
  }

  function generateStaff(count = 1000) {
    const results = [];
    const schoolPool = window.getSchoolsList ? window.getSchoolsList() : _schools.slice(0, 7);
    for (let i = 0; i < count; i++) {
      const role = _rand(_jobRoles);
      const ts = Date.now() - Math.floor(Math.random() * 5 * 365 * 86400000);
      const rec = {
        id: _nid(),
        global_id: 'teach_' + _nid(),
        name1: _rand(['محمد', 'أحمد', 'علي', 'حسين', 'فاطمة', 'زينب', 'مريم', 'سارة', 'نور']),
        name2: _rand(_secondNames),
        name3: _rand(_secondNames),
        name4: _rand(_lastNames),
        nid: String(197 + Math.floor(Math.random() * 30)) + String(Math.floor(1000000000 + Math.random() * 9000000000)).slice(0, 10),
        dob: _rDate(new Date('1970-01-01').getTime(), new Date('1995-12-31').getTime()),
        gender: Math.random() > 0.5 ? 'ذكر' : 'أنثى',
        school: _rand(schoolPool),
        jobRole: role,
        subject: role === 'تدريسي' ? _rand(_subjects) : '',
        spec: _rand(['تربية وعلم نفس', 'علوم', 'رياضيات', 'لغة عربية', 'لغة إنجليزية', 'تاريخ', 'جغرافية', 'فيزياء', 'كيمياء', 'إدارة تربوية']),
        degree: _rand(_degrees),
        grade: _rand(_grades),
        hire: _rDate(new Date('2000-01-01').getTime(), new Date('2022-12-31').getTime()),
        phone: '07' + Math.floor(700000000 + Math.random() * 200000000),
        attendance: Math.random() > 0.1 ? 'مستمر' : 'غير مستمر',
        createdAt: ts,
        updatedAt: ts,
        tsEdit: ts,
        ts
      };
      results.push(rec);
    }
    return results;
  }

  function loadQAData(studCount = 5000, staffCount = 1000) {
    if (!window.sdb) { alert('النظام غير مهيأ بعد'); return; }
    const confirmed = confirm(
      `⚠️ سيتم تحميل بيانات اختبار:\n` +
      `• ${studCount} طالب\n` +
      `• ${staffCount} كادر\n\n` +
      `هذا سيحذف البيانات الحالية. هل تريد المتابعة؟`
    );
    if (!confirmed) return;

    const stud = generateStudents(studCount);
    const teach = generateStaff(staffCount);
    window.sdb('stud', stud);
    window.sdb('teach', teach);

    if (window.refreshAll) window.refreshAll();
    if (window.addSyncLog) window.addSyncLog(`✅ تم تحميل ${studCount} طالب و${staffCount} كادر بنجاح`, 'success');
    alert(`✅ تم تحميل بيانات QA:\n• ${stud.length} طالب\n• ${teach.length} كادر`);
  }

  return {
    debounce,
    buildSearchIndex,
    searchIndex,
    safeAddListener,
    shouldUseVirtual,
    initDebouncedSearch,
    generateStudents,
    generateStaff,
    loadQAData,
    cleanup,
    VIRTUAL_THRESHOLD,
    DEBOUNCE_MS
  };
})();

window.PerformanceManager = PerformanceManager;

// تصدير دوال الاختبار مباشرة
window.loadQAData = PerformanceManager.loadQAData;
window.generateTestData = PerformanceManager.loadQAData;
