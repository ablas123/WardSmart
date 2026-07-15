/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuditLogEntry, User, getRoleColor, hasPermission } from '../types';
import { ShieldCheck, Printer, Search, RefreshCw, FileSpreadsheet, Lock } from 'lucide-react';

interface AuditLogProps {
  auditLog: AuditLogEntry[];
  currentUser: User;
  lang?: any;
}

export default function AuditLog({ auditLog, currentUser, lang }: AuditLogProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = auditLog.filter(log => 
    log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.details.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePrint = () => {
    window.print();
  };

  const hasAccess = hasPermission(currentUser.role, 'view_audit_log');

  if (!hasAccess) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-xs max-w-md mx-auto space-y-4">
        <Lock className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-800">صلاحية معطلة (إدارة القسم والأخصائيين فقط)</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          سجل الحسابات والعمليات السريرية (Audit Log) مخصص وحصري للإشراف السري الخاص بمدير قسم الأطفال والأخصائيين والنائب لضمان أمان البيانات وحماية الخصوصية.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4 print:p-0">
      
      {/* Header section (Hidden on print) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-green-600" />
            سجل العمليات والرقابة الفنية السريرية (Audit Trail)
          </h1>
          <p className="text-xs text-slate-400 mt-1">تتبع كافة ممارسات التعديل، الحذف، القبول، وتسجيل الدخول الطاقم الطبي بالجناح لضمان أمان البيانات وجودة الرعاية.</p>
        </div>

        <button 
          onClick={handlePrint}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-1 transition-all border border-slate-200"
        >
          <Printer className="w-4 h-4 text-slate-500" />
          طباعة وتصدير التقرير الرقابي الرسمى
        </button>
      </div>

      {/* Main Table section */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-3xs print:border-none print:shadow-none print:p-0">
        
        {/* Printable Official Header */}
        <div className="hidden print:block text-center space-y-2 border-b-2 border-slate-900 pb-4 mb-6">
          <h1 className="text-xl font-bold text-slate-900">مستشفى الملك فهد للأطفال والولادة</h1>
          <h2 className="text-md font-bold text-slate-800">تقرير الرقابة السريرية والتدقيق الأمني لقسم تنويم الأطفال - CoreWard</h2>
          <div className="flex justify-between text-xs text-slate-600 pt-1">
            <span>تاريخ إصدار التقرير: {new Date().toLocaleDateString('ar-EG')}</span>
            <span>مدير القسم المشرف: {currentUser.name}</span>
          </div>
        </div>

        {/* Search filter (Hidden on print) */}
        <div className="flex justify-between items-center mb-4 gap-4 print:hidden">
          <div className="relative w-full md:w-72">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="البحث بالفاعل، الإجراء، أو التفاصيل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <span className="text-[10px] text-slate-400 font-bold">
            عرض {filteredLogs.length} عملية تدقيق مسجلة بالنظام
          </span>
        </div>

        {/* Audit Log list */}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 print:bg-slate-100 print:text-slate-900 print:border-slate-800">
                <th className="p-3">توقيت العملية</th>
                <th className="p-3">الطبيب الفاعل</th>
                <th className="p-3">فئته الطبية</th>
                <th className="p-3">طبيعة الإجراء</th>
                <th className="p-3">التفاصيل السريرية المعززة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs print:divide-slate-300">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-3 text-slate-500 whitespace-nowrap print:text-slate-900">
                    {new Date(log.timestamp).toLocaleString('ar-EG')}
                  </td>
                  <td className="p-3 font-bold text-slate-800 print:text-slate-900">
                    {log.userName}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border print:border-none print:px-0 print:text-slate-900 ${getRoleColor(log.userRole)}`}>
                      {log.userRole}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-blue-700 print:text-slate-900">
                    {log.action}
                  </td>
                  <td className="p-3 text-slate-600 font-medium leading-relaxed max-w-sm print:text-slate-900">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Printable Footer */}
        <div className="hidden print:block text-center text-[10px] text-slate-400 border-t border-slate-200 mt-8 pt-4">
          تقرير رقابة أمني مشفّر وتلقائي صادر عن جناح تنويم الأطفال والولادة الملكي الذكي CoreWard - ٢٠٢٦
        </div>

      </div>

    </div>
  );
}
