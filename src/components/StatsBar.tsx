'use client';

import { Course } from '@/lib/types';
import { getTotalUnits, detectConflicts, getDayScheduleGaps, DAYS_OF_WEEK } from '@/lib/utils';

interface StatsBarProps {
  courses: Course[];
}

export default function StatsBar({ courses }: StatsBarProps) {
  const totalUnits = getTotalUnits(courses);
  const conflicts = detectConflicts(courses);
  const totalGapMinutes = DAYS_OF_WEEK.reduce((sum, day) => sum + getDayScheduleGaps(courses, day), 0);
  const gapHours = (totalGapMinutes / 60).toFixed(1);

  // Count days with classes
  const activeDays = DAYS_OF_WEEK.filter(d => courses.some(c => c.days.includes(d)));

  const stats = [
    {
      label: 'Total Units',
      value: totalUnits,
      sub: totalUnits >= 12 ? 'Full-time' : 'Part-time',
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: 'Classes',
      value: courses.length,
      sub: `${activeDays.length} day${activeDays.length !== 1 ? 's' : ''} / week`,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      label: 'Conflicts',
      value: conflicts.length,
      sub: conflicts.length === 0 ? 'All clear!' : `${conflicts.length} overlap${conflicts.length > 1 ? 's' : ''}`,
      color: conflicts.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400',
      bg: conflicts.length > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20',
    },
    {
      label: 'Schedule Gaps',
      value: `${gapHours}h`,
      sub: 'between classes',
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(stat => (
        <div
          key={stat.label}
          className={`${stat.bg} rounded-xl p-4`}
        >
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{stat.label}</p>
          <p className={`text-2xl font-bold mt-0.5 ${stat.color}`}>{stat.value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.sub}</p>
        </div>
      ))}
    </div>
  );
}
