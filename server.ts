/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc } from "firebase/firestore";

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "database.json");
const BACKUP_FILE = path.join(process.cwd(), "database_backup.json");

app.use(express.json());

// Simple Hashing Helper using native crypto
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "coreward-salt-2026").digest("hex");
}

// Safe header decoding helper to support Arabic and other UTF-8 text safely
function safeDecodeHeader(val: string | undefined): string {
  if (!val) return "";
  try {
    return decodeURIComponent(val);
  } catch (e) {
    return val;
  }
}

// Ensure database.json exists with initial data
function initializeDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    const defaultAdminPasswordHash = hashPassword("admin123");
    const defaultMaryAndPasswordHash = hashPassword("mary123");
    const defaultKhalidPasswordHash = hashPassword("khalid123");

    const initialData = {
      users: [
        { id: "u-admin", name: "د. أحمد المنصوري", email: "admin@ward.com", role: "Director", password: defaultAdminPasswordHash },
        { id: "u-maryam", name: "د. مريم العتيبي", email: "maryam@ward.com", role: "Specialist", password: defaultMaryAndPasswordHash },
        { id: "u-khalid", name: "د. خالد الحربي", email: "khalid@ward.com", role: "Intern", password: defaultKhalidPasswordHash }
      ],
      patients: [
        {
          id: "p-1",
          name: "يوسف عبد الله السديري",
          age: "٨ أشهر",
          gender: "male",
          bedNumber: "A1",
          status: "critical",
          admissionDate: "2026-07-13",
          assignedInternId: "u-khalid",
          assignedInternName: "د. خالد الحربي",
          symptoms: "صعوبة في التنفس، سعال ديكي شديد، زرقة حول الفم عند السعال",
          diagnosis: "التهاب القصبات الهوائية الحاد (Acute Bronchiolitis)",
          allergies: "لا يوجد حساسية معروفة",
          pastHistory: "ولادة مبكرة في الأسبوع ٣٥، لا يوجد عمليات سابقة",
          vitalsHistory: [
            {
              timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
              temp: 38.8,
              heartRate: 142,
              respRate: 58,
              systolicBp: 88,
              diastolicBp: 54,
              spo2: 91,
              author: "د. خالد الحربي"
            },
            {
              timestamp: new Date(Date.now() - 1 * 3600000).toISOString(),
              temp: 38.4,
              heartRate: 135,
              respRate: 52,
              systolicBp: 90,
              diastolicBp: 56,
              spo2: 93,
              author: "د. أحمد المنصوري"
            }
          ],
          growthHistory: [
            { ageMonths: 8, weightKg: 7.2 }
          ],
          medications: [
            { id: "m-1", name: "Ventolin Nebulizer", dosage: "1.25 mg", frequency: "كل ٤ ساعات", status: "active" },
            { id: "m-2", name: "Paracetamol Drops", dosage: "100 mg", frequency: "عند الحاجة كل ٦ ساعات", status: "active" }
          ],
          soapHistory: [
            {
              id: "s-1",
              timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
              author: "د. خالد الحربي",
              role: "Intern",
              s: "الرضيع لا يرضع بشكل جيد، يبكي باستمرار عند السعال، وصعوبة واضحة في التنفس.",
              o: "معدل التنفس ٥٨، وجود سحب وربي (subcostal retractions)، تشبع الأكسجين ٩١٪ على هواء الغرفة.",
              a: "التهاب قصبات حاد مع ضائقة تنفسية متوسطة إلى شديدة.",
              p: "البدء بجلسات فنتولين، مراقبة مستمرة للعلامات الحيوية وتشبع الأكسجين، تزويده بأكسجين رطب عبر قنية أنفية (1 L/min)."
            }
          ],
          dischargeChecklist: [
            { id: "dc-1", item: "استقرار العلامات الحيوية وتشبع الأكسجين > ٩٤٪ على هواء الغرفة لمدة ٢٤ ساعة متواصلة", completed: false },
            { id: "dc-2", item: "الرضاعة والتغذية الفموية كافية ولا تسبب إرهاق تنفسي", completed: false },
            { id: "dc-3", item: "عدم وجود صعوبة أو سحب تنفسي وربي", completed: false },
            { id: "dc-4", item: "تدريب الوالدين على استخدام البخاخ والمراقبة المنزلية ورصد علامات الخطر", completed: false },
            { id: "dc-5", item: "تحديد موعد المتابعة في العيادة الخارجية وتوقيع ملخص الخروج", completed: false }
          ],
          updatedAt: Date.now()
        },
        {
          id: "p-2",
          name: "ليان فهد المطيري",
          age: "٤ سنوات",
          gender: "female",
          bedNumber: "B3",
          status: "stable",
          admissionDate: "2026-07-14",
          assignedInternId: "u-khalid",
          assignedInternName: "د. خالد الحربي",
          symptoms: "حمى مرتفعة، قيء متكرر، ألم في أسفل البطن جهة اليمين",
          diagnosis: "اشتباه التهاب الزائدة الدودية (Suspected Appendicitis)",
          allergies: "البنسلين (Penicillin)",
          pastHistory: "استئصال اللوزتين في عام ٢٠٢٥",
          vitalsHistory: [
            {
              timestamp: new Date(Date.now() - 6 * 3600000).toISOString(),
              temp: 39.1,
              heartRate: 110,
              respRate: 24,
              systolicBp: 95,
              diastolicBp: 60,
              spo2: 98,
              author: "د. مريم العتيبي"
            }
          ],
          growthHistory: [
            { ageMonths: 48, weightKg: 15.8 }
          ],
          medications: [
            { id: "m-3", name: "IV Fluids (D5 1/2 NS)", dosage: "60 ml/hr", frequency: "مستمر", status: "active" },
            { id: "m-4", name: "Paracetamol IV", dosage: "220 mg", frequency: "كل ٦ ساعات بانتظام", status: "active" }
          ],
          soapHistory: [
            {
              id: "s-2",
              timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
              author: "د. مريم العتيبي",
              role: "Specialist",
              s: "الطفلة تشتكي من ألم في البطن يزداد عند الحركة، قيأت مرتين اليوم.",
              o: "ألم عند الضغط في الربع السفلي الأيمن مع علامة ريباوند خفيفة. البطن لينة.",
              a: "اشتباه التهاب زائدة دودية حاد، مستقرة سريرياً حالياً.",
              p: "إبقاء المريضة صائمة (NPO)، إجراء تحليل دم شامل وسونار للبطن، استشارة طبيب جراحة الأطفال المناوب."
            }
          ],
          dischargeChecklist: [
            { id: "dc2-1", item: "العلامات الحيوية طبيعية والحرارة مستقرة بدون خافضات", completed: true },
            { id: "dc2-2", item: "زوال القيء والقدرة على شرب السوائل فموياً", completed: true },
            { id: "dc2-3", item: "تقرير السونار سلبي أو استبعاد الجراحة من قبل الفريق الجراحي", completed: false },
            { id: "dc2-4", item: "تثقيف الأهل حول علامات الخطر البطنية", completed: false },
            { id: "dc2-5", item: "كتابة ملخص الخروج وجدول المتابعة", completed: false }
          ],
          updatedAt: Date.now()
        }
      ],
      tasks: [
        {
          id: "t-1",
          patientId: "p-1",
          patientName: "يوسف عبد الله السديري",
          description: "مراجعة غازات الدم الشرياني وتعديل مستوى الأكسجين رطب",
          assigneeRole: "Intern",
          priority: "high",
          dueDate: new Date().toISOString().split("T")[0],
          dueTime: "10:30",
          completed: false,
          updatedAt: Date.now()
        },
        {
          id: "t-2",
          patientId: "p-2",
          patientName: "ليان فهد المطيري",
          description: "التنسيق مع قسم الأشعة لإجراء السونار بشكل عاجل واستلام النتيجة",
          assigneeRole: "Specialist",
          priority: "high",
          dueDate: new Date().toISOString().split("T")[0],
          dueTime: "09:15",
          completed: false,
          updatedAt: Date.now()
        }
      ],
      handovers: [
        {
          id: "h-1",
          patientId: "p-1",
          patientName: "يوسف عبد الله السديري",
          timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
          senderName: "د. خالد الحربي",
          senderRole: "Intern",
          situation: "الطفل منوم بالتهاب قصبات حاد، يعاني من ضائقة تنفسية وزيادة في المجهود التنفسي.",
          background: "ولادة مبكرة، منوم منذ الأمس، كان على هواء الغرفة والآن يحتاج لأكسجين رطب.",
          assessment: "معدل التنفس مرتفع (٥٢)، تشبع الأكسجين يتحسن مع الأكسجين (٩٣٪)، لكن لا يزال مجهداً.",
          recommendation: "يرجى مراقبة التنفس كل ساعة وإعادة غازات الدم عند الظهر في حال عدم التحسن السريري.",
          isUrgent: true,
          updatedAt: Date.now()
        }
      ],
      clinicSlots: [
        { id: "cs-1", time: "09:00", patientName: "سليمان يحيى الزهراني", age: "٥ سنوات", reason: "متابعة الربو القصبي وإعادة تعبئة الأدوية", status: "waiting", updatedAt: Date.now() },
        { id: "cs-2", time: "10:00", patientName: "فاطمة أحمد باوزير", age: "١٨ شهراً", reason: "استشارة بخصوص عدم كفاية الوزن والرضاعة", status: "waiting", updatedAt: Date.now() }
      ],
      chatMessages: [
        { id: "msg-1", senderName: "د. أحمد المنصوري", senderRole: "Director", timestamp: new Date(Date.now() - 12 * 3600000).toISOString(), text: "السلام عليكم جميعاً، يرجى التكرم بالمرور الصباحي باكراً اليوم لمناقشة الحالات الحرجة." },
        { id: "msg-2", senderName: "د. مريم العتيبي", senderRole: "Specialist", timestamp: new Date(Date.now() - 11 * 3600000).toISOString(), text: "وعليكم السلام يا دكتور. سنبدأ بالمرور من الجناح (أ) حالاً." }
      ],
      auditLog: [
        { id: "a-1", timestamp: new Date(Date.now() - 24 * 3600000).toISOString(), userId: "u-admin", userName: "د. أحمد المنصوري", userRole: "Director", action: "تهيئة النظام", details: "تم تشغيل نظام CoreWard بنجاح وتأسيس الحسابات الافتراضية." }
      ],
      alerts: [
        { id: "al-1", timestamp: new Date().toISOString(), title: "حالة حرجة بحاجة لمتابعة", message: "المريض يوسف عبد الله السديري في السرير A1 يعاني من انخفاض تشبع الأكسجين.", targetRole: "all", targetUserId: "all", type: "urgent", read: false }
      ]
    };

    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(initialData, null, 2));
    console.log("Database and backup files initialized with sample pediatric data.");
  }
}

