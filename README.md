# منصة سواعد الخير التعليمية | Sawaed Al-Khair Platform

![React](https://img.shields.io/badge/React-18.x-blue?logo=react)
![Firebase](https://img.shields.io/badge/Firebase-Cloud-orange?logo=firebase)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)
![PWA](https://img.shields.io/badge/PWA-Offline%20First-5A0FC8)
![Vite](https://img.shields.io/badge/Vite-Latest-646CFF?logo=vite)
![Status](https://img.shields.io/badge/Status-Production-brightgreen)
![License](https://img.shields.io/badge/License-Proprietary-red)

---

## 📋 جدول المحتويات | Table of Contents

- [نظرة عامة | Project Overview](#نظرة-عامة--project-overview)
- [الآليات المعمارية الأساسية | Core Architectural Mechanisms](#الآليات-المعمارية-الأساسية--core-architectural-mechanisms)
- [هيكل المشروع | Project Structure](#هيكل-المشروع--project-structure)
- [مكدس التكنولوجيا | Technology Stack](#مكدس-التكنولوجيا--technology-stack)
- [الإعداد والتكوين | Environment Setup](#الإعداد-والتكوين--environment-setup)
- [معايير الأمان | Security & Data Safety](#معايير-الأمان--security--data-safety)
- [الميزات الرئيسية | Key Features](#الميزات-الرئيسية--key-features)
- [الدعم والمساهمة | Support & Contribution](#الدعم-والمساهمة--support--contribution)

---

## نظرة عامة | Project Overview

**Sawaed Al-Khair** هي منصة تعليمية تفاعلية شاملة مصممة لتوفير تجربة تعليمية سلسة وآمنة. المنصة توفر للطلاب إمكانية الوصول إلى:

- 📚 **مواد دراسية شاملة** - كتب، ملخصات، وحلول كاملة
- 📄 **عارض مستندات متقدم** - عرض PDFs مع دعم كامل للوضع الأوفلاين
- 🎓 **أدوات التعليم التفاعلية** - اختبارات، أسئلة سابقة، وعروض تقديمية
- 📱 **تطبيق ويب متقدم (PWA)** - يعمل بكفاءة عالية أوفلاين وأونلاين
- 👥 **إدارة أدوار شاملة** - نظام صلاحيات متطور للمحررين والمسؤولين
- 🔔 **إشعارات فورية** - تحديثات حقيقية عبر Firebase Cloud Messaging

**Mission:** تمكين الطلاب الأردنيين (خاصة الثانوية العامة / التوجيهي) بأدوات تعليمية حديثة وموثوقة مع ضمان استمرارية الوصول حتى بدون اتصال إنترنت.

---

## الآليات المعمارية الأساسية | Core Architectural Mechanisms

### 1. 🗂️ محرك التخزين المحلي والتخزين المؤقت | Offline-First & Local Caching Engine

**IndexedDB Storage System:**
- جميع المستندات والملفات تُخزن محليًا في `IndexedDB` (قاعدة بيانات متقدمة في المتصفح)
- كل ملف يُخزن مع البيانات الوصفية:
  - نوع MIME الفعلي من رأس الخادم (`Content-Type`)
  - بيانات تعريفية (العنوان، الوصف، معرّف الملف)
  - طابع زمني للتتبع والحذف التلقائي

```javascript
// مثال على بنية التخزين
{
  id: "offline_file_12345",
  blob: Blob,                    // الملف الثنائي الفعلي
  type: "application/pdf",       // نوع MIME من الخادم
  title: "الرياضيات - الفصل الأول",
  savedAt: 1692345600000,
  size: 2048576
}
```

**Service Worker (SW.js):**
- يعمل كطبقة وسيطة بين التطبيق والشبكة
- يوفر استراتيجية **Cache-First** للملفات الثابتة
- يدعم **Network-First** للبيانات الديناميكية
- يعيد توجيه الطلبات تلقائيًا عند انقطاع الإنترنت

### 2. 🎬 محرك العرض الهجين للمستندات والـ PDF | Hybrid Document & PDF Viewer Engine

**معمارية العرض متعددة الطبقات:**

```
┌─────────────────────────────────────────┐
│  User Action: "Open PDF" Button Click   │
└──────────────┬──────────────────────────┘
               │
        ┌──────▼──────┐
        │ Check Cache │ ◄── IndexedDB
        └──────┬──────┘
               │
         ┌─────▼─────┐
         │Is Offline?│
         └─────┬─────┘
           Yes │No
         ┌─────▼─────┐         ┌──────────────────┐
         │ Use Blob  │         │Fetch from Server │
         │ Directly  │         └────────┬─────────┘
         └─────┬─────┘                  │
               │          ┌────────────┬▼──────────────┐
               │          │ Try Options in Order:     │
               │          ├────────────────────────────┤
               │          │ 1. Cloudflare Worker Proxy│
               │          │ 2. Direct URL             │
               │          │ 3. Google Drive Proxy     │
               │          │ 4. AllOrigins API        │
               │          └────────┬───────────────────┘
               │                   │
               │          ┌────────▼──────────┐
               │          │Success? Create   │
               │          │Object URL (blob:)│
               │          └────────┬──────────┘
               │                   │
        ┌──────▼────────────────────▼─────┐
        │      Render PDF Viewer          │
        │  (react-pdf + pdf.js)           │
        └─────────────────────────────────┘
               │
        ┌──────▼─────────────────────┐
        │Fallback on 403/Error:      │
        │ → Google Drive Embedded    │
        │   Preview (<iframe>)       │
        └────────────────────────────┘
```

**تفاصيل محرك العرض:**

| Layer | Component | Purpose |
|-------|-----------|---------|
| **Presentation** | `PDFViewer.jsx` | عرض صفحات PDF بشكل تفاعلي مع تمرير سلس |
| **Binary Fetch** | `fetchBinaryBlob()` | استخراج بيانات الملف الثنائية بدقة عالية |
| **Proxy Layer** | Cloudflare Workers | تجاوز قيود CORS والمصادقة عند الوصول للملفات المحمية |
| **Fallback** | Google Drive Preview | عرض embedded iframe للملفات المحمية أو التي يتعذر تنزيلها |
| **Storage** | IndexedDB + Service Worker | حفظ محلي دائم مع سياسة تنظيف تلقائية |

**MIME Type Detection & Routing:**
```javascript
// أولويات كشف نوع الملف:
1. blob.type (من رأس Content-Type الفعلي)
2. savedRecord.type (من بيانات التخزين المحلية)
3. getFileMimeType(item, blob) (التخمين من الامتداد)
4. "application/pdf" (الافتراضي)

// التوجيه الذكي:
if (mimeType.includes("pdf")) → <PDFViewer />
else if (mimeType.includes("image")) → <ImageViewer />
else → <IframeViewer /> (محرر عام)
```

### 3. 🔐 المصادقة والتحكم بالأدوار | Authentication & RBAC

**Firebase Authentication Pipeline:**
```
┌─────────────────────────────────────┐
│   User Login Form (Email/Password)  │
└─────────────────┬───────────────────┘
                  │
          ┌───────▼────────┐
          │ Validate Input │
          └───────┬────────┘
                  │
      ┌───────────▼──────────────┐
      │ Firebase Auth.signIn()   │
      └───────────┬──────────────┘
                  │
          ┌───────▼────────────┐
          │Session Stored in   │
          │ AuthContext        │
          └───────┬────────────┘
                  │
      ┌───────────▼──────────────┐
      │ Fetch User Profile       │
      │ from Firestore           │
      └───────────┬──────────────┘
                  │
          ┌───────▼──────────┐
          │ Normalize Role   │
          │ & Permissions    │
          └─────────────────┘
```

**Role Normalization Matrix:**
| Role String | Canonical | Permissions |
|-------------|-----------|------------|
| `user` / `null` | `user` | View only - قراءة المحتوى |
| `editor`, `admin` | `editor` | Edit folders & files - تعديل المحتوى |
| `admin` | `admin` | Full system access - إدارة كاملة |
| `malazem` | `malazem` | Approve content - الموافقة على المحتوى |

### 4. 🔔 خط أنابيب الإشعارات | Push Notification Pipeline

**Firebase Cloud Messaging (FCM) Flow:**

```
┌─────────────────────────────────────┐
│  User Visits Platform First Time    │
└──────────────┬──────────────────────┘
               │
        ┌──────▼──────────┐
        │Request Notification
        │Permission from OS │
        └──────┬───────────┘
               │
        ┌──────▼──────────────┐
        │If User Allows:      │
        │generateToken()      │
        └──────┬──────────────┘
               │
    ┌──────────▼──────────────┐
    │Firebase Cloud Messaging│
    │Returns Unique FCM Token│
    └──────────┬──────────────┘
               │
    ┌──────────▼──────────────┐
    │Save Token to Firestore  │
    │Sync with User Profile   │
    └──────────┬──────────────┘
               │
    ┌──────────▼──────────────┐
    │Service Worker Listens   │
    │onMessage(firebaseMsg)   │
    └─────────────────────────┘
```

**Message Handling:**
- `onMessage()` في `firebase.js` يستقبل الرسائل الفورية
- يتم تحديث الواجهة تلقائيًا في الخلفية
- المستخدم يرى إشعار نظام التشغيل بالفور

---

## هيكل المشروع | Project Structure

```
sawaed/
├── 📁 public/                        # Static Assets & PWA Config
│   ├── manifest.json                 # PWA Manifest (app metadata)
│   ├── _headers                      # Netlify/CF Headers Config
│   ├── _redirects                    # URL Rewrites & Routing
│   ├── firebase-messaging-sw.js      # FCM Service Worker
│   ├── sw.js                         # Main Service Worker
│   └── pdf.worker.min.js             # PDF.js Web Worker
│
├── 📁 src/                           # Application Source Code
│   ├── 📁 assets/                    # Images, Icons, Media
│   │   └── [brand assets]
│   │
│   ├── App.jsx                       # Main Application Component
│   │   ├── Authentication & Routes
│   │   ├── Offline File Management
│   │   ├── PDF Viewer Integration
│   │   ├── Admin Panels
│   │   └── Folder/Section Navigation
│   │
│   ├── App.css                       # Global Styles
│   ├── index.css                     # Base Styles
│   ├── main.jsx                      # React Entry Point
│   │
│   ├── 📁 Services/
│   │   ├── firebase.js               # Firebase Initialization
│   │   ├── firebaseAuth.js           # Auth Methods (Email/Google)
│   │   ├── firebaseConfig.js         # Config & Credentials
│   │   ├── firestoreService.js       # Firestore CRUD Operations
│   │   └── offlineHandler.js         # IndexedDB & SW Management
│   │
│   ├── 📁 Context/
│   │   └── AuthContext.jsx           # User State & Auth Hooks
│   │
│   ├── 📁 Components/
│   │   ├── FileCard.jsx              # File Display Component
│   │   ├── PDFViewer.jsx             # PDF Rendering (react-pdf)
│   │   ├── AuthContext.jsx           # Provider Component
│   │   └── [Additional UI Components]
│   │
│   ├── constants.js                  # App Constants & Enums
│   └── config.js                     # Environment & API Config
│
├── vite.config.js                    # Vite Build Configuration
├── eslint.config.js                  # Code Linting Rules
├── package.json                      # Dependencies & Scripts
├── netlify.toml                      # Netlify Deployment Config
├── index.html                        # HTML Entry Point
└── README.md                         # This File

📁 reports/ (Internal Use Only - Not Deployed)
├── AUDIT_COMPLETION_MANIFEST.md
├── CODE_AUDIT_COMPLETION_REPORT.md
└── [Compliance Documentation]
```

---

## مكدس التكنولوجيا | Technology Stack

### 🎨 Frontend UI & Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.x | UI Framework - بناء الواجهات التفاعلية |
| **Vite** | Latest | Build Tool - تجميع الكود بسرعة عالية |
| **CSS3** | Modern | Styling - تصميم الواجهات المتقدمة |
| **Cairo Font** | RTL | Arabic Typography - دعم الكتابة العربية |
| **canvas-confetti** | Latest | Animation - تأثيرات بصرية احتفالية |

### 🗄️ Backend Services & Database
| Service | Component | Purpose |
|---------|-----------|---------|
| **Firebase Authentication** | firebaseAuth.js | المصادقة والجلسات - Email, Google Sign-In |
| **Firebase Firestore** | firestoreService.js | قاعدة البيانات السحابية - المستندات والمجلدات |
| **Firebase Cloud Messaging** | firebase.js | الإشعارات الفورية - Push Notifications |
| **Firebase Analytics** | firebase.js | تتبع السلوك - User Behavior Analytics |
| **Firebase Storage** | firebase.js | تخزين الملفات - File Upload/Download |

### 🌐 Edge Proxy & CDN
| Technology | Purpose | Config |
|------------|---------|--------|
| **Cloudflare Workers** | Edge Proxy للملفات المحمية - Bypass CORS & Auth |
| **Cloudflare Analytics** | قياس الأداء - Performance Metrics |
| **Netlify** | استضافة الويب والنشر - Web Hosting & Deployment |

### 💾 Local Storage & Caching
| Technology | Purpose | Use Case |
|------------|---------|----------|
| **IndexedDB** | قاعدة بيانات محلية - Local File Storage |
| **Service Worker** | تخزين مؤقت والعمل الأوفلاين - Offline Functionality |
| **LocalStorage** | تخزين الحالة البسيطة - User Preferences |
| **Browser Cache API** | تخزين مؤقت للموارد - Static Assets |

### 📄 PDF & Document Handling
| Tool | Component | Purpose |
|------|-----------|---------|
| **react-pdf** | PDFViewer.jsx | عرض PDFs - PDF Rendering |
| **pdf.js** | pdf.worker.min.js | محرك PDF - PDF Processing Engine |
| **Google Drive API** | Fallback Viewer | عرض embedded للملفات المحمية |

---

## الإعداد والتكوين | Environment Setup

### المتطلبات الأساسية | Prerequisites
```bash
Node.js >= 16.x
npm >= 8.x (or yarn >= 3.x)
```

### التثبيت والتشغيل | Installation

```bash
# 1. استنساخ المستودع | Clone Repository
git clone <repository-url>
cd sawaed

# 2. تثبيت الاعتماديات | Install Dependencies
npm install

# 3. إنشاء ملف البيئة | Create Environment File
cp .env.example .env.local

# 4. تعديل المتغيرات (انظر القسم أدناه)
# Edit .env.local with your Firebase & Cloudflare credentials

# 5. تشغيل خادم التطوير | Start Development Server
npm run dev

# التطبيق يفتح على: http://localhost:5173
```

### ملف البيئة | .env.example

```env
# ══════════════════════════════════════════════════════════
# Firebase Configuration (من Firebase Console)
# ══════════════════════════════════════════════════════════
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# ══════════════════════════════════════════════════════════
# Cloudflare Workers Configuration
# استخدم للوصول الآمن للملفات المحمية
# ══════════════════════════════════════════════════════════
VITE_CLOUDFLARE_WORKER_BASE_URL=https://<YOUR_WORKER_SUBDOMAIN>.workers.dev

# ══════════════════════════════════════════════════════════
# Application Mode
# ══════════════════════════════════════════════════════════
VITE_APP_MODE=production  # أو development

# ══════════════════════════════════════════════════════════
# Feature Flags (Optional)
# ══════════════════════════════════════════════════════════
VITE_ENABLE_OFFLINE_MODE=true
VITE_ENABLE_NOTIFICATIONS=true
VITE_ENABLE_ANALYTICS=true
```

### البناء والنشر | Build & Deploy

```bash
# بناء الإصدار الإنتاجي | Build for Production
npm run build

# التحقق من النسخة المبنية | Preview Production Build
npm run preview

# نشر على Netlify | Deploy to Netlify
netlify deploy --prod
```

---

## معايير الأمان | Security & Data Safety

### 🔒 حماية البيانات الحساسة | Sensitive Data Protection

#### 1. **عدم الكشف عن مفاتيح API**
- ✅ جميع المفاتيح الحساسة تُخزن في متغيرات البيئة (`.env`)
- ✅ المتغيرات البادئة بـ `VITE_` تُضمّن آمنة في الكود (معروفة للعميل)
- ✅ المتغيرات الحساسة الأخرى تبقى في الخادم فقط
- ❌ **لا تُضع مفاتيح مباشرة في الكود أو Git**

#### 2. **Firebase Security Rules**
```javascript
// Firestore Access Control
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // فقط المستخدمون المصرح لهم يمكنهم الوصول
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // المحررون فقط يمكنهم تعديل المحتوى
    match /folder_items/{document=**} {
      allow read: if request.auth != null;
      allow write: if hasRole(['editor', 'admin']);
    }
  }
}
```

### 🌐 معالجة CORS والوصول الآمن | CORS & Secure Access

**المشكلة:**
- بعض الملفات (Google Drive, Protected PDFs) محمية بـ CORS
- الوصول المباشر من المتصفح قد يُرجع خطأ 403/CORS Block

**الحل - Cloudflare Workers Proxy:**
```javascript
// Cloudflare Worker Script
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // التحقق من المصادقة
  const token = request.headers.get('Authorization')
  if (!isValidToken(token)) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  // إعادة توجيه الطلب مع رؤوس محدّثة
  const newRequest = new Request(request, {
    headers: {
      ...request.headers,
      'User-Agent': 'Mozilla/5.0...' // تجاوز قيود User-Agent
    }
  })
  
  return fetch(newRequest)
}
```

### 📱 حماية البيانات المحلية | Local Data Protection

#### IndexedDB Security:
```javascript
// عند حفظ ملف
const idbSaveFile = async (id, blob, meta) => {
  // 1. التحقق من نوع الملف
  if (!isValidMimeType(blob.type)) {
    throw new Error("Invalid file type");
  }
  
  // 2. التحقق من حجم الملف (منع الامتلاء)
  if (blob.size > 500 * 1024 * 1024) { // 500 MB max
    throw new Error("File too large");
  }
  
  // 3. تخزين آمن
  const store = tx.objectStore("files");
  store.put({
    id,
    blob,
    ...meta,
    encryptionKey: null // للمستقبل
  });
}
```

#### Service Worker Security:
- ✅ يعمل فقط على HTTPS (في الإنتاج)
- ✅ عزل الكود - لا يمكن الوصول لـ DOM مباشرة
- ✅ سياسة CSP (Content Security Policy) صارمة

### 🔑 إدارة الأدوار والصلاحيات | Role & Permission Management

```javascript
// نموذج التحكم بالوصول
const ROLE_PERMISSIONS = {
  user: ['view_content'],
  editor: ['view_content', 'edit_folders', 'add_files', 'delete_files'],
  admin: ['view_content', 'edit_folders', 'add_files', 'delete_files', 
          'manage_users', 'manage_roles', 'view_analytics'],
  malazem: ['view_content', 'approve_content']
}

// التحقق قبل أي عملية
const canEditFolder = (user, action) => {
  const userRole = normalizeUserRole(user.role);
  return ROLE_PERMISSIONS[userRole]?.includes(action) ?? false;
}
```

---

## الميزات الرئيسية | Key Features

### 📚 المكتبة الرقمية | Digital Library
- ✅ عرض منظم للمواد حسب الصفوف والفروع والفصول الدراسية
- ✅ دعم كامل للملفات: PDFs, صور, وثائق
- ✅ محرك بحث سريع عن المحتوى
- ✅ تقييمات والتقييمات من المستخدمين

### 📖 عارض المستندات المتقدم | Advanced Document Viewer
- ✅ عرض فوري للـ PDFs مع تكبير/تصغير
- ✅ دعم الوضع الليلي (Dark Mode)
- ✅ ملاحظات وتعليقات توضيحية
- ✅ تنزيل آمن للملفات

### 📱 تطبيق ويب متقدم (PWA) | Progressive Web App
- ✅ يعمل بدون إنترنت - Offline First
- ✅ تثبيت كتطبيق على الهاتف والحاسوب
- ✅ مزامنة تلقائية عند العودة للإنترنت
- ✅ إشعارات فورية Push Notifications

### 👥 نظام الإدارة الشامل | Admin Management System
- ✅ لوحة تحكم متقدمة للمحررين والإداريين
- ✅ إدارة المستخدمين والأدوار والصلاحيات
- ✅ تحميل الملفات بكميات كبيرة (Bulk Upload)
- ✅ تحليلات وتقارير الاستخدام
- ✅ إدارة المواد والأقسام الدراسية

### 🔔 الإشعارات الذكية | Smart Notifications
- ✅ إشعارات بالتحديثات الجديدة
- ✅ تذكيرات بالاختبارات والمواعيد
- ✅ رسائل مخصصة حسب الدور والاهتمامات

---

## الدعم والمساهمة | Support & Contribution

### الإبلاغ عن الأخطاء | Bug Reports
```
التفاصيل المطلوبة:
1. وصف واضح للمشكلة
2. الخطوات المؤدية للمشكلة
3. السلوك المتوقع vs الفعلي
4. معلومات النظام (OS, Browser, Device)
5. لقطات شاشة أو فيديو (إن أمكن)
```

### الميزات المطلوبة | Feature Requests
```
قالب الطلب:
1. العنوان: واضح وموجز
2. الوصف: شرح تفصيلي للميزة
3. الفائدة: لماذا هذه الميزة مهمة؟
4. الحالات الاستخدام: أمثلة عملية
```

### الاتصال والدعم | Contact & Support
- 📧 البريد الإلكتروني: support@sawaed.example
- 💬 الدعم الفني: support.sawaed.example
- 🐛 متابعة الأخطاء: GitHub Issues
- 📱 تطبيق الدعم: في-التطبيق Chat Widget

---

## معلومات إضافية | Additional Information

### الامتثال والخصوصية | Compliance & Privacy
- ✅ **GDPR Compliant** - حماية بيانات المستخدمين
- ✅ **Local Data Storage** - البيانات تُخزن محليًا على الجهاز
- ✅ **Encryption in Transit** - HTTPS لكل الاتصالات
- ✅ **Privacy Policy**: [Link to Privacy Policy]
- ✅ **Terms of Service**: [Link to Terms]

### الترخيص | License
هذا المشروع مرخص تحت رخصة proprietary. جميع الحقوق محفوظة.

### الشكر والتقدير | Credits
- بيانات المنهاج الأردني من وزارة التربية والتعليم
- رموز وصور من مكتبات مفتوحة المصدر
- المجتمع الأردني للتطوير والتكنولوجيا

### تاريخ الإصدار | Release History
- **v2.0.0** (Current) - اسم البناء الحالي
- **v1.9.x** - الإصدارات السابقة المستقرة
- [تاريخ النسخ الكامل متاح في CHANGELOG.md]

---

**آخر تحديث | Last Updated:** 2026-08-24  
**الحالة | Status:** ✅ Production Live  
**الدعم | Support Level:** Enterprise Grade