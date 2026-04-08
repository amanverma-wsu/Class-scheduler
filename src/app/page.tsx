'use client';

import { useState, useEffect, useCallback } from 'react';
import { Course, Semester, AppState } from '@/lib/types';
import { detectConflicts, getTotalUnits } from '@/lib/utils';
import { loadState, saveState, exportToCSV } from '@/lib/storage';
import WeeklyCalendar from '@/components/WeeklyCalendar';
import CourseList from '@/components/CourseList';
import AddClassModal from '@/components/AddClassModal';
import CourseDetailModal from '@/components/CourseDetailModal';
import CourseCatalogModal from '@/components/CourseCatalogModal';
import StatsBar from '@/components/StatsBar';
import SemesterManager from '@/components/SemesterManager';
import TasksPanel from '@/components/TasksPanel';

type ViewMode = 'calendar' | 'list' | 'tasks';

export default function Home() {
  const [state, setState] = useState<AppState | null>(null);
  const [view, setView] = useState<ViewMode>('calendar');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [detailCourse, setDetailCourse] = useState<Course | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [search, setSearch] = useState('');
  const [darkMode, setDarkMode] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const loaded = loadState();
    setState(loaded);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedDark = localStorage.getItem('dark-mode');
    setDarkMode(savedDark !== null ? savedDark === 'true' : prefersDark);
  }, []);

  // Persist state
  useEffect(() => {
    if (state) saveState(state);
  }, [state]);

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('dark-mode', String(darkMode));
  }, [darkMode]);

  const activeSemester: Semester | undefined = state?.semesters.find(
    s => s.id === state.activeSemesterId
  );

  const courses = activeSemester?.courses ?? [];
  const filteredCourses = search.trim()
    ? courses.filter(c =>
        c.courseCode.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.instructor.toLowerCase().includes(search.toLowerCase()) ||
        c.room.toLowerCase().includes(search.toLowerCase())
      )
    : courses;

  const conflicts = detectConflicts(courses);
  const conflictIds = new Set(conflicts.flatMap(c => [c.courseA.id, c.courseB.id]));

  const updateSemester = useCallback((updater: (sem: Semester) => Semester) => {
    setState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        semesters: prev.semesters.map(s =>
          s.id === prev.activeSemesterId ? updater(s) : s
        ),
      };
    });
  }, []);

  function handleSaveCourse(course: Course) {
    updateSemester(sem => {
      const exists = sem.courses.find(c => c.id === course.id);
      return {
        ...sem,
        courses: exists
          ? sem.courses.map(c => (c.id === course.id ? course : c))
          : [...sem.courses, course],
      };
    });
    setShowAddModal(false);
    setEditingCourse(null);
  }

  function handleDeleteCourse(courseId: string) {
    updateSemester(sem => ({
      ...sem,
      courses: sem.courses.filter(c => c.id !== courseId),
    }));
    setDetailCourse(null);
  }

  function handleEditCourse(course: Course) {
    setEditingCourse(course);
    setDetailCourse(null);
    setShowAddModal(true);
  }

  function handleCourseClick(course: Course) {
    setDetailCourse(course);
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading your schedule...</p>
        </div>
      </div>
    );
  }

  const detailConflicts = detailCourse
    ? conflicts
        .filter(c => c.courseA.id === detailCourse.id || c.courseB.id === detailCourse.id)
        .map(c => (c.courseA.id === detailCourse.id ? c.courseB : c.courseA))
    : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">CS</span>
              </div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white hidden sm:block">
                Class Scheduler
              </h1>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-xs">
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search classes..."
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 placeholder-gray-400"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* View toggle */}
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                {(['calendar', 'list', 'tasks'] as ViewMode[]).map(v => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      view === v
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {v === 'calendar' ? 'Cal' : v === 'list' ? 'List' : '✓ Tasks'}
                  </button>
                ))}
              </div>

              {/* Export */}
              {courses.length > 0 && (
                <button
                  onClick={() => exportToCSV(courses, activeSemester?.name ?? 'Schedule')}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  title="Export to CSV"
                >
                  ↓ CSV
                </button>
              )}

              {/* Dark mode */}
              <button
                onClick={() => setDarkMode(d => !d)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Toggle dark mode"
              >
                {darkMode ? '☀️' : '🌙'}
              </button>

              {/* Browse catalog */}
              <button
                onClick={() => setShowCatalog(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border-2 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                title="Browse WSU course catalog"
              >
                🎓 Browse
              </button>

              {/* Add class manually */}
              <button
                onClick={() => { setEditingCourse(null); setShowAddModal(true); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
              >
                <span className="text-base leading-none">+</span>
                <span className="hidden sm:inline">Add Class</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Semester tabs */}
        <SemesterManager
          semesters={state.semesters}
          activeSemesterId={state.activeSemesterId}
          onSwitch={id => setState(prev => prev ? { ...prev, activeSemesterId: id } : prev)}
          onAdd={sem => setState(prev => {
            if (!prev) return prev;
            return { semesters: [...prev.semesters, sem], activeSemesterId: sem.id };
          })}
          onRename={(id, name) => setState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              semesters: prev.semesters.map(s => s.id === id ? { ...s, name } : s),
            };
          })}
          onDelete={id => setState(prev => {
            if (!prev) return prev;
            const remaining = prev.semesters.filter(s => s.id !== id);
            return {
              semesters: remaining,
              activeSemesterId: remaining[0]?.id ?? '',
            };
          })}
        />

        {/* Stats */}
        <StatsBar courses={courses} />

        {/* Conflict banner */}
        {conflicts.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-red-500 text-xl flex-shrink-0">⚠</span>
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                {conflicts.length} time conflict{conflicts.length > 1 ? 's' : ''} detected
              </p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                {conflicts.map(c => `${c.courseA.courseCode} & ${c.courseB.courseCode}`).join(' · ')}
              </p>
            </div>
          </div>
        )}

        {/* Calendar / List / Tasks */}
        {view === 'calendar' && (
          <WeeklyCalendar
            courses={filteredCourses}
            conflicts={conflicts}
            onCourseClick={handleCourseClick}
          />
        )}
        {view === 'list' && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {filteredCourses.length} class{filteredCourses.length !== 1 ? 'es' : ''}
                {search && ` matching "${search}"`}
              </h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {getTotalUnits(courses)} total units
              </span>
            </div>
            <CourseList
              courses={filteredCourses}
              conflictIds={conflictIds}
              onCourseClick={handleCourseClick}
            />
          </div>
        )}
        {view === 'tasks' && <TasksPanel />}
      </main>

      {/* Modals */}
      {showAddModal && (
        <AddClassModal
          existingCourse={editingCourse}
          existingColors={courses.map(c => c.color)}
          onSave={handleSaveCourse}
          onClose={() => { setShowAddModal(false); setEditingCourse(null); }}
        />
      )}

      {detailCourse && (
        <CourseDetailModal
          course={detailCourse}
          isConflict={conflictIds.has(detailCourse.id)}
          conflictsWith={detailConflicts}
          onEdit={handleEditCourse}
          onDelete={handleDeleteCourse}
          onClose={() => setDetailCourse(null)}
        />
      )}

      {showCatalog && (
        <CourseCatalogModal
          existingCourses={courses}
          onAdd={course => {
            handleSaveCourse(course);
          }}
          onClose={() => setShowCatalog(false)}
        />
      )}
    </div>
  );
}
