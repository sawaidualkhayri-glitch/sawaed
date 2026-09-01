const DEFAULT_CONFIG = {
  splashEnabled: true,
  splashTitle: "سَـواعِـدُ الخَـيْـر",
  splashSubtitle: "منكم و إليكم",
  splashQuote: "من سلك طريقًا يلتمس فيه علمًا، سهل الله له به طريقًا إلى الجنة.",
  splashQuoteSource: "رواه صحيح مسلم",
  extraFields: [],
  grades: ["حادي عشر", "ثاني عشر (توجيهي)"],
  branches: ["علمي", "أدبي"],
  subjects: {
    "حادي عشر_علمي": ["اللغة العربية", "اللغة الإنجليزية", "الرياضيات", "التربية الإسلامية", "التكنولوجيا", "الفيزياء", "الكيمياء", "الأحياء"],
    "حادي عشر_أدبي": ["اللغة العربية", "اللغة الإنجليزية", "الرياضيات", "التربية الإسلامية", "التكنولوجيا", "الدراسات الجغرافية", "الدراسات التاريخية", "الثقافة العلمية"],
    "ثاني عشر (توجيهي)_علمي": ["اللغة العربية", "اللغة الإنجليزية", "الرياضيات", "التربية الإسلامية", "التكنولوجيا", "الفيزياء", "الكيمياء", "الأحياء"],
    "ثاني عشر (توجيهي)_أدبي": ["اللغة العربية", "اللغة الإنجليزية", "الرياضيات", "التربية الإسلامية", "التكنولوجيا", "الدراسات الجغرافية", "الدراسات التاريخية", "الثقافة العلمية"],
  },
  subjectIcons: {
    "اللغة العربية": "📖",
    "اللغة الإنجليزية": "🌍",
    "الرياضيات": "🔢",
    "التربية الإسلامية": "🕌",
    "التكنولوجيا": "💻",
    "الفيزياء": "⚛️",
    "الكيمياء": "🧪",
    "الأحياء": "🧬",
    "الدراسات الجغرافية": "🗺️",
    "الدراسات التاريخية": "📜",
    "الثقافة العلمية": "🔬"
  },
  folderStructure: {},
  subjectSections: ["الرزم", "الكتب", "حلول الكتب", "مواد تعليمية", "ملخصات", "أسئلة واختبارات سابقة", "اختبارات إلكترونية", "عروض تقديمية", "الدراسة للامتحانات", "قنوات يوتيوب شارحة"],
  foundationSubjects: ["لغة عربية", "لغة إنجليزية", "رياضيات", "فيزياء", "كيمياء", "أحياء"],
  foundationBranches: {
    "لغة عربية": ["علمي", "أدبي"],
    "لغة إنجليزية": ["علمي", "أدبي"],
    "رياضيات": ["علمي", "أدبي"],
    "فيزياء": [],
    "كيمياء": [],
    "أحياء": []
  },
  foundationTypes: {
    electronic: ["مباشر", "دروس مسجلة"],
    inPerson: ["غزة", "دير البلح", "النصيرات", "البريج", "المغازي", "خانيونس البلد", "المواصي"]
  },
  navPages: [
    { id: "home", label: "الرئيسية", icon: "🏠" },
    { id: "foundation", label: "التأسيس", icon: "📚" },
    { id: "news", label: "الأخبار", icon: "📰" },
    { id: "saved", label: "المحفوظات", icon: "⭐" },
    { id: "settings", label: "الإعدادات", icon: "⚙️" },
    { id: "storage", label: "التخزين", icon: "📥" },
  ],
  savedCategories: ["مميز بنجمة"],
  savedTypes: ["ملف من المواد", "روابط من أي مكان", "خبر من الأخبار", "ملفات من التأسيس"],
  contactLinks: [{ label: "تواصل معنا عبر واتساب", url: "https://whatsapp.com/channel/0029VbCYtmCKwqSKQllr5w3p", icon: "💬" }],
  motivationalQuotes: [],
  motivationalFixed: false,
  editors: [],
};

const LIGHT = {
  bg: "linear-gradient(160deg,#c8d8f0 0%,#dcd6f7 40%,#b8cfe8 70%,#e8e0f5 100%)",
  card: "rgba(255,255,255,0.6)",
  cardBorder: "rgba(255,255,255,0.85)",
  text: "#1a1a3e", subtext: "#4a4a7a",
  accent: "#5B52D4", accent2: "#8B82E8",
  navBg: "rgba(255,255,255,0.8)",
  inputBg: "rgba(255,255,255,0.75)",
  shadow: "0 8px 32px rgba(91,82,212,0.15)",
  sectionBg: "rgba(255,255,255,0.4)",
  danger: "#e55353",
};

