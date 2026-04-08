'use client';

import { useState, useEffect, useCallback } from 'react';
import { Task } from '@/lib/types';

const FEED_URL_KEY = 'canvas-feed-url';
const COMPLETED_KEY = 'canvas-completed-tasks';
const URGENT_COUNT_KEY = 'canvas-urgent-count';
// sessionStorage key — tasks are only notified once per browser session
const NOTIFIED_SESSION_KEY = 'canvas-notified-session';

function loadCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(COMPLETED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

function saveCompleted(ids: Set<string>) {
  try { localStorage.setItem(COMPLETED_KEY, JSON.stringify([...ids])); } catch { /* ignore */ }
}

function groupTasks(tasks: Task[], completed: Set<string>) {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(todayEnd); weekEnd.setDate(weekEnd.getDate() + 6);

  const overdue: Task[] = [], today: Task[] = [], week: Task[] = [], later: Task[] = [], done: Task[] = [];
  for (const t of tasks) {
    if (completed.has(t.id)) { done.push(t); continue; }
    const due = new Date(t.dueDate);
    if (due < todayStart) overdue.push(t);
    else if (due <= todayEnd) today.push(t);
    else if (due <= weekEnd) week.push(t);
    else later.push(t);
  }
  return { overdue, today, week, later, done };
}

function formatDue(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short', day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  };
  const datePart = d.toLocaleDateString(undefined, opts);
  if (d.getHours() === 23 && d.getMinutes() === 59) return datePart;
  const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${datePart} at ${timePart}`;
}

// Fire browser notifications for urgent tasks — deduped per session
function fireNotifications(urgentTasks: Task[]) {
  if (typeof window === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const raw = sessionStorage.getItem(NOTIFIED_SESSION_KEY);
    const notified = new Set<string>(raw ? JSON.parse(raw) : []);
    let changed = false;

    for (const t of urgentTasks) {
      if (notified.has(t.id)) continue;
      const isOverdue = new Date(t.dueDate) < new Date();
      new Notification(isOverdue ? `Overdue: ${t.title}` : `Due today: ${t.title}`, {
        body: [t.courseName, formatDue(t.dueDate)].filter(Boolean).join(' · '),
        icon: '/favicon.ico',
        tag: t.id, // prevents duplicate OS-level notifications
      });
      notified.add(t.id);
      changed = true;
    }
    if (changed) sessionStorage.setItem(NOTIFIED_SESSION_KEY, JSON.stringify([...notified]));
  } catch { /* Notification API may throw in some contexts */ }
}

const TYPE_ICON: Record<string, string> = {
  assignment: '📝', quiz: '📋', discussion: '💬', event: '📅', other: '•',
};

interface TaskItemProps { task: Task; completed: boolean; onToggle: (id: string) => void; }

function TaskItem({ task, completed, onToggle }: TaskItemProps) {
  return (
    <div className={`flex items-start gap-3 py-2.5 px-1 transition-colors ${completed ? 'opacity-50' : ''}`}>
      <button
        onClick={() => onToggle(task.id)}
        className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded border-2 transition-all ${
          completed
            ? 'bg-green-500 border-green-500 flex items-center justify-center'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
        }`}
        aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {completed && <span className="text-white text-xs leading-none">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1.5 flex-wrap">
          <span className="text-sm">{TYPE_ICON[task.type] ?? '•'}</span>
          <span className={`text-sm font-medium text-gray-800 dark:text-gray-200 ${completed ? 'line-through' : ''} break-words`}>
            {task.title}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          {task.courseName && (
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{task.courseName}</span>
          )}
          <span className="text-xs text-gray-400 dark:text-gray-500">{formatDue(task.dueDate)}</span>
          {task.url && (
            <a href={task.url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
              title="Open in Canvas">↗</a>
          )}
        </div>
      </div>
    </div>
  );
}

interface SectionProps { label: string; labelClass?: string; tasks: Task[]; completed: Set<string>; onToggle: (id: string) => void; }

function Section({ label, labelClass = '', tasks, completed, onToggle }: SectionProps) {
  if (tasks.length === 0) return null;
  return (
    <div className="mb-4">
      <h3 className={`text-xs font-bold uppercase tracking-wider mb-1 ${labelClass || 'text-gray-500 dark:text-gray-400'}`}>
        {label} <span className="font-normal normal-case tracking-normal opacity-60">({tasks.length})</span>
      </h3>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {tasks.map(t => <TaskItem key={t.id} task={t} completed={completed.has(t.id)} onToggle={onToggle} />)}
      </div>
    </div>
  );
}

interface TasksPanelProps {
  onUrgentCount?: (count: number) => void;
}

export default function TasksPanel({ onUrgentCount }: TasksPanelProps) {
  const [feedUrl, setFeedUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    const saved = localStorage.getItem(FEED_URL_KEY) ?? '';
    setFeedUrl(saved);
    setInputUrl(saved);
    setCompleted(loadCompleted());
    if (typeof Notification !== 'undefined') setNotifPermission(Notification.permission);
  }, []);

  const fetchTasks = useCallback(async (url: string) => {
    if (!url) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/tasks?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setTasks([]); }
      else setTasks(data.tasks ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load tasks';
      setError(msg.includes('timeout') || msg.includes('abort') ? 'Request timed out' : msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (feedUrl) fetchTasks(feedUrl); }, [feedUrl, fetchTasks]);

  // When tasks change, report urgent count + fire notifications
  useEffect(() => {
    if (tasks.length === 0) return;
    const { overdue, today } = groupTasks(tasks, completed);
    const urgent = [...overdue, ...today];
    const count = urgent.length;
    // Persist for badge shown on other views
    try { localStorage.setItem(URGENT_COUNT_KEY, String(count)); } catch { /* ignore */ }
    onUrgentCount?.(count);
    fireNotifications(urgent);
  }, [tasks, completed, onUrgentCount]);

  async function requestNotifications() {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      const { overdue, today } = groupTasks(tasks, completed);
      fireNotifications([...overdue, ...today]);
    }
  }

  function handleSaveUrl() {
    const url = inputUrl.trim();
    if (!url) return;
    localStorage.setItem(FEED_URL_KEY, url);
    setFeedUrl(url);
    setShowSetup(false);
  }

  function handleClearUrl() {
    localStorage.removeItem(FEED_URL_KEY);
    localStorage.removeItem(URGENT_COUNT_KEY);
    setFeedUrl(''); setInputUrl(''); setTasks([]); setError('');
    onUrgentCount?.(0);
  }

  function toggleComplete(id: string) {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveCompleted(next);
      return next;
    });
  }

  const { overdue, today, week, later, done } = groupTasks(tasks, completed);

  // ── No feed connected ──────────────────────────────────────────────
  if (!feedUrl && !showSetup) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
        <div className="text-4xl mb-3">📚</div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Canvas Tasks</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Connect your Canvas calendar to see assignments and due dates here.
        </p>
        <button onClick={() => setShowSetup(true)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
          Connect Canvas Calendar
        </button>
      </div>
    );
  }

  // ── Setup form ─────────────────────────────────────────────────────
  if (showSetup || (!feedUrl && !loading)) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Connect Canvas Calendar</h2>
          {feedUrl && (
            <button onClick={() => setShowSetup(false)} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Cancel</button>
          )}
        </div>
        <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-4 list-decimal list-inside">
          <li>Open Canvas → <strong>Calendar</strong></li>
          <li>Click <strong className="text-blue-600 dark:text-blue-400">Calendar Feed</strong> (bottom-right)</li>
          <li>Copy the calendar URL and paste it below</li>
        </ol>
        <div className="flex gap-2">
          <input type="url" value={inputUrl} onChange={e => setInputUrl(e.target.value)}
            placeholder="https://wsu.instructure.com/feeds/calendars/user_..."
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 placeholder-gray-400" />
          <button onClick={handleSaveUrl} disabled={!inputUrl.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
            Connect
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Your calendar URL stays on your device and is never shared.
        </p>
      </div>
    );
  }

  // ── Main panel ─────────────────────────────────────────────────────
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <h2 className="font-bold text-gray-900 dark:text-white text-sm">
          Canvas Tasks
          {tasks.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">{tasks.length - done.length} remaining</span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          {/* Notification bell */}
          {notifPermission !== 'denied' && tasks.length > 0 && (
            notifPermission === 'granted' ? (
              <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1" title="Notifications enabled">
                🔔 On
              </span>
            ) : (
              <button onClick={requestNotifications}
                className="text-xs text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
                title="Enable due-date notifications">
                🔔 Enable alerts
              </button>
            )
          )}
          {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
          <button onClick={() => fetchTasks(feedUrl)} disabled={loading}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-40 transition-colors" title="Refresh">
            ↻ Refresh
          </button>
          <button onClick={() => setShowSetup(true)}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="Change Canvas URL">
            ⚙
          </button>
        </div>
      </div>

      <div className="px-5 py-3">
        {/* Error */}
        {error && !loading && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 mb-3 text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-400">Could not load tasks</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">{error}</p>
            <div className="flex gap-3 mt-2">
              <button onClick={() => fetchTasks(feedUrl)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Try again</button>
              <button onClick={handleClearUrl} className="text-xs text-gray-400 hover:underline">Change URL</button>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && tasks.length === 0 && (
          <div className="space-y-3 py-2">
            {[1,2,3].map(i => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-4 h-4 mt-0.5 rounded bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                  <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && tasks.length === 0 && (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <div className="text-2xl mb-2">🎉</div>
            <p className="text-sm font-medium">No upcoming tasks</p>
            <p className="text-xs">Canvas calendar is connected</p>
          </div>
        )}

        {/* Tasks */}
        {!loading && tasks.length > 0 && (
          <>
            <Section label="Overdue" labelClass="text-red-500 dark:text-red-400" tasks={overdue} completed={completed} onToggle={toggleComplete} />
            <Section label="Today" labelClass="text-orange-500 dark:text-orange-400" tasks={today} completed={completed} onToggle={toggleComplete} />
            <Section label="This Week" labelClass="text-blue-600 dark:text-blue-400" tasks={week} completed={completed} onToggle={toggleComplete} />
            <Section label="Later" tasks={later} completed={completed} onToggle={toggleComplete} />

            {done.length > 0 && (
              <div>
                <button onClick={() => setShowDone(v => !v)}
                  className="text-xs text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors mb-1">
                  {showDone ? '▾' : '▸'} Completed ({done.length})
                </button>
                {showDone && (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {done.map(t => <TaskItem key={t.id} task={t} completed onToggle={toggleComplete} />)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