initializeDatabase();

// --- Firebase Firestore Initialization & Sync ---
let firebaseApp: any = null;
let firestoreDb: any = null;

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    firebaseApp = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    });
    if (config.firestoreDatabaseId) {
      firestoreDb = initializeFirestore(firebaseApp, {
        experimentalForceLongPolling: true
      }, config.firestoreDatabaseId);
    } else {
      firestoreDb = initializeFirestore(firebaseApp, {
        experimentalForceLongPolling: true
      });
    }
    console.log("Firebase initialized successfully on server with projectId:", config.projectId);
  } else {
    console.warn("firebase-applet-config.json not found. Operating with local filesystem database.");
  }
} catch (error) {
  console.error("Failed to initialize Firebase:", error);
}

// Background Task to mirror local updates to Firestore
async function saveToFirestore(db: any) {
  if (!firestoreDb) return;
  try {
    const collectionsToSync = ["users", "patients", "tasks", "handovers", "clinicSlots", "chatMessages", "auditLog", "alerts", "units", "rolePermissions"];
    for (const colName of collectionsToSync) {
      const items = db[colName] || [];
      const colRef = collection(firestoreDb, colName);
      const querySnapshot = await getDocs(colRef);
      
      const existingIds = new Set<string>();
      querySnapshot.forEach(doc => existingIds.add(doc.id));

      const currentIds = new Set(items.map((item: any) => item.id).filter(Boolean));

      // 1. Delete items that were removed locally
      for (const id of existingIds) {
        if (!currentIds.has(id)) {
          const docRef = doc(firestoreDb, colName, id);
          await deleteDoc(docRef);
        }
      }

      // 2. Add or update items
      for (const item of items) {
        const { id, ...data } = item;
        if (id) {
          const docRef = doc(firestoreDb, colName, id);
          await setDoc(docRef, data);
        }
      }
    }
    console.log("Successfully synchronized and persisted all database updates to Cloud Firestore.");
  } catch (error) {
    console.error("Failed to write updates to Cloud Firestore:", error);
  }
}

