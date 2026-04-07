'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Course } from '@/lib/types';
import { generateId, getNextColor, DAYS_OF_WEEK } from '@/lib/utils';
import type { CatalogCourse } from '@/app/api/courses/route';

interface CourseCatalogModalProps {
  existingCourses: Course[];
  onAdd: (course: Course) => void;
  onClose: () => void;
}

const CAMPUSES = ['Pullman', 'Vancouver', 'Spokane', 'Tri-Cities', 'Everett', 'Global Campus'];
const TERMS = ['Spring', 'Fall', 'Summer'];
const CURRENT_YEAR = new Date().getFullYear().toString();
const YEARS = [CURRENT_YEAR, String(Number(CURRENT_YEAR) + 1), String(Number(CURRENT_YEAR) - 1)];

const WSU_SUBJECTS = [
  'CPT_S', 'CS', 'MATH', 'STAT', 'PHYS', 'CHEM', 'BIOL', 'EE', 'ME', 'CE',
  'ECONS', 'ENGL', 'COMM', 'PSYCH', 'SOC', 'HIST', 'POL_S', 'ANTH', 'PHIL',
  'MUSIC', 'ARTS', 'ARCH', 'ACCTG', 'BUS', 'MIS', 'MBA', 'NURSING', 'KINES',
];

function catalogToCourse(cat: CatalogCourse, existingColors: string[]): Course {
  const validDays = cat.days.filter(d =>
    DAYS_OF_WEEK.includes(d as typeof DAYS_OF_WEEK[number])
  ) as Course['days'];

  return {
    id: generateId(),
    courseCode: cat.courseCode,
    name: cat.title,
    instructor: cat.instructor,
    room: cat.location,
    days: validDays,
    timeSlot: {
      startTime: cat.startTime || '08:00',
      endTime: cat.endTime || '09:00',
    },
    units: cat.credits,
    classNumber: cat.sln,
    section: `Sect ${cat.section}`,
    color: getNextColor(existingColors),
    availability: cat.openSeats > 0 ? 'Open' : 'Closed',
    openSeats: cat.openSeats,
    totalSeats: cat.totalSeats,
  };
}

export default function CourseCatalogModal({ existingCourses, onAdd, onClose }: CourseCatalogModalProps) {
  const [query, setQuery] = useState('');
  const [campus, setCampus] = useState('Pullman');
  const [term, setTerm] = useState('Spring');
  const [year, setYear] = useState('2026');
  const [subject, setSubject] = useState('');
  const [results, setResults] = useState<CatalogCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [addedSlns, setAddedSlns] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const existingSLNs = new Set(existingCourses.map(c => c.classNumber));

  const search = useCallback(async (q: string, sub: string) => {
    if (!q && !sub) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ campus, term, year });
      if (q) params.set('q', q);
      if (sub) params.set('subject', sub);
      const res = await fetch(`/api/courses?${params}`);
      const data = await res.json();
      if (data.error && !data.courses?.length) {
        setError(`WSU catalog error: ${data.error}`);
      }
      setResults(data.courses ?? []);
    } catch {
      setError('Failed to fetch courses. Check your connection.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [campus, term, year]);

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(query, subject);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, subject, search]);

  function handleAdd(cat: CatalogCourse) {
    const course = catalogToCourse(cat, existingCourses.map(c => c.color));
    onAdd(course);
    setAddedSlns(prev => new Set([...prev, cat.sln]));
  }

  const isAdded = (cat: CatalogCourse) =>
    addedSlns.has(cat.sln) || existingSLNs.has(cat.sln);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Browse WSU Courses</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Live data from schedules.wsu.edu</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-3">
          {/* Search bar */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by course code, name, instructor, or class #..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 placeholder-gray-400"
            />
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap gap-2">
            <select
              value={campus}
              onChange={e => setCampus(e.target.value)}
              className={selectCls}
            >
              {CAMPUSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={term}
              onChange={e => setTerm(e.target.value)}
              className={selectCls}
            >
              {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={year}
              onChange={e => setYear(e.target.value)}
              className={selectCls}
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className={selectCls}
            >
              <option value="">All Subjects</option>
              {WSU_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-3">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Fetching from WSU catalog...</span>
            </div>
          )}

          {!loading && error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-600 dark:text-red-400 text-center">
              {error}
            </div>
          )}

          {!loading && !error && results.length === 0 && (query || subject) && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <div className="text-3xl mb-2">🔎</div>
              <p className="font-medium">No courses found</p>
              <p className="text-sm">Try a different search term or subject</p>
            </div>
          )}

          {!loading && !query && !subject && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <div className="text-3xl mb-2">📚</div>
              <p className="font-medium">Search WSU courses</p>
              <p className="text-sm">Type a course code like &ldquo;CPT_S&rdquo; or pick a subject</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                {results.length} course{results.length !== 1 ? 's' : ''} found
              </p>
              {results.map((cat, i) => {
                const added = isAdded(cat);
                const hasTime = cat.startTime && cat.endTime;
                const seatPct = cat.totalSeats > 0
                  ? Math.round(((cat.totalSeats - cat.openSeats) / cat.totalSeats) * 100)
                  : 0;

                return (
                  <div
                    key={`${cat.sln}-${i}`}
                    className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 dark:text-white text-sm">
                          {cat.courseCode}
                        </span>
                        {cat.section && (
                          <span className="text-xs text-gray-500">Sect {cat.section}</span>
                        )}
                        {cat.sln && (
                          <span className="text-xs text-gray-400">#{cat.sln}</span>
                        )}
                        {cat.isLab && (
                          <span className="text-xs bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 py-0.5 rounded-full">Lab</span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          cat.openSeats > 0
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {cat.openSeats > 0 ? `${cat.openSeats} open` : 'Full'}
                        </span>
                      </div>

                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 truncate">{cat.title}</p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                        {hasTime && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {cat.days.map(d => d.slice(0, 3)).join('/')} &nbsp;
                            {formatDisplayTime(cat.startTime)}–{formatDisplayTime(cat.endTime)}
                          </span>
                        )}
                        {!hasTime && (
                          <span className="text-xs text-gray-400 italic">Time: Arranged</span>
                        )}
                        {cat.location && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[180px]">{cat.location}</span>
                        )}
                        {cat.instructor !== 'TBA' && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">{cat.instructor}</span>
                        )}
                        <span className="text-xs text-gray-400">{cat.credits} cr</span>
                      </div>

                      {cat.totalSeats > 0 && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-[80px]">
                            <div
                              className={`h-full rounded-full ${seatPct >= 90 ? 'bg-red-400' : seatPct >= 70 ? 'bg-yellow-400' : 'bg-green-400'}`}
                              style={{ width: `${seatPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400">{cat.openSeats}/{cat.totalSeats} seats</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleAdd(cat)}
                      disabled={added}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                        added
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-default'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow'
                      }`}
                    >
                      {added ? '✓ Added' : '+ Add'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Data sourced from schedules.wsu.edu
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

const selectCls = "text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700";

function formatDisplayTime(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}
