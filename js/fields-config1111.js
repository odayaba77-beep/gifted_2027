window.FIELD_CONFIG = {
  "students": [
    {
      "id": "name1",
      "name": "name1",
      "label": "الاسم الأول",
      "type": "text",
      "required": true,
      "section": "personal",
      "order": 1,
      "visible": true,
      "core": true,
      "sort_order": 1
    },
    {
      "id": "name2",
      "name": "name2",
      "label": "اسم الأب",
      "type": "text",
      "required": true,
      "section": "personal",
      "order": 2,
      "visible": true,
      "core": true,
      "sort_order": 2
    },
    {
      "id": "name3",
      "name": "name3",
      "label": "اسم الجد",
      "type": "text",
      "required": true,
      "section": "personal",
      "order": 3,
      "visible": true,
      "core": true,
      "sort_order": 3
    },
    {
      "id": "name4",
      "name": "name4",
      "label": "اللقب",
      "type": "text",
      "required": true,
      "section": "personal",
      "order": 4,
      "visible": true,
      "core": true,
      "sort_order": 4
    },
    {
      "id": "dob",
      "name": "dob",
      "label": "تاريخ الميلاد",
      "type": "date",
      "required": true,
      "section": "personal",
      "order": 5,
      "visible": true,
      "core": true,
      "sort_order": 5
    },
    {
      "id": "gender",
      "name": "gender",
      "label": "الجنس",
      "type": "select",
      "required": true,
      "section": "personal",
      "order": 6,
      "options": [
        "ذكر",
        "أنثى"
      ],
      "visible": true,
      "core": true,
      "sort_order": 6
    },
    {
      "id": "school",
      "name": "school",
      "label": "المدرسة",
      "type": "select",
      "required": true,
      "section": "academic",
      "order": 7,
      "options": [
        "بغداد",
        "النجف",
        "البصرة",
        "نينوى",
        "الأنبار",
        "ميسان",
        "ذي قار"
      ],
      "visible": true,
      "core": true,
      "sort_order": 7
    },
    {
      "id": "academicYear",
      "name": "academicYear",
      "label": "السنة الدراسية",
      "type": "select",
      "required": true,
      "section": "academic",
      "order": 8,
      "options": [
        "2024-2025",
        "2025-2026",
        "2026-2027",
        "2027-2028",
        "2028-2029",
        "2029-2030",
        "2030-2031",
        "2031-2032",
        "2032-2033",
        "2033-2034",
        "2034-2035"
      ],
      "visible": true,
      "core": true,
      "sort_order": 8
    },
    {
      "id": "stage",
      "name": "stage",
      "label": "المرحلة الدراسية",
      "type": "select",
      "required": true,
      "section": "academic",
      "order": 9,
      "options": [
        "الأول المتوسط",
        "الثاني المتوسط",
        "الثالث المتوسط",
        "الرابع الإعدادي",
        "الخامس الإعدادي",
        "السادس الإعدادي"
      ],
      "visible": true,
      "core": true,
      "sort_order": 9
    },
    {
      "id": "talent",
      "name": "talent",
      "label": "نوع الموهبة",
      "type": "select",
      "required": true,
      "section": "academic",
      "order": 10,
      "options": [
        "رياضيات",
        "علوم طبيعية",
        "فيزياء",
        "كيمياء",
        "أحياء",
        "برمجة وحاسوب",
        "لغات",
        "أدب وكتابة",
        "فنون تشكيلية",
        "موسيقى"
      ],
      "visible": true,
      "core": true,
      "sort_order": 10
    },
    {
      "id": "gpa",
      "name": "gpa",
      "label": "المعدل الدراسي",
      "type": "number",
      "required": false,
      "section": "academic",
      "order": 11,
      "visible": true,
      "core": true,
      "sort_order": 11
    },
    {
      "id": "parentPhone",
      "name": "parentPhone",
      "label": "هاتف ولي الأمر",
      "type": "text",
      "required": true,
      "section": "contact",
      "order": 12,
      "visible": true,
      "core": true,
      "sort_order": 12
    },
    {
      "id": "studentPhone",
      "name": "studentPhone",
      "label": "هاتف الطالب",
      "type": "text",
      "required": false,
      "section": "contact",
      "order": 13,
      "visible": true,
      "core": true,
      "sort_order": 13
    },
    {
      "id": "address",
      "name": "address",
      "label": "عنوان السكن",
      "type": "textarea",
      "required": true,
      "section": "contact",
      "order": 14,
      "visible": true,
      "core": true,
      "sort_order": 14
    },
    {
      "id": "attendance",
      "name": "attendance",
      "label": "حالة الدوام",
      "type": "select",
      "required": true,
      "section": "attendance",
      "order": 15,
      "options": [
        "مستمر",
        "غير مستمر"
      ],
      "visible": true,
      "core": true,
      "sort_order": 15
    },
    {
      "id": "cf_1780756114364",
      "label": "هل الطالب متلكأ",
      "type": "select",
      "required": true,
      "core": false,
      "visible": true,
      "options": [
        "نعم",
        "كلا"
      ],
      "sort_order": 16
    },
    {
      "id": "attendanceNotes",
      "name": "attendanceNotes",
      "label": "ملاحظات حالة الدوام",
      "type": "textarea",
      "required": false,
      "section": "attendance",
      "order": 16,
      "visible": true,
      "core": true,
      "sort_order": 17
    },
    {
      "id": "achievements",
      "name": "achievements",
      "label": "الإنجازات والمشاركات",
      "type": "textarea",
      "required": false,
      "section": "attendance",
      "order": 17,
      "visible": true,
      "core": true,
      "sort_order": 18
    },
    {
      "id": "cf_1780757109132",
      "label": "عمل ولي الامر",
      "type": "select",
      "required": true,
      "core": false,
      "visible": true,
      "options": [
        "موظف حكومي",
        "كاسب",
        "غيرها"
      ],
      "sort_order": 19
    },
    {
      "id": "cf_1780757308931",
      "label": "عمل ام الطالب",
      "type": "select",
      "required": true,
      "core": false,
      "visible": true,
      "options": [
        "موظفة حكومية",
        "ربة بيت",
        "غيرها"
      ],
      "sort_order": 20
    },
    {
      "id": "passStatus",
      "name": "passStatus",
      "label": "حالة النجاح",
      "type": "select",
      "required": false,
      "section": "promotion",
      "options": [
        "ناجح",
        "راسب",
        "متخرج"
      ],
      "visible": false,
      "core": true,
      "sort_order": 21
    },
    {
      "id": "archiveReason",
      "name": "archiveReason",
      "label": "سبب الأرشفة",
      "type": "text",
      "required": false,
      "section": "archive",
      "visible": false,
      "core": true,
      "sort_order": 22
    },
    {
      "id": "archiveDate",
      "name": "archiveDate",
      "label": "تاريخ الأرشفة",
      "type": "date",
      "required": false,
      "section": "archive",
      "visible": false,
      "core": true,
      "sort_order": 23
    },
    {
      "id": "acceptedBy",
      "name": "acceptedBy",
      "label": "الجهة المقبول بها",
      "type": "text",
      "required": false,
      "section": "archive",
      "visible": false,
      "core": true,
      "sort_order": 24
    },
    {
      "id": "studyType",
      "name": "studyType",
      "label": "نوع الدراسة",
      "type": "text",
      "required": false,
      "section": "archive",
      "visible": false,
      "core": true,
      "sort_order": 25
    },
    {
      "id": "archiveNotes",
      "name": "archiveNotes",
      "label": "ملاحظات الأرشفة",
      "type": "textarea",
      "required": false,
      "section": "archive",
      "visible": false,
      "core": true,
      "sort_order": 26
    },
    {
      "id": "university",
      "name": "university",
      "label": "الجامعة",
      "type": "text",
      "required": false,
      "section": "archive",
      "visible": false,
      "core": true,
      "sort_order": 27
    },
    {
      "id": "college",
      "name": "college",
      "label": "الكلية",
      "type": "text",
      "required": false,
      "section": "archive",
      "visible": false,
      "core": true,
      "sort_order": 28
    },
    {
      "id": "department",
      "name": "department",
      "label": "القسم",
      "type": "text",
      "required": false,
      "section": "archive",
      "visible": false,
      "core": true,
      "sort_order": 29
    },
    {
      "id": "admissionYear",
      "name": "admissionYear",
      "label": "سنة القبول",
      "type": "text",
      "required": false,
      "section": "archive",
      "visible": false,
      "core": true,
      "sort_order": 30
    }
  ],
  "staff": [
    {
      "id": "name1",
      "name": "name1",
      "label": "الاسم الأول",
      "type": "text",
      "required": true,
      "section": "personal",
      "order": 1,
      "visible": true,
      "core": true,
      "sort_order": 1
    },
    {
      "id": "name2",
      "name": "name2",
      "label": "اسم الأب",
      "type": "text",
      "required": true,
      "section": "personal",
      "order": 2,
      "visible": true,
      "core": true,
      "sort_order": 2
    },
    {
      "id": "name3",
      "name": "name3",
      "label": "اسم الجد",
      "type": "text",
      "required": true,
      "section": "personal",
      "order": 3,
      "visible": true,
      "core": true,
      "sort_order": 3
    },
    {
      "id": "name4",
      "name": "name4",
      "label": "اللقب",
      "type": "text",
      "required": true,
      "section": "personal",
      "order": 4,
      "visible": true,
      "core": true,
      "sort_order": 4
    },
    {
      "id": "nid",
      "name": "nid",
      "label": "رقم الهوية الوطنية",
      "type": "text",
      "required": false,
      "section": "personal",
      "order": 5,
      "visible": true,
      "core": true,
      "sort_order": 5
    },
    {
      "id": "dob",
      "name": "dob",
      "label": "تاريخ الميلاد",
      "type": "date",
      "required": true,
      "section": "personal",
      "order": 6,
      "visible": true,
      "core": true,
      "sort_order": 6
    },
    {
      "id": "gender",
      "name": "gender",
      "label": "الجنس",
      "type": "select",
      "required": true,
      "section": "personal",
      "order": 7,
      "options": [
        "ذكر",
        "أنثى"
      ],
      "visible": true,
      "core": true,
      "sort_order": 7
    },
    {
      "id": "school",
      "name": "school",
      "label": "المدرسة",
      "type": "select",
      "required": true,
      "section": "employment",
      "order": 8,
      "options": [
        "بغداد",
        "النجف",
        "البصرة",
        "نينوى",
        "الأنبار",
        "ميسان",
        "ذي قار"
      ],
      "visible": true,
      "core": true,
      "sort_order": 8
    },
    {
      "id": "jobRole",
      "name": "jobRole",
      "label": "الوظيفة",
      "type": "select",
      "required": true,
      "section": "employment",
      "order": 9,
      "options": [
        "إداري",
        "تدريسي"
      ],
      "visible": true,
      "core": true,
      "sort_order": 9
    },
    {
      "id": "subject",
      "name": "subject",
      "label": "المادة الدراسية",
      "type": "select",
      "required": false,
      "section": "employment",
      "order": 10,
      "options": [
        "الإسلامية",
        "اللغة العربية",
        "اللغة الإنكليزية",
        "اللغة الفرنسية",
        "الرياضيات",
        "الكيمياء",
        "الفيزياء",
        "الأحياء",
        "الأخلاقية",
        "الاجتماعيات",
        "الحاسوب والبرمجة",
        "التربية البدنية",
        "الفنون"
      ],
      "visible": true,
      "core": true,
      "sort_order": 10
    },
    {
      "id": "targetStages",
      "name": "targetStages",
      "label": "المراحل الدراسية",
      "type": "checkboxes",
      "required": false,
      "section": "employment",
      "order": 11,
      "options": [
        "الأول متوسط",
        "الثاني متوسط",
        "الثالث متوسط",
        "الرابع إعدادي",
        "الخامس إعدادي",
        "السادس إعدادي"
      ],
      "visible": true,
      "core": true,
      "sort_order": 11
    },
    {
      "id": "spec",
      "name": "spec",
      "label": "الاختصاص الدقيق",
      "type": "text",
      "required": false,
      "section": "employment",
      "order": 12,
      "visible": true,
      "core": true,
      "sort_order": 12
    },
    {
      "id": "degree",
      "name": "degree",
      "label": "أعلى شهادة",
      "type": "select",
      "required": false,
      "section": "employment",
      "order": 13,
      "options": [
        "دبلوم",
        "بكالوريوس",
        "ماجستير",
        "دكتوراه"
      ],
      "visible": true,
      "core": true,
      "sort_order": 13
    },
    {
      "id": "grade",
      "name": "grade",
      "label": "الدرجة الوظيفية",
      "type": "select",
      "required": false,
      "section": "employment",
      "order": 14,
      "options": [
        "مدرس",
        "مدرس أول",
        "مدرس ممتاز",
        "أستاذ مساعد",
        "أستاذ",
        "موظف",
        "موظف أول",
        "مدير"
      ],
      "visible": true,
      "core": true,
      "sort_order": 14
    },
    {
      "id": "hire",
      "name": "hire",
      "label": "تاريخ التعيين",
      "type": "date",
      "required": true,
      "section": "employment",
      "order": 15,
      "visible": true,
      "core": true,
      "sort_order": 15
    },
    {
      "id": "service",
      "name": "service",
      "label": "سنوات الخدمة",
      "type": "number",
      "required": false,
      "section": "employment",
      "order": 16,
      "visible": true,
      "core": true,
      "sort_order": 16
    },
    {
      "id": "phone",
      "name": "phone",
      "label": "رقم الهاتف",
      "type": "text",
      "required": true,
      "section": "contact",
      "order": 17,
      "visible": true,
      "core": true,
      "sort_order": 17
    },
    {
      "id": "email",
      "name": "email",
      "label": "البريد الإلكتروني",
      "type": "text",
      "required": false,
      "section": "contact",
      "order": 18,
      "visible": true,
      "core": true,
      "sort_order": 18
    },
    {
      "id": "address",
      "name": "address",
      "label": "العنوان السكني",
      "type": "textarea",
      "required": false,
      "section": "contact",
      "order": 19,
      "visible": true,
      "core": true,
      "sort_order": 19
    },
    {
      "id": "attendance",
      "name": "attendance",
      "label": "حالة الدوام",
      "type": "select",
      "required": true,
      "section": "attendance",
      "order": 20,
      "options": [
        "مستمر",
        "غير مستمر"
      ],
      "visible": true,
      "core": true,
      "sort_order": 20
    },
    {
      "id": "attendanceNotes",
      "name": "attendanceNotes",
      "label": "ملاحظات حالة الدوام",
      "type": "textarea",
      "required": false,
      "section": "attendance",
      "order": 21,
      "visible": true,
      "core": true,
      "sort_order": 21
    },
    {
      "id": "achievements",
      "name": "achievements",
      "label": "الإنجازات والأبحاث / ملاحظات",
      "type": "textarea",
      "required": false,
      "section": "attendance",
      "order": 22,
      "visible": true,
      "core": true,
      "sort_order": 22
    },
    {
      "id": "cf_1780757638164",
      "label": "مكان العمل السابق",
      "type": "select",
      "required": true,
      "core": false,
      "visible": true,
      "options": [
        "مدارس متميزين او متفوقبن",
        "مدارس اعتيادية",
        "مدارس اطراف",
        "غيرها"
      ],
      "sort_order": 23
    }
  ],
  "school": [
    {
      "id": "si_govname",
      "label": "اسم المحافظة",
      "type": "text",
      "required": false,
      "core": true,
      "visible": true,
      "sort_order": 1
    },
    {
      "id": "si_district",
      "label": "القضاء / الناحية",
      "type": "text",
      "required": false,
      "core": true,
      "visible": true,
      "sort_order": 2
    },
    {
      "id": "si_address",
      "label": "عنوان المدرسة",
      "type": "textarea",
      "required": false,
      "core": true,
      "visible": true,
      "sort_order": 3
    },
    {
      "id": "si_phone",
      "label": "هاتف المدرسة",
      "type": "text",
      "required": false,
      "core": true,
      "visible": true,
      "sort_order": 4
    },
    {
      "id": "si_email",
      "label": "البريد الإلكتروني للمدرسة",
      "type": "text",
      "required": false,
      "core": true,
      "visible": true,
      "sort_order": 5
    },
    {
      "id": "si_founded",
      "label": "سنة التأسيس",
      "type": "number",
      "required": false,
      "core": true,
      "visible": true,
      "sort_order": 6
    },
    {
      "id": "si_capacity",
      "label": "الطاقة الاستيعابية (طالب)",
      "type": "number",
      "required": false,
      "core": true,
      "visible": true,
      "sort_order": 7
    },
    {
      "id": "si_principal",
      "label": "اسم مدير المدرسة",
      "type": "text",
      "required": false,
      "core": true,
      "visible": true,
      "sort_order": 8
    },
    {
      "id": "si_notes",
      "label": "ملاحظات عامة",
      "type": "textarea",
      "required": false,
      "core": true,
      "visible": true,
      "sort_order": 9
    }
  ]
};
window.FIELD_CONFIG_DEFAULTS = JSON.parse(JSON.stringify(window.FIELD_CONFIG));
if (window.CORE_FIELDS) { CORE_FIELDS.teach = window.FIELD_CONFIG.staff; CORE_FIELDS.stud = window.FIELD_CONFIG.students; }
