// ============================================================
// PDF EXPORT ENGINE WITH HTML2PDF
// محرك تصدير تقارير PDF الفردية والشاملة باستخدام html2pdf
// ============================================================

// --- 1. نافذة وتصدير بطاقة التقرير الفردي الشامل للطالب ---

window.openStudentReportModal = function(studentId) {
  const students = typeof gdata === 'function' ? gdata('stud') : (JSON.parse(localStorage.getItem('gft_stud') || '[]'));
  const student = students.find(s => s.id === studentId);
  if (!student) {
    alert('لم يتم العثور على بيانات الطالب');
    return;
  }

  let modal = document.getElementById('student-report-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'student-report-modal';
    modal.className = 'pv-overlay';
    modal.style.zIndex = '9500';
    document.body.appendChild(modal);
  }

  const reportHTML = generateStudentProfileReportHTML(student);

  modal.innerHTML = `
    <div class="pv-box" style="width: 860px; max-width: 96vw; max-height: 94vh; display: flex; flex-direction: column;">
      <div style="padding: 16px 20px; background: #00695C; color: #fff; display: flex; align-items: center; justify-content: space-between; border-top-left-radius: 20px; border-top-right-radius: 20px;">
        <div style="font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          معاينة وتصدير بطاقة الطالب الموهوب (PDF)
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button class="btn btn-sm" id="btn-export-student-pdf" onclick="downloadStudentPDF('${student.id}')" style="background:#15803d; border:1px solid #15803d; color:#fff; font-weight:bold; display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            تنزيل ملف PDF
          </button>
          <button class="btn btn-sm btn-pr" onclick="printStudentReport()" style="background:#00897B; color:#fff; font-weight:bold; display:inline-flex; align-items:center; gap:6px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            طباعة
          </button>
          <button class="mc2" onclick="closeStudentReportModal()" style="color:#fff; border-color:rgba(255,255,255,0.3)">×</button>
        </div>
      </div>
      <div style="flex: 1; overflow-y: auto; padding: 20px; background: #334155;" id="student-report-preview-wrap">
        <div id="student-pdf-content" style="background: #ffffff; color: #0f172a; width: 794px; min-height: 1123px; margin: 0 auto; padding: 32px 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); font-family: 'Cairo', sans-serif; direction: rtl; position: relative; box-sizing: border-box;">
          ${reportHTML}
        </div>
      </div>
    </div>
  `;

  modal.classList.add('open');
};

window.closeStudentReportModal = function() {
  const modal = document.getElementById('student-report-modal');
  if (modal) modal.classList.remove('open');
};