// Synchronize memory and local cache file with Cloud Firestore on startup
async function syncDatabaseWithFirestore() {
  if (!firestoreDb) return;
  console.log("Synchronizing local cache file with Cloud Firestore...");

  const collectionsToSync = ["users", "patients", "tasks", "handovers", "clinicSlots", "chatMessages", "auditLog", "alerts", "units", "rolePermissions"];
  const dbData: any = {};

  try {
    for (const colName of collectionsToSync) {
      const colRef = collection(firestoreDb, colName);
      const querySnapshot = await getDocs(colRef);
      dbData[colName] = [];
      querySnapshot.forEach((doc) => {
        dbData[colName].push({ id: doc.id, ...doc.data() });
      });
    }

    const isFirestoreEmpty = collectionsToSync.every(col => !dbData[col] || dbData[col].length === 0);
    if (isFirestoreEmpty) {
      console.log("Firestore is empty. Seeding Cloud Firestore with default clinical pediatric data...");
      initializeDatabase();
      const localData = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      
      for (const colName of collectionsToSync) {
        const items = localData[colName] || [];
        for (const item of items) {
          const { id, ...data } = item;
          if (id) {
            const docRef = doc(firestoreDb, colName, id);
            await setDoc(docRef, data);
          }
        }
      }
      console.log("Cloud Firestore successfully seeded with high-quality pediatric data.");
      return;
    }

    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(dbData, null, 2));
    console.log("Local database cache successfully loaded from Cloud Firestore.");
  } catch (error) {
    console.error("Error during Firestore sync on startup:", error);
  }
}

// Periodic Backup (Every 6 hours simulation or trigger)
setInterval(() => {
  try {
    if (fs.existsSync(DB_FILE)) {
      const dbContent = fs.readFileSync(DB_FILE, "utf-8");
      fs.writeFileSync(BACKUP_FILE, dbContent);
      console.log("Automated 6-hour database backup saved successfully.");
    }
  } catch (error) {
    console.error("Backup failed:", error);
  }
}, 6 * 3600 * 1000);

// Helper to read DB
function readDB() {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    
    // Auto-inject missing structural default fields
    let changed = false;
    if (!data.units || !Array.isArray(data.units) || data.units.length === 0) {
      data.units = [
        { id: "unit-peds", name: "Pediatric Unit (قسم الأطفال)" },
        { id: "unit-cardio", name: "Cardiology Unit (قسم القلب)" },
        { id: "unit-icu", name: "ICU (العناية المركزة)" }
      ];
      changed = true;
    }
    if (!data.rolePermissions || !Array.isArray(data.rolePermissions) || data.rolePermissions.length === 0) {
      data.rolePermissions = [
        { id: "Director", permissions: [
          'manage_users', 'view_patients', 'admit_patients', 'update_vitals', 'write_notes', 'discharge_patients',
          'create_tasks', 'complete_tasks', 'create_handovers', 'acknowledge_handovers', 'manage_clinic',
          'send_chat', 'view_audit_log', 'add_alert'
        ]},
        { id: "Specialist", permissions: [
          'manage_users', 'view_patients', 'admit_patients', 'update_vitals', 'write_notes', 'discharge_patients',
          'create_tasks', 'complete_tasks', 'create_handovers', 'acknowledge_handovers', 'manage_clinic',
          'send_chat', 'view_audit_log', 'add_alert'
        ]},
        { id: "Deputy", permissions: [
          'manage_users', 'view_patients', 'admit_patients', 'update_vitals', 'write_notes', 'discharge_patients',
          'create_tasks', 'complete_tasks', 'create_handovers', 'acknowledge_handovers', 'manage_clinic',
          'send_chat', 'view_audit_log', 'add_alert'
        ]},
        { id: "General", permissions: [
          'view_patients', 'admit_patients', 'update_vitals', 'write_notes', 'discharge_patients',
          'create_tasks', 'complete_tasks', 'create_handovers', 'acknowledge_handovers',
          'send_chat', 'add_alert'
        ]},
        { id: "Intern", permissions: [
          'view_patients', 'admit_patients', 'update_vitals', 'write_notes',
          'create_tasks', 'complete_tasks', 'create_handovers', 'acknowledge_handovers',
          'send_chat'
        ]}
      ];
      changed = true;
    }
    
    // Auto-assign unit-peds to patients/tasks/handovers/clinicSlots if missing
    ["patients", "tasks", "handovers", "clinicSlots"].forEach(col => {
      if (Array.isArray(data[col])) {
        data[col].forEach((item: any) => {
          if (!item.unitId) {
            item.unitId = "unit-peds";
            changed = true;
          }
        });
      }
    });

    if (changed) {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    }

    return data;
  } catch (e) {
    console.error("Failed to read DB, restoring backup...", e);
    if (fs.existsSync(BACKUP_FILE)) {
      const backup = fs.readFileSync(BACKUP_FILE, "utf-8");
      fs.writeFileSync(DB_FILE, backup);
      return JSON.parse(backup);
    }
    return { users: [], patients: [], tasks: [], handovers: [], clinicSlots: [], chatMessages: [], auditLog: [], alerts: [], units: [], rolePermissions: [] };
  }
}

