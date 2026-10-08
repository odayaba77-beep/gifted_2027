// ============================================================
// نظام الإعدادات الدائمة — تُحفظ داخل الملف نفسه
// CONFIG_DATA هو مصدر الحقيقة الرئيسي
// ============================================================

const CONFIG_DATA = {
  version: "5.0.0",
  updatedAt: null,
  schools: ['بغداد','النجف','البصرة','نينوى','الأنبار','ميسان','ذي قار'],
  academicYears: ['2024-2025','2025-2026','2026-2027','2027-2028','2028-2029','2029-2030','2030-2031','2031-2032','2032-2033','2033-2034','2034-2035'],
  users: {
    admin:   {pass:'Admin@2025',role:'مدير النظام',name:'مسؤول الهيأة المركزية',school:null,av:'مر',isAdmin:true},
    baghdad: {pass:'Bg@2025',role:'مدرسة بغداد',name:'مسؤول مدرسة بغداد',school:'بغداد',av:'بغ',isAdmin:false},
    najaf:   {pass:'Nj@2025',role:'مدرسة النجف',name:'مسؤول مدرسة النجف',school:'النجف',av:'نج',isAdmin:false},
    basra:   {pass:'Bs@2025',role:'مدرسة البصرة',name:'مسؤول مدرسة البصرة',school:'البصرة',av:'بص',isAdmin:false},
    nineveh: {pass:'Nn@2025',role:'مدرسة نينوى',name:'مسؤول مدرسة نينوى',school:'نينوى',av:'ني',isAdmin:false},
    anbar:   {pass:'An@2025',role:'مدرسة الأنبار',name:'مسؤول مدرسة الأنبار',school:'الأنبار',av:'أن',isAdmin:false},
    maysan:  {pass:'Ms@2025',role:'مدرسة ميسان',name:'مسؤول مدرسة ميسان',school:'ميسان',av:'مي',isAdmin:false},
    diqar:   {pass:'Dq@2025',role:'مدرسة ذي قار',name:'مسؤول مدرسة ذي قار',school:'ذي قار',av:'ذق',isAdmin:false}
  },
  fields: {teach: null, stud: null},
  schoolInfoFields: null,
  subjects: ['الإسلامية','اللغة العربية','اللغة الإنكليزية','اللغة الفرنسية','الرياضيات','الكيمياء','الفيزياء','الأحياء','الأخلاقية','الاجتماعيات','الحاسوب والبرمجة','التربية البدنية','الفنون'],
  syncUrl: '',
  generalSettings: {
    defaultAttendance: 'مستمر',
    autoSync: true,
    syncIntervalMin: 5
  }
};

