'use client';

import { Course } from '@/lib/types';
import { formatTime, DAYS_OF_WEEK } from '@/lib/utils';

interface CourseDetailModalProps {
  course: Course | null;
  isConflict: boolean;
  conflictsWith: Course[];
  onEdit: (course: Course) => void;
  onDelete: (courseId: string) => void;
  onClose: () => void;
}

export default function CourseDetailModal({
  course,
  isConflict,
  conflictsWith,
  onEdit,
  onDelete,
  onClose,
}: CourseDetailModalProps) {
  if (!course) return null;

  const duration = (() => {
    const [sh, sm] = course.timeSlot.startTime.split(':').map(Number);
    const [eh, em] = course.timeSlot.endTime.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  })();

  const seatPct = course.totalSeats
    ? Math.round(((course.totalSeats - (course.openSeats ?? 0)) / course.totalSeats) * 100)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header band */}
        <div className="p-5 text-white" style={{ backgroundColor: course.color }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium opacity-80">{course.courseCode} &middot; {course.section}</p>
              <h2 className="text-xl font-bold mt-0.5 leading-tight">{course.name}</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white opacity-70 hover:opacity-100 text-2xl leading-none ml-3"
            >
              &times;
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="bg-white/20 rounded-full px-2.5 py-1">{course.units} units</span>
            <span className={`rounded-full px-2.5 py-1 font-semibold ${
              course.availability === 'Open' ? 'bg-green-400/80' :
              course.availability === 'Waitlist' ? 'bg-yellow-400/80' : 'bg-red-400/80'
            }`}>
              {course.availability}
            </span>
            {isConflict && (
              <span className="bg-red-500/80 rounded-full px-2.5 py-1 font-semibold">
                ⚠ Conflict
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Schedule */}
          <div className="grid grid-cols-2 gap-3">
            <InfoBlock label="Days">
              <div className="flex flex-wrap gap-1 mt-1">
                {DAYS_OF_WEEK.map(d => (
                  <span
                    key={d}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      course.days.includes(d)
                        ? 'text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                    }`}
                    style={course.days.includes(d) ? { backgroundColor: course.color } : {}}
                  >
                    {d.slice(0, 3)}
                  </span>
                ))}
              </div>
            </InfoBlock>
            <InfoBlock label="Time">
              <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                {formatTime(course.timeSlot.startTime)} &ndash; {formatTime(course.timeSlot.endTime)}
              </p>
              <p className="text-xs text-gray-500">{duration}</p>
            </InfoBlock>
            <InfoBlock label="Room">
              <p className="text-sm text-gray-800 dark:text-gray-200">{course.room}</p>
            </InfoBlock>
            <InfoBlock label="Instructor">
              <p className="text-sm text-gray-800 dark:text-gray-200">{course.instructor}</p>
            </InfoBlock>
            <InfoBlock label="Class #">
              <p className="text-sm text-gray-800 dark:text-gray-200">{course.classNumber}</p>
            </InfoBlock>
            {course.totalSeats != null && (
              <InfoBlock label="Seats">
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  {course.openSeats} / {course.totalSeats} open
                </p>
                {seatPct !== null && (
                  <div className="mt-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${seatPct}%`, backgroundColor: course.color }}
                    />
                  </div>
                )}
              </InfoBlock>
            )}
          </div>

          {/* Conflicts */}
          {conflictsWith.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
                Time conflict with:
              </p>
              {conflictsWith.map(c => (
                <p key={c.id} className="text-sm text-red-600 dark:text-red-400">
                  &bull; {c.courseCode}: {c.name}
                </p>
              ))}
            </div>
          )}

          {/* Notes */}
          {course.notes && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{course.notes}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={() => onEdit(course)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors"
            style={{ borderColor: course.color, color: course.color }}
          >
            Edit
          </button>
          <button
            onClick={() => {
              if (confirm(`Remove ${course.courseCode} from your schedule?`)) {
                onDelete(course.id);
                onClose();
              }
            }}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      {children}
    </div>
  );
}
