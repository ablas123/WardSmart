/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Patient, Task, SbarHandover, User, getRoleLabel } from '../types';
import { Language, translations } from '../utils/translations';
import { Activity, ShieldAlert, CheckSquare, RefreshCw, Sparkles, TrendingUp, Users, Clock, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardProps {
  patients: Patient[];
  tasks: Task[];
  handovers: SbarHandover[];
  onNavigate: (tab: string) => void;
  currentUser: User;
  lang?: Language;
}

interface AnalyticsData {
  avgLengthOfStay: string;
  estimatedInflow: string;
  capacityAdvice: string;
  staffingIndex: 'normal' | 'overloaded' | 'under-staffed';
  analyticsSummary: string;
}

export default function Dashboard({ patients, tasks, handovers, onNavigate, currentUser, lang = 'ar' }: DashboardProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePatients = patients.filter(p => p.status !== 'discharged');
  const criticalPatients = patients.filter(p => p.status === 'critical');
  const followupPatients = patients.filter(p => p.status === 'followup');
  const stablePatients = patients.filter(p => p.status === 'stable');
  const pendingTasks = tasks.filter(t => !t.completed);
  const urgentHandovers = handovers.filter(h => h.isUrgent && !h.acknowledgedBy);

  const t = translations[lang];

  // Fetch Predictive Analytics
  const fetchAnalytics = async (isManual = false) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/gemini/predictive-analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': encodeURIComponent(currentUser.id),
          'x-user-role': encodeURIComponent(currentUser.role),
          'x-user-name': encodeURIComponent(currentUser.name)
        }
      });
      if (!response.ok) {
        throw new Error(lang === 'ar' ? 'فشلت عملية جلب التحليلات التنبؤية' : 'Failed to fetch predictive analytics');
      }
      const data = await response.json();
      setAnalytics(data);
    } catch (e: any) {
      setError(e.message || (lang === 'ar' ? 'حدث خطأ أثناء الاتصال بالخادم' : 'Error connecting to server'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [patients.length, tasks.length]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 transform translate-x-12 -translate-y-12 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">
              {lang === 'ar' ? `أهلاً بك، ${currentUser.name} 👋` : `Welcome, Dr. ${currentUser.name} 👋`}
            </h1>
            <p className="text-blue-100 text-sm md:text-base">
              {lang === 'ar' 
                ? 'لوحة تحكم قسم تنويم الأطفال وقرار الدعم الطبي الذكي (CoreWard)' 
                : 'Pediatric Ward Dashboard & Smart Clinical Decision Support Portal'}
            </p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl text-xs md:text-sm flex items-center gap-2 border border-white/10">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"></span>
            <span>{t.roleLabel}: {getRoleLabel(currentUser.role, lang)}</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Patients */}
        <motion.div 
          onClick={() => onNavigate('ward')}
          whileHover={{ y: -3 }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs cursor-pointer flex items-center justify-between"
          id="stat-active-patients"
        >
          <div className="space-y-1">
            <span className="text-slate-500 text-xs font-medium block">{t.totalPatients}</span>
            <span className="text-2xl md:text-3xl font-bold text-slate-800">{activePatients.length}</span>
            <span className="text-[10px] text-slate-400 block">
              {lang === 'ar' ? `من أصل ${patients.length} حالة مسجلة` : `out of ${patients.length} registered patients`}
            </span>
          </div>
          <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
            <Users className="w-6 h-6" />
          </div>
        </motion.div>

        {/* Card 2: Critical Patients */}
        <motion.div 
          onClick={() => onNavigate('ward')}
          whileHover={{ y: -3 }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs cursor-pointer flex items-center justify-between"
          id="stat-critical-patients"
        >
          <div className="space-y-1">
            <span className="text-slate-500 text-xs font-medium block">{t.criticalCases}</span>
            <span className={`text-2xl md:text-3xl font-bold ${criticalPatients.length > 0 ? 'text-red-600' : 'text-slate-800'}`}>
              {criticalPatients.length}
            </span>
            <span className="text-[10px] text-slate-400 block">
              {lang === 'ar' ? 'تتطلب رعاية حثيثة' : 'Requires immediate attention'}
            </span>
          </div>
          <div className={`p-3 rounded-xl ${criticalPatients.length > 0 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
            <ShieldAlert className="w-6 h-6" />
          </div>
        </motion.div>

        {/* Card 3: Pending Tasks */}
        <motion.div 
          onClick={() => onNavigate('tasks')}
          whileHover={{ y: -3 }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs cursor-pointer flex items-center justify-between"
          id="stat-pending-tasks"
        >
          <div className="space-y-1">
            <span className="text-slate-500 text-xs font-medium block">{t.activeTasks}</span>
            <span className="text-2xl md:text-3xl font-bold text-slate-800">{pendingTasks.length}</span>
            <span className="text-[10px] text-slate-400 block">
              {lang === 'ar' ? 'مهام سريرية بحاجة لإنجاز' : 'Clinical nursing tasks pending'}
            </span>
          </div>
          <div className="bg-amber-50 p-3 rounded-xl text-amber-600">
            <CheckSquare className="w-6 h-6" />
          </div>
        </motion.div>

        {/* Card 4: Urgent Handovers */}
        <motion.div 
          onClick={() => onNavigate('handover')}
          whileHover={{ y: -3 }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs cursor-pointer flex items-center justify-between"
          id="stat-urgent-handovers"
        >
          <div className="space-y-1">
            <span className="text-slate-500 text-xs font-medium block">
              {lang === 'ar' ? 'تسليمات عاجلة (SBAR)' : 'Urgent Handovers'}
            </span>
            <span className={`text-2xl md:text-3xl font-bold ${urgentHandovers.length > 0 ? 'text-rose-600 animate-bounce' : 'text-slate-800'}`}>
              {urgentHandovers.length}
            </span>
            <span className="text-[10px] text-slate-400 block">
              {lang === 'ar' ? 'بانتظار التأكيد الفوري' : 'Awaiting confirmation'}
            </span>
          </div>
          <div className={`p-3 rounded-xl ${urgentHandovers.length > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
            <Clock className="w-6 h-6" />
          </div>
        </motion.div>
      </div>

      {/* Main Grid: Patients status list & Predictive Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1 & 2: Quick Status Distribution & Urgent Clinical tasks */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Interactive Bed Map Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600 animate-pulse" />
                {lang === 'ar' ? 'خارطة أسرة قسم تنويم الأطفال التفاعلية' : 'Interactive Pediatric Ward Bed Map'}
              </span>
              <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200 font-bold">
                {lang === 'ar' ? `المشغولة: ${activePatients.length} / المجموع: 7` : `Occupied: ${activePatients.length} / Total: 7`}
              </span>
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['A1', 'A2', 'B1', 'B2', 'B3', 'C1', 'C2'].map((bed) => {
                const pat = activePatients.find(p => p.bedNumber === bed);
                let bgStyle = "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300";
                let statusBadge = null;

                if (pat) {
                  if (pat.status === 'critical') {
                    bgStyle = "bg-red-50/70 border-red-200 hover:bg-red-50 text-red-700";
                    statusBadge = lang === 'ar' ? 'حرجة ⚠️' : 'Critical ⚠️';
                  } else if (pat.status === 'followup') {
                    bgStyle = "bg-amber-50/70 border-amber-200 hover:bg-amber-50 text-amber-700";
                    statusBadge = lang === 'ar' ? 'متابعة ⏳' : 'Followup ⏳';
                  } else {
                    bgStyle = "bg-emerald-50/70 border-emerald-200 hover:bg-emerald-50 text-emerald-700";
                    statusBadge = lang === 'ar' ? 'مستقرة ✓' : 'Stable ✓';
                  }
                }

                return (
                  <div 
                    key={bed}
                    onClick={() => onNavigate('ward')}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-right flex flex-col justify-between h-24 ${bgStyle}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black bg-white/60 px-1.5 py-0.5 rounded-md border border-black/5">{bed}</span>
                      {statusBadge && <span className="text-[8px] font-black">{statusBadge}</span>}
                    </div>

                    {pat ? (
                      <div className="space-y-0.5 mt-2">
                        <span className="text-[11px] font-black block truncate">{pat.name}</span>
                        <span className="text-[9px] opacity-80 block truncate">
                          {pat.age} • {pat.gender === 'male' ? (lang === 'ar' ? 'ذكر' : 'M') : (lang === 'ar' ? 'أنثى' : 'F')}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-auto">
                        <span className="text-[10px] text-slate-400 font-bold block">{lang === 'ar' ? 'سرير شاغر' : 'Empty Bed'}</span>
                        <span className="text-[8px] text-emerald-600 block font-semibold">{lang === 'ar' ? 'متاح للتنويم' : 'Available'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Patient Distribution Graph */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              {lang === 'ar' ? 'توزيع الحالات السريرية في الجناح' : 'Clinical Case Status Distribution'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{lang === 'ar' ? 'حرجة (Critical)' : 'Critical'}</span>
                  <span className="font-semibold text-red-600">
                    {criticalPatients.length} {lang === 'ar' ? 'حالات' : 'cases'} ({activePatients.length ? Math.round((criticalPatients.length / activePatients.length) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div className="bg-red-500 h-full rounded-full transition-all duration-500" style={{ width: `${activePatients.length ? (criticalPatients.length / activePatients.length) * 100 : 0}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{lang === 'ar' ? 'متابعة (Followup)' : 'Follow-up'}</span>
                  <span className="font-semibold text-amber-600">
                    {followupPatients.length} {lang === 'ar' ? 'حالات' : 'cases'} ({activePatients.length ? Math.round((followupPatients.length / activePatients.length) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${activePatients.length ? (followupPatients.length / activePatients.length) * 100 : 0}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{lang === 'ar' ? 'مستقرة (Stable)' : 'Stable'}</span>
                  <span className="font-semibold text-green-600">
                    {stablePatients.length} {lang === 'ar' ? 'حالات' : 'cases'} ({activePatients.length ? Math.round((stablePatients.length / activePatients.length) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div className="bg-green-500 h-full rounded-full transition-all duration-500" style={{ width: `${activePatients.length ? (stablePatients.length / activePatients.length) * 100 : 0}%` }}></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-slate-100 text-center">
              <div className="bg-red-50/50 p-2 rounded-xl">
                <span className="text-[10px] text-red-500 font-bold block">
                  {lang === 'ar' ? 'مجهود تنفسي / ضائقة' : 'Respiratory Distress'}
                </span>
                <span className="text-xs text-red-800 font-semibold">
                  {criticalPatients.length} {lang === 'ar' ? 'قيد المراقبة' : 'under monitoring'}
                </span>
              </div>
              <div className="bg-amber-50/50 p-2 rounded-xl">
                <span className="text-[10px] text-amber-600 font-bold block">
                  {lang === 'ar' ? 'متابعة حرارة / تحاليل' : 'Fever / Lab Followups'}
                </span>
                <span className="text-xs text-amber-800 font-semibold">
                  {followupPatients.length} {lang === 'ar' ? 'حالات نشطة' : 'active cases'}
                </span>
              </div>
              <div className="bg-green-50/50 p-2 rounded-xl">
                <span className="text-[10px] text-green-600 font-bold block">
                  {lang === 'ar' ? 'جاهزية للخروج قريباً' : 'Ready for Discharge'}
                </span>
                <span className="text-xs text-green-800 font-semibold">
                  {stablePatients.length} {lang === 'ar' ? 'أطفال مستقرين' : 'stable children'}
                </span>
              </div>
            </div>
          </div>

          {/* Critical Reminders / Urgent Tasks */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-indigo-600" />
                {lang === 'ar' ? 'المهام السريرية العاجلة القادمة' : 'Upcoming Urgent Clinical Tasks'}
              </h2>
              <button onClick={() => onNavigate('tasks')} className="text-xs text-blue-600 font-semibold hover:underline">
                {lang === 'ar' ? 'عرض كل المهام' : 'View All Tasks'}
              </button>
            </div>

            {pendingTasks.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                {lang === 'ar' 
                  ? 'لا توجد مهام سريرية معلقة لليوم. عمل رائع! 🎉' 
                  : 'No pending clinical tasks today. Excellent work! 🎉'}
              </div>
            ) : (
              <div className="space-y-3">
                {pendingTasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-amber-500' : 'bg-slate-400'
                      }`}></span>
                      <div>
                        <span className="text-xs text-slate-400 block">
                          {task.patientName} ({lang === 'ar' ? 'سرير' : 'Bed'} {patients.find(p => p.id === task.patientId)?.bedNumber || '--'})
                        </span>
                        <span className="text-sm font-semibold text-slate-800">{task.description}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-700 font-semibold rounded-md">
                        {getRoleLabel(task.assigneeRole, lang)}
                      </span>
                      <span className="text-slate-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {task.dueTime}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Column 3: AI-Powered Clinical Predictive Analytics */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between h-full relative overflow-hidden">
            <div className="absolute top-0 left-0 bg-blue-500/5 w-32 h-32 rounded-full blur-2xl"></div>
            
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-5 h-5 text-indigo-500 fill-indigo-100" />
                  {lang === 'ar' ? 'تحليلات التنبؤ والتخطيط' : 'AI Predictive Analytics'}
                </h2>
                <button 
                  onClick={() => fetchAnalytics(true)} 
                  disabled={loading}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors disabled:opacity-50"
                  title={lang === 'ar' ? 'تحديث التوقعات بالذكاء الاصطناعي' : 'Refresh AI Analytics'}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loading ? (
                <div className="space-y-4 py-8 text-center">
                  <div className="relative inline-block">
                    <Sparkles className="w-10 h-10 text-indigo-500 animate-pulse mx-auto" />
                    <span className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin"></span>
                  </div>
                  <p className="text-xs text-slate-400 animate-pulse">
                    {lang === 'ar' 
                      ? 'جاري تحليل بيانات القسم وتقديم التنبؤات التشغيلية المخصصة...' 
                      : 'Analyzing department data and generating customized operational predictions...'}
                  </p>
                </div>
              ) : error ? (
                <div className="p-4 rounded-xl bg-red-50 text-red-700 text-xs border border-red-100 space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>
                      {lang === 'ar' ? 'فشل الاتصال بمستشار الذكاء الاصطناعي' : 'AI Clinical Assistant Offline'}
                    </span>
                  </div>
                  <p>{error}</p>
                  <button 
                    onClick={() => fetchAnalytics()}
                    className="text-[10px] text-red-800 underline block font-bold"
                  >
                    {lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
                  </button>
                </div>
              ) : analytics ? (
                <div className="space-y-5">
                  {/* Staffing Index Badge */}
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-500 font-medium">
                      {lang === 'ar' ? 'مؤشر ضغط العمل المقدر' : 'Estimated Workload Index'}
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      analytics.staffingIndex === 'overloaded' 
                        ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                        : analytics.staffingIndex === 'under-staffed'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {analytics.staffingIndex === 'overloaded' 
                        ? (lang === 'ar' ? '⚠️ ضغط عمل مرتفع' : '⚠️ Heavy Workload') 
                        : analytics.staffingIndex === 'under-staffed' 
                        ? (lang === 'ar' ? '⚠️ نقص كادر محتمل' : '⚠️ Potential Shortage') 
                        : (lang === 'ar' ? '✅ طبيعي ومتوازن' : '✅ Balanced')}
                    </span>
                  </div>

                  {/* Estimated Inflow & Stay */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 text-center">
                      <span className="text-[10px] text-slate-400 block font-medium">
                        {lang === 'ar' ? 'متوسط مدة الإقامة (ALOS)' : 'Avg Length of Stay (ALOS)'}
                      </span>
                      <span className="text-sm font-bold text-slate-800">{analytics.avgLengthOfStay}</span>
                    </div>
                    <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 text-center">
                      <span className="text-[10px] text-slate-400 block font-medium">
                        {lang === 'ar' ? 'معدل الدخول (24 ساعة)' : 'Estimated Inflow (24h)'}
                      </span>
                      <span className="text-sm font-bold text-slate-800">{analytics.estimatedInflow}</span>
                    </div>
                  </div>

                  {/* Summary text */}
                  <div className="text-xs text-slate-600 leading-relaxed bg-indigo-50/30 p-3 rounded-xl border border-indigo-100/50">
                    <p className="font-semibold text-indigo-900 mb-1 flex items-center gap-1 text-[11px]">
                      <Sparkles className="w-3 h-3 text-indigo-500" /> 
                      {lang === 'ar' ? 'ملخص الاستشارة التنبؤية:' : 'Predictive Insight Summary:'}
                    </p>
                    {analytics.analyticsSummary}
                  </div>

                  {/* Capacity Advice */}
                  <div className="text-xs text-slate-500 border-t border-slate-100 pt-3">
                    <span className="font-bold text-slate-700 block mb-1">
                      {lang === 'ar' ? '💡 توصية تخطيط الطاقة الاستيعابية:' : '💡 Bed Capacity Planning Advice:'}
                    </span>
                    {analytics.capacityAdvice}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  {lang === 'ar' ? 'لا توجد توقعات حالية. يرجى التحديث.' : 'No analytics forecasts available. Please refresh.'}
                </div>
              )}
            </div>

            <div className="text-[9px] text-slate-400 pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
              <span>
                {lang === 'ar' ? 'آخر تحديث: ' : 'Last Updated: '}
                {new Date().toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US')}
              </span>
              <span>{lang === 'ar' ? 'مستشار التخطيط الذكي من CoreWard' : 'CoreWard Smart Planner Advisor'}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