// الحقول الأساسية
const CORE_FIELDS = {
  emp: [
    {id:'name1',label:'الاسم الأول',type:'text',required:true,core:true,visible:true},
    {id:'name2',label:'اسم الأب',type:'text',required:true,core:true,visible:true},
    {id:'name3',label:'اسم الجد',type:'text',required:true,core:true,visible:true},
    {id:'name4',label:'اللقب',type:'text',required:true,core:true,visible:true},
    {id:'nid',label:'رقم الهوية الوطنية',type:'text',required:false,core:true,visible:true},
    {id:'dob',label:'تاريخ الميلاد',type:'date',required:true,core:true,visible:true},
    {id:'school',label:'المدرسة',type:'select',options:CONFIG_DATA.schools,required:true,core:true,visible:true},
    {id:'job',label:'العنوان الوظيفي',type:'select',options:['مدير مدرسة','معاون مدير','سكرتير','محاسب','مراقب','منسق أنشطة','موظف إداري'],required:true,core:true,visible:true},
    {id:'spec',label:'الاختصاص الدقيق',type:'text',required:false,core:true,visible:true},
    {id:'degree',label:'أعلى شهادة',type:'select',options:['دبلوم','بكالوريوس','ماجستير','دكتوراه'],required:false,core:true,visible:true},
    {id:'hire',label:'تاريخ التعيين',type:'date',required:true,core:true,visible:true},
    {id:'service',label:'سنوات الخدمة',type:'number',required:false,core:true,visible:true},
    {id:'phone',label:'رقم الهاتف',type:'text',required:true,core:true,visible:true},
    {id:'email',label:'البريد الإلكتروني',type:'text',required:false,core:true,visible:true},
    {id:'address',label:'العنوان السكني',type:'textarea',required:false,core:true,visible:true},
    {id:'notes',label:'ملاحظات',type:'textarea',required:false,core:true,visible:true}
  ],
  teach: [
    {id:'name1',label:'الاسم الأول',type:'text',required:true,core:true,visible:true},
    {id:'name2',label:'اسم الأب',type:'text',required:true,core:true,visible:true},
    {id:'name3',label:'اسم الجد',type:'text',required:true,core:true,visible:true},
    {id:'name4',label:'اللقب',type:'text',required:true,core:true,visible:true},
    {id:'nid',label:'رقم الهوية الوطنية',type:'text',required:false,core:true,visible:true},
    {id:'dob',label:'تاريخ الميلاد',type:'date',required:true,core:true,visible:true},
    {id:'gender',label:'الجنس',type:'select',options:['ذكر','أنثى'],required:true,core:true,visible:true},
    {id:'school',label:'المدرسة',type:'select',options:CONFIG_DATA.schools,required:true,core:true,visible:true},
    {id:'jobRole',label:'الوظيفة',type:'select',options:['إداري','تدريسي'],required:true,core:true,visible:true},
    {id:'subject',label:'المادة الدراسية',type:'select',options:CONFIG_DATA.subjects,required:false,core:true,visible:true,teachOnly:true},
    {id:'targetStages',label:'المراحل الدراسية',type:'checkboxes',options:['الأول متوسط','الثاني متوسط','الثالث متوسط','الرابع إعدادي','الخامس إعدادي','السادس إعدادي'],required:false,core:true,visible:true,teachOnly:true},
    {id:'spec',label:'الاختصاص الدقيق',type:'text',required:false,core:true,visible:true},
    {id:'degree',label:'أعلى شهادة',type:'select',options:['دبلوم','بكالوريوس','ماجستير','دكتوراه'],required:false,core:true,visible:true},
    {id:'grade',label:'الدرجة الوظيفية',type:'select',options:['مدرس','مدرس أول','مدرس ممتاز','أستاذ مساعد','أستاذ','موظف','موظف أول','مدير'],required:false,core:true,visible:true},
    {id:'hire',label:'تاريخ التعيين',type:'date',required:true,core:true,visible:true},
    {id:'service',label:'سنوات الخدمة',type:'number',required:false,core:true,visible:true},
    {id:'phone',label:'رقم الهاتف',type:'text',required:true,core:true,visible:true},
    {id:'email',label:'البريد الإلكتروني',type:'text',required:false,core:true,visible:true},
    {id:'address',label:'العنوان السكني',type:'textarea',required:false,core:true,visible:true},
    {id:'attendance',label:'حالة الدوام',type:'select',options:['مستمر','غير مستمر'],required:true,core:true,visible:true},
    {id:'attendanceNotes',label:'ملاحظات حالة الدوام',type:'textarea',required:false,core:true,visible:true},
    {id:'achievements',label:'الإنجازات والأبحاث / ملاحظات',type:'textarea',required:false,core:true,visible:true}
  ],
  stud: [
    {id:'name1',label:'الاسم الأول',type:'text',required:true,core:true,visible:true},
    {id:'name2',label:'اسم الأب',type:'text',required:true,core:true,visible:true},
    {id:'name3',label:'اسم الجد',type:'text',required:true,core:true,visible:true},
    {id:'name4',label:'اللقب',type:'text',required:true,core:true,visible:true},
    {id:'dob',label:'تاريخ الميلاد',type:'date',required:true,core:true,visible:true},
    {id:'gender',label:'الجنس',type:'select',options:['ذكر','أنثى'],required:true,core:true,visible:true},
    {id:'school',label:'المدرسة',type:'select',options:CONFIG_DATA.schools,required:true,core:true,visible:true},
    {id:'academicYear',label:'السنة الدراسية',type:'select',options:CONFIG_DATA.academicYears,required:true,core:true,visible:true},
    {id:'stage',label:'المرحلة الدراسية',type:'select',options:['الأول المتوسط','الثاني المتوسط','الثالث المتوسط','الرابع الإعدادي','الخامس الإعدادي','السادس الإعدادي'],required:true,core:true,visible:true},
    {id:'talent',label:'نوع الموهبة',type:'select',options:['رياضيات','علوم طبيعية','فيزياء','كيمياء','أحياء','برمجة وحاسوب','لغات','أدب وكتابة','فنون تشكيلية','موسيقى'],required:true,core:true,visible:true},
    {id:'gpa',label:'المعدل الدراسي',type:'number',required:false,core:true,visible:true},
    {id:'parentPhone',label:'هاتف ولي الأمر',type:'text',required:true,core:true,visible:true},
    {id:'studentPhone',label:'هاتف الطالب',type:'text',required:false,core:true,visible:true},
    {id:'address',label:'عنوان السكن',type:'textarea',required:true,core:true,visible:true},
    {id:'attendance',label:'حالة الدوام',type:'select',options:['مستمر','غير مستمر'],required:true,core:true,visible:true},
    {id:'attendanceNotes',label:'ملاحظات حالة الدوام',type:'textarea',required:false,core:true,visible:true},
    {id:'achievements',label:'الإنجازات والمشاركات',type:'textarea',required:false,core:true,visible:true}
  ]
};