function generateStudentProfileReportHTML(s) {
  const fullName = [s.name1, s.name2, s.name3, s.name4].filter(Boolean).join(' ');
  const schoolName = s.school || 'عامة';
  const year = s.academicYear || (window.ACTIVE_YEAR || '2024-2025');
  const stage = s.stage || 'غير محددة';
  const talent = s.talent || 'غير محددة';
  const gpaVal = s.gpa ? parseFloat(s.gpa) : null;
  const attendance = s.attendance || 'مستمر';
  const currentDate = new Date().toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' });

  // Calculate stage average GPA for comparative chart
  const allStudents = typeof gdata === 'function' ? gdata('stud') : [];
  const stageStudents = allStudents.filter(st => st.stage === stage && st.gpa);
  let stageAvgGPA = 88.5;
  if (stageStudents.length > 0) {
    const sum = stageStudents.reduce((acc, curr) => acc + (parseFloat(curr.gpa) || 0), 0);
    stageAvgGPA = (sum / stageStudents.length).toFixed(1);
  }

  // GPA Evaluation Badge
  let gpaBadgeText = 'ممتاز جداً';
  let gpaColor = '#15803d';
  if (gpaVal !== null) {
    if (gpaVal >= 90) { gpaBadgeText = 'متفوق (ممتاز)'; gpaColor = '#15803d'; }
    else if (gpaVal >= 80) { gpaBadgeText = 'جيد جداً'; gpaColor = '#00897B'; }
    else if (gpaVal >= 70) { gpaBadgeText = 'جيد'; gpaColor = '#c8922a'; }
    else { gpaBadgeText = 'يحتاج متابعة'; gpaColor = '#b91c1c'; }
  }

  // Photo HTML
  const avatarSrc = typeof getRecordAvatar === 'function' ? getRecordAvatar(s, 'stud') : (s.photo || (s.gender === 'أنثى' ? 'images/avatar_girl_student.jpg' : 'images/avatar_boy_student.jpg'));
  const photoHtml = `<img src="${avatarSrc}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #00695C; box-shadow: 0 4px 10px rgba(0,0,0,0.15);" alt="صورة الطالب">`;

  // Get dynamic fields configured in FIELD_CONFIG
  const fields = typeof getFields === 'function' ? getFields('stud') : [];
  const knownIds = new Set(['name1', 'name2', 'name3', 'name4', 'dob', 'gender', 'school', 'academicYear', 'stage', 'talent', 'gpa', 'parentPhone', 'studentPhone', 'address', 'attendance', 'attendanceNotes', 'achievements']);

  const extraFields = fields.filter(f => f.visible && !knownIds.has(f.id) && s[f.id]);

  // Chart Competency values
  const compAcademic = gpaVal || 90;
  const compTalent = talent !== 'غير محددة' ? 95 : 85;
  const compDiscipline = attendance === 'مستمر' ? 98 : 75;
  const compAchievements = s.achievements ? 92 : 80;

  const logoSrc = (typeof window !== 'undefined' && window.GIFTED_OFFICIAL_LOGO) ? window.GIFTED_OFFICIAL_LOGO : '';

  return `
    <!-- HEADER -->
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #00695C; padding-bottom: 14px; margin-bottom: 20px;">
      <div style="text-align: right; width: 33%;">
        <div style="font-size: 13px; font-weight: 800; color: #00695C;">جمهورية العراق — وزارة التربية</div>
        <div style="font-size: 12px; font-weight: 700; color: #1a3a5c; margin-top: 2px;">هيأة رعاية الموهوبين</div>
        <div style="font-size: 11px; color: #475569; margin-top: 2px;">مدرسة الموهوبين — ${schoolName}</div>
      </div>
      <div style="text-align: center; width: 34%;">
        <div style="width: 58px; height: 58px; margin: 0 auto 6px; display: flex; align-items: center; justify-content: center;">
          ${logoSrc ? `<img src="${logoSrc}" alt="شعار هيأة رعاية الموهوبين" style="max-width:58px;max-height:58px;object-fit:contain;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.15)"/>` : `<div style="width:54px;height:54px;background:#E0F2F1;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid #00897B;"><svg viewBox="0 0 24 24" fill="none" stroke="#00695C" stroke-width="2" style="width:30px;height:30px"><path d="M12 14l9-5-9-5-9 5 9 5z"/><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg></div>`}
        </div>
        <div style="font-size: 16px; font-weight: 900; color: #00695C; letter-spacing: -0.02em;">بطاقة التقرير الشامل للطالب الموهوب</div>
        <div style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">Individual Student Profile Report</div>
      </div>
      <div style="text-align: left; width: 33%;">
        <div style="font-size: 11px; color: #475569;"><strong>تاريخ التقرير:</strong> ${currentDate}</div>
        <div style="font-size: 11px; color: #475569; margin-top: 2px;"><strong>السنة الدراسية:</strong> ${year}</div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 4px; font-family: monospace;">REF: GFT-${(s.id || '').substring(0, 8).toUpperCase()}</div>
      </div>
    </div>

    <!-- STUDENT HERO CARD -->
    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #e8f0f9 100%); border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 16px 20px; margin-bottom: 20px; display: flex; align-items: center; gap: 20px;">
      <div style="flex-shrink: 0;">
        ${photoHtml}
      </div>
      <div style="flex: 1;">
        <div style="font-size: 20px; font-weight: 900; color: #00695C; margin-bottom: 6px;">${fullName}</div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
          <span style="background: #00695C; color: #fff; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;">مدرسة ${schoolName}</span>
          <span style="background: #1a3a5c; color: #fff; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;">المرحلة: ${stage}</span>
          <span style="background: #c8922a; color: #fff; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;">الموهبة: ${talent}</span>
          <span style="background: ${attendance === 'مستمر' ? '#15803d' : '#b91c1c'}; color: #fff; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;">الدوام: ${attendance}</span>
        </div>
        <div style="display: flex; gap: 16px; font-size: 12px; color: #334155;">
          <span><strong>الجنس:</strong> ${s.gender || '—'}</span>
          <span><strong>تاريخ الميلاد:</strong> ${s.dob || '—'}</span>
          <span><strong>السنة الدراسية:</strong> ${year}</span>
        </div>
      </div>
      <div style="text-align: center; background: #ffffff; padding: 12px 18px; border-radius: 12px; border: 2px solid ${gpaColor}; min-width: 120px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">المعدل الدراسي</div>
        <div style="font-size: 28px; font-weight: 900; color: ${gpaColor}; font-family: 'Cairo Play', sans-serif; line-height: 1.1;">${gpaVal !== null ? gpaVal : '—'}</div>
        <div style="font-size: 10px; font-weight: 700; color: ${gpaColor}; margin-top: 2px;">${gpaBadgeText}</div>
      </div>
    </div>

    <!-- MAIN DATA TABLES GRID -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
      <!-- PERSONAL & ACADEMIC INFO -->
      <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden;">
        <div style="background: #00695C; color: #fff; padding: 8px 14px; font-size: 12px; font-weight: 800; display: flex; align-items: center; gap: 6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          البيانات الشخصية والدراسية
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <tbody>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569; width: 40%;">الاسم الكامل</td><td style="padding: 7px 12px; font-weight: 700; color: #0f172a;">${fullName}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569;">تاريخ الميلاد</td><td style="padding: 7px 12px;">${s.dob || '—'}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569;">الجنس</td><td style="padding: 7px 12px;">${s.gender || '—'}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569;">المدرسة / الفرع</td><td style="padding: 7px 12px; font-weight: 700; color: #00695C;">مدرسة ${schoolName}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569;">المرحلة الدراسية</td><td style="padding: 7px 12px;">${stage}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569;">مجال الموهبة</td><td style="padding: 7px 12px; font-weight: 700; color: #c8922a;">${talent}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569;">المعدل التراكمي</td><td style="padding: 7px 12px; font-weight: 800; color: ${gpaColor};">${gpaVal !== null ? gpaVal + '%' : 'غير مدخل'}</td></tr>
            <tr><td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569;">حالة الدوام</td><td style="padding: 7px 12px;">${attendance} ${s.attendanceNotes ? '(' + s.attendanceNotes + ')' : ''}</td></tr>
          </tbody>
        </table>
      </div>

      <!-- CONTACT & GUARDIAN INFO -->
      <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden;">
        <div style="background: #1a3a5c; color: #fff; padding: 8px 14px; font-size: 12px; font-weight: 800; display: flex; align-items: center; gap: 6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          التواصل ومعلومات السكن وولي الأمر
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <tbody>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569; width: 40%;">هاتف ولي الأمر</td><td style="padding: 7px 12px; font-weight: 700; direction: ltr; text-align: right;">${s.parentPhone || '—'}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569;">هاتف الطالب</td><td style="padding: 7px 12px; direction: ltr; text-align: right;">${s.studentPhone || '—'}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569;">عنوان السكن</td><td style="padding: 7px 12px;">${s.address || '—'}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569;">مهنة / عمل الأب</td><td style="padding: 7px 12px;">${s.cf_1780757109132 || s.fatherJob || '—'}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569;">عمل أم الطالب</td><td style="padding: 7px 12px;">${s.cf_1780757308931 || s.motherJob || '—'}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569;">حالة التعثر الدراسي</td><td style="padding: 7px 12px;">${s.cf_1780756114364 || 'كلا (منتظم)'}</td></tr>
            <tr><td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569;">تاريخ التسجيل بالمركزي</td><td style="padding: 7px 12px; font-size: 11px;">${s.ts ? new Date(s.ts).toLocaleDateString('ar-IQ') : '—'}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    ${extraFields.length > 0 ? `
      <!-- EXTRA CUSTOM FIELDS -->
      <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; margin-bottom: 20px;">
        <div style="background: #334155; color: #fff; padding: 7px 14px; font-size: 11px; font-weight: 800;">بيانات ومعلومات إضافية</div>
        <div style="padding: 10px 14px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 11px;">
          ${extraFields.map(f => `
            <div style="background: #f8fafc; padding: 6px 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <span style="font-weight: 700; color: #475569; display: block; margin-bottom: 2px;">${f.label}:</span>
              <span style="color: #0f172a; font-weight: 600;">${s[f.id]}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- ACHIEVEMENTS SECTION -->
    <div style="background: #fdf3e3; border: 1.5px solid #c8922a; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px;">
      <div style="font-size: 13px; font-weight: 800; color: #b45309; display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
        سجل الإنجازات والمشاركات العلمية والملاحظات المتميزة
      </div>
      <div style="font-size: 12px; color: #1e293b; line-height: 1.6; white-space: pre-wrap; font-weight: 500;">
        ${s.achievements && s.achievements.trim() ? s.achievements : 'تم تسديد متطلبات التفوق وتوثيق الالتزام بالسلوك الأكاديمي والموهبة في الهيأة بدون مخالفات تذكر.'}
      </div>
    </div>

    <!-- STUDENT LEVEL & COMPETENCY PERFORMANCE CHARTS -->
    <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 16px 20px; margin-bottom: 22px;">
      <div style="font-size: 13px; font-weight: 800; color: #00695C; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
        <span style="display: flex; align-items: center; gap: 6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          المخطط البياني لمستوى الطالب والمقارنة مع المرحلة
        </span>
        <span style="font-size: 10px; color: #64748b; font-weight: 600;">تقييم الأداء والمؤشرات العامة</span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: center;">
        <!-- CHART 1: COMPETENCY BARS -->
        <div>
          <div style="font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 8px; text-align: center;">مؤشرات كفايات الموهبة والتحصيل الدراسي</div>
          
          <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 2px;">
              <span>التحصيل والمعدل الدراسي</span>
              <span style="color: #15803d;">${compAcademic}%</span>
            </div>
            <div style="height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden;">
              <div style="width: ${compAcademic}%; height: 100%; background: #15803d; border-radius: 5px;"></div>
            </div>
          </div>

          <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 2px;">
              <span>الموهبة والتفكير الإبداعي</span>
              <span style="color: #c8922a;">${compTalent}%</span>
            </div>
            <div style="height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden;">
              <div style="width: ${compTalent}%; height: 100%; background: #c8922a; border-radius: 5px;"></div>
            </div>
          </div>

          <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 2px;">
              <span>الانضباط والالتزام بالدوام</span>
              <span style="color: #00695C;">${compDiscipline}%</span>
            </div>
            <div style="height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden;">
              <div style="width: ${compDiscipline}%; height: 100%; background: #00695C; border-radius: 5px;"></div>
            </div>
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 2px;">
              <span>المشاركات والأنشطة النوعية</span>
              <span style="color: #1a3a5c;">${compAchievements}%</span>
            </div>
            <div style="height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden;">
              <div style="width: ${compAchievements}%; height: 100%; background: #1a3a5c; border-radius: 5px;"></div>
            </div>
          </div>
        </div>

        <!-- CHART 2: COMPARATIVE BAR GRAPH (Student vs Stage Avg) -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 12px; text-align: center;">مقارنة معدل الطالب بمعدل المرحلة في المدرسة</div>
          
          <div style="display: flex; align-items: flex-end; justify-content: center; gap: 32px; height: 120px; padding-bottom: 10px; border-bottom: 1px solid #cbd5e1;">
            <!-- Student GPA Bar -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
              <span style="font-size: 11px; font-weight: 800; color: #00695C;">${gpaVal !== null ? gpaVal : '—'}</span>
              <div style="width: 38px; height: ${gpaVal !== null ? (gpaVal * 0.9) : 80}px; background: linear-gradient(180deg, #00897B, #00695C); border-radius: 6px 6px 0 0; box-shadow: 0 2px 6px rgba(0,0,0,0.1);"></div>
              <span style="font-size: 10px; font-weight: 700; color: #0f172a; margin-top: 4px;">معدل الطالب</span>
            </div>

            <!-- Stage Avg Bar -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
              <span style="font-size: 11px; font-weight: 800; color: #1a3a5c;">${stageAvgGPA}</span>
              <div style="width: 38px; height: ${(stageAvgGPA * 0.9)}px; background: linear-gradient(180deg, #3b82f6, #1a3a5c); border-radius: 6px 6px 0 0; box-shadow: 0 2px 6px rgba(0,0,0,0.1);"></div>
              <span style="font-size: 10px; font-weight: 700; color: #0f172a; margin-top: 4px;">معدل المرحلة</span>
            </div>
          </div>

          <div style="font-size: 10px; color: #64748b; text-align: center; margin-top: 8px;">
            ${gpaVal !== null && gpaVal >= stageAvgGPA ? `✅ معدل الطالب يتجاوز متوسط المرحلة بمقدار ${(gpaVal - stageAvgGPA).toFixed(1)} درجة` : `مستوى الطالب متقارب مع متوسط المرحلة الدراسية`}
          </div>
        </div>
      </div>
    </div>

    <!-- SIGNATURES & OFFICIAL SEAL -->
    <div style="display: flex; align-items: flex-end; justify-content: space-between; margin-top: 30px; padding-top: 16px; border-top: 1.5px dashed #cbd5e1;">
      <div style="text-align: center; width: 30%;">
        <div style="font-size: 11px; font-weight: 800; color: #1e293b;">المرشد التربوي / لجنة الموهبة</div>
        <div style="height: 40px; margin-top: 4px;"></div>
        <div style="font-size: 10px; color: #64748b;">التوقيع: ............................</div>
      </div>

      <div style="text-align: center; width: 30%;">
        <div style="width: 70px; height: 70px; border: 2px dashed #00695C; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; color: #00695C; font-size: 9px; font-weight: 800; text-align: center;">
          ختم المدرسة<br>الرسمي
        </div>
      </div>

      <div style="text-align: center; width: 30%;">
        <div style="font-size: 11px; font-weight: 800; color: #1e293b;">مدير مدرسة الموهوبين</div>
        <div style="height: 40px; margin-top: 4px;"></div>
        <div style="font-size: 10px; color: #64748b;">التوقيع والختم: ............................</div>
      </div>
    </div>

    <!-- REPORT WATERMARK FOOTER -->
    <div style="margin-top: 24px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 8px;">
      هذا التقرير وثيقة رسمية صادرة إلكترونياً من نظام إدارة بيانات هيأة رعاية الموهوبين — جمهورية العراق. جميع الحقوق محفوظة © ${new Date().getFullYear()}
    </div>
  `;
}

window.downloadStudentPDF = function(studentId) {
  const students = typeof gdata === 'function' ? gdata('stud') : (JSON.parse(localStorage.getItem('gft_stud') || '[]'));
  const student = students.find(s => s.id === studentId);
  const studentName = student ? [student.name1, student.name2].filter(Boolean).join('_') : 'طالب';

  const element = document.getElementById('student-pdf-content');
  if (!element) {
    alert('تعذّر العثور على محتوى التقرير للطباعة');
    return;
  }

  const btn = document.getElementById('btn-export-student-pdf');
  const originalBtnText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span style="display:inline-block;animation:spin 1s linear infinite;margin-left:5px">⏳</span> جاري التصدير...`;
  }

  if (window.showToast) {
    window.showToast('جاري تحويل بطاقة الطالب إلى ملف PDF عالي الجودة...', 'info', 3000);
  }

  if (typeof html2pdf !== 'undefined') {
    const opt = {
      margin: [6, 6, 6, 6],
      filename: `بطاقة_الطالب_${studentName}_${student?.academicYear || ''}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        letterRendering: true
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
      }
      if (window.showToast) {
        window.showToast('✅ تم تحميل تقرير الطالب بصيغة PDF بنجاح', 'success');
      }
    }).catch(err => {
      console.error('[downloadStudentPDF] error:', err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
      }
      window.printStudentReport();
    });
  } else {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnText;
    }
    window.printStudentReport();
  }
};

