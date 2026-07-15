/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Patient, Task, SbarHandover, ClinicSlot, ChatMessage, AuditLogEntry, Alert, User } from '../types';

export interface SyncQueueAction {
  id: string;
  timestamp: number;
  collection: 'patients' | 'tasks' | 'handovers' | 'clinicSlots' | 'chatMessages' | 'auditLog' | 'alerts';
  operation: 'add' | 'update' | 'delete';
  itemId: string;
  data: any;
}

const STORAGE_KEYS = {
  PATIENTS: 'coreward_patients',
  TASKS: 'coreward_tasks',
  HANDOVERS: 'coreward_handovers',
  CLINIC: 'coreward_clinic',
  CHAT: 'coreward_chat',
  AUDIT: 'coreward_audit',
  ALERTS: 'coreward_alerts',
  SYNC_QUEUE: 'coreward_sync_queue',
  CURRENT_USER: 'coreward_current_user',
  TEAM_MEMBERS: 'coreward_team_members'
};

export const localDB = {
  get<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error(`Error reading ${key} from localStorage`, e);
      return defaultValue;
    }
  },

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Error saving ${key} to localStorage`, e);
    }
  },

  getPatients(): Patient[] {
    return localDB.get<Patient[]>(STORAGE_KEYS.PATIENTS, []);
  },

  getTasks(): Task[] {
    return localDB.get<Task[]>(STORAGE_KEYS.TASKS, []);
  },

  getHandovers(): SbarHandover[] {
    return localDB.get<SbarHandover[]>(STORAGE_KEYS.HANDOVERS, []);
  },

  getClinicSlots(): ClinicSlot[] {
    return localDB.get<ClinicSlot[]>(STORAGE_KEYS.CLINIC, []);
  },

  getChatMessages(): ChatMessage[] {
    return localDB.get<ChatMessage[]>(STORAGE_KEYS.CHAT, []);
  },

  getAuditLog(): AuditLogEntry[] {
    return localDB.get<AuditLogEntry[]>(STORAGE_KEYS.AUDIT, []);
  },

  getAlerts(): Alert[] {
    return localDB.get<Alert[]>(STORAGE_KEYS.ALERTS, []);
  },

  getSyncQueue(): SyncQueueAction[] {
    return localDB.get<SyncQueueAction[]>(STORAGE_KEYS.SYNC_QUEUE, []);
  },

  getCurrentUser(): User | null {
    return localDB.get<User | null>(STORAGE_KEYS.CURRENT_USER, null);
  },

  getTeamMembers(): User[] {
    return localDB.get<User[]>(STORAGE_KEYS.TEAM_MEMBERS, []);
  },

  // Save specific collection directly
  savePatients(patients: Patient[]): void { this.set(STORAGE_KEYS.PATIENTS, patients); },
  saveTasks(tasks: Task[]): void { this.set(STORAGE_KEYS.TASKS, tasks); },
  saveHandovers(handovers: SbarHandover[]): void { this.set(STORAGE_KEYS.HANDOVERS, handovers); },
  saveClinicSlots(slots: ClinicSlot[]): void { this.set(STORAGE_KEYS.CLINIC, slots); },
  saveChatMessages(messages: ChatMessage[]): void { this.set(STORAGE_KEYS.CHAT, messages); },
  saveAuditLog(audit: AuditLogEntry[]): void { this.set(STORAGE_KEYS.AUDIT, audit); },
  saveAlerts(alerts: Alert[]): void { this.set(STORAGE_KEYS.ALERTS, alerts); },
  saveSyncQueue(queue: SyncQueueAction[]): void { this.set(STORAGE_KEYS.SYNC_QUEUE, queue); },
  saveCurrentUser(user: User | null): void { this.set(STORAGE_KEYS.CURRENT_USER, user); },
  saveTeamMembers(members: User[]): void { this.set(STORAGE_KEYS.TEAM_MEMBERS, members); },

  // Add Sync Action to local queue
  queueSyncAction(
    collection: SyncQueueAction['collection'],
    operation: SyncQueueAction['operation'],
    itemId: string,
    data: any
  ): void {
    const queue = this.getSyncQueue();
    const action: SyncQueueAction = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: Date.now(),
      collection,
      operation,
      itemId,
      data
    };
    queue.push(action);
    this.saveSyncQueue(queue);
    
    // Trigger custom event to notify app about queue status
    window.dispatchEvent(new CustomEvent('sync_queue_changed', { detail: queue.length }));
  },

  clearSyncQueue(): void {
    this.saveSyncQueue([]);
    window.dispatchEvent(new CustomEvent('sync_queue_changed', { detail: 0 }));
  },

  clearAll(): void {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  }
};