// Helper to write DB
function writeDB(data: any) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  saveToFirestore(data).catch(err => console.error("Async firestore sync failed:", err));
}

// Helper to write Audit Log Entry
function addAuditEntry(userId: string, userName: string, userRole: string, action: string, details: string) {
  const db = readDB();
  const entry = {
    id: "a-" + Math.random().toString(36).substring(2, 11),
    timestamp: new Date().toISOString(),
    userId,
    userName,
    userRole,
    action,
    details
  };
  db.auditLog.unshift(entry);
  if (db.auditLog.length > 300) {
    db.auditLog = db.auditLog.slice(0, 300); // keep last 300
  }
  writeDB(db);
}

// --- Lazy Initialized Server-Side Gemini API ---
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY") {
      aiInstance = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });
      console.log("Gemini client successfully initialized on port 3000.");
    } else {
      console.warn("GEMINI_API_KEY not configured or has default value. Falling back to local clinical rules engine.");
    }
  }
  return aiInstance;
}

// --- Endpoints ---

// Ping keep alive
app.get("/api/ping", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Login
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const user = db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
  
  if (!user) {
    return res.status(401).json({ error: "البريد الإلكتروني غير مسجل أو كلمة المرور غير صحيحة" });
  }

  if (user.disabled || user.archived) {
    return res.status(403).json({ error: "هذا الحساب معطل أو غير نشط حالياً. يرجى مراجعة إدارة القسم." });
  }

  const passHash = hashPassword(password);
  if (user.password !== passHash) {
    return res.status(401).json({ error: "كلمة المرور غير صحيحة" });
  }

  // Success
  addAuditEntry(user.id, user.name, user.role, "تسجيل دخول", "تم تسجيل دخول المستخدم بنجاح.");
  
  // Exclude password from response
  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser });
});

// Register (Director only)
app.post("/api/auth/register", (req, res) => {
  const { name, email, password, role } = req.body;
  const adminRole = safeDecodeHeader(req.headers["x-user-role"] as string);
  const adminId = safeDecodeHeader(req.headers["x-user-id"] as string);
  const adminName = safeDecodeHeader(req.headers["x-user-name"] as string);

  if (adminRole !== "Director" && adminRole !== "Specialist" && adminRole !== "Deputy") {
    return res.status(403).json({ error: "غير مصرح. تسجيل الكادر الطبي متاح للمدير والأخصائي والنائب فقط." });
  }

  const db = readDB();
  const exists = db.users.some((u: any) => u.email.toLowerCase() === email.toLowerCase());
  if (exists) {
    return res.status(400).json({ error: "البريد الإلكتروني مسجل بالفعل لمستخدم آخر" });
  }

  const newUser = {
    id: "u-" + Math.random().toString(36).substring(2, 11),
    name,
    email: email.toLowerCase(),
    role,
    password: hashPassword(password)
  };

  db.users.push(newUser);
  writeDB(db);

  addAuditEntry(adminId || "system", adminName || "Director", "Director", "تسجيل مستخدم جديد", `تم تسجيل ${name} بدور ${role}`);

  const { password: _, ...safeUser } = newUser;
  res.json({ user: safeUser, users: db.users.map(({ password: _, ...u }: any) => u) });
});

// Get Team Members (Safe)
app.get("/api/users", (req, res) => {
  const db = readDB();
  const safeUsers = db.users.map(({ password: _, ...u }: any) => u);
  res.json({ users: safeUsers });
});

// Delete User (Director, Specialist, and Deputy)
app.delete("/api/users/:id", (req, res) => {
  const adminRole = safeDecodeHeader(req.headers["x-user-role"] as string);
  const adminId = safeDecodeHeader(req.headers["x-user-id"] as string);
  const adminName = safeDecodeHeader(req.headers["x-user-name"] as string);

  if (adminRole !== "Director" && adminRole !== "Specialist" && adminRole !== "Deputy") {
    return res.status(403).json({ error: "غير مصرح. حذف الكادر الطبي متاح للمدير والأخصائي والنائب فقط." });
  }

  const userIdToDelete = req.params.id;
  if (userIdToDelete === "u-admin" || userIdToDelete === adminId) {
    return res.status(400).json({ error: "لا يمكن حذف حساب المدير الرئيسي أو حسابك الشخصي الحالي." });
  }

  const db = readDB();
  const index = db.users.findIndex((u: any) => u.id === userIdToDelete);
  if (index === -1) {
    return res.status(404).json({ error: "المستخدم غير موجود" });
  }

  const deletedUser = db.users[index];
  db.users.splice(index, 1);
  writeDB(db);

  addAuditEntry(adminId || "system", adminName || "Director", adminRole as any || "Director", "حذف مستخدم", `تم حذف المستخدم ${deletedUser.name} (${deletedUser.role})`);

  res.json({ success: true, users: db.users.map(({ password: _, ...u }: any) => u) });
});

// Synchronization Endpoint (Supports client actions + offline updates)
app.post("/api/sync", (req, res) => {
  const { syncQueue } = req.body;
  const userId = safeDecodeHeader(req.headers["x-user-id"] as string) || "offline-user";
  const userName = safeDecodeHeader(req.headers["x-user-name"] as string) || "مستخدم متزامن";
  const userRole = safeDecodeHeader(req.headers["x-user-role"] as string) || "Intern";

  const db = readDB();

  // Process sync queue if client uploaded any actions
  if (Array.isArray(syncQueue) && syncQueue.length > 0) {
    console.log(`Processing ${syncQueue.length} sync actions from client...`);
    
    // Sort actions by timestamp ascending to preserve order
    const sortedActions = [...syncQueue].sort((a, b) => a.timestamp - b.timestamp);

    for (const action of sortedActions) {
      const { collection, operation, itemId, data } = action;
      
      if (!db[collection]) continue;

      if (operation === "add") {
        // Add item. Check if already exists to avoid duplication
        const index = db[collection].findIndex((item: any) => item.id === itemId);
        if (index === -1) {
          db[collection].push(data);
          addAuditEntry(userId, userName, userRole, `مزامنة إضافة (${collection})`, `تمت إضافة عنصر ذو رقم تعريف ${itemId}`);
        } else {
          // If already exists, conflict resolution check
          if (data.updatedAt && db[collection][index].updatedAt < data.updatedAt) {
            db[collection][index] = { ...db[collection][index], ...data };
          }
        }
      } else if (operation === "update") {
        const index = db[collection].findIndex((item: any) => item.id === itemId);
        if (index !== -1) {
          // Conflict Resolution: Client wins only if its data is newer
          const serverItem = db[collection][index];
          const clientUpdatedAt = data.updatedAt || Date.now();
          const serverUpdatedAt = serverItem.updatedAt || 0;

          if (clientUpdatedAt > serverUpdatedAt) {
            db[collection][index] = { ...serverItem, ...data };
            addAuditEntry(userId, userName, userRole, `مزامنة تعديل (${collection})`, `تم تحديث بيانات العنصر ذو رقم تعريف ${itemId}`);
          } else {
            console.log(`Conflict resolved: Server wins for ${collection} ID ${itemId} (Server: ${serverUpdatedAt} vs Client: ${clientUpdatedAt})`);
          }
        } else {
          // If server deleted it or it doesn't exist, we can re-add it as update/restore
          db[collection].push(data);
        }
      } else if (operation === "delete") {
        const index = db[collection].findIndex((item: any) => item.id === itemId);
        if (index !== -1) {
          db[collection].splice(index, 1);
          addAuditEntry(userId, userName, userRole, `مزامنة حذف (${collection})`, `تم حذف العنصر ذو رقم تعريف ${itemId}`);
        }
      }
    }
    
    writeDB(db);
  }

  // Send back the absolute latest database state to client
  res.json({
    patients: db.patients,
    tasks: db.tasks,
    handovers: db.handovers,
    clinicSlots: db.clinicSlots,
    chatMessages: db.chatMessages,
    auditLog: db.auditLog,
    alerts: db.alerts,
    users: db.users.map(({ password: _, ...u }: any) => u),
    units: db.units || [],
    rolePermissions: db.rolePermissions || [],
    serverTime: Date.now()
  });
});

// --- Admin Management & Smart Feature Endpoints ---

// 1. Reset Demo Data (Director Only)
app.post("/api/admin/reset-demo", (req, res) => {
  const adminRole = safeDecodeHeader(req.headers["x-user-role"] as string);
  const adminId = safeDecodeHeader(req.headers["x-user-id"] as string);
  const adminName = safeDecodeHeader(req.headers["x-user-name"] as string);

  if (adminRole !== "Director") {
    return res.status(403).json({ error: "غير مصرح. إعادة تعيين البيانات متاح لمدير القسم فقط." });
  }

  const db = readDB();
  db.patients = [];
  db.tasks = [];
  db.handovers = [];
  db.clinicSlots = [];
  db.chatMessages = [];
  db.alerts = [];

  writeDB(db);

  addAuditEntry(adminId || "system", adminName || "Director", "Director", "إعادة تعيين البيانات", "تم تصفير كافة السجلات الطبية والبيانات التجريبية للنظام بنجاح.");

  res.json({ success: true, db });
});

// 2. Update Dynamic Role Permissions (Director Only)
app.post("/api/admin/role-permissions", (req, res) => {
  const adminRole = safeDecodeHeader(req.headers["x-user-role"] as string);
  const adminId = safeDecodeHeader(req.headers["x-user-id"] as string);
  const adminName = safeDecodeHeader(req.headers["x-user-name"] as string);

  if (adminRole !== "Director") {
    return res.status(403).json({ error: "غير مصرح. تعديل الصلاحيات متاح لمدير القسم فقط." });
  }

  const { rolePermissions } = req.body; // Array of { id: string, permissions: string[] }
  if (!rolePermissions || !Array.isArray(rolePermissions)) {
    return res.status(400).json({ error: "بيانات غير صالحة" });
  }

  const db = readDB();
  db.rolePermissions = rolePermissions;
  writeDB(db);

  addAuditEntry(adminId || "system", adminName || "Director", "Director", "تحديث الصلاحيات (RBAC)", "تم تحديث الصلاحيات المخصصة للأدوار الطبية في النظام.");

  res.json({ success: true, rolePermissions: db.rolePermissions });
});

// 3. Update Units Configuration (Director Only)
app.post("/api/admin/units", (req, res) => {
  const adminRole = safeDecodeHeader(req.headers["x-user-role"] as string);
  const adminId = safeDecodeHeader(req.headers["x-user-id"] as string);
  const adminName = safeDecodeHeader(req.headers["x-user-name"] as string);

  if (adminRole !== "Director") {
    return res.status(403).json({ error: "غير مصرح. إدارة الأقسام متاح لمدير القسم فقط." });
  }

  const { units } = req.body; // Array of { id: string, name: string, managerId?: string }
  if (!units || !Array.isArray(units)) {
    return res.status(400).json({ error: "بيانات غير صالحة" });
  }

  const db = readDB();
  db.units = units;
  writeDB(db);

  addAuditEntry(adminId || "system", adminName || "Director", "Director", "تحديث الأقسام", "تم تحديث وتعديل أقسام التنويم الطبي والمدراء المسؤولين.");

  res.json({ success: true, units: db.units });
});

