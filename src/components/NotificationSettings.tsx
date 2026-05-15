'use client';

import { useState, useEffect } from 'react';
import {
  getReminderIntervals,
  saveIntervalSettings,
  isSoundEnabled,
  setSoundEnabled,
  ReminderInterval,
} from '@/lib/notifications';

interface NotificationSettingsProps {
  onClose: () => void;
}

export default function NotificationSettings({ onClose }: NotificationSettingsProps) {
  const [intervals, setIntervals] = useState<ReminderInterval[]>([]);
  const [sound, setSound] = useState(true);

  useEffect(() => {
    setIntervals(getReminderIntervals());
    setSound(isSoundEnabled());
  }, []);

  function toggleInterval(label: string) {
    setIntervals(prev => {
      const updated = prev.map(i =>
        i.label === label ? { ...i, enabled: !i.enabled } : i
      );
      saveIntervalSettings(updated);
      return updated;
    });
  }

  function toggleSound() {
    setSound(prev => {
      setSoundEnabled(!prev);
      return !prev;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Notification Settings</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Choose when to be reminded before assignments are due
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Intervals */}
        <div className="px-5 py-4 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
            Remind me before due
          </p>
          {intervals.map(interval => (
            <button
              key={interval.label}
              onClick={() => toggleInterval(interval.label)}
              className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">
                  {interval.label === '6 hours' ? '🕕' :
                   interval.label === '3 hours' ? '🕒' :
                   interval.label === '1 hour'  ? '🕐' : '⏰'}
                </span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {interval.label}
                </span>
              </div>
              {/* Toggle switch */}
              <div
                className={`w-10 h-6 rounded-full transition-colors relative ${
                  interval.enabled
                    ? 'bg-blue-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    interval.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`}
                />
              </div>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="mx-5 border-t border-gray-100 dark:border-gray-800" />

        {/* Sound */}
        <div className="px-5 py-4">
          <button
            onClick={toggleSound}
            className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{sound ? '🔊' : '🔇'}</span>
              <div className="text-left">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 block">
                  Notification sound
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Play a tone when reminders fire
                </span>
              </div>
            </div>
            <div
              className={`w-10 h-6 rounded-full transition-colors relative ${
                sound ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                  sound ? 'translate-x-[18px]' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            Reminders work best when the app tab is open. For background notifications, keep the browser running.
          </p>
        </div>
      </div>
    </div>
  );
}