const DARK = {
  bg: "linear-gradient(160deg,#0d1333 0%,#1a1040 40%,#0e1a3a 70%,#15103a 100%)",
  card: "rgba(255,255,255,0.08)",
  cardBorder: "rgba(255,255,255,0.15)",
  text: "#e8e8ff", subtext: "#9898cc",
  accent: "#7C73F5", accent2: "#a89af5",
  navBg: "rgba(15,10,40,0.9)",
  inputBg: "rgba(255,255,255,0.1)",
  shadow: "0 8px 32px rgba(0,0,0,0.4)",
  sectionBg: "rgba(255,255,255,0.05)",
  danger: "#ff6b6b",
};

const EMOJI = { "اللغة العربية": "📖", "اللغة الإنجليزية": "🌐", "الرياضيات": "📐", "التربية الإسلامية": "☪️", "التكنولوجيا": "💻", "الفيزياء": "⚛️", "الكيمياء": "🧪", "الأحياء": "🌿", "الدراسات الجغرافية": "🗺️", "الدراسات التاريخية": "🏛️", "الثقافة العلمية": "🔬", "لغة عربية": "📖", "لغة إنجليزية": "🌐", "فيزياء": "⚛️", "كيمياء": "🧪", "أحياء": "🌿" };

function ls(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    if (v === null || v === undefined) return fallback;
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

const navStack = [];

function pushNav(id) {
  navStack.push(id);
  window.history.pushState({ navId: id, stackLen: navStack.length }, "");
}

function popNav() {
  navStack.pop();
}

function resetNav() {
  navStack.length = 0;
  window.history.pushState({ sawaed: true }, "");
}

function sendLocalNotification(title, body) {
  if (Notification.permission !== "granted") return;
  const opts = { body, icon: "/icon-192.png", badge: "/icon-192.png", dir: "rtl", lang: "ar" };
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => reg.showNotification(title, opts));
  } else {
    new Notification(title, opts);
  }
}

function getMidnightKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function calcFlame() {
  const now = Date.now();
  const saved = ls("sawaed_flame_data", null);
  const todayKey = getMidnightKey();

  if (!saved) {
    const data = { streak: 1, lastKey: todayKey, lastOpenMs: now };
    lsSet("sawaed_flame_data", data);
    return data;
  }

  const msSinceLast = now - (saved.lastOpenMs || 0);
  const hoursSinceLast = msSinceLast / (1000 * 60 * 60);

  if (saved.lastKey === todayKey) {
    const updated = { ...saved, lastOpenMs: now };
    lsSet("sawaed_flame_data", updated);
    return updated;
  }

  if (hoursSinceLast >= 48) {
    const data = { streak: 1, lastKey: todayKey, lastOpenMs: now };
    lsSet("sawaed_flame_data", data);
    return data;
  }

  const data = { streak: (saved.streak || 1) + 1, lastKey: todayKey, lastOpenMs: now };
  lsSet("sawaed_flame_data", data);
  return data;
}

function initFlame() {
  const saved = ls("sawaed_flame_data", null);
  if (!saved) {
    const data = { streak: 1, lastKey: getMidnightKey(), lastOpenMs: Date.now() };
    lsSet("sawaed_flame_data", data);
    return 1;
  }
  const msSinceLast = Date.now() - (saved.lastOpenMs || 0);
  if (msSinceLast >= 48 * 60 * 60 * 1000) {
    const data = { streak: 1, lastKey: getMidnightKey(), lastOpenMs: Date.now() };
    lsSet("sawaed_flame_data", data);
    return 1;
  }
  return saved.streak || 1;
}

function ensurePwaAppName() {
  const APP_NAME = "سواعد الخير";
  try {
    document.title = APP_NAME;

    let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitle) {
      appleTitle = document.createElement("meta");
      appleTitle.setAttribute("name", "apple-mobile-web-app-title");
      document.head.appendChild(appleTitle);
    }
    appleTitle.setAttribute("content", APP_NAME);

    const existingLink = document.querySelector('link[rel="manifest"]');
    fetch(existingLink ? existingLink.href : "/manifest.json")
      .then(res => (res.ok ? res.json() : {}))
      .catch(() => ({}))
      .then(baseManifest => {
        const manifest = {
          ...baseManifest,
          name: APP_NAME,
          short_name: APP_NAME,
          lang: "ar",
          dir: "rtl",
        };
        const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
        const manifestURL = URL.createObjectURL(blob);
        let link = document.querySelector('link[rel="manifest"]');
        if (!link) {
          link = document.createElement("link");
          link.setAttribute("rel", "manifest");
          document.head.appendChild(link);
        }
        link.setAttribute("href", manifestURL);
      });
  } catch (err) {
    console.warn("[PWA] تعذر ضبط اسم التطبيق:", err);
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  ensurePwaAppName();
}

export {
  DEFAULT_CONFIG,
  LIGHT,
  DARK,
  EMOJI,
  ls,
  lsSet,
  navStack,
  pushNav,
  popNav,
  resetNav,
  sendLocalNotification,
  getMidnightKey,
  calcFlame,
  initFlame,
  ensurePwaAppName,
};
