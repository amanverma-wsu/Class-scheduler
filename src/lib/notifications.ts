import { Task } from '@/lib/types';

// ── Reminder intervals ──────────────────────────────────────────────
export interface ReminderInterval {
  label: string;
  ms: number;
  enabled: boolean;
}

const DEFAULT_INTERVALS: ReminderInterval[] = [
  { label: '6 hours',    ms: 6 * 60 * 60 * 1000, enabled: true },
  { label: '3 hours',    ms: 3 * 60 * 60 * 1000, enabled: true },
  { label: '1 hour',     ms: 1 * 60 * 60 * 1000, enabled: true },
  { label: '10 minutes', ms: 10 * 60 * 1000,     enabled: true },
];

const FIRED_KEY = 'canvas-notification-fired';
const SETTINGS_KEY = 'canvas-notification-settings';
const SOUND_KEY = 'canvas-notification-sound';

let activeTimers: ReturnType<typeof setTimeout>[] = [];

// ── Settings persistence ────────────────────────────────────────────

export function loadIntervalSettings(): ReminderInterval[] {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_INTERVALS.map(i => ({ ...i }));
    const saved = JSON.parse(raw) as { label: string; enabled: boolean }[];
    return DEFAULT_INTERVALS.map(def => {
      const match = saved.find(s => s.label === def.label);
      return { ...def, enabled: match ? match.enabled : def.enabled };
    });
  } catch {
    return DEFAULT_INTERVALS.map(i => ({ ...i }));
  }
}

export function saveIntervalSettings(intervals: ReminderInterval[]) {
  try {
    const data = intervals.map(i => ({ label: i.label, enabled: i.enabled }));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

export function isSoundEnabled(): boolean {
  try {
    const val = localStorage.getItem(SOUND_KEY);
    return val === null ? true : val === 'true';
  } catch { return true; }
}

export function setSoundEnabled(enabled: boolean) {
  try { localStorage.setItem(SOUND_KEY, String(enabled)); } catch { /* ignore */ }
}

// ── Fired tracking ──────────────────────────────────────────────────

function loadFired(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

function saveFired(fired: Set<string>) {
  try { localStorage.setItem(FIRED_KEY, JSON.stringify([...fired])); } catch { /* ignore */ }
}

function markFired(tag: string) {
  const fired = loadFired();
  fired.add(tag);
  saveFired(fired);
}

function reminderKey(taskId: string, label: string): string {
  return `${taskId}::${label}`;
}

// ── Sound ───────────────────────────────────────────────────────────

function playNotificationSound() {
  if (!isSoundEnabled()) return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);

    setTimeout(() => ctx.close(), 500);
  } catch { /* AudioContext may not be available */ }
}

// ── Service Worker ──────────────────────────────────────────────────

let swRegistration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;

  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js');

    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, tag } = event.data || {};
      if (type === 'NOTIFICATION_FIRED' && tag) {
        markFired(tag);
        playNotificationSound();
      }
    });

    return true;
  } catch (err) {
    console.warn('Service Worker registration failed:', err);
    return false;
  }
}

function sendToSW(message: unknown) {
  if (swRegistration?.active) {
    swRegistration.active.postMessage(message);
  }
}

// ── Fire notification (in-page fallback) ────────────────────────────

function fireNotification(task: Task, label: string) {
  if (typeof window === 'undefined' || Notification.permission !== 'granted') return;

  const fired = loadFired();
  const key = reminderKey(task.id, label);
  if (fired.has(key)) return;

  try {
    new Notification(`⏰ ${task.title}`, {
      body: `Due in ${label}${task.courseName ? ` · ${task.courseName}` : ''}`,
      icon: '/favicon.ico',
      tag: key,
      requireInteraction: true,
    });
    markFired(key);
    playNotificationSound();
  } catch { /* Notification API may throw */ }
}

// ── Schedule notifications ──────────────────────────────────────────

export function scheduleNotifications(tasks: Task[]) {
  clearAllTimers();

  if (typeof window === 'undefined' || Notification.permission !== 'granted') return;

  const intervals = loadIntervalSettings().filter(i => i.enabled);
  const now = Date.now();
  const fired = loadFired();

  // Delegate to Service Worker for background notifications
  if (swRegistration?.active) {
    sendToSW({
      type: 'SCHEDULE_NOTIFICATIONS',
      payload: {
        tasks: tasks.map(t => ({
          id: t.id,
          title: t.title,
          dueDate: t.dueDate,
          courseName: t.courseName,
          url: t.url,
        })),
        firedKeys: [...fired],
      },
    });
  }

  // Also schedule in-page as fallback
  for (const task of tasks) {
    const dueMs = new Date(task.dueDate).getTime();
    if (isNaN(dueMs)) continue;

    for (const interval of intervals) {
      const key = reminderKey(task.id, interval.label);
      if (fired.has(key)) continue;

      const fireAt = dueMs - interval.ms;
      const delay = fireAt - now;

      if (delay <= 0 && dueMs > now) {
        fireNotification(task, interval.label);
      } else if (delay > 0) {
        const timer = setTimeout(() => {
          fireNotification(task, interval.label);
        }, delay);
        activeTimers.push(timer);
      }
    }
  }
}

export function clearAllTimers() {
  for (const timer of activeTimers) clearTimeout(timer);
  activeTimers = [];
}

export function pruneOldNotifications(currentTaskIds: Set<string>) {
  const fired = loadFired();
  const pruned = new Set<string>();
  for (const key of fired) {
    const taskId = key.split('::')[0];
    if (currentTaskIds.has(taskId)) {
      pruned.add(key);
    }
  }
  if (pruned.size !== fired.size) {
    saveFired(pruned);
  }
}

export function getReminderIntervals(): ReminderInterval[] {
  return loadIntervalSettings();
}