/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SbarHandover, Patient, User, hasPermission } from '../types';
import { Clipboard, Plus, CheckCircle2, Clock, ShieldAlert, X, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SbarHandoverProps {
  handovers: SbarHandover[];
  patients: Patient[];
  currentUser: User;
  onAddHandover: (handover: SbarHandover) => void;
  onUpdateHandover: (handoverId: string, updates: Partial<SbarHandover>) => void;
  onAddAuditLog: (action: string, details: string) => void;
  lang?: any;
}

export default function SbarHandoverComponent({ handovers, patients, currentUser, onAddHandover, onUpdateHandover, onAddAuditLog, lang }: SbarHandoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [situation, setSituation] = useState('');
  const [background, setBackground] = useState('');
  const [assessment, setAssessment] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const activePatients = patients.filter(p => p.status !== 'discharged');

  // Submit handover
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !situation || !background || !assessment || !recommendation) {
      setFormError('يرجى كتابة كافة الأقسام الطبية الأربعة لنموذج SBAR المعتمد.');
      return;
    }

    const patientObj = patients.find(p => p.id === patientId);
    if (!patientObj) return;

    const newHandover: SbarHandover = {
      id: `h-${Date.now()}`,
      patientId,
      patientName: patientObj.name,
      timestamp: new Date().toISOString(),
      senderName: currentUser.name,
      senderRole: currentUser.role,
      situation,
      background,
      assessment,
      recommendation,
      isUrgent,
      updatedAt: Date.now()
    };

    onAddHandover(newHandover);
    onAddAuditLog('تسليم حالة (SBAR Handover)', `تم تسجيل تسليم حالة المريض ${patientObj.name} بنموذج SBAR المعتمد (الأهمية: ${isUrgent ? 'عاجلة' : 'اعتيادية'}).`);

    setIsOpen(false);
    setPatientId('');
    setSituation('');
    setBackground('');
    setAssessment('');
    setRecommendation('');
    setIsUrgent(false);
    setFormError(null);
  };

  // Acknowledge handover
  const handleAcknowledge = (handover: SbarHandover) => {
    onUpdateHandover(handover.id, {
      acknowledgedBy: currentUser.name,
      acknowledgedAt: new Date().toISOString(),
      updatedAt: Date.now()
    });

    onAddAuditLog('تأكيد استلام حالة (SBAR)', `أكد ${currentUser.name} استلام مسؤولية متابعة المريض ${handover.patientName} سريرياً.`);
  };

  return (
    <div className="space-y-6">
      
      {/* SBAR Jumbotron Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Clipboard className="w-6 h-6 text-indigo-600" />
            التسليم السريري الموحد (SBAR Handovers)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            آلية التسليم الموحد للسلامة السريرية: الوضع الراهن (Situation)، الخلفية المرضية (Background)، التقييم السريري (Assessment)، والتوصيات المقترحة (Recommendation).
          </p>
        </div>

        <button 
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-1 transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
          إنشاء تسليم SBAR
        </button>
      </div>

      {/* Handovers stream */}
      <div className="space-y-4">
        {handovers.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-100 text-slate-400 text-sm">
            لا توجد تسليمات SBAR مسجلة في الـ 24 ساعة الماضية للقسم. ☕
          </div>
        ) : (
          handovers.map((item) => (
            <div 
              key={item.id} 
              className={`bg-white rounded-2xl border transition-all p-6 space-y-4 shadow-3xs ${
                item.isUrgent && !item.acknowledgedBy
                  ? 'border-red-300 ring-2 ring-red-500/10'
                  : 'border-slate-100'
              }`}
            >
              
              {/* Header block */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-slate-800 text-sm">{item.patientName}</span>
                  <span className="text-xs text-slate-400 font-medium">السرير: {patients.find(p => p.id === item.patientId)?.bedNumber || '--'}</span>
                  
                  {item.isUrgent && (
                    <span className="bg-red-100 text-red-800 border border-red-200 text-[9px] px-2 py-0.5 rounded-md font-bold animate-pulse">
                      🚨 تسليم عاجل وطارئ
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {new Date(item.timestamp).toLocaleString('ar-EG')}
                  </span>
                  <span>المسلم: <span className="font-bold text-slate-700">{item.senderName} ({item.senderRole})</span></span>
                </div>
              </div>

              {/* SBAR 4 quadrants layout */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                {/* Situation */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-indigo-700 font-bold block mb-1">S - الوضع الراهن Situation</span>
                  <p className="text-xs text-slate-700 leading-relaxed font-semibold">{item.situation}</p>
                </div>

                {/* Background */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-indigo-700 font-bold block mb-1">B - الخلفية الطبية Background</span>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">{item.background}</p>
                </div>

                {/* Assessment */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-indigo-700 font-bold block mb-1">A - التقييم السريري Assessment</span>
                  <p className="text-xs text-slate-700 leading-relaxed font-bold">{item.assessment}</p>
                </div>

                {/* Recommendation */}
                <div className="bg-indigo-50/30 p-4 rounded-xl border border-indigo-100">
                  <span className="text-[10px] text-indigo-800 font-bold block mb-1">R - التوصيات المطلوبة Recommendation</span>
                  <p className="text-xs text-indigo-950 leading-relaxed font-bold">{item.recommendation}</p>
                </div>

              </div>

              {/* Handover Footer / Acknowledgment */}
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100/50 mt-4 text-xs">
                <div>
                  {item.acknowledgedBy ? (
                    <div className="flex items-center gap-1.5 text-green-700 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>تم تأكيد الاستلام من قِبل: {item.acknowledgedBy}</span>
                      <span className="text-[10px] text-slate-400 font-normal">في: {new Date(item.acknowledgedAt!).toLocaleTimeString('ar-EG')}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-amber-600 font-semibold animate-pulse">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      <span>بانتظار تأكيد استلام المسؤولية السريرية للوردية القادمة</span>
                    </div>
                  )}
                </div>

                {!item.acknowledgedBy && (
                  <button 
                    onClick={() => handleAcknowledge(item)}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-4 py-1.5 rounded-lg transition-all"
                  >
                    أؤكد استلام الحالة كطبيب مستلم ✍️
                  </button>
                )}
              </div>

            </div>
          ))
        )}
      </div>

      {/* Create Handover Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white p-6 rounded-2xl max-w-lg w-full border border-slate-100 shadow-xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  تسجيل نموذج SBAR طبي متكامل لتسليم الوردية
                </h3>
                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold block">المريض المنوم المستهدف *</label>
                  <select 
                    value={patientId} 
                    onChange={(e) => setPatientId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    required
                  >
                    <option value="">اختر مريضاً لتسليمه...</option>
                    {activePatients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (سرير: {p.bedNumber})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">S (الوضع الراهن - Situation) *</label>
                    <textarea 
                      placeholder="لماذا الطفل منوم وما هي أزمته الحالية الحية؟"
                      value={situation}
                      onChange={(e) => setSituation(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-medium"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">B (الخلفية المرضية - Background) *</label>
                    <textarea 
                      placeholder="التاريخ المرضي المباشر، عمره، والقصة منذ دخوله المستشفى..."
                      value={background}
                      onChange={(e) => setBackground(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-medium"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">A (التقييم الطبي الحالي - Assessment) *</label>
                    <textarea 
                      placeholder="الفحص الطبي المحدث، أصوات الصدر، كفاية التنفس ونقاط PEWS..."
                      value={assessment}
                      onChange={(e) => setAssessment(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-medium"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">R (التوصيات والخطوات القادمة - Recommendation) *</label>
                    <textarea 
                      placeholder="ما المطلوب بدقة من الوردية القادمة القيام به بخصوصه؟"
                      value={recommendation}
                      onChange={(e) => setRecommendation(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-medium"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-red-50/50 rounded-xl border border-red-100">
                  <input 
                    type="checkbox" 
                    id="is_urgent_handover" 
                    checked={isUrgent}
                    onChange={(e) => setIsUrgent(e.target.checked)}
                    className="w-4.5 h-4.5 text-red-600 focus:ring-red-500 border-red-300 rounded"
                  />
                  <label htmlFor="is_urgent_handover" className="text-xs font-bold text-red-800 cursor-pointer">
                    🚨 وضع علامة (حالة عاجلة جداً): تتطلب توقيع استلام عاجل من المقيم المستلم فوراً.
                  </label>
                </div>

                {formError && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-100">
                    {formError}
                  </div>
                )}

                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <button 
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl flex-1 transition-all"
                  >
                    نشر وتعميم التسليم (SBAR)
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsOpen(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl transition-all"
                  >
                    إلغاء
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