const SCHOOL_INFO_DEFAULTS = [
  {id:'si_govname',label:'اسم المحافظة',type:'text',required:false,visible:true},
  {id:'si_district',label:'القضاء / الناحية',type:'text',required:false,visible:true},
  {id:'si_address',label:'عنوان المدرسة',type:'textarea',required:false,visible:true},
  {id:'si_phone',label:'هاتف المدرسة',type:'text',required:false,visible:true},
  {id:'si_email',label:'البريد الإلكتروني للمدرسة',type:'text',required:false,visible:true},
  {id:'si_founded',label:'سنة التأسيس',type:'number',required:false,visible:true},
  {id:'si_capacity',label:'الطاقة الاستيعابية (طالب)',type:'number',required:false,visible:true},
  {id:'si_principal',label:'اسم مدير المدرسة',type:'text',required:false,visible:true},
  {id:'si_notes',label:'ملاحظات عامة',type:'textarea',required:false,visible:true},
];

const USERS_DEFAULT = {
  admin:   {pass:'Admin@2025',role:'مدير النظام',name:'مسؤول الهيأة المركزية',school:null,av:'مر',isAdmin:true},
  baghdad: {pass:'Bg@2025',role:'مدرسة بغداد',name:'مسؤول مدرسة بغداد',school:'بغداد',av:'بغ',isAdmin:false},
  najaf:   {pass:'Nj@2025',role:'مدرسة النجف',name:'مسؤول مدرسة النجف',school:'النجف',av:'نج',isAdmin:false},
  basra:   {pass:'Bs@2025',role:'مدرسة البصرة',name:'مسؤول مدرسة البصرة',school:'البصرة',av:'بص',isAdmin:false},
  nineveh: {pass:'Nn@2025',role:'مدرسة نينوى',name:'مسؤول مدرسة نينوى',school:'نينوى',av:'ني',isAdmin:false},
  anbar:   {pass:'An@2025',role:'مدرسة الأنبار',name:'مسؤول مدرسة الأنبار',school:'الأنبار',av:'أن',isAdmin:false},
  maysan:  {pass:'Ms@2025',role:'مدرسة ميسان',name:'مسؤول مدرسة ميسان',school:'ميسان',av:'مي',isAdmin:false},
  diqar:   {pass:'Dq@2025',role:'مدرسة ذي قار',name:'مسؤول مدرسة ذي قار',school:'ذي قار',av:'ذق',isAdmin:false}
};

const SCHOOLS_DEFAULT = CONFIG_DATA.schools;
const ACADEMIC_YEARS = CONFIG_DATA.academicYears;

const fieldTypeIcons = {
  text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 6.1H3M21 12.1H3M15.1 18H3"/></svg>',
  textarea: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>',
  date: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  select: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>',
  multiselect: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h5M4 12h5M4 17h5M14 8l3 3-3 3"/></svg>',
  number: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  checkboxes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
};

const fieldTypeLabels = {
  text: 'نص قصير',
  textarea: 'نص طويل',
  date: 'تاريخ',
  select: 'قائمة منسدلة',
  multiselect: 'قائمة متعددة الاختيار',
  number: 'رقم',
  checkboxes: 'مربعات اختيار'
};

const iconColors = {
  text: '#1d4ed8',
  textarea: '#6d28d9',
  date: '#0f766e',
  select: '#c8922a',
  multiselect: '#7c3aed',
  number: '#b91c1c',
  checkboxes: '#15803d'
};

const typeNames = { teach: 'كادر المدرسة', stud: 'الطلاب الموهوبون' };
const typeIcons = { teach: '#00695C', stud: '#c8922a' };