import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppState, Course, Semester } from '@/lib/types';

// ── Load ──────────────────────────────────────────────────────────────────────

export async function loadUserSchedule(supabase: SupabaseClient): Promise<AppState | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: semesters }, { data: courses }, { data: settings }] = await Promise.all([
    supabase.from('semesters').select('*').eq('user_id', user.id).order('display_order'),
    supabase.from('courses').select('*').eq('user_id', user.id),
    supabase.from('user_settings').select('active_semester_id').eq('user_id', user.id).maybeSingle(),
  ]);

  if (!semesters || semesters.length === 0) return null;

  const semesterList: Semester[] = semesters.map((s) => ({
    id: s.id,
    name: s.name,
    courses: (courses ?? [])
      .filter((c) => c.semester_id === s.id)
      .map(dbRowToCourse),
  }));

  return {
    semesters: semesterList,
    activeSemesterId: settings?.active_semester_id ?? semesterList[0]?.id ?? '',
  };
}

// ── Save ──────────────────────────────────────────────────────────────────────

export async function saveUserSchedule(supabase: SupabaseClient, state: AppState): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const semesterRows = state.semesters.map((s, i) => ({
    id: s.id,
    user_id: user.id,
    name: s.name,
    display_order: i,
  }));

  const courseRows = state.semesters.flatMap((s) =>
    s.courses.map((c) => courseToDbRow(c, s.id, user.id))
  );

  const existingCourseIds = courseRows.map((r) => r.id);

  // Use upsert for semesters and courses, then clean up deleted ones
  await Promise.all([
    semesterRows.length > 0
      ? supabase.from('semesters').upsert(semesterRows, { onConflict: 'id' })
      : Promise.resolve(),
    courseRows.length > 0
      ? supabase.from('courses').upsert(courseRows, { onConflict: 'id' })
      : Promise.resolve(),
    supabase.from('user_settings').upsert(
      { user_id: user.id, active_semester_id: state.activeSemesterId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    ),
  ]);

  // Delete courses that were removed
  if (existingCourseIds.length > 0) {
    await supabase.from('courses').delete()
      .eq('user_id', user.id)
      .not('id', 'in', `(${existingCourseIds.map(id => `'${id}'`).join(',')})`);
  } else {
    await supabase.from('courses').delete().eq('user_id', user.id);
  }

  // Delete semesters that were removed
  const semesterIds = state.semesters.map((s) => s.id);
  if (semesterIds.length > 0) {
    await supabase.from('semesters').delete()
      .eq('user_id', user.id)
      .not('id', 'in', `(${semesterIds.map(id => `'${id}'`).join(',')})`);
  }
}

// ── Row mappers ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbRowToCourse(row: any): Course {
  return {
    id: row.id,
    courseCode: row.course_code,
    name: row.name,
    instructor: row.instructor ?? '',
    room: row.room ?? '',
    days: row.days ?? [],
    timeSlot: { startTime: row.start_time, endTime: row.end_time },
    units: row.units ?? 3,
    classNumber: row.class_number ?? '',
    section: row.section ?? '',
    color: row.color ?? '#3b82f6',
    availability: row.availability ?? 'Open',
    openSeats: row.open_seats ?? undefined,
    totalSeats: row.total_seats ?? undefined,
    notes: row.notes ?? undefined,
  };
}

function courseToDbRow(course: Course, semesterId: string, userId: string) {
  return {
    id: course.id,
    semester_id: semesterId,
    user_id: userId,
    course_code: course.courseCode,
    name: course.name,
    instructor: course.instructor,
    room: course.room,
    days: course.days,
    start_time: course.timeSlot.startTime,
    end_time: course.timeSlot.endTime,
    units: course.units,
    class_number: course.classNumber,
    section: course.section,
    color: course.color,
    availability: course.availability,
    open_seats: course.openSeats ?? null,
    total_seats: course.totalSeats ?? null,
    notes: course.notes ?? null,
  };
}