// 4. Update User Role, Status or Assignment (Director, Specialist, and Deputy)
app.post("/api/users/:id/update", (req, res) => {
  const adminRole = safeDecodeHeader(req.headers["x-user-role"] as string);
  const adminId = safeDecodeHeader(req.headers["x-user-id"] as string);
  const adminName = safeDecodeHeader(req.headers["x-user-name"] as string);

  if (adminRole !== "Director" && adminRole !== "Specialist" && adminRole !== "Deputy") {
    return res.status(403).json({ error: "غير مصرح." });
  }

  const { role, disabled, archived, assignedUnitId } = req.body;
  const userId = req.params.id;

  const db = readDB();
  const index = db.users.findIndex((u: any) => u.id === userId);
  if (index === -1) {
    return res.status(404).json({ error: "المستخدم غير موجود" });
  }

  const u = db.users[index];
  if (role) u.role = role;
  if (disabled !== undefined) u.disabled = disabled;
  if (archived !== undefined) u.archived = archived;
  if (assignedUnitId !== undefined) u.assignedUnitId = assignedUnitId;

  writeDB(db);
  addAuditEntry(adminId || "system", adminName || "Director", adminRole as any || "Director", "تعديل مستخدم", `تم تعديل بيانات أو صلاحيات الحساب للكادر ${u.name}`);

  res.json({ success: true, users: db.users.map(({ password: _, ...usr }: any) => usr) });
});

// --- AI decision support Fallbacks & Prompts ---

