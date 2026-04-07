'use client';

import { useState, useEffect } from 'react';
import { Course, DayOfWeek } from '@/lib/types';
import { DAYS_OF_WEEK, COURSE_COLORS, generateId, getNextColor } from '@/lib/utils';

interface AddClassModalProps {
  existingCourse?: Course | null;
  existingColors: string[];
  onSave: (course: Course) => void;
  onClose: () => void;
}

const EMPTY_FORM = {
  courseCode: '',
  name: '',
  instructor: '',
  room: '',
  days: [] as DayOfWeek[],
  startTime: '08:00',
  endTime: '09:00',
  units: 3,
  classNumber: '',
  section: 'Sect 01',
  color: COURSE_COLORS[0],
  availability: 'Open' as 'Open' | 'Closed' | 'Waitlist',
  openSeats: '',
  totalSeats: '',
  notes: '',
};

export default function AddClassModal({ existingCourse, existingColors, onSave, onClose }: AddClassModalProps) {
  const [form, setForm] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    if (existingCourse) {
      setForm({
        courseCode: existingCourse.courseCode,
        name: existingCourse.name,
        instructor: existingCourse.instructor,
        room: existingCourse.room,
        days: existingCourse.days,
        startTime: existingCourse.timeSlot.startTime,
        endTime: existingCourse.timeSlot.endTime,
        units: existingCourse.units,
        classNumber: existingCourse.classNumber,
        section: existingCourse.section,
        color: existingCourse.color,
        availability: existingCourse.availability,
        openSeats: existingCourse.openSeats?.toString() ?? '',
        totalSeats: existingCourse.totalSeats?.toString() ?? '',
        notes: existingCourse.notes ?? '',
      });
    } else {
      setForm({ ...EMPTY_FORM, color: getNextColor(existingColors) });
    }
  }, [existingCourse, existingColors]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  function toggleDay(day: DayOfWeek) {
    setForm(f => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day],
    }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.courseCode.trim()) e.courseCode = 'Course code is required';
    if (!form.name.trim()) e.name = 'Course name is required';
    if (form.days.length === 0) e.days = 'Select at least one day';
    if (!form.startTime) e.startTime = 'Start time required';
    if (!form.endTime) e.endTime = 'End time required';
    if (form.startTime >= form.endTime) e.endTime = 'End time must be after start time';
    if (form.units < 0.5 || form.units > 20) e.units = 'Units must be between 0.5 and 20';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const course: Course = {
      id: existingCourse?.id ?? generateId(),
      courseCode: form.courseCode.trim(),
      name: form.name.trim(),
      instructor: form.instructor.trim(),
      room: form.room.trim(),
      days: [...form.days].sort((a, b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b)),
      timeSlot: { startTime: form.startTime, endTime: form.endTime },
      units: Number(form.units),
      classNumber: form.classNumber.trim(),
      section: form.section.trim(),
      color: form.color,
      availability: form.availability,
      openSeats: form.openSeats ? parseInt(form.openSeats) : undefined,
      totalSeats: form.totalSeats ? parseInt(form.totalSeats) : undefined,
      notes: form.notes.trim() || undefined,
    };
    onSave(course);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {existingCourse ? 'Edit Class' : 'Add Class'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Course code + name */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Course Code *" error={errors.courseCode}>
              <input
                type="text"
                value={form.courseCode}
                onChange={e => setForm(f => ({ ...f, courseCode: e.target.value }))}
                placeholder="CPT_S 322"
                className={inputCls(!!errors.courseCode)}
              />
            </Field>
            <Field label="Section">
              <input
                type="text"
                value={form.section}
                onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
                placeholder="Sect 01"
                className={inputCls(false)}
              />
            </Field>
          </div>

          <Field label="Course Name *" error={errors.name}>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Software Engineering I"
              className={inputCls(!!errors.name)}
            />
          </Field>

          {/* Days */}
          <Field label="Days *" error={errors.days}>
            <div className="flex flex-wrap gap-2 mt-1">
              {DAYS_OF_WEEK.map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                    form.days.includes(day)
                      ? 'text-white border-transparent'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400'
                  }`}
                  style={form.days.includes(day) ? { backgroundColor: form.color, borderColor: form.color } : {}}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </Field>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Time *" error={errors.startTime}>
              <input
                type="time"
                value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                className={inputCls(!!errors.startTime)}
              />
            </Field>
            <Field label="End Time *" error={errors.endTime}>
              <input
                type="time"
                value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                className={inputCls(!!errors.endTime)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Instructor">
              <input
                type="text"
                value={form.instructor}
                onChange={e => setForm(f => ({ ...f, instructor: e.target.value }))}
                placeholder="P. Kumar"
                className={inputCls(false)}
              />
            </Field>
            <Field label="Units *" error={errors.units}>
              <input
                type="number"
                value={form.units}
                min={0.5}
                max={20}
                step={0.5}
                onChange={e => setForm(f => ({ ...f, units: parseFloat(e.target.value) }))}
                className={inputCls(!!errors.units)}
              />
            </Field>
          </div>

          <Field label="Room">
            <input
              type="text"
              value={form.room}
              onChange={e => setForm(f => ({ ...f, room: e.target.value }))}
              placeholder="Carpenter Hall 102"
              className={inputCls(false)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Class Number">
              <input
                type="text"
                value={form.classNumber}
                onChange={e => setForm(f => ({ ...f, classNumber: e.target.value }))}
                placeholder="2750"
                className={inputCls(false)}
              />
            </Field>
            <Field label="Availability">
              <select
                value={form.availability}
                onChange={e => setForm(f => ({ ...f, availability: e.target.value as 'Open' | 'Closed' | 'Waitlist' }))}
                className={inputCls(false)}
              >
                <option value="Open">Open</option>
                <option value="Waitlist">Waitlist</option>
                <option value="Closed">Closed</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Open Seats">
              <input
                type="number"
                value={form.openSeats}
                min={0}
                onChange={e => setForm(f => ({ ...f, openSeats: e.target.value }))}
                className={inputCls(false)}
              />
            </Field>
            <Field label="Total Seats">
              <input
                type="number"
                value={form.totalSeats}
                min={1}
                onChange={e => setForm(f => ({ ...f, totalSeats: e.target.value }))}
                className={inputCls(false)}
              />
            </Field>
          </div>

          {/* Color picker */}
          <Field label="Color">
            <div className="flex flex-wrap gap-2 mt-1">
              {COURSE_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color }))}
                  className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                  style={{
                    backgroundColor: color,
                    outline: form.color === color ? `3px solid ${color}` : 'none',
                    outlineOffset: '2px',
                  }}
                  title={color}
                />
              ))}
            </div>
          </Field>

          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes..."
              rows={2}
              className={inputCls(false) + ' resize-none'}
            />
          </Field>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl text-white font-semibold transition-all hover:brightness-110"
              style={{ backgroundColor: form.color }}
            >
              {existingCourse ? 'Save Changes' : 'Add Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return `w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-colors ${
    hasError
      ? 'border-red-400 focus:ring-red-300'
      : 'border-gray-200 dark:border-gray-600 focus:ring-blue-300 dark:focus:ring-blue-600'
  }`;
}
