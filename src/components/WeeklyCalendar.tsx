'use client';

import { Course, DayOfWeek } from '@/lib/types';
import { DAYS_OF_WEEK, DAY_ABBREV, timeToMinutes, formatTime, getEarliestTime, getLatestTime } from '@/lib/utils';

interface WeeklyCalendarProps {
  courses: Course[];
  conflicts: { courseA: Course; courseB: Course }[];
  onCourseClick: (course: Course) => void;
}

const HOUR_HEIGHT = 64; // px per hour

export default function WeeklyCalendar({ courses, conflicts, onCourseClick }: WeeklyCalendarProps) {
  const conflictIds = new Set(
    conflicts.flatMap(c => [c.courseA.id, c.courseB.id])
  );

  const startHour = Math.max(7, Math.floor(timeToMinutes(getEarliestTime(courses)) / 60));
  const endHour = Math.min(22, Math.ceil(timeToMinutes(getLatestTime(courses)) / 60));
  const totalHours = endHour - startHour;
  const gridHeight = totalHours * HOUR_HEIGHT;

  const hours = Array.from({ length: totalHours + 1 }, (_, i) => startHour + i);

  function getCourseStyle(course: Course): React.CSSProperties {
    const startMin = timeToMinutes(course.timeSlot.startTime);
    const endMin = timeToMinutes(course.timeSlot.endTime);
    const top = ((startMin - startHour * 60) / 60) * HOUR_HEIGHT;
    const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 20);
    return {
      top: `${top}px`,
      height: `${height}px`,
      backgroundColor: course.color,
    };
  }

  function getDayColumns(day: DayOfWeek) {
    return courses.filter(c => c.days.includes(day));
  }

  // Simple overlap grouping for a day
  function groupOverlappingCourses(dayCourses: Course[]): Course[][] {
    const sorted = [...dayCourses].sort(
      (a, b) => timeToMinutes(a.timeSlot.startTime) - timeToMinutes(b.timeSlot.startTime)
    );
    const groups: Course[][] = [];
    for (const course of sorted) {
      let placed = false;
      for (const group of groups) {
        const lastInGroup = group[group.length - 1];
        if (timeToMinutes(lastInGroup.timeSlot.endTime) <= timeToMinutes(course.timeSlot.startTime)) {
          group.push(course);
          placed = true;
          break;
        }
      }
      if (!placed) groups.push([course]);
    }
    return groups;
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(5,1fr)] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="p-3" />
        {DAYS_OF_WEEK.map(day => {
          const hasCourses = getDayColumns(day).length > 0;
          return (
            <div
              key={day}
              className={`p-3 text-center text-sm font-semibold border-l border-gray-200 dark:border-gray-700 ${
                hasCourses ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <span className="hidden sm:block">{day}</span>
              <span className="sm:hidden">{DAY_ABBREV[day]}</span>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="overflow-auto max-h-[600px]">
        <div
          className="grid grid-cols-[60px_repeat(5,1fr)] relative"
          style={{ height: `${gridHeight}px` }}
        >
          {/* Hour labels */}
          <div className="relative">
            {hours.map(hour => (
              <div
                key={hour}
                className="absolute w-full pr-2 text-right"
                style={{ top: `${(hour - startHour) * HOUR_HEIGHT - 8}px` }}
              >
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {DAYS_OF_WEEK.map(day => {
            const dayCourses = getDayColumns(day);
            const groups = groupOverlappingCourses(dayCourses);
            // Build a map: courseId -> { col, totalCols }
            const colMap = new Map<string, { col: number; totalCols: number }>();
            groups.forEach(group => {
              group.forEach((course, idx) => {
                colMap.set(course.id, { col: idx, totalCols: groups.length });
              });
            });

            return (
              <div
                key={day}
                className="relative border-l border-gray-200 dark:border-gray-700"
                style={{ height: `${gridHeight}px` }}
              >
                {/* Hour lines */}
                {hours.map(hour => (
                  <div
                    key={hour}
                    className="absolute w-full border-t border-gray-100 dark:border-gray-800"
                    style={{ top: `${(hour - startHour) * HOUR_HEIGHT}px` }}
                  />
                ))}

                {/* Course blocks */}
                {dayCourses.map(course => {
                  const info = colMap.get(course.id) ?? { col: 0, totalCols: 1 };
                  const width = `${100 / info.totalCols}%`;
                  const left = `${(info.col / info.totalCols) * 100}%`;
                  const isConflict = conflictIds.has(course.id);

                  return (
                    <button
                      key={course.id}
                      onClick={() => onCourseClick(course)}
                      className="absolute rounded-lg p-1 text-white text-xs font-medium overflow-hidden hover:brightness-110 hover:shadow-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-1 text-left"
                      style={{
                        ...getCourseStyle(course),
                        width,
                        left,
                        opacity: 0.92,
                        ...(isConflict ? { outline: '2px solid #EF4444', outlineOffset: '-2px' } : {}),
                      }}
                      title={`${course.courseCode}: ${course.name}`}
                    >
                      <div className="font-bold truncate leading-tight">{course.courseCode}</div>
                      <div className="truncate opacity-90 leading-tight hidden sm:block" style={{ fontSize: '10px' }}>
                        {course.name}
                      </div>
                      <div className="truncate opacity-80 leading-tight" style={{ fontSize: '10px' }}>
                        {formatTime(course.timeSlot.startTime)}
                      </div>
                      {isConflict && (
                        <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full m-0.5" title="Conflict!" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
