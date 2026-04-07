import { Course, ConflictInfo, DayOfWeek, TimeSlot } from './types';

// Convert "HH:MM" to minutes since midnight
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Convert minutes since midnight to "HH:MM"
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Convert "HH:MM" 24h to "h:MMam/pm"
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Parse "12:10PM" display time to "12:10" 24h
export function parseDisplayTime(displayTime: string): string {
  const match = displayTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return '00:00';
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function doTimeSlotsOverlap(a: TimeSlot, b: TimeSlot): boolean {
  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

export function detectConflicts(courses: Course[]): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  for (let i = 0; i < courses.length; i++) {
    for (let j = i + 1; j < courses.length; j++) {
      const a = courses[i];
      const b = courses[j];
      const sharedDays = a.days.filter(d => b.days.includes(d)) as DayOfWeek[];
      if (sharedDays.length > 0 && doTimeSlotsOverlap(a.timeSlot, b.timeSlot)) {
        conflicts.push({ courseA: a, courseB: b, conflictDays: sharedDays });
      }
    }
  }
  return conflicts;
}

export function getTotalUnits(courses: Course[]): number {
  return courses.reduce((sum, c) => sum + c.units, 0);
}

export function getEarliestTime(courses: Course[]): string {
  if (courses.length === 0) return '08:00';
  const earliest = courses.reduce((min, c) => {
    const start = timeToMinutes(c.timeSlot.startTime);
    return start < min ? start : min;
  }, Infinity);
  // Floor to nearest hour, at least 7:00
  const hour = Math.max(7, Math.floor(earliest / 60));
  return `${hour.toString().padStart(2, '0')}:00`;
}

export function getLatestTime(courses: Course[]): string {
  if (courses.length === 0) return '20:00';
  const latest = courses.reduce((max, c) => {
    const end = timeToMinutes(c.timeSlot.endTime);
    return end > max ? end : max;
  }, 0);
  // Ceil to nearest hour, at least 18:00
  const hour = Math.max(18, Math.ceil(latest / 60));
  return `${hour.toString().padStart(2, '0')}:00`;
}

export function getDayScheduleGaps(courses: Course[], day: DayOfWeek): number {
  const dayCourses = courses
    .filter(c => c.days.includes(day))
    .sort((a, b) => timeToMinutes(a.timeSlot.startTime) - timeToMinutes(b.timeSlot.startTime));

  if (dayCourses.length < 2) return 0;

  let totalGap = 0;
  for (let i = 1; i < dayCourses.length; i++) {
    const gap = timeToMinutes(dayCourses[i].timeSlot.startTime) - timeToMinutes(dayCourses[i - 1].timeSlot.endTime);
    if (gap > 0) totalGap += gap;
  }
  return totalGap;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export const COURSE_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
];

export function getNextColor(existingColors: string[]): string {
  const unused = COURSE_COLORS.find(c => !existingColors.includes(c));
  return unused ?? COURSE_COLORS[existingColors.length % COURSE_COLORS.length];
}

export const DAYS_OF_WEEK: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const DAY_ABBREV: Record<DayOfWeek, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
};
