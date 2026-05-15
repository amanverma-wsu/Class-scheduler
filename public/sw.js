// Service Worker for Class Scheduler — handles push-style notifications
// even when the main tab is in the background or closed.

const CACHE_NAME = 'class-scheduler-sw-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for messages from the main thread to schedule notifications
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  if (type === 'SCHEDULE_NOTIFICATIONS') {
    scheduleAll(payload.tasks, payload.firedKeys);
  }

  if (type === 'CLEAR_NOTIFICATIONS') {
    clearAllAlarms();
  }
});

// ── Alarm-based scheduling ──────────────────────────────────────────
// Service workers can't use setTimeout reliably (they get killed).
// Instead we store scheduled times and use a periodic self-wake via
// a single setTimeout that re-checks every 30 seconds.

let scheduledReminders = []; // { fireAt, title, body, tag }
let checkTimer = null;

const REMINDER_INTERVALS = [
  { label: '6 hours',    ms: 6 * 60 * 60 * 1000 },
  { label: '3 hours',    ms: 3 * 60 * 60 * 1000 },
  { label: '1 hour',     ms: 1 * 60 * 60 * 1000 },
  { label: '10 minutes', ms: 10 * 60 * 1000 },
];

function scheduleAll(tasks, firedKeys) {
  const firedSet = new Set(firedKeys || []);
  scheduledReminders = [];
  const now = Date.now();

  for (const task of tasks) {
    const dueMs = new Date(task.dueDate).getTime();
    if (isNaN(dueMs) || dueMs <= now) continue;

    for (const interval of REMINDER_INTERVALS) {
      const tag = `${task.id}::${interval.label}`;
      if (firedSet.has(tag)) continue;

      const fireAt = dueMs - interval.ms;
      if (fireAt <= now) {
        // Should have fired already — fire now
        showNotification(task, interval.label, tag);
        notifyClientFired(tag);
      } else {
        scheduledReminders.push({
          fireAt,
          title: `⏰ ${task.title}`,
          body: `Due in ${interval.label}${task.courseName ? ` · ${task.courseName}` : ''}`,
          tag,
          url: task.url || null,
        });
      }
    }
  }

  // Start the check loop
  startCheckLoop();
}

function startCheckLoop() {
  if (checkTimer) clearInterval(checkTimer);
  if (scheduledReminders.length === 0) return;

  // Check every 30 seconds
  checkTimer = setInterval(() => {
    const now = Date.now();
    const toFire = scheduledReminders.filter(r => r.fireAt <= now);
    scheduledReminders = scheduledReminders.filter(r => r.fireAt > now);

    for (const reminder of toFire) {
      self.registration.showNotification(reminder.title, {
        body: reminder.body,
        icon: '/favicon.ico',
        tag: reminder.tag,
        requireInteraction: true,
        data: { url: reminder.url },
      });
      notifyClientFired(reminder.tag);
    }

    if (scheduledReminders.length === 0 && checkTimer) {
      clearInterval(checkTimer);
      checkTimer = null;
    }
  }, 30 * 1000);
}

function clearAllAlarms() {
  scheduledReminders = [];
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}

function showNotification(task, label, tag) {
  self.registration.showNotification(`⏰ ${task.title}`, {
    body: `Due in ${label}${task.courseName ? ` · ${task.courseName}` : ''}`,
    icon: '/favicon.ico',
    tag,
    requireInteraction: true,
    data: { url: task.url || null },
  });
}

// Tell the main thread a notification was fired so it can update localStorage
async function notifyClientFired(tag) {
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage({ type: 'NOTIFICATION_FIRED', tag });
  }
}

// Click handler — open the Canvas URL or focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url;

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // If there's an open tab, focus it
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.focus();
          if (url) client.navigate(url);
          return;
        }
      }
      // Otherwise open a new tab
      if (url) {
        return self.clients.openWindow(url);
      }
      return self.clients.openWindow('/');
    })
  );
});