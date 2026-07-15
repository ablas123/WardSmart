/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ClinicSlot, User, hasPermission } from '../types';
import { CalendarRange, Plus, CheckCircle2, Clock, Trash2, X, Search, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ClinicQueueProps {
  clinicSlots: ClinicSlot[];
  currentUser: User;
  onAddSlot: (slot: ClinicSlot) => void;
  onUpdateSlot: (slotId: string, updates: Partial<ClinicSlot>) => void;
  onDeleteSlot: (slotId: string) => void;
  onAddAuditLog: (action: string, details: string) => void;
  lang?: any;
}

export default function ClinicQueue({ clinicSlots, currentUser, onAddSlot, onUpdateSlot, onDeleteSlot, onAddAuditLog, lang }: ClinicQueueProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [reason, setReason] = useState('');
  const [time, setTime] = useState('09:00');
  const [formError, setFormError] = useState<string | null>(null);

  const isManager = hasPermission(currentUser.role, 'manage_clinic');

  // Submit appointment
  const handleCreateSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName || !patientAge || !reason || !time) {
      setFormError('يرجى كتابة كافة التفاصيل لحجز موعد العيادة.');
      return;
    }

    const newSlot: ClinicSlot = {
      id: `cs-${Date.now()}`,
      time,
      patientName,
      age: patientAge,
      reason,
      status: 'waiting',
      updatedAt: Date.now()
    };

    onAddSlot(newSlot);
    onAddAuditLog('جدولة موعد في العيادة', `تم حجز موعد للطفل ${patientName} الساعة ${time} في العيادة الخارجية.`);

    setIsOpen(false);
    setPatientName('');
    setPatientAge('');
    setReason('');
    setTime('09:00');
    setFormError(null);
  };

  // Toggle Slot Status
  const handleToggleStatus = (slot: ClinicSlot) => {
    const newStatus: ClinicSlot['status'] = slot.status === 'waiting' ? 'completed' : 'waiting';
    onUpdateSlot(slot.id, {
      status: newStatus,
      updatedAt: Date.now()
    });

    onAddAuditLog('تحديث حالة موعد العيادة', `تم وضع علامة (${newStatus === 'completed' ? 'تمت المعاينة' : 'في الانتظار'}) للموعد الخاص بـ ${slot.patientName}.`);
  };

  // Sort slots by time ascending
  const sortedSlots = [...clinicSlots].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="space-y-6">
      
      {/* Clinic Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarRange className="w-6 h-6 text-blue-600" />
            حجوزات العيادة الخارجية والانتظار (Outpatient Clinic)
          </h1>
          <p className="text-xs text-slate-400 mt-1">تتبع مواعيد المراجعة، الاستشارات الدورية للأطفال، وإدارة تدفق غرف الكشف اليومية.</p>
        </div>

        {isManager && (
          <button 
            onClick={() => setIsOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-1 transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            حجز موعد عيادة
          </button>
        )}
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-3xs">
        <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-1">
          <Clock className="w-4 h-4 text-blue-500" />
          قائمة كشف المرضى وجدولة مواعيد اليوم
        </h2>

        {sortedSlots.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            لا توجد حجوزات عيادة مجدولة لليوم حتى الآن. 🗂️
          </div>
        ) : (
          <div className="space-y-3">
            {sortedSlots.map((slot) => (
              <div 
                key={slot.id} 
                className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border transition-all ${
                  slot.status === 'completed' 
                    ? 'bg-slate-50/50 border-slate-200 opacity-70' 
                    : 'bg-white border-slate-100 shadow-3xs hover:border-slate-200'
                }`}
              >
                <div className="flex items-start md:items-center gap-3.5">
                  {/* Time Badge */}
                  <div className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-xl border border-blue-100 text-xs flex items-center gap-1 shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    {slot.time}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-xs ${slot.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                        {slot.patientName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">العمر: {slot.age}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium block mt-0.5">سبب الاستشارة: {slot.reason}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 md:mt-0">
                  <button 
                    onClick={() => handleToggleStatus(slot)}
                    className={`text-[10px] px-3 py-1.5 rounded-lg font-bold border transition-all ${
                      slot.status === 'completed'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {slot.status === 'completed' ? '✓ اكتملت المعاينة' : 'بانتظار الطبيب الكاشف'}
                  </button>

                  {isManager && (
                    <button 
                      onClick={() => {
                        if (confirm('هل أنت متأكد من رغبتك في إلغاء وتراجع هذا الموعد؟')) {
                          onDeleteSlot(slot.id);
                          onAddAuditLog('إلغاء حجز موعد عيادة', `تم حذف حجز موعد الطفل ${slot.patientName} بنجاح.`);
                        }
                      }}
                      className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors border border-transparent hover:border-red-100"
                      title="حذف الموعد"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Appointment Booking Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white p-6 rounded-2xl max-w-md w-full border border-slate-100 shadow-xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  حجز وتحديد موعد مراجعة للعيادة الخارجية
                </h3>
                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSlot} className="space-y-4 text-xs">
                
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold block">اسم المريض (الطفل) *</label>
                  <input 
                    type="text" 
                    placeholder="مثل: عبد العزيز سعود العسيري"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-medium"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">العمر بالكامل *</label>
                    <input 
                      type="text" 
                      placeholder="مثل: سنتين ونصف"
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">توقيت المعاينة الدقيق *</label>
                    <input 
                      type="time" 
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold block">سبب الزيارة الطبية والاستشارة بالتفصيل *</label>
                  <textarea 
                    placeholder="اكتب التوصية الطبية والسبب (مثل: مراجعة مستويات حديد الدم)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-medium"
                    required
                  />
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
                    حفظ وجدولة الموعد للعيادة
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
