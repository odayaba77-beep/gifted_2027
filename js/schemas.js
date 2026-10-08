/**
 * ============================================================
 * CENTRALIZED DYNAMIC SCHEMA SYSTEM
 * نظام الحقول المركزي الديناميكي
 *
 * التخزين: Google Sheets + JSON Config (ليس localStorage)
 * ============================================================
 */

const FIELD_TYPES = {
  TEXT: "text",
  EMAIL: "email",
  NUMBER: "number",
  DATE: "date",
  SELECT: "select",
  MULTISELECT: "multiselect",
  CHECKBOX: "checkbox",
  CHECKBOXES: "checkboxes",
  TEXTAREA: "textarea",
  FILE: "file",
  PHONE: "phone",
  URL: "url",
};

const FIELD_CATEGORIES = {
  STUDENTS: "students",
  STAFF: "staff",
  SCHOOL: "school",
};

/**
 * ============================================================
 * DYNAMIC SCHEMA DEFINITION
 * تعريف الـ Schemas الديناميكية
 * ============================================================
 */

const DYNAMIC_SCHEMAS = {
  // ============================================================
  // Schema: الطلاب الموهوبون
  // ============================================================
  students: {
    id: "students",
    name: "الطلاب الموهوبون",
    category: FIELD_CATEGORIES.STUDENTS,
    description: "بيانات الطلاب الموهوبين في البرنامج",
    version: "1.0.0",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: null,

    schema: [
      // قسم: بيانات شخصية
      {
        id: "std_name1",
        label: "الاسم الأول",
        type: FIELD_TYPES.TEXT,
        required: true,
        order: 1,
        category: "personal",
        validation: { minLength: 2, maxLength: 50 },
      },
      {
        id: "std_name2",
        label: "اسم الأب",
        type: FIELD_TYPES.TEXT,
        required: true,
        order: 2,
        category: "personal",
        validation: { minLength: 2, maxLength: 50 },
      },
      {
        id: "std_name3",
        label: "اسم الجد",
        type: FIELD_TYPES.TEXT,
        required: true,
        order: 3,
        category: "personal",
        validation: { minLength: 2, maxLength: 50 },
      },
      {
        id: "std_name4",
        label: "اللقب (الفصيلة)",
        type: FIELD_TYPES.TEXT,
        required: true,
        order: 4,
        category: "personal",
        validation: { minLength: 2, maxLength: 50 },
      },
      {
        id: "std_dob",
        label: "تاريخ الميلاد",
        type: FIELD_TYPES.DATE,
        required: true,
        order: 5,
        category: "personal",
      },
      {
        id: "std_gender",
        label: "الجنس",
        type: FIELD_TYPES.SELECT,
        required: true,
        order: 6,
        category: "personal",
        options: ["ذكر", "أنثى"],
      },

      // قسم: البيانات الأكاديمية
      {
        id: "std_school",
        label: "المدرسة",
        type: FIELD_TYPES.SELECT,
        required: true,
        order: 10,
        category: "academic",
        dynamicOptions: "SCHOOLS_LIST",
      },
      {
        id: "std_academic_year",
        label: "السنة الدراسية",
        type: FIELD_TYPES.SELECT,
        required: true,
        order: 11,
        category: "academic",
        dynamicOptions: "ACADEMIC_YEARS",
      },
      {
        id: "std_stage",
        label: "المرحلة الدراسية",
        type: FIELD_TYPES.SELECT,
        required: true,
        order: 12,
        category: "academic",
        options: [
          "الأول المتوسط",
          "الثاني المتوسط",
          "الثالث المتوسط",
          "الرابع الإعدادي",
          "الخامس الإعدادي",
          "السادس الإعدادي",
        ],
      },
      {
        id: "std_talent",
        label: "نوع الموهبة",
        type: FIELD_TYPES.SELECT,
        required: true,
        order: 13,
        category: "academic",
        options: [
          "رياضيات",
          "علوم طبيعية",
          "فيزياء",
          "كيمياء",
          "أحياء",
          "برمجة وحاسوب",
          "لغات",
          "أدب وكتابة",
          "فنون تشكيلية",
          "موسيقى",
        ],
      },
      {
        id: "std_gpa",
        label: "المعدل الدراسي (GPA)",
        type: FIELD_TYPES.NUMBER,
        required: false,
        order: 14,
        category: "academic",
        validation: { min: 0, max: 100 },
      },

      // قسم: بيانات الاتصال
      {
        id: "std_parent_phone",
        label: "هاتف ولي الأمر",
        type: FIELD_TYPES.PHONE,
        required: true,
        order: 20,
        category: "contact",
      },
      {
        id: "std_student_phone",
        label: "هاتف الطالب",
        type: FIELD_TYPES.PHONE,
        required: false,
        order: 21,
        category: "contact",
      },
      {
        id: "std_parent_email",
        label: "بريد ولي الأمر الإلكتروني",
        type: FIELD_TYPES.EMAIL,
        required: false,
        order: 22,
        category: "contact",
      },
      {
        id: "std_address",
        label: "عنوان السكن",
        type: FIELD_TYPES.TEXTAREA,
        required: true,
        order: 23,
        category: "contact",
      },

      // قسم: الحضور والإنجازات
      {
        id: "std_attendance",
        label: "حالة الدوام",
        type: FIELD_TYPES.SELECT,
        required: true,
        order: 30,
        category: "attendance",
        options: ["مستمر", "غير مستمر"],
      },
      {
        id: "std_attendance_notes",
        label: "ملاحظات حالة الدوام",
        type: FIELD_TYPES.TEXTAREA,
        required: false,
        order: 31,
        category: "attendance",
      },
      {
        id: "std_achievements",
        label: "الإنجازات والمشاركات",
        type: FIELD_TYPES.TEXTAREA,
        required: false,
        order: 32,
        category: "attendance",
      },
    ],
  },

  // ============================================================
  // Schema: الكادر التدريسي والإداري
  // ============================================================
  staff: {
    id: "staff",
    name: "الكادر التدريسي والإداري",
    category: FIELD_CATEGORIES.STAFF,
    description: "بيانات المعلمين والموظفين الإداريين",
    version: "1.0.0",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: null,

    schema: [
      // قسم: بيانات شخصية
      {
        id: "staff_name1",
        label: "الاسم الأول",
        type: FIELD_TYPES.TEXT,
        required: true,
        order: 1,
        category: "personal",
        validation: { minLength: 2, maxLength: 50 },
      },
      {
        id: "staff_name2",
        label: "اسم الأب",
        type: FIELD_TYPES.TEXT,
        required: true,
        order: 2,
        category: "personal",
        validation: { minLength: 2, maxLength: 50 },
      },
      {
        id: "staff_name3",
        label: "اسم الجد",
        type: FIELD_TYPES.TEXT,
        required: true,
        order: 3,
        category: "personal",
        validation: { minLength: 2, maxLength: 50 },
      },
      {
        id: "staff_name4",
        label: "اللقب (الفصيلة)",
        type: FIELD_TYPES.TEXT,
        required: true,
        order: 4,
        category: "personal",
        validation: { minLength: 2, maxLength: 50 },
      },
      {
        id: "staff_nid",
        label: "رقم الهوية الوطنية",
        type: FIELD_TYPES.TEXT,
        required: false,
        order: 5,
        category: "personal",
      },
      {
        id: "staff_dob",
        label: "تاريخ الميلاد",
        type: FIELD_TYPES.DATE,
        required: true,
        order: 6,
        category: "personal",
      },
      {
        id: "staff_gender",
        label: "الجنس",
        type: FIELD_TYPES.SELECT,
        required: true,
        order: 7,
        category: "personal",
        options: ["ذكر", "أنثى"],
      },

      // قسم: البيانات الوظيفية
      {
        id: "staff_school",
        label: "المدرسة",
        type: FIELD_TYPES.SELECT,
        required: true,
        order: 10,
        category: "employment",
        dynamicOptions: "SCHOOLS_LIST",
      },
      {
        id: "staff_job_role",
        label: "الوظيفة",
        type: FIELD_TYPES.SELECT,
        required: true,
        order: 11,
        category: "employment",
        options: ["إداري", "تدريسي"],
      },
      {
        id: "staff_job_title",
        label: "العنوان الوظيفي",
        type: FIELD_TYPES.SELECT,
        required: true,
        order: 12,
        category: "employment",
        options: [
          "مدير مدرسة",
          "معاون مدير",
          "مدرس",
          "مدرس أول",
          "مدرس ممتاز",
          "موظف إداري",
          "سكرتير",
          "محاسب",
        ],
      },
      {
        id: "staff_subject",
        label: "المادة الدراسية",
        type: FIELD_TYPES.SELECT,
        required: false,
        order: 13,
        category: "employment",
        options: [
          "الإسلامية",
          "اللغة العربية",
          "اللغة الإنكليزية",
          "اللغة الفرنسية",
          "الرياضيات",
          "الكيمياء",
          "الفيزياء",
          "الأحياء",
          "الاجتماعيات",
          "الحاسوب والبرمجة",
        ],
        conditional: { dependsOn: "staff_job_role", showIf: "تدريسي" },
      },
      {
        id: "staff_grade",
        label: "الدرجة الوظيفية",
        type: FIELD_TYPES.SELECT,
        required: false,
        order: 14,
        category: "employment",
        options: ["مدرس", "مدرس أول", "مدرس ممتاز", "أستاذ مساعد", "أستاذ"],
      },
      {
        id: "staff_specialization",
        label: "الاختصاص الدقيق",
        type: FIELD_TYPES.TEXT,
        required: false,
        order: 15,
        category: "employment",
      },
      {
        id: "staff_highest_degree",
        label: "أعلى شهادة",
        type: FIELD_TYPES.SELECT,
        required: false,
        order: 16,
        category: "employment",
        options: ["دبلوم", "بكالوريوس", "ماجستير", "دكتوراه"],
      },
      {
        id: "staff_hire_date",
        label: "تاريخ التعيين",
        type: FIELD_TYPES.DATE,
        required: true,
        order: 17,
        category: "employment",
      },
      {
        id: "staff_service_years",
        label: "سنوات الخدمة",
        type: FIELD_TYPES.NUMBER,
        required: false,
        order: 18,
        category: "employment",
        validation: { min: 0, max: 50 },
      },

      // قسم: بيانات الاتصال
      {
        id: "staff_phone",
        label: "رقم الهاتف",
        type: FIELD_TYPES.PHONE,
        required: true,
        order: 20,
        category: "contact",
      },
      {
        id: "staff_email",
        label: "البريد الإلكتروني",
        type: FIELD_TYPES.EMAIL,
        required: false,
        order: 21,
        category: "contact",
      },
      {
        id: "staff_address",
        label: "العنوان السكني",
        type: FIELD_TYPES.TEXTAREA,
        required: false,
        order: 22,
        category: "contact",
      },

      // قسم: الحضور والملاحظات
      {
        id: "staff_attendance",
        label: "حالة الدوام",
        type: FIELD_TYPES.SELECT,
        required: true,
        order: 30,
        category: "attendance",
        options: ["مستمر", "غير مستمر"],
      },
      {
        id: "staff_attendance_notes",
        label: "ملاحظات حالة الدوام",
        type: FIELD_TYPES.TEXTAREA,
        required: false,
        order: 31,
        category: "attendance",
      },
      {
        id: "staff_achievements",
        label: "الإنجازات والأبحاث / ملاحظات",
        type: FIELD_TYPES.TEXTAREA,
        required: false,
        order: 32,
        category: "attendance",
      },
    ],
  },

  // ============================================================
  // Schema: بيانات المدرسة
  // ============================================================
  school: {
    id: "school",
    name: "بيانات المدرسة",
    category: FIELD_CATEGORIES.SCHOOL,
    description: "معلومات المدرسة والبيانات الإدارية",
    version: "1.0.0",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: null,

    schema: [
      // قسم: معلومات أساسية
      {
        id: "sch_gov_name",
        label: "اسم المحافظة",
        type: FIELD_TYPES.TEXT,
        required: false,
        order: 1,
        category: "basic",
      },
      {
        id: "sch_district",
        label: "القضاء / الناحية",
        type: FIELD_TYPES.TEXT,
        required: false,
        order: 2,
        category: "basic",
      },
      {
        id: "sch_address",
        label: "عنوان المدرسة",
        type: FIELD_TYPES.TEXTAREA,
        required: false,
        order: 3,
        category: "basic",
      },
      {
        id: "sch_phone",
        label: "رقم الهاتف",
        type: FIELD_TYPES.PHONE,
        required: false,
        order: 4,
        category: "basic",
      },
      {
        id: "sch_email",
        label: "البريد الإلكتروني",
        type: FIELD_TYPES.EMAIL,
        required: false,
        order: 5,
        category: "basic",
      },

      // قسم: ملاحظات عامة
      {
        id: "sch_notes",
        label: "ملاحظات عامة",
        type: FIELD_TYPES.TEXTAREA,
        required: false,
        order: 10,
        category: "notes",
      },
    ],
  },
};

/**
 * ============================================================
 * Helper: تحويل الـ Schema إلى قائمة مسطحة
 * ============================================================
 */
function flattenSchema(schema) {
  return schema.schema || [];
}

/**
 * ============================================================
 * Helper: الحصول على حقل معين من Schema
 * ============================================================
 */
function getFieldFromSchema(schemaId, fieldId) {
  const schema = DYNAMIC_SCHEMAS[schemaId];
  if (!schema) return null;
  return schema.schema.find((f) => f.id === fieldId) || null;
}

/**
 * ============================================================
 * Helper: الحصول على الحقول المرتبة من Schema
 * ============================================================
 */
function getOrderedFields(schemaId) {
  const schema = DYNAMIC_SCHEMAS[schemaId];
  if (!schema) return [];
  return [...schema.schema].sort((a, b) => a.order - b.order);
}

/**
 * ============================================================
 * Helper: الحصول على الحقول حسب الفئة
 * ============================================================
 */
function getFieldsByCategory(schemaId, category) {
  const schema = DYNAMIC_SCHEMAS[schemaId];
  if (!schema) return [];
  return schema.schema.filter((f) => f.category === category);
}
