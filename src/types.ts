/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'Director' | 'Specialist' | 'Deputy' | 'General' | 'Intern';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string;
}

export interface VitalRecord {
  timestamp: string;
  temp: number; // °C
  heartRate: number; // bpm
  respRate: number; // breaths/min
  systolicBp: number;
  diastolicBp: number;
  spo2: number; // %
  author: string;
}

export interface GrowthRecord {
  ageMonths: number;
  weightKg: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  wazScore?: number;
  hazScore?: number;
  hczScore?: number;
  malnutritionGrade?: string;
  standard?: 'WHO' | 'CDC';
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  status: 'active' | 'completed' | 'paused';
}

export interface SoapEntry {
  id: string;
  timestamp: string;
  author: string;
  role: UserRole;
  s: string; // Subjective
  o: string; // Objective
  a: string; // Assessment
  p: string; // Plan
}

export interface Patient {
  id: string;
  name: string;
  age: string; // e.g. "3 years", "18 months"
  gender: 'male' | 'female';
  bedNumber: string;
  status: 'stable' | 'followup' | 'critical' | 'discharged';
  admissionDate: string;
  assignedInternId: string;
  assignedInternName: string;
  symptoms: string;
  diagnosis: string;
  
  // Clinical data
  vitalsHistory: VitalRecord[];
  growthHistory: GrowthRecord[];
  medications: Medication[];
  soapHistory: SoapEntry[];
  
  // Medical history
  allergies: string;
  pastHistory: string;
  
  // Discharge summary
  dischargeChecklist: {
    id: string;
    item: string;
    completed: boolean;
  }[];
  dischargeNotes?: string;
  dischargedAt?: string;

  updatedAt: number;
}

export interface Task {
  id: string;
  patientId: string;
  patientName: string;
  description: string;
  assigneeRole: UserRole;
  priority: 'high' | 'medium' | 'low';
  dueDate: string; // YYYY-MM-DD
  dueTime: string; // HH:MM
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
  updatedAt: number;
}

export interface SbarHandover {
  id: string;
  patientId: string;
  patientName: string;
  timestamp: string;
  senderName: string;
  senderRole: UserRole;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  isUrgent: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  updatedAt: number;
}

export interface ClinicSlot {
  id: string;
  time: string; // HH:MM
  patientName: string;
  age: string;
  reason: string;
  status: 'waiting' | 'completed';
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderRole: UserRole;
  timestamp: string;
  text: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
}

export interface Alert {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  targetRole: 'all' | UserRole;
  targetUserId: 'all' | string;
  type: 'info' | 'warning' | 'urgent';
  read: boolean;
}

// Permissions Check helper
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  Director: [
    'manage_users', 'view_patients', 'admit_patients', 'update_vitals', 'write_notes', 'discharge_patients',
    'create_tasks', 'complete_tasks', 'create_handovers', 'acknowledge_handovers', 'manage_clinic',
    'send_chat', 'view_audit_log', 'add_alert'
  ],
  Specialist: [
    'manage_users', 'view_patients', 'admit_patients', 'update_vitals', 'write_notes', 'discharge_patients',
    'create_tasks', 'complete_tasks', 'create_handovers', 'acknowledge_handovers', 'manage_clinic',
    'send_chat', 'view_audit_log', 'add_alert'
  ],
  Deputy: [
    'manage_users', 'view_patients', 'admit_patients', 'update_vitals', 'write_notes', 'discharge_patients',
    'create_tasks', 'complete_tasks', 'create_handovers', 'acknowledge_handovers', 'manage_clinic',
    'send_chat', 'view_audit_log', 'add_alert'
  ],
  General: [
    'view_patients', 'admit_patients', 'update_vitals', 'write_notes', 'discharge_patients',
    'create_tasks', 'complete_tasks', 'create_handovers', 'acknowledge_handovers',
    'send_chat', 'add_alert'
  ],
  Intern: [
    'view_patients', 'admit_patients', 'update_vitals', 'write_notes',
    'create_tasks', 'complete_tasks', 'create_handovers', 'acknowledge_handovers',
    'send_chat'
  ]
};

export function hasPermission(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}

export function getRoleLabel(role: UserRole, lang: 'ar' | 'en' = 'ar'): string {
  const isEn = lang === 'en';
  switch (role) {
    case 'Director': return isEn ? 'Director' : 'مدير القسم (Director)';
    case 'Specialist': return isEn ? 'Specialist' : 'أخصائي (Specialist)';
    case 'Deputy': return isEn ? 'Deputy' : 'نائب استشاري (Deputy)';
    case 'General': return isEn ? 'General Physician' : 'طبيب عام (General)';
    case 'Intern': return isEn ? 'Pediatric Intern' : 'طبيب امتياز (Intern)';
    default: return role;
  }
}

export function getRoleColor(role: UserRole): string {
  switch (role) {
    case 'Director': return 'bg-red-100 text-red-800 border-red-200';
    case 'Specialist': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'Deputy': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'General': return 'bg-green-100 text-green-800 border-green-200';
    case 'Intern': return 'bg-orange-100 text-orange-800 border-orange-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}
