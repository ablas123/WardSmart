/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, Patient, Task, SbarHandover, ClinicSlot, ChatMessage, AuditLogEntry, Alert, UserRole, getRoleLabel, getRoleColor, hasPermission, setDynamicPermissions } from './types';
import { Language, translations } from './utils/translations';
import { localDB, SyncQueueAction } from './utils/localDB';
import Dashboard from './components/Dashboard';
import Ward from './components/Ward';
import Tasks from './components/Tasks';
import SbarHandoverComponent from './components/SbarHandover';
import ClinicQueue from './components/ClinicQueue';
import TeamChat from './components/TeamChat';
import AuditLog from './components/AuditLog';
import { 
  Activity, Sparkles, RefreshCw, LogOut, ShieldAlert, CheckSquare, 
  Clipboard, CalendarRange, MessageSquare, ShieldCheck, UserPlus, 
  Wifi, WifiOff, Bell, ChevronLeft, LogIn, Lock, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // Language & Translation State
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('coreward_lang') as Language) || 'ar');

  useEffect(() => {
    localStorage.setItem('coreward_lang', lang);
  }, [lang]);

  // Session & Authentication
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [email, setEmail] = useState('admin@ward.com');
  const [password, setPassword] = useState('admin123');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Active View State
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Core Sync'd Database State
  const [patients, setPatients] = useState<Patient[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [handovers, setHandovers] = useState<SbarHandover[]>([]);
  const [clinicSlots, setClinicSlots] = useState<ClinicSlot[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [units, setUnits] = useState<any[]>(localDB.getUnits());
  const [activeUnitId, setActiveUnitId] = useState<string>(localStorage.getItem('coreward_active_unit_id') || 'unit-peds');

  // Connectivity & Sync Status
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueueCount, setSyncQueueCount] = useState(localDB.getSyncQueue().length);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  // Clinical Alert Overlay/Toast
  const [activeToast, setActiveToast] = useState<{ title: string; desc: string; type: 'info' | 'urgent' } | null>(null);

  // New staff registration (Director only)
  const [isRegOpen, setIsRegOpen] = useState(false);
  const [regModalTab, setRegModalTab] = useState<'register' | 'list'>('register');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('Intern');
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<boolean>(false);

  // Detect network status changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Watch custom localDB sync queue events
    const handleQueueChange = (e: Event) => {
      const count = (e as CustomEvent).detail;
      setSyncQueueCount(count);
    };
    window.addEventListener('sync_queue_changed', handleQueueChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync_queue_changed', handleQueueChange);
    };
  }, []);

  // Load initial local database states
  useEffect(() => {
    const cachedUser = localDB.getCurrentUser();
    if (cachedUser) {
      setCurrentUser(cachedUser);
    }
    
    setPatients(localDB.getPatients());
    setTasks(localDB.getTasks());
    setHandovers(localDB.getHandovers());
    setClinicSlots(localDB.getClinicSlots());
    setChatMessages(localDB.getChatMessages());
    setAuditLog(localDB.getAuditLog());
    setAlerts(localDB.getAlerts());
    setTeamMembers(localDB.getTeamMembers());
    setUnits(localDB.getUnits());

    const cachedPerms = localDB.getRolePermissions();
    if (cachedPerms && cachedPerms.length > 0) {
      const obj: any = {};
      cachedPerms.forEach((item: any) => {
        obj[item.id] = item.permissions;
      });
      setDynamicPermissions(obj);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('coreward_active_unit_id', activeUnitId);
  }, [activeUnitId]);

  // Run automatic background sync every 15 seconds if online, and immediately on mount/login
  useEffect(() => {
    if (!currentUser) return;

    if (isOnline) {
      triggerSync();
    }

    const interval = setInterval(() => {
      if (isOnline) {
        triggerSync();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [currentUser, isOnline]);

  // Run clinical alert monitors (e.g., checks for overdue tasks or critical vitals)
  useEffect(() => {
    if (patients.length === 0) return;
    
    // Check for critical patients and raise instant header toast alerts
    const criticalPatient = patients.find(p => p.status === 'critical');
    if (criticalPatient) {
      setActiveToast({
        title: '🚨 تنبيه سريري حرج جداً',
        desc: `الطفل المريض ${criticalPatient.name} في السرير ${criticalPatient.bedNumber} يعاني من مؤشرات حيوية غير مستقرة وبحاجة لمعاينة فورية!`,
        type: 'urgent'
      });
    }
  }, [patients]);

  // Sync Engine with conflict resolution
  const triggerSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    
    const queue = localDB.getSyncQueue();
    const userId = currentUser?.id || 'offline';
    const userRole = currentUser?.role || 'Intern';
    const userName = currentUser?.name || 'مستخدم غير متزامن';

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': encodeURIComponent(userId),
          'x-user-role': encodeURIComponent(userRole),
          'x-user-name': encodeURIComponent(userName)
        },
        body: JSON.stringify({ syncQueue: queue })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Merge state - Server is the absolute source of truth
        localDB.savePatients(data.patients);
        localDB.saveTasks(data.tasks);
        localDB.saveHandovers(data.handovers);
        localDB.saveClinicSlots(data.clinicSlots);
        localDB.saveChatMessages(data.chatMessages);
        localDB.saveAuditLog(data.auditLog);
        localDB.saveAlerts(data.alerts);
        localDB.saveTeamMembers(data.users);
        
        if (data.units) {
          localDB.saveUnits(data.units);
          setUnits(data.units);
        }
        if (data.rolePermissions) {
          localDB.saveRolePermissions(data.rolePermissions);
          const obj: any = {};
          data.rolePermissions.forEach((item: any) => {
            obj[item.id] = item.permissions;
          });
          setDynamicPermissions(obj);
        }

        // Clear sync queue locally
        localDB.clearSyncQueue();
        
        // Update local React state
        setPatients(data.patients);
        setTasks(data.tasks);
        setHandovers(data.handovers);
        setClinicSlots(data.clinicSlots);
        setChatMessages(data.chatMessages);
        setAuditLog(data.auditLog);
        setAlerts(data.alerts);
        setTeamMembers(data.users);

        setLastSyncTime(Date.now());
        setSyncQueueCount(0);
      }
    } catch (e) {
      console.warn('Sync failed: Network is offline or server is unreachable. Operating securely in offline-first cached mode.', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (response.ok) {
        setCurrentUser(data.user);
        localDB.saveCurrentUser(data.user);
        
        // Do full sync on login
        triggerSync();
      } else {
        setLoginError(data.error || 'فشلت عملية تسجيل الدخول');
      }
    } catch (err) {
      // Offline fallback login for test accounts
      console.warn('Network offline during login. Attempting offline login fallback.');
      if (email === 'admin@ward.com' && password === 'admin123') {
        const fallbackAdmin: User = { id: 'u-admin', name: 'د. أحمد المنصوري', email: 'admin@ward.com', role: 'Director' };
        setCurrentUser(fallbackAdmin);
        localDB.saveCurrentUser(fallbackAdmin);
      } else if (email === 'maryam@ward.com' && password === 'mary123') {
        const fallbackMary: User = { id: 'u-maryam', name: 'د. مريم العتيبي', email: 'maryam@ward.com', role: 'Specialist' };
        setCurrentUser(fallbackMary);
        localDB.saveCurrentUser(fallbackMary);
      } else if (email === 'khalid@ward.com' && password === 'khalid123') {
        const fallbackKhalid: User = { id: 'u-khalid', name: 'د. خالد الحربي', email: 'khalid@ward.com', role: 'Intern' };
        setCurrentUser(fallbackKhalid);
        localDB.saveCurrentUser(fallbackKhalid);
      } else {
        setLoginError('يتطلب تسجيل الدخول لأول مرة اتصالاً بالشبكة أو استخدام الحسابات الافتراضية محلياً.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    localDB.saveCurrentUser(null);
    setCurrentUser(null);
  };

  // Staff registration
  const handleRegisterStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(false);

    if (!regName || !regEmail || !regPass || !regRole) {
      setRegError('يرجى تعبئة جميع الخانات لإنشاء الحساب.');
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': encodeURIComponent(currentUser?.id || ''),
          'x-user-role': encodeURIComponent(currentUser?.role || ''),
          'x-user-name': encodeURIComponent(currentUser?.name || '')
        },
        body: JSON.stringify({ name: regName, email: regEmail, password: regPass, role: regRole })
      });

      const data = await response.json();
      if (response.ok) {
        setRegSuccess(true);
        setTeamMembers(data.users);
        localDB.saveTeamMembers(data.users);
        
        // Reset form
        setRegName('');
        setRegEmail('');
        setRegPass('');
      } else {
        setRegError(data.error || 'فشلت عملية التسجيل');
      }
    } catch (err) {
      setRegError('فشل الاتصال بالخادم لإتمام تسجيل الكادر المناوب.');
    }
  };

  // Staff deletion
  const handleDeleteStaff = async (userIdToDelete: string) => {
    setRegError(null);
    setRegSuccess(false);

    try {
      const response = await fetch(`/api/users/${userIdToDelete}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': encodeURIComponent(currentUser?.id || ''),
          'x-user-role': encodeURIComponent(currentUser?.role || ''),
          'x-user-name': encodeURIComponent(currentUser?.name || '')
        }
      });

      const data = await response.json();
      if (response.ok) {
        setRegSuccess(true);
        setTeamMembers(data.users);
        localDB.saveTeamMembers(data.users);
      } else {
        setRegError(data.error || 'فشلت عملية الحذف');
      }
    } catch (err) {
      setRegError('فشل الاتصال بالخادم لإتمام حذف المستخدم.');
    }
  };

  const handleUpdateStaffStatus = async (userId: string, updates: any) => {
    setRegError(null);
    setRegSuccess(false);

    try {
      const response = await fetch(`/api/users/${userId}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': encodeURIComponent(currentUser?.id || ''),
          'x-user-role': encodeURIComponent(currentUser?.role || ''),
          'x-user-name': encodeURIComponent(currentUser?.name || '')
        },
        body: JSON.stringify(updates)
      });

      const data = await response.json();
      if (response.ok) {
        setRegSuccess(true);
        setTeamMembers(data.users);
        localDB.saveTeamMembers(data.users);
      } else {
        setRegError(data.error || 'فشلت عملية التحديث');
      }
    } catch (err) {
      setRegError('فشل الاتصال بالخادم لتحديث الكادر السريري.');
    }
  };

  const handleResetDemoData = async () => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من رغبتك في إعادة تعيين جميع البيانات التجريبية وحذف كافة المرضى والمستندات؟' : 'Are you sure you want to reset all demo data and delete all patients, tasks, handovers, clinic slots, chat messages, and alerts?')) {
      return;
    }
    
    try {
      const response = await fetch('/api/admin/reset-demo', {
        method: 'POST',
        headers: {
          'x-user-id': encodeURIComponent(currentUser?.id || ''),
          'x-user-role': encodeURIComponent(currentUser?.role || ''),
          'x-user-name': encodeURIComponent(currentUser?.name || '')
        }
      });
      const data = await response.json();
      if (response.ok) {
        // Clear locally cached data
        localDB.savePatients([]);
        localDB.saveTasks([]);
        localDB.saveHandovers([]);
        localDB.saveClinicSlots([]);
        localDB.saveChatMessages([]);
        localDB.saveAlerts([]);
        
        // Update state
        setPatients([]);
        setTasks([]);
        setHandovers([]);
        setClinicSlots([]);
        setChatMessages([]);
        setAlerts([]);
        
        setRegSuccess(true);
        setIsRegOpen(false);
        triggerSync();
        alert(lang === 'ar' ? '✓ تم إعادة تعيين النظام بنجاح!' : '✓ Demo data reset successful!');
      } else {
        alert(data.error || 'فشلت عملية إعادة التعيين');
      }
    } catch (err) {
      alert(lang === 'ar' ? 'فشل الاتصال بالخادم لإعادة التعيين' : 'Failed to connect to server for reset');
    }
  };

  // --- Mutators called by child components (Offline-First Wrapper) ---

  const handleAddAuditLogLocal = (action: string, details: string) => {
    const entry: AuditLogEntry = {
      id: `a-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: currentUser?.id || 'offline-user',
      userName: currentUser?.name || 'مستخدم متزامن',
      userRole: currentUser?.role || 'Intern',
      action,
      details
    };
    const updated = [entry, ...auditLog];
    setAuditLog(updated);
    localDB.saveAuditLog(updated);
    localDB.queueSyncAction('auditLog', 'add', entry.id, entry);
  };

  const handleAddPatient = (patient: Patient) => {
    const isDirector = currentUser?.role === 'Director';
    const currentActiveUnitId = isDirector ? activeUnitId : (currentUser?.assignedUnitId || 'unit-peds');
    const patientWithUnit = { ...patient, unitId: currentActiveUnitId };

    const updated = [patientWithUnit, ...patients];
    setPatients(updated);
    localDB.savePatients(updated);
    localDB.queueSyncAction('patients', 'add', patient.id, patientWithUnit);
    triggerSync();
  };

  const handleUpdatePatient = (patientId: string, updates: Partial<Patient>) => {
    const updated = patients.map(p => p.id === patientId ? { ...p, ...updates } : p);
    setPatients(updated);
    localDB.savePatients(updated);
    localDB.queueSyncAction('patients', 'update', patientId, updates);
    triggerSync();
  };

  const handleAddTask = (task: Task) => {
    const isDirector = currentUser?.role === 'Director';
    const currentActiveUnitId = isDirector ? activeUnitId : (currentUser?.assignedUnitId || 'unit-peds');
    const taskWithUnit = { ...task, unitId: currentActiveUnitId };

    const updated = [taskWithUnit, ...tasks];
    setTasks(updated);
    localDB.saveTasks(updated);
    localDB.queueSyncAction('tasks', 'add', task.id, taskWithUnit);
    triggerSync();
  };

  const handleUpdateTask = (taskId: string, updates: Partial<Task>) => {
    const updated = tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
    setTasks(updated);
    localDB.saveTasks(updated);
    localDB.queueSyncAction('tasks', 'update', taskId, updates);
    triggerSync();
  };

  const handleDeleteTask = (taskId: string) => {
    const updated = tasks.filter(t => t.id !== taskId);
    setTasks(updated);
    localDB.saveTasks(updated);
    localDB.queueSyncAction('tasks', 'delete', taskId, null);
    triggerSync();
  };

  const handleAddHandover = (handover: SbarHandover) => {
    const isDirector = currentUser?.role === 'Director';
    const currentActiveUnitId = isDirector ? activeUnitId : (currentUser?.assignedUnitId || 'unit-peds');
    const handoverWithUnit = { ...handover, unitId: currentActiveUnitId };

    const updated = [handoverWithUnit, ...handovers];
    setHandovers(updated);
    localDB.saveHandovers(updated);
    localDB.queueSyncAction('handovers', 'add', handover.id, handoverWithUnit);
    triggerSync();
  };

  const handleUpdateHandover = (handoverId: string, updates: Partial<SbarHandover>) => {
    const updated = handovers.map(h => h.id === handoverId ? { ...h, ...updates } : h);
    setHandovers(updated);
    localDB.saveHandovers(updated);
    localDB.queueSyncAction('handovers', 'update', handoverId, updates);
    triggerSync();
  };

  const handleAddSlot = (slot: ClinicSlot) => {
    const isDirector = currentUser?.role === 'Director';
    const currentActiveUnitId = isDirector ? activeUnitId : (currentUser?.assignedUnitId || 'unit-peds');
    const slotWithUnit = { ...slot, unitId: currentActiveUnitId };

    const updated = [slotWithUnit, ...clinicSlots];
    setClinicSlots(updated);
    localDB.saveClinicSlots(updated);
    localDB.queueSyncAction('clinicSlots', 'add', slot.id, slotWithUnit);
    triggerSync();
  };

  const handleUpdateSlot = (slotId: string, updates: Partial<ClinicSlot>) => {
    const updated = clinicSlots.map(s => s.id === slotId ? { ...s, ...updates } : s);
    setClinicSlots(updated);
    localDB.saveClinicSlots(updated);
    localDB.queueSyncAction('clinicSlots', 'update', slotId, updates);
    triggerSync();
  };

  const handleDeleteSlot = (slotId: string) => {
    const updated = clinicSlots.filter(s => s.id !== slotId);
    setClinicSlots(updated);
    localDB.saveClinicSlots(updated);
    localDB.queueSyncAction('clinicSlots', 'delete', slotId, null);
    triggerSync();
  };

  const handleSendMessage = (text: string) => {
    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderName: currentUser?.name || 'طبيب',
      senderRole: currentUser?.role || 'Intern',
      timestamp: new Date().toISOString(),
      text
    };
    const updated = [...chatMessages, message];
    setChatMessages(updated);
    localDB.saveChatMessages(updated);
    localDB.queueSyncAction('chatMessages', 'add', message.id, message);
    triggerSync();
  };

  // If user is not logged in, render beautiful clinical Portal Login screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden" dir="rtl">
        {/* Ambient glow backgrounds */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-3xl"></div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800 border border-slate-700/60 p-8 rounded-3xl max-w-md w-full shadow-2xl relative z-10"
        >
          {/* Logo Brand */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/20 mb-3 relative overflow-hidden">
              <Activity className="w-8 h-8 animate-pulse" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
            </div>
            <h1 className="text-2xl font-black text-white tracking-wide">كور وورد · CoreWard</h1>
            <p className="text-xs text-slate-400 mt-1.5 font-medium leading-relaxed">نظام المراقبة السريرية التنبؤية وقبول وتنويم الأطفال المتكامل</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-bold block">البريد الإلكتروني المهني للكادر</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@ward.com"
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 text-white rounded-xl text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-bold block">كلمة المرور المشفرة</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 text-white rounded-xl text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all"
                required
              />
            </div>

            {loginError && (
              <div className="p-3 bg-rose-500/10 text-rose-300 rounded-xl text-xs border border-rose-500/20 leading-relaxed font-semibold">
                ⚠️ {loginError}
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5"
            >
              <LogIn className="w-4 h-4" />
              {isLoggingIn ? 'جاري التحقق...' : 'دخول البوابة السريرية'}
            </button>
          </form>

          {/* Test credentials board */}
          <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 mt-6 space-y-2">
            <span className="text-[10px] text-slate-400 font-black block">🔑 حسابات الكادر الطبي للاختبار والتقييم (RBAC):</span>
            <div className="space-y-1.5 text-[10px] text-slate-400 font-medium">
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span>مدير القسم (Director): <span className="text-white font-bold">admin@ward.com</span></span>
                <span className="text-blue-400">admin123</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span>أخصائي (Specialist): <span className="text-white font-bold">maryam@ward.com</span></span>
                <span className="text-blue-400">mary123</span>
              </div>
              <div className="flex justify-between">
                <span>امتياز (Intern): <span className="text-white font-bold">khalid@ward.com</span></span>
                <span className="text-blue-400">khalid123</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Active Screen Selector helper
  const renderActiveComponent = () => {
    const isDirector = currentUser?.role === 'Director';
    const currentActiveUnitId = isDirector ? activeUnitId : (currentUser?.assignedUnitId || 'unit-peds');

    // Filter data to only match the selected clinical unit
    const unitPatients = patients.filter(p => !p.unitId || p.unitId === currentActiveUnitId);
    const unitTasks = tasks.filter(t => !t.unitId || t.unitId === currentActiveUnitId);
    const unitHandovers = handovers.filter(h => !h.unitId || h.unitId === currentActiveUnitId);
    const unitClinicSlots = clinicSlots.filter(s => !s.unitId || s.unitId === currentActiveUnitId);

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard patients={unitPatients} tasks={unitTasks} handovers={unitHandovers} onNavigate={setActiveTab} currentUser={currentUser} lang={lang} />;
      case 'ward':
        return (
          <Ward 
            patients={unitPatients} 
            teamMembers={teamMembers} 
            currentUser={currentUser} 
            onAddPatient={handleAddPatient} 
            onUpdatePatient={handleUpdatePatient}
            onAddAuditLog={handleAddAuditLogLocal}
            lang={lang}
          />
        );
      case 'tasks':
        return (
          <Tasks 
            tasks={unitTasks} 
            patients={unitPatients} 
            currentUser={currentUser} 
            onAddTask={handleAddTask} 
            onUpdateTask={handleUpdateTask} 
            onDeleteTask={handleDeleteTask}
            onAddAuditLog={handleAddAuditLogLocal}
            lang={lang}
          />
        );
      case 'handover':
        return (
          <SbarHandoverComponent 
            handovers={unitHandovers} 
            patients={unitPatients} 
            currentUser={currentUser} 
            onAddHandover={handleAddHandover} 
            onUpdateHandover={handleUpdateHandover}
            onAddAuditLog={handleAddAuditLogLocal}
            lang={lang}
          />
        );
      case 'clinic':
        return (
          <ClinicQueue 
            clinicSlots={unitClinicSlots} 
            currentUser={currentUser} 
            onAddSlot={handleAddSlot} 
            onUpdateSlot={handleUpdateSlot} 
            onDeleteSlot={handleDeleteSlot}
            onAddAuditLog={handleAddAuditLogLocal}
            lang={lang}
          />
        );
      case 'chat':
        return <TeamChat chatMessages={chatMessages} teamMembers={teamMembers} currentUser={currentUser} onSendMessage={handleSendMessage} lang={lang} />;
      case 'audit':
        return <AuditLog auditLog={auditLog} currentUser={currentUser} lang={lang} />;
      default:
        return <Dashboard patients={unitPatients} tasks={unitTasks} handovers={unitHandovers} onNavigate={setActiveTab} currentUser={currentUser} lang={lang} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" dir="rtl">
      
      {/* Top Banner Warning alerts if active */}
      <AnimatePresence>
        {activeToast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-3 text-center text-xs text-white flex justify-between items-center px-6 relative z-50 ${
              activeToast.type === 'urgent' ? 'bg-red-600' : 'bg-blue-600'
            } print:hidden`}
          >
            <div className="flex items-center gap-2 mx-auto">
              <span className="font-bold">{activeToast.title}:</span>
              <span className="font-medium">{activeToast.desc}</span>
            </div>
            <button onClick={() => setActiveToast(null)} className="hover:opacity-70 font-bold text-sm">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header navigation */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        
        {/* Left Side: Brand Logo and Sync indicators */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-500/10">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-slate-800 text-base block tracking-wide">كور وورد · CoreWard</span>
              <span className="text-[10px] text-slate-400 block font-bold">
                {lang === 'ar' ? 'بوابة تنويم طب الأطفال الذكية' : 'Smart Pediatric Ward Portal'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
            {/* Online Badge */}
            <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 border transition-all ${
              isOnline 
                ? 'bg-green-50 text-green-700 border-green-200' 
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5 animate-pulse" />}
              {isOnline 
                ? (lang === 'ar' ? 'منظومة متصلة بالشبكة' : 'Connected to Server') 
                : (lang === 'ar' ? 'تجهيز العمل غير المتصل (Offline)' : 'Offline-First Workspace')
              }
            </span>

            {/* Sync Queue Badge */}
            {syncQueueCount > 0 && (
              <button 
                onClick={triggerSync}
                disabled={isSyncing}
                className="bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 hover:bg-amber-200 transition-all animate-bounce"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>
                  {lang === 'ar' 
                    ? `لديك ${syncQueueCount} تعديلات بانتظار المزامنة الآن` 
                    : `You have ${syncQueueCount} modifications pending sync`
                  }
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Active User Account panel */}
        <div className="flex items-center gap-3">
          {/* Unit Switcher or Assigned Unit Badge */}
          {currentUser && (
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200/60 p-1.5 rounded-xl">
              {currentUser.role === 'Director' ? (
                <select
                  value={activeUnitId}
                  onChange={(e) => setActiveUnitId(e.target.value)}
                  className="bg-transparent border-none text-xs font-black text-blue-700 focus:ring-0 cursor-pointer outline-none px-1"
                >
                  {units && units.length > 0 ? (
                    units.map((u: any) => (
                      <option key={u.id} value={u.id} className="text-slate-800">
                        🏥 {lang === 'ar' ? u.nameAr : u.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="unit-peds" className="text-slate-800">🏥 جناح الأطفال</option>
                      <option value="unit-cardio" className="text-slate-800">🏥 جناح أمراض القلب</option>
                      <option value="unit-icu" className="text-slate-800">🏥 جناح العناية المركزة</option>
                    </>
                  )}
                </select>
              ) : (
                <div className="text-xs font-black text-slate-700 flex items-center gap-1 px-2 py-0.5">
                  <span>🏥</span>
                  <span>
                    {(() => {
                      const myUnitId = currentUser.assignedUnitId || 'unit-peds';
                      const matchedUnit = units?.find((u: any) => u.id === myUnitId);
                      return matchedUnit 
                        ? (lang === 'ar' ? matchedUnit.nameAr : matchedUnit.name) 
                        : (lang === 'ar' ? 'جناح الأطفال' : 'Pediatric Ward');
                    })()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Language Switcher */}
          <button 
            onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-black rounded-xl transition-all flex items-center gap-1"
            title={lang === 'ar' ? 'Switch to English' : 'التحويل للعربية'}
          >
            🌐 {lang === 'ar' ? 'English' : 'العربية'}
          </button>

          {hasPermission(currentUser.role, 'manage_users') && (
            <button 
              onClick={() => setIsRegOpen(true)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all"
            >
              <UserPlus className="w-4 h-4 text-slate-500" />
              {lang === 'ar' ? 'تسجيل كادر طبي مناوب' : 'Register Staff'}
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="text-left md:text-right">
              <span className="text-xs font-bold text-slate-800 block">{currentUser.name}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${getRoleColor(currentUser.role)}`}>
                {getRoleLabel(currentUser.role, lang)}
              </span>
            </div>
            
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-red-50 text-red-500 rounded-xl transition-all border border-transparent hover:border-red-100"
              title={lang === 'ar' ? 'تسجيل الخروج' : 'Logout'}
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

      </header>

      {/* Main Container Layout */}
      <div className="flex-1 flex flex-col md:flex-row print:p-0">
        
        {/* Navigation Sidebar (Vertical on Desktop, Horizontal on Mobile) */}
        <nav className="w-full md:w-60 bg-white border-b md:border-b-0 md:border-l border-slate-200/80 p-4 space-y-1 md:space-y-1.5 shrink-0 print:hidden">
          {[
            { id: 'dashboard', label: lang === 'ar' ? 'لوحة التحكم' : 'Dashboard', icon: Activity },
            { id: 'ward', label: lang === 'ar' ? 'جناح التنويم' : 'Pediatric Ward', icon: ShieldAlert },
            { id: 'tasks', label: lang === 'ar' ? 'جدول المهام' : 'Tasks & Nursing', icon: CheckSquare },
            { id: 'handover', label: lang === 'ar' ? 'التسليم الطبي (SBAR)' : 'SBAR Handover', icon: Clipboard },
            { id: 'clinic', label: lang === 'ar' ? 'العيادة الخارجية' : 'Outpatient Clinic', icon: CalendarRange },
            { id: 'chat', label: lang === 'ar' ? 'الدردشة التنسيقية' : 'Clinical Chat', icon: MessageSquare },
            { id: 'audit', label: lang === 'ar' ? 'الرقابة والأمان' : 'Audit Logs', icon: ShieldCheck, onlyAdmin: true }
          ].map(tab => {
            if (tab.onlyAdmin && !hasPermission(currentUser.role, 'view_audit_log')) return null;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Content Viewer window */}
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full print:p-0 print:max-w-none">
          {renderActiveComponent()}
        </main>

      </div>

      {/* Register User Modal (Director only) */}
      <AnimatePresence>
        {isRegOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 text-white p-6 rounded-2xl max-w-md w-full border border-slate-700 shadow-xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Users className="w-5 h-5 text-blue-400" />
                  {lang === 'ar' ? 'إدارة وتفويض الكادر الطبي بالقسم' : 'Medical Staff Authorization'}
                </h3>
                <button 
                  onClick={() => {
                    setIsRegOpen(false);
                    setRegSuccess(false);
                    setRegError(null);
                  }} 
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Tabs Switcher */}
              <div className="flex bg-slate-900 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setRegModalTab('register');
                    setRegSuccess(false);
                    setRegError(null);
                  }}
                  className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                    regModalTab === 'register' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lang === 'ar' ? 'تسجيل كادر جديد' : 'Register New'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegModalTab('list');
                    setRegSuccess(false);
                    setRegError(null);
                  }}
                  className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                    regModalTab === 'list' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lang === 'ar' ? `الطاقم الحالي (${teamMembers.length})` : `Active Staff (${teamMembers.length})`}
                </button>
              </div>

              {regModalTab === 'register' ? (
                <form onSubmit={handleRegisterStaff} className="space-y-4 text-xs">
                  
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-300 font-bold block">اسم الطبيب بالكامل *</label>
                    <input 
                      type="text" 
                      placeholder="مثل: د. سارة العثمان"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-white rounded-xl focus:outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-300 font-bold block">البريد الإلكتروني المهني *</label>
                    <input 
                      type="email" 
                      placeholder="sarah@ward.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-white rounded-xl focus:outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-300 font-bold block">الدور السريري الممنوح *</label>
                      <select 
                        value={regRole}
                        onChange={(e) => setRegRole(e.target.value as UserRole)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-white rounded-xl focus:outline-none"
                      >
                        <option value="Intern">طبيب امتياز (Intern)</option>
                        <option value="General">طبيب عام (General)</option>
                        <option value="Deputy">نائب استشاري (Deputy)</option>
                        <option value="Specialist">أخصائي (Specialist)</option>
                        <option value="Director">مدير القسم (Director)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-300 font-bold block">كلمة المرور المؤقتة *</label>
                      <input 
                        type="password" 
                        value={regPass}
                        onChange={(e) => setRegPass(e.target.value)}
                        placeholder="كلمة مرور الدخول الأولى"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-white rounded-xl focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  {regError && (
                    <div className="p-3 bg-red-950/40 text-red-300 border border-red-900 rounded-xl text-xs">
                      ⚠️ {regError}
                    </div>
                  )}

                  {regSuccess && (
                    <div className="p-3 bg-green-950/40 text-green-300 border border-green-900 rounded-xl text-xs font-bold">
                      ✓ تم تسجيل وتفويض الطبيب بنجاح ويمكنه تسجيل الدخول فوراً!
                    </div>
                  )}

                  <div className="flex gap-2 pt-3 border-t border-slate-700">
                    <button 
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl flex-1 transition-all"
                    >
                      تفويض وتسجيل الكادر
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsRegOpen(false);
                        setRegSuccess(false);
                        setRegError(null);
                      }}
                      className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold px-4 py-2 rounded-xl transition-all"
                    >
                      إغلاق النافذة
                    </button>
                  </div>

                </form>
              ) : (
                <div className="space-y-4 text-xs">
                  <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                    {teamMembers.map((member) => {
                      const isMainAdmin = member.id === 'u-admin';
                      const isSelf = member.id === currentUser?.id;
                      if (member.archived) return null;

                      return (
                        <div 
                          key={member.id} 
                          className={`p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-3 ${
                            member.disabled ? 'opacity-50 border-amber-500/20' : 'hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-0.5">
                              <span className="font-bold text-white text-xs block">
                                {member.name} {isSelf && <span className="text-[10px] text-blue-400 font-normal">(أنت)</span>}
                                {member.disabled && <span className="text-[10px] text-amber-400 font-black mr-2">(معطل)</span>}
                              </span>
                              <span className="text-[10px] text-slate-400 block">{member.email}</span>
                            </div>
                          </div>

                          {!isMainAdmin && !isSelf && (
                            <div className="space-y-2 border-t border-slate-800/80 pt-2.5">
                              <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div className="space-y-1">
                                  <label className="text-slate-400 font-bold block">الدور الوظيفي:</label>
                                  <select
                                    value={member.role}
                                    onChange={(e) => handleUpdateStaffStatus(member.id, { role: e.target.value as UserRole })}
                                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg p-1 text-[10px] focus:outline-none"
                                  >
                                    <option value="Intern">امتياز</option>
                                    <option value="General">طبيب عام</option>
                                    <option value="Deputy">نائب</option>
                                    <option value="Specialist">أخصائي</option>
                                    <option value="Director">مدير قسم</option>
                                  </select>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-slate-400 font-bold block">القسم المخصص:</label>
                                  <select
                                    value={member.assignedUnitId || 'unit-peds'}
                                    onChange={(e) => handleUpdateStaffStatus(member.id, { assignedUnitId: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg p-1 text-[10px] focus:outline-none"
                                  >
                                    {units?.map((u: any) => (
                                      <option key={u.id} value={u.id}>
                                        {lang === 'ar' ? u.nameAr : u.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="flex justify-end gap-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStaffStatus(member.id, { disabled: !member.disabled })}
                                  className={`px-2 py-1 rounded text-[9px] font-bold border transition-all ${
                                    member.disabled 
                                      ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/20 hover:bg-emerald-600 hover:text-white' 
                                      : 'bg-amber-600/20 text-amber-400 border-amber-500/20 hover:bg-amber-600 hover:text-white'
                                  }`}
                                >
                                  {member.disabled 
                                    ? (lang === 'ar' ? 'تنشيط الحساب' : 'Enable') 
                                    : (lang === 'ar' ? 'تعطيل الحساب' : 'Disable')
                                  }
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(lang === 'ar' ? 'هل أنت متأكد من رغبتك في حذف وأرشفة هذا المستخدم؟' : 'Are you sure you want to archive/remove this user?')) {
                                      handleUpdateStaffStatus(member.id, { archived: true });
                                    }
                                  }}
                                  className="px-2 py-1 bg-red-600/20 text-red-400 border border-red-500/20 hover:bg-red-600 hover:text-white rounded text-[9px] font-bold transition-all"
                                >
                                  {lang === 'ar' ? 'حذف وأرشفة' : 'Archive'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {regError && (
                    <div className="p-3 bg-red-950/40 text-red-300 border border-red-900 rounded-xl text-xs">
                      ⚠️ {regError}
                    </div>
                  )}

                  {regSuccess && (
                    <div className="p-3 bg-green-950/40 text-green-300 border border-green-900 rounded-xl text-xs font-bold">
                      ✓ تم تحديث وحفظ بيانات الكادر بنجاح!
                    </div>
                  )}

                  <div className="border-t border-slate-700/60 pt-3.5 mt-2 text-center">
                    <button
                      type="button"
                      onClick={handleResetDemoData}
                      className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-black py-2 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      🧹 {lang === 'ar' ? 'إعادة تهيئة النظام ومسح البيانات' : 'Reset All Clinical Demo Data'}
                    </button>
                    <span className="text-[9px] text-slate-500 font-bold block mt-1.5">
                      * يمسح المرضى والمهام ومحاضر التسليم والعيادات والتنبيهات، ويحتفظ بالطاقم والوحدات.
                    </span>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-slate-700">
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsRegOpen(false);
                        setRegSuccess(false);
                        setRegError(null);
                      }}
                      className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold px-4 py-2 rounded-xl w-full transition-all text-center"
                    >
                      إغلاق النافذة
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