// 1. Vitals Analysis
app.post("/api/gemini/vitals-analysis", async (req, res) => {
  const { vitals, age, symptoms } = req.body;
  const ai = getGeminiClient();

  // Standard Pediatric Ranges Helper
  // age is in months/years
  const isInfant = age.includes("شهر") || age.includes("أشهر") || age.includes("أسبوع") || age.includes("أسابيع");
  
  if (ai) {
    try {
      const prompt = `أنت خبير واستشاري طب أطفال متمرس. قم بتحليل العلامات الحيوية التالية لرضيع أو طفل بقسم التنويم:
العمر: ${age}
الأعراض: ${symptoms}
العلامات الحيوية الحالية:
- درجة الحرارة: ${vitals.temp} °C
- معدل ضربات القلب: ${vitals.heartRate} نبضة/دقيقة
- معدل التنفس: ${vitals.respRate} دورة/دقيقة
- تشبع الأكسجين (SpO2): ${vitals.spo2} %
- ضغط الدم: ${vitals.systolicBp}/${vitals.diastolicBp} mmHg

يرجى إعطاء تحليل طبي باللغة العربية بأسلوب مهني رصين وموجز من ثلاث نقاط رئيسية:
1. تقييم دقيق لكل مؤشر حيوي (طبيعي، مرتفع، منخفض خطير) مع حساب نقاط الإنذار المبكر للأطفال (PEWS) تقريبياً.
2. التحذير من أي مخاطر حيوية قد تهدد استقرار الطفل فوراً.
3. التوصيات العلاجية والسريرية العاجلة الموصى بها كطبيب استشاري (مثلاً زيادة الأكسجين، خافضات حرارة، ترطيب، أو فحص جراحي).

أجب بصيغة JSON نظيفة ومرتبة بالهيكل التالي فقط:
{
  "pewsScore": number, // مجموع النقاط المقدر من 0 لـ 9
  "statusLevel": "stable" | "warning" | "critical", // مستوى الخطر الحيوي
  "analysisText": "نص التقييم والملاحظات الطبية بالتفصيل باللغة العربية...",
  "recommendations": ["توصية أولى...", "توصية ثانية..."]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const responseText = response.text || "";
      return res.json(JSON.parse(responseText.trim()));
    } catch (error) {
      console.log("Vitals analysis: Using local clinical rules engine fallback.");
    }
  }

  // Fallback Rule-Based Engine (PEWS calculator + Arabic clinical comments)
  console.log("Using clinical rule engine for Vitals Analysis.");
  let pews = 0;
  let analysis = "";
  const recommendations: string[] = [];

  // Temp check
  if (vitals.temp >= 38.5) {
    pews += 1;
    analysis += "• درجة الحرارة مرتفعة (حمى نشطة) تبلغ " + vitals.temp + " مئوية. ";
    recommendations.push("إعطاء خافضات الحرارة الموصى بها فموياً أو وريدياً (باراسيتامول/بروفين) حسب وزن الطفل.");
  } else if (vitals.temp < 36.0) {
    pews += 2;
    analysis += "• درجة الحرارة منخفضة بشكل مقلق تبلغ " + vitals.temp + " مئوية. ";
    recommendations.push("تدفئة الطفل ومراقبة مستويات السكر بالدم.");
  } else {
    analysis += "• درجة الحرارة طبيعية ومستقرة. ";
  }

  // SpO2 check
  if (vitals.spo2 < 92) {
    pews += 3;
    analysis += "• انخفاض حرج في مستوى تشبع الأكسجين SpO2 يبلغ " + vitals.spo2 + "٪ (نقص أكسجة متوسط إلى شديد). ";
    recommendations.push("البدء الفوري بتزويد الطفل بأكسجين رطب عبر القنية الأنفية (1-2 لتر/دقيقة) للحفاظ على تشبع فوق ٩٤٪.");
    recommendations.push("مراقبة الجهد التنفسي (سحب وربي، رفرفة فتحتي الأنف) والتحضير لدعم تنفسي متقدم في حال التدهور.");
  } else if (vitals.spo2 < 95) {
    pews += 1;
    analysis += "• تشبع الأكسجين SpO2 مائل للانخفاض " + vitals.spo2 + "٪. ";
    recommendations.push("مراقبة التنفس باستمرار وتحفيز المريض على التموضع المريح (نصف جالس).");
  } else {
    analysis += "• تشبع الأكسجين ممتاز وطبيعي (" + vitals.spo2 + "٪). ";
  }

  // Resp Rate Check based on age
  const rr = vitals.respRate;
  if (isInfant) {
    if (rr > 50) {
      pews += 2;
      analysis += "• تسارع شديد في التنفس (Tachypnea) لرضيع يبلغ " + rr + " دورة/دقيقة. ";
      recommendations.push("تقييم الجهد التنفسي لحديثي الولادة والرضع، وإبقاء المريض صائماً جزئياً لتفادي الاختناق.");
    } else if (rr > 40) {
      pews += 1;
      analysis += "• زيادة طفيفة في معدل التنفس تبلغ " + rr + " دورة/دقيقة. ";
    } else if (rr < 25) {
      pews += 2;
      analysis += "• تباطؤ في معدل التنفس لرضيع (" + rr + "/دقيقة)، يتطلب رعاية فورية. ";
    }
  } else {
    if (rr > 35) {
      pews += 2;
      analysis += "• تسارع واضح في التنفس لطفل يبلغ " + rr + " دورة/دقيقة. ";
      recommendations.push("مراجعة كفاءة التنفس القصبي وسماع أصوات الصدر بالسماعة (أزيز، كراكر).");
    } else if (rr < 15) {
      pews += 2;
      analysis += "• هبوط معدل التنفس للطفل (" + rr + "/دقيقة) مقلق للغاية. ";
    }
  }

  // Heart Rate
  const hr = vitals.heartRate;
  if (isInfant) {
    if (hr > 160) {
      pews += 2;
      analysis += "• تسارع حاد في ضربات القلب لرضيع يبلغ " + hr + " نبضة/دقيقة. ";
    } else if (hr < 90) {
      pews += 3;
      analysis += "• تباطؤ خطير في ضربات القلب لرضيع يبلغ " + hr + " نبضة/دقيقة. ";
      recommendations.push("استدعاء الطبيب الأخصائي فوراً للإنعاش القلبي الرئوي وتأمين مجرى الهواء.");
    }
  } else {
    if (hr > 130) {
      pews += 2;
      analysis += "• تسارع نبضات القلب للطفل يبلغ " + hr + " نبضة/دقيقة. ";
    } else if (hr < 70) {
      pews += 2;
      analysis += "• تباطؤ ضربات القلب للطفل يبلغ " + hr + " نبضة/دقيقة. ";
    }
  }

  let statusLevel: "stable" | "warning" | "critical" = "stable";
  if (pews >= 4 || vitals.spo2 < 92) {
    statusLevel = "critical";
    analysis += "\n\n[حالة حرجة] تشير نتائج تقييم PEWS المقدرة بـ (" + pews + ") إلى وجود تدهور في الحالة التنفسية أو الوعائية للطفل.";
    recommendations.unshift("استدعاء أخصائي طب الأطفال المقيم فوراً للمعاينة السريرية المباشرة.");
  } else if (pews >= 2) {
    statusLevel = "warning";
    analysis += "\n\n[تنبيه متوسط] مجموع نقاط PEWS هو (" + pews + ")، يتوجب زيادة وتيرة القياس للعلامات الحيوية كل ساعتين.";
  } else {
    analysis += "\n\n[حالة مستقرة] مجموع نقاط PEWS هو (" + pews + ")، استمر في خطة المراقبة الاعتيادية.";
  }

  res.json({
    pewsScore: pews,
    statusLevel,
    analysisText: analysis + " (صادر عن محرك القواعد السريرية المحلّي)",
    recommendations
  });
});

// 2. Diagnosis Suggestions
app.post("/api/gemini/diagnosis-suggestions", async (req, res) => {
  const { symptoms, age, medicalHistory } = req.body;
  const ai = getGeminiClient();

  if (ai) {
    try {
      const prompt = `أنت خبير واستشاري طب أطفال ذكي. تفحص الأعراض التالية لطفل منوم وعمره وتاريخه المرضي:
العمر: ${age}
الأعراض الحالية: ${symptoms}
التاريخ الطبي: ${medicalHistory}

اقترح ٣ تشخيصات تفريقية (Differential Diagnoses) محتملة تناسب الأطفال بدقة ومسؤولية سريرية باللغة العربية.
لكل تشخيص، اذكر:
1. اسم التشخيص الطبي (عربي/إنجليزي)
2. نسبة الاحتمال التقريبية (٪)
3. العوامل الداعمة لهذا التشخيص بناءً على الأعراض المدخلة.
4. الإجراء التشخيصي التالي المقترح لتأكيد الحالة (تحليل دم، أشعة، سونار، مزرعة).

أجب بصيغة JSON نظيفة ومباشرة بالهيكل التالي فقط:
{
  "suggestions": [
    {
      "diagnosisName": "اسم التشخيص (مع ترجمة بالإنجليزية)",
      "probability": number, // مثلاً 65
      "supportingFactors": "العوامل الداعمة بالتفصيل...",
      "nextDiagnosticStep": "التحاليل أو الفحوصات المقترحة..."
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      return res.json(JSON.parse(response.text || ""));
    } catch (error) {
      console.log("Diagnosis suggestions: Using local clinical rules engine fallback.");
    }
  }

  // Fallback Rule-Based Suggestions
  const symStr = (symptoms || "").toLowerCase();
  const suggestions: any[] = [];

  if (symStr.includes("تنفس") || symStr.includes("سعال") || symStr.includes("صدر") || symStr.includes("أكسجين")) {
    suggestions.push({
      diagnosisName: "التهاب القشيبات/الشعيبات الهوائية الحاد (Acute Bronchiolitis)",
      probability: 70,
      supportingFactors: "وجود صعوبة تنفس، سعال متكرر، وعمر المريض الصغير مع أعراض تنفسية سفلية مجهدة.",
      nextDiagnosticStep: "عمل أشعة سينية على الصدر (CXR) لاستبعاد الالتهاب الرئوي الفصي، وفحص فيروس RSV مسحة أنفية."
    });
    suggestions.push({
      diagnosisName: "الربو الشعبي الحاد / نوبة ربو (Acute Bronchial Asthma Exacerbation)",
      probability: 45,
      supportingFactors: "أعراض السعال الجاف، تكرار النوبات وصعوبة التنفس بالأخص عند الاستلقاء.",
      nextDiagnosticStep: "مراقبة درجة الاستجابة لموسعات القصبات الهوائية والتحقق من وجود تاريخ عائلي للتحسس."
    });
  } else if (symStr.includes("بطن") || symStr.includes("قيء") || symStr.includes("زائدة") || symStr.includes("وجع")) {
    suggestions.push({
      diagnosisName: "اشتباه التهاب الزائدة الدودية الحاد (Suspected Acute Appendicitis)",
      probability: 60,
      supportingFactors: "ألم بطني متمركز في الربع السفلي الأيمن، مصحوباً بالقيء والحرارة العالية.",
      nextDiagnosticStep: "عمل أشعة صوتية (سونار) للبطن والحوض فوراً لتقييم قطر الزائدة وجودة ترويتها الدموية."
    });
    suggestions.push({
      diagnosisName: "التهاب الأمعاء والمعدة الحاد (Acute Gastroenteritis)",
      probability: 50,
      supportingFactors: "القيء المتكرر، آلام البطن المنتشرة والحرارة المتوسطة.",
      nextDiagnosticStep: "تحليل البراز لفحص الميكروبات، ومراقبة توازن الكهارل ومؤشرات الجفاف."
    });
  } else {
    // Default generic pediatric suggestions
    suggestions.push({
      diagnosisName: "التهاب مجاري تنفسية عليا فيروسي (Viral Upper Respiratory Tract Infection)",
      probability: 65,
      supportingFactors: "الحمى والأعراض العامة غير المحددة للطفل.",
      nextDiagnosticStep: "تحليل دم شامل (CBC) ومراقبة مستمرة للأعراض مع الدعم بالسوائل وخافضات الحرارة."
    });
    suggestions.push({
      diagnosisName: "التهاب المسالك البولية عند الأطفال (Pediatric Urinary Tract Infection)",
      probability: 35,
      supportingFactors: "حمى مجهولة السبب وصعوبة أو تغير طبيعة التبول لدى الأطفال الصغار.",
      nextDiagnosticStep: "تحليل عينة بول مجهري وزراعة البول المخبرية لتحديد نوع البكتيريا ومضادها المناسب."
    });
  }

  res.json({ suggestions });
});

// 3. Predictive Analytics
app.post("/api/gemini/predictive-analytics", async (req, res) => {
  const ai = getGeminiClient();
  const db = readDB();

  const totalPatients = db.patients.length;
  const criticalCount = db.patients.filter((p: any) => p.status === "critical").length;
  const stableCount = db.patients.filter((p: any) => p.status === "stable").length;
  const followupCount = db.patients.filter((p: any) => p.status === "followup").length;
  const pendingTasks = db.tasks.filter((t: any) => !t.completed).length;

  if (ai) {
    try {
      const prompt = `أنت مستشار إدارة الجودة وتخطيط الطاقة الاستيعابية في مستشفيات الأطفال. بناءً على المؤشرات الحالية لقسم طوارئ وتنويم الأطفال:
- إجمالي عدد الأطفال المنومين حالياً بالجناح: ${totalPatients}
- الحالات الحرجة (Critical): ${criticalCount}
- الحالات المستقرة (Stable): ${stableCount}
- حالات المتابعة الدورية (Followup): ${followupCount}
- المهام السريرية المعلقة حالياً: ${pendingTasks}

أجب بتحليل تخطيطي مستقبلي ذكي باللغة العربية يتضمن توقعات علمية لأربع نقاط:
1. متوسط مدة الإقامة المتوقع للمرضى المنومين حالياً (Average Length of Stay - ALOS) بناءً على توزيع خطورة الحالات.
2. معدل إنجاز المهام السريرية وكفاءة تدفق العمل.
3. التوقعات الإحصائية لتدفق المراجعين الجدد خلال الـ 24 ساعة القادمة (معدل الدخول المتوقع).
4. توصيات تشغيلية لإدارة الطاقم الطبي المناوب (عدد الأطباء والممرضين المطلوبين لمنع الاحتراق المهني وتأمين جودة رعاية مثالية).

أرجوك صغ الإجابة في ملف JSON مهيكل بالصيغة التالية فقط:
{
  "avgLengthOfStay": string, // مثلاً "3.4 أيام"
  "estimatedInflow": string, // مثلاً "4 - 6 حالات دخول جديدة"
  "capacityAdvice": string, // نص التوصية بسعة الجناح...
  "staffingIndex": "normal" | "overloaded" | "under-staffed", // مؤشر الضغط
  "analyticsSummary": "تقرير تفصيلي رائع وبليغ باللغة العربية يشمل تحليلاً ذكياً للقسم..."
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      return res.json(JSON.parse(response.text || ""));
    } catch (error) {
      console.log("Predictive analytics: Using local clinical rules engine fallback.");
    }
  }

  // Fallback Local Analytics Engine
  let avgLOS = "2.5 أيام";
  let estimatedInflow = "2 - 4 حالات تنويم جديدة";
  let staffingIndex: "normal" | "overloaded" | "under-staffed" = "normal";
  let capacityAdvice = "السعة السريرية متزنة حالياً ولا يوجد ضغط كبير على غرف التنويم.";
  
  if (criticalCount > 1 || totalPatients > 5) {
    avgLOS = "4.2 أيام";
    estimatedInflow = "5 - 8 حالات دخول";
    staffingIndex = "overloaded";
    capacityAdvice = "ضغط العمل مرتفع نظراً لوجود حالات حرجة ومهام متعددة معلقة. يُنصح باستدعاء كادر دعم للوردية الليلية.";
  }

  const summary = `بناءً على لوحة البيانات الحالية، يضم الجناح عدد ${totalPatients} حالة منومة، بينها ${criticalCount} حالة تتطلب عناية فائقة مستمرة وسرعة استجابة. معدل المهام المعلقة هو ${pendingTasks} مهمة، مما يعني ضرورة توزيع الأدوار بدقة على أطباء الامتياز والأخصائيين المناوبين لتفادي التأخر في تقديم العلاجات الموصوفة.`;

  res.json({
    avgLengthOfStay: avgLOS,
    estimatedInflow,
    capacityAdvice,
    staffingIndex,
    analyticsSummary: summary + " (صادر عن محرك تخطيط الجودة المحلّي لـ CoreWard)"
  });
});


// Serve React app in Vite development vs production
async function startServer() {
  // Sync local cache with Cloud Firestore on boot
  try {
    await syncDatabaseWithFirestore();
  } catch (err) {
    console.error("Failed to sync database with Firestore on boot:", err);
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware integrated.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production build from dist.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CoreWard Server successfully running on http://localhost:${PORT}`);
  });
}

startServer();
