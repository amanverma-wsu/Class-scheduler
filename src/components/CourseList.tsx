'use client';

import { Course } from '@/lib/types';
import { formatTime, DAY_ABBREV, DAYS_OF_WEEK } from '@/lib/utils';

interface CourseListProps {
  courses: Course[];
  conflictIds: Set<string>;
  onCourseClick: (course: Course) => void;
}

export default function CourseList({ courses, conflictIds, onCourseClick }: CourseListProps) {
  if (courses.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-gray-500">
        <div className="text-4xl mb-3">📚</div>
        <p className="font-medium">No classes yet</p>
        <p className="text-sm">Click &ldquo;Add Class&rdquo; to get started</p>
      </div>
    );
  }

  // Sort by day then time
  const sorted = [...courses].sort((a, b) => {
    const aDayIdx = Math.min(...a.days.map(d => DAYS_OF_WEEK.indexOf(d)));
    const bDayIdx = Math.min(...b.days.map(d => DAYS_OF_WEEK.indexOf(d)));
    if (aDayIdx !== bDayIdx) return aDayIdx - bDayIdx;
    return a.timeSlot.startTime.localeCompare(b.timeSlot.startTime);
  });

  return (
    <div className="space-y-2">
      {sorted.map(course => {
        const isConflict = conflictIds.has(course.id);
        return (
          <button
            key={course.id}
            onClick={() => onCourseClick(course)}
            className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-150 overflow-hidden flex items-stretch"
          >
            {/* Color bar */}
            <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: course.color }} />

            <div className="flex-1 px-4 py-3 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-gray-900 dark:text-white text-sm truncate">
                    {course.courseCode}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate hidden sm:block">
                    {course.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isConflict && (
                    <span className="text-xs bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
                      Conflict
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    course.availability === 'Open'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : course.availability === 'Waitlist'
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {course.availability}
                  </span>
                  <span className="text-xs text-gray-400">{course.units} cr</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {course.days.map(d => DAY_ABBREV[d]).join('/')} &nbsp;
                  {formatTime(course.timeSlot.startTime)} &ndash; {formatTime(course.timeSlot.endTime)}
                </span>
                {course.room && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{course.room}</span>
                )}
                {course.instructor && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">{course.instructor}</span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