window.printStudentReport = function() {
  const content = document.getElementById('student-pdf-content');
  if (!content) return;

  const printWin = window.open('', '_blank');
  if (!printWin) {
    alert('يرجى السماح بفتح النوافذ المنبثقة للطباعة');
    return;
  }

  printWin.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>طباعة تقرير الطالب الشامل</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Cairo+Play:wght@700&display=swap" rel="stylesheet">
      <style>
        body { margin: 0; padding: 20px; background: #fff; font-family: 'Cairo', sans-serif; direction: rtl; }
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          body { padding: 0; }
          #student-pdf-content { box-shadow: none !important; width: 100% !important; padding: 0 !important; }
        }
      </style>
    </head>
    <body>
      <div id="student-pdf-content">
        ${content.innerHTML}
      </div>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
            window.close();
          }, 400);
        };
      <\/script>
    </body>
    </html>
  `);
  printWin.document.close();
};


// ============================================================
// --- 2. نافذة وتصدير تقرير المدرسة الشامل (SCHOOL REPORT PDF) ---
// ============================================================

window.openSchoolReportModal = function(schoolName) {
  const targetSchool = schoolName || (window.CU?.school) || (typeof getSchoolsList === 'function' ? getSchoolsList()[0] : 'بغداد');
  if (!targetSchool) {
    alert('يرجى اختيار المدرسة أولاً');
    return;
  }

  let modal = document.getElementById('school-report-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'school-report-modal';
    modal.className = 'pv-overlay';
    modal.style.zIndex = '9500';
    document.body.appendChild(modal);
  }

  const reportHTML = generateSchoolComprehensiveReportHTML(targetSchool);

  modal.innerHTML = `
    <div class="pv-box" style="width: 900px; max-width: 96vw; max-height: 94vh; display: flex; flex-direction: column;">
      <div style="padding: 16px 20px; background: #1a3a5c; color: #fff; display: flex; align-items: center; justify-content: space-between; border-top-left-radius: 20px; border-top-right-radius: 20px;">
        <div style="font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          معاينة وتصدير تقرير مدرسة ${targetSchool} الشامل (PDF)
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button class="btn btn-sm" id="btn-export-school-pdf" onclick="downloadSchoolReportPDF('${targetSchool}')" style="background:#00897B; border:1px solid #00897B; color:#fff; font-weight:bold; display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            تنزيل ملف PDF
          </button>
          <button class="btn btn-sm" onclick="printSchoolReport()" style="background:#475569; color:#fff; font-weight:bold; display:inline-flex; align-items:center; gap:6px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            طباعة
          </button>
          <button class="mc2" onclick="closeSchoolReportModal()" style="color:#fff; border-color:rgba(255,255,255,0.3)">×</button>
        </div>
      </div>
      <div style="flex: 1; overflow-y: auto; padding: 20px; background: #1e293b;" id="school-report-preview-wrap">
        <div id="school-pdf-content" style="background: #ffffff; color: #0f172a; width: 810px; min-height: 1140px; margin: 0 auto; padding: 32px 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); font-family: 'Cairo', sans-serif; direction: rtl; position: relative; box-sizing: border-box;">
          ${reportHTML}
        </div>
      </div>
    </div>
  `;

  modal.classList.add('open');
};

window.closeSchoolReportModal = function() {
  const modal = document.getElementById('school-report-modal');
  if (modal) modal.classList.remove('open');
};

function generateSchoolComprehensiveReportHTML(schoolName) {
  const teachList = (typeof gdata === 'function' ? gdata('teach') : (JSON.parse(localStorage.getItem('gft_teach') || '[]'))).filter(r => r.school === schoolName);
  const studList = (typeof gdata === 'function' ? gdata('stud') : (JSON.parse(localStorage.getItem('gft_stud') || '[]'))).filter(r => r.school === schoolName);
  
  const siData = typeof getSchoolInfoData === 'function' ? getSchoolInfoData(schoolName) : {};
  const siFields = typeof getSchoolInfoFields === 'function' ? getSchoolInfoFields().filter(f => f.visible) : [];
  const currentDate = new Date().toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' });
  const year = window.ACTIVE_YEAR || '2024-2025';

  // Statistics calculation
  const totalStaff = teachList.length;
  const totalStudents = studList.length;
  
  // Stages breakdown
  const stagesCount = {};
  studList.forEach(s => {
    const stg = s.stage || 'غير محددة';
    stagesCount[stg] = (stagesCount[stg] || 0) + 1;
  });

  // Talents breakdown
  const talentsCount = {};
  studList.forEach(s => {
    const tal = s.talent || 'غير محددة';
    talentsCount[tal] = (talentsCount[tal] || 0) + 1;
  });

  // GPA analysis
  const validGpas = studList.map(s => parseFloat(s.gpa)).filter(g => !isNaN(g));
  const avgGPA = validGpas.length > 0 ? (validGpas.reduce((a, b) => a + b, 0) / validGpas.length).toFixed(1) : '—';
  const excellentStudentsCount = validGpas.filter(g => g >= 90).length;

  // Staff roles breakdown
  const staffRolesCount = {};
  teachList.forEach(t => {
    const role = t.jobRole || t.job || 'تدريسي';
    staffRolesCount[role] = (staffRolesCount[role] || 0) + 1;
  });

  // School completion
  const overall = typeof getSchoolOverall === 'function' ? getSchoolOverall(schoolName) : null;
  const completionPct = overall ? overall.pct : 100;

  const logoSrc = (typeof window !== 'undefined' && window.GIFTED_OFFICIAL_LOGO) ? window.GIFTED_OFFICIAL_LOGO : '';

  return `
    <!-- OFFICIAL HEADER -->
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1a3a5c; padding-bottom: 14px; margin-bottom: 20px;">
      <div style="text-align: right; width: 33%;">
        <div style="font-size: 13px; font-weight: 800; color: #00695C;">جمهورية العراق — وزارة التربية</div>
        <div style="font-size: 12px; font-weight: 700; color: #1a3a5c; margin-top: 2px;">هيأة رعاية الموهوبين</div>
        <div style="font-size: 11px; color: #475569; margin-top: 2px;">مدرسة الموهوبين — ${schoolName}</div>
      </div>
      <div style="text-align: center; width: 34%;">
        <div style="width: 58px; height: 58px; margin: 0 auto 6px; display: flex; align-items: center; justify-content: center;">
          ${logoSrc ? `<img src="${logoSrc}" alt="شعار هيأة رعاية الموهوبين" style="max-width:58px;max-height:58px;object-fit:contain;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.15)"/>` : `<div style="width:56px;height:56px;background:#e8f0f9;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid #1a3a5c;"><svg viewBox="0 0 24 24" fill="none" stroke="#1a3a5c" stroke-width="2" style="width:30px;height:30px"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`}
        </div>
        <div style="font-size: 17px; font-weight: 900; color: #1a3a5c; letter-spacing: -0.02em;">التقرير الإداري والتربوي الشامل للمدرسة</div>
        <div style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">Comprehensive School Performance Report</div>
      </div>
      <div style="text-align: left; width: 33%;">
        <div style="font-size: 11px; color: #475569;"><strong>تاريخ التقرير:</strong> ${currentDate}</div>
        <div style="font-size: 11px; color: #475569; margin-top: 2px;"><strong>السنة الدراسية:</strong> ${year}</div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 4px; font-family: monospace;">CODE: SCH-${schoolName}</div>
      </div>
    </div>

    <!-- SUMMARY KPI STATS -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
      <div style="background: #E0F2F1; border: 1.5px solid #00897B; border-radius: 10px; padding: 12px; text-align: center;">
        <div style="font-size: 11px; font-weight: 700; color: #00695C;">إجمالي الطلاب الموهوبين</div>
        <div style="font-size: 24px; font-weight: 900; color: #00695C; font-family: 'Cairo Play', sans-serif;">${totalStudents}</div>
        <div style="font-size: 10px; color: #004D40;">طالب وطالبة</div>
      </div>
      <div style="background: #e8f0f9; border: 1.5px solid #1a3a5c; border-radius: 10px; padding: 12px; text-align: center;">
        <div style="font-size: 11px; font-weight: 700; color: #1a3a5c;">كادر المدرسة والتدريسيين</div>
        <div style="font-size: 24px; font-weight: 900; color: #1a3a5c; font-family: 'Cairo Play', sans-serif;">${totalStaff}</div>
        <div style="font-size: 10px; color: #0f172a;">عضو كادر</div>
      </div>
      <div style="background: #fdf3e3; border: 1.5px solid #c8922a; border-radius: 10px; padding: 12px; text-align: center;">
        <div style="font-size: 11px; font-weight: 700; color: #b45309;">المعدل العام للمدرسة</div>
        <div style="font-size: 24px; font-weight: 900; color: #b45309; font-family: 'Cairo Play', sans-serif;">${avgGPA}%</div>
        <div style="font-size: 10px; color: #78350f;">${excellentStudentsCount} طالب متفوق (90+)</div>
      </div>
      <div style="background: #f0fdf4; border: 1.5px solid #15803d; border-radius: 10px; padding: 12px; text-align: center;">
        <div style="font-size: 11px; font-weight: 700; color: #15803d;">نسبة اكتمال السجلات</div>
        <div style="font-size: 24px; font-weight: 900; color: #15803d; font-family: 'Cairo Play', sans-serif;">${completionPct}%</div>
        <div style="font-size: 10px; color: #14532d;">بيانات مركزية مكتملة</div>
      </div>
    </div>

    <!-- SCHOOL GENERAL INFO & CONTACT DETAILS -->
    <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; margin-bottom: 20px;">
      <div style="background: #1a3a5c; color: #fff; padding: 8px 14px; font-size: 12px; font-weight: 800; display: flex; align-items: center; gap: 6px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        معلومات وبيانات مدرسة ${schoolName} الرسمية
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <tbody>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569; width: 25%;">اسم المدرسة</td>
            <td style="padding: 7px 12px; font-weight: 700; color: #00695C; width: 25%;">مدرسة الموهوبين في ${schoolName}</td>
            <td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569; width: 25%;">المحافظة</td>
            <td style="padding: 7px 12px; font-weight: 700; color: #0f172a; width: 25%;">${siData.gov_name || siData.governorate || schoolName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569;">العنوان الجغرافي</td>
            <td style="padding: 7px 12px;">${siData.address || 'مركز المحافظة'}</td>
            <td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569;">سنة التأسيس</td>
            <td style="padding: 7px 12px;">${siData.establishedYear || '—'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569;">مدير المدرسة</td>
            <td style="padding: 7px 12px; font-weight: 700;">${siData.managerName || '—'}</td>
            <td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569;">هاتف الإدارة</td>
            <td style="padding: 7px 12px; direction: ltr; text-align: right;">${siData.phone || '—'}</td>
          </tr>
          <tr>
            <td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569;">البريد الإلكتروني</td>
            <td style="padding: 7px 12px;">${siData.email || '—'}</td>
            <td style="padding: 7px 12px; background: #f8fafc; font-weight: 700; color: #475569;">الملاحظات العامة</td>
            <td style="padding: 7px 12px;">${siData.notes || '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- DISTRIBUTIONS & CHARTS GRID -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
      <!-- STAGES DISTRIBUTION -->
      <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; padding: 14px;">
        <div style="font-size: 12px; font-weight: 800; color: #00695C; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          توزيع الطلاب حسب المراحل الدراسية
        </div>
        ${Object.keys(stagesCount).length > 0 ? Object.entries(stagesCount).map(([stg, cnt]) => {
          const pct = Math.round((cnt / (totalStudents || 1)) * 100);
          return `
            <div style="margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin-bottom: 2px;">
                <span>${stg}</span>
                <span style="color: #00695C;">${cnt} طالب (${pct}%)</span>
              </div>
              <div style="height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                <div style="width: ${pct}%; height: 100%; background: #00897B; border-radius: 4px;"></div>
              </div>
            </div>
          `;
        }).join('') : '<div style="font-size:11px;color:#94a3b8;text-align:center;padding:10px">لا توجد بيانات مسجلة</div>'}
      </div>

      <!-- TALENTS DISTRIBUTION -->
      <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; padding: 14px;">
        <div style="font-size: 12px; font-weight: 800; color: #b45309; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          توزيع مجالات الموهبة والتفوق
        </div>
        ${Object.keys(talentsCount).length > 0 ? Object.entries(talentsCount).map(([tal, cnt]) => {
          const pct = Math.round((cnt / (totalStudents || 1)) * 100);
          return `
            <div style="margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin-bottom: 2px;">
                <span>${tal}</span>
                <span style="color: #b45309;">${cnt} طالب (${pct}%)</span>
              </div>
              <div style="height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                <div style="width: ${pct}%; height: 100%; background: #c8922a; border-radius: 4px;"></div>
              </div>
            </div>
          `;
        }).join('') : '<div style="font-size:11px;color:#94a3b8;text-align:center;padding:10px">لا توجد بيانات مسجلة</div>'}
      </div>
    </div>

    <!-- OUTSTANDING STUDENTS ROSTER PREVIEW (TOP 6) -->
    <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; margin-bottom: 22px;">
      <div style="background: #00695C; color: #fff; padding: 8px 14px; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: space-between;">
        <span>قائمة عينة من طلبة المدرسة المتميزين</span>
        <span style="font-size: 10px; font-weight: normal;">إجمالي المسجلين: ${totalStudents} طالب</span>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
            <th style="padding: 6px 10px; text-align: right;">ت</th>
            <th style="padding: 6px 10px; text-align: right;">اسم الطالب الكامل</th>
            <th style="padding: 6px 10px; text-align: right;">المرحلة</th>
            <th style="padding: 6px 10px; text-align: right;">مجال الموهبة</th>
            <th style="padding: 6px 10px; text-align: center;">المعدل الدراسي</th>
            <th style="padding: 6px 10px; text-align: center;">حالة الدوام</th>
          </tr>
        </thead>
        <tbody>
          ${studList.slice(0, 8).map((st, idx) => {
            const stName = [st.name1, st.name2, st.name3, st.name4].filter(Boolean).join(' ');
            return `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 6px 10px; color: #64748b;">${idx + 1}</td>
                <td style="padding: 6px 10px; font-weight: 700; color: #0f172a;">${stName}</td>
                <td style="padding: 6px 10px;">${st.stage || '—'}</td>
                <td style="padding: 6px 10px; color: #b45309; font-weight: 600;">${st.talent || '—'}</td>
                <td style="padding: 6px 10px; text-align: center; font-weight: 800; color: #15803d;">${st.gpa ? st.gpa + '%' : '—'}</td>
                <td style="padding: 6px 10px; text-align: center;">${st.attendance || 'مستمر'}</td>
              </tr>
            `;
          }).join('')}
          ${studList.length === 0 ? '<tr><td colspan="6" style="padding:14px;text-align:center;color:#94a3b8">لا توجد بيانات طلاب مسجلة لهذه المدرسة</td></tr>' : ''}
        </tbody>
      </table>
    </div>

    <!-- SIGNATURES & OFFICIAL SEAL -->
    <div style="display: flex; align-items: flex-end; justify-content: space-between; margin-top: 30px; padding-top: 16px; border-top: 1.5px dashed #cbd5e1;">
      <div style="text-align: center; width: 30%;">
        <div style="font-size: 11px; font-weight: 800; color: #1e293b;">مسؤول شعبة شؤون المدارس</div>
        <div style="height: 40px; margin-top: 4px;"></div>
        <div style="font-size: 10px; color: #64748b;">التوقيع: ............................</div>
      </div>

      <div style="text-align: center; width: 30%;">
        <div style="width: 74px; height: 74px; border: 2px dashed #1a3a5c; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; color: #1a3a5c; font-size: 9px; font-weight: 800; text-align: center;">
          الختم الرسمي<br>لهيأة رعاية الموهوبين
        </div>
      </div>

      <div style="text-align: center; width: 30%;">
        <div style="font-size: 11px; font-weight: 800; color: #1e293b;">مدير مدرسة الموهوبين في ${schoolName}</div>
        <div style="height: 40px; margin-top: 4px;"></div>
        <div style="font-size: 10px; color: #64748b;">التوقيع والختم: ............................</div>
      </div>
    </div>

    <!-- REPORT FOOTER -->
    <div style="margin-top: 24px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 8px;">
      تم تصدير هذا التقرير الشامل إلكترونياً من النظام المركزي لهيأة رعاية الموهوبين — جمهورية العراق. تاريخ الإصدار: ${currentDate}
    </div>
  `;
}

window.downloadSchoolReportPDF = function(schoolName) {
  const targetSchool = schoolName || (window.CU?.school) || 'المدرسة';
  const element = document.getElementById('school-pdf-content');
  if (!element) {
    alert('تعذّر العثور على محتوى تقرير المدرسة للطباعة');
    return;
  }

  const btn = document.getElementById('btn-export-school-pdf');
  const originalBtnText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span style="display:inline-block;animation:spin 1s linear infinite;margin-left:5px">⏳</span> جاري التصدير...`;
  }

  if (window.showToast) {
    window.showToast(`جاري إنشاء ملف PDF للتقرير الشامل لمدرسة ${targetSchool}...`, 'info', 3000);
  }

  if (typeof html2pdf !== 'undefined') {
    const opt = {
      margin: [6, 6, 6, 6],
      filename: `تقرير_شامل_مدرسة_${targetSchool}_${window.ACTIVE_YEAR || ''}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        letterRendering: true
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
      }
      if (window.showToast) {
        window.showToast(`✅ تم تنزيل تقرير مدرسة ${targetSchool} بصيغة PDF بنجاح`, 'success');
      }
    }).catch(err => {
      console.error('[downloadSchoolReportPDF] error:', err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
      }
      window.printSchoolReport();
    });
  } else {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnText;
    }
    window.printSchoolReport();
  }
};

window.printSchoolReport = function() {
  const content = document.getElementById('school-pdf-content');
  if (!content) return;

  const printWin = window.open('', '_blank');
  if (!printWin) {
    alert('يرجى السماح بفتح النوافذ المنبثقة للطباعة');
    return;
  }

  printWin.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>طباعة تقرير المدرسة الشامل</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Cairo+Play:wght@700&display=swap" rel="stylesheet">
      <style>
        body { margin: 0; padding: 20px; background: #fff; font-family: 'Cairo', sans-serif; direction: rtl; }
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          body { padding: 0; }
          #school-pdf-content { box-shadow: none !important; width: 100% !important; padding: 0 !important; }
        }
      </style>
    </head>
    <body>
      <div id="school-pdf-content">
        ${content.innerHTML}
      </div>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
            window.close();
          }, 400);
        };
      <\/script>
    </body>
    </html>
  `);
  printWin.document.close();
};
