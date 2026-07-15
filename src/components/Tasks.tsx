/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Task, Patient, User, UserRole, hasPermission } from '../types';
import { CheckSquare, Square, Plus, Trash2, Calendar, Clock, AlertCircle, Check, X, Search, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TasksProps {
  tasks: Task[];
  patients: Patient[];
  currentUser: User;
  onAddTask: (task: Task) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onAddAuditLog: (action: string, details: string) => void;
  lang?: any;
}

export default function Tasks({ tasks, patients, currentUser, onAddTask, onUpdateTask, onDeleteTask, onAddAuditLog, lang }: TasksProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'my_role' | 'all'>('my_role');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Task Form states
  const [taskPatientId, setTaskPatientId] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskRole, setTaskRole] = useState<UserRole>('Intern');
  const [taskPriority, setTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [taskDate, setTaskDate] = useState(new Date().toISOString().split('T')[0]);
  const [taskTime, setTaskTime] = useState('12:00');
  const [formError, setFormError] = useState<string | null>(null);

  const activePatients = patients.filter(p => p.status !== 'discharged');

  // Verify due states
  const checkTaskStatus = (task: Task) => {
    if (task.completed) return { label: 'مكتملة', color: 'text-green-600 bg-green-50' };

    const now = new Date();
    const [dueYear, dueMonth, dueDay] = task.dueDate.split('-').map(Number);
    const [dueHour, dueMinute] = task.dueTime.split(':').map(Number);
    const dueDateTime = new Date(dueYear, dueMonth - 1, dueDay, dueHour, dueMinute);

    if (dueDateTime < now) {
      return { label: '⏰ متأخرة (Overdue)', color: 'text-red-600 bg-red-50 animate-pulse font-bold' };
    }

    const timeDiffHrs = (dueDateTime.getTime() - now.getTime()) / 3600000;
    if (timeDiffHrs > 0 && timeDiffHrs <= 2) {
      return { label: '🕐 حان وقتها قريباً (Due Soon)', color: 'text-amber-600 bg-amber-50 font-bold' };
    }

    return { label: 'مجدولة', color: 'text-slate-500 bg-slate-50' };
  };

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.patientName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterMode === 'all' ? true : t.assigneeRole === currentUser.role;
    return matchesSearch && matchesRole;
  }).sort((a, b) => {
    // Sort uncompleted high priority first
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.priority !== b.priority) {
      if (a.priority === 'high') return -1;
      if (b.priority === 'high') return 1;
    }
    return a.dueDate.localeCompare(b.dueDate) || a.dueTime.localeCompare(b.dueTime);
  });

  const pendingCount = tasks.filter(t => !t.completed && t.assigneeRole === currentUser.role).length;

  // Handle Form Submit
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskPatientId || !taskDesc || !taskRole) {
      setFormError('يرجى ملء كافة الخانات وتحديد المريض المكلف بالمهمة.');
      return;
    }

    const selectedPatient = patients.find(p => p.id === taskPatientId);
    if (!selectedPatient) return;

    const newTask: Task = {
      id: `t-${Date.now()}`,
      patientId: taskPatientId,
      patientName: selectedPatient.name,
      description: taskDesc,
      assigneeRole: taskRole,
      priority: taskPriority,
      dueDate: taskDate,
      dueTime: taskTime,
      completed: false,
      updatedAt: Date.now()
    };

    onAddTask(newTask);
    onAddAuditLog('إسناد مهمة سريرية', `تم إسناد مهمة جديدة (${taskDesc}) لطاقم ${taskRole} بخصوص الطفل ${selectedPatient.name}.`);

    setIsAddOpen(false);
    setTaskDesc('');
    setTaskPatientId('');
    setFormError(null);
  };

  // Toggle completion
  const handleToggleComplete = (task: Task) => {
    const updatedStatus = !task.completed;
    onUpdateTask(task.id, {
      completed: updatedStatus,
      completedBy: updatedStatus ? currentUser.name : undefined,
      completedAt: updatedStatus ? new Date().toISOString() : undefined,
      updatedAt: Date.now()
    });

    onAddAuditLog(
      updatedStatus ? 'إكمال مهمة سريرية' : 'إلغاء إكمال مهمة',
      `تم تحديد المهمة (${task.description}) للمريض ${task.patientName} كـ ${updatedStatus ? 'مكتملة' : 'معلقة'} بواسطة ${currentUser.name}.`
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Task Bio Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-indigo-600" />
            جدول المهام والإجراءات السريرية
          </h1>
          <p className="text-xs text-slate-400 mt-1">تتبع المهام العلاجية، الفحوصات اليومية، وتوزيع الأدوار على الطاقم الطبي بالجناح.</p>
        </div>

        <div className="flex gap-2">
          {pendingCount > 0 && (
            <span className="bg-red-50 text-red-600 text-xs px-3 py-1.5 rounded-xl font-bold border border-red-100 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              لديك {pendingCount} مهام معلقة لدورك الطبي!
            </span>
          )}

          {hasPermission(currentUser.role, 'create_tasks') && (
            <button 
              onClick={() => setIsAddOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-1 transition-all shadow-xs"
            >
              <Plus className="w-4 h-4" />
              إسناد مهمة جديدة
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Filters & Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-3xs overflow-hidden">
        
        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
          <div className="flex gap-1.5 w-full md:w-auto">
            <button
              onClick={() => setFilterMode('my_role')}
              className={`text-xs px-4 py-2 rounded-xl font-bold border transition-all ${
                filterMode === 'my_role'
                  ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              مهام كادري الطبي ({currentUser.role})
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`text-xs px-4 py-2 rounded-xl font-bold border transition-all ${
                filterMode === 'all'
                  ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              عرض مهام الجناح بأكمله
            </button>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="البحث عن اسم الطفل أو المهمة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Tasks List Table */}
        <div className="overflow-x-auto">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              لا توجد مهام مطابقة لخيارات التصفية حالياً. 👍
            </div>
          ) : (
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                  <th className="p-4">حالة الإنجاز</th>
                  <th className="p-4">المريض والموقع</th>
                  <th className="p-4">تفاصيل الإجراء الطبي المطلوب</th>
                  <th className="p-4">الفئة المكلفة</th>
                  <th className="p-4">مستوى الأهمية</th>
                  <th className="p-4">الموعد المستهدف</th>
                  <th className="p-4">المسؤول عن التوقيع</th>
                  <th className="p-4 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTasks.map((task) => {
                  const status = checkTaskStatus(task);
                  return (
                    <tr 
                      key={task.id} 
                      className={`hover:bg-slate-50/50 transition-colors ${
                        task.completed ? 'opacity-65 bg-slate-50/20' : ''
                      }`}
                    >
                      <td className="p-4">
                        <button 
                          onClick={() => handleToggleComplete(task)}
                          className="focus:outline-none"
                        >
                          {task.completed ? (
                            <CheckSquare className="w-5 h-5 text-green-600 fill-green-50" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300 hover:text-indigo-600" />
                          )}
                        </button>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-slate-800 block">{task.patientName}</span>
                        <span className="text-[10px] text-slate-400">السرير: {patients.find(p => p.id === task.patientId)?.bedNumber || '--'}</span>
                      </td>
                      <td className="p-4 max-w-xs font-semibold text-slate-700">
                        {task.description}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 font-bold rounded-lg text-[10px]">{task.assigneeRole}</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${
                          task.priority === 'high' ? 'bg-red-100 text-red-800' :
                          task.priority === 'medium' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {task.priority === 'high' ? 'عاجل جداً' : task.priority === 'medium' ? 'متوسط' : 'عادي'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col text-[10px] text-slate-500 gap-0.5">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400" /> {task.dueDate}</span>
                          <span className="flex items-center gap-1 font-semibold text-slate-700"><Clock className="w-3 h-3 text-slate-400" /> {task.dueTime}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold block w-max ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="p-4">
                        {task.completedBy && (
                          <div className="text-[10px] text-slate-400">
                            أنجزها: <span className="font-bold text-slate-600">{task.completedBy}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-left">
                        {hasPermission(currentUser.role, 'create_tasks') && (
                          <button 
                            onClick={() => {
                              if (confirm('هل أنت متأكد من رغبتك في حذف هذه المهمة من النظام؟')) {
                                onDeleteTask(task.id);
                                onAddAuditLog('حذف مهمة', `تم حذف المهمة السريرية (${task.description}) للمريض ${task.patientName}.`);
                              }
                            }}
                            className="p-1 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                            title="حذف المهمة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* Add Task Modal */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white p-6 rounded-2xl max-w-md w-full border border-slate-100 shadow-xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800">إسناد وتكليف مهمة طبية جديدة</h3>
                <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold block">اختر الطفل المريض المستهدف *</label>
                  <select 
                    value={taskPatientId}
                    onChange={(e) => setTaskPatientId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    required
                  >
                    <option value="">اختر مريضاً من القائمة...</option>
                    {activePatients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (سرير: {p.bedNumber})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold block">تفاصيل الإجراء والمهمة المطلوبة *</label>
                  <input 
                    type="text" 
                    placeholder="مثال: سحب دم لإجراء تحليل غازات الدم الشرياني"
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">الفئة الطبية المكلفة *</label>
                    <select 
                      value={taskRole}
                      onChange={(e) => setTaskRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    >
                      <option value="Intern">طبيب امتياز (Intern)</option>
                      <option value="General">طبيب عام (General)</option>
                      <option value="Deputy">نائب استشاري (Deputy)</option>
                      <option value="Specialist">أخصائي (Specialist)</option>
                      <option value="Director">مدير القسم (Director)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">مستوى الأولوية والخطورة *</label>
                    <select 
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    >
                      <option value="low">عادي (Low)</option>
                      <option value="medium">متوسط (Medium)</option>
                      <option value="high">عاجل جداً (High)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">تاريخ الاستحقاق *</label>
                    <input 
                      type="date"
                      value={taskDate}
                      onChange={(e) => setTaskDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">توقيت الاستحقاق الأقصى *</label>
                    <input 
                      type="time"
                      value={taskTime}
                      onChange={(e) => setTaskTime(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                      required
                    />
                  </div>
                </div>

                {formError && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs border border-red-100">
                    {formError}
                  </div>
                )}

                <div className="flex gap-2 pt-3">
                  <button 
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-xl font-bold flex-1 transition-all"
                  >
                    حفظ وإسناد المهمة للمناوبة
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-xl font-bold transition-all"
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
