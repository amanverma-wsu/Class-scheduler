'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Course } from '@/lib/types';
import { generateId, getNextColor, DAYS_OF_WEEK } from '@/lib/utils';

interface CourseCatalogModalProps {
  existingCourses: Course[];
  onAdd: (course: Course) => void;
  onClose: () => void;
}

const CAMPUSES = ['Pullman', 'Vancouver', 'Spokane', 'Tri-Cities', 'Everett', 'Global Campus'];
const TERMS = ['Spring', 'Fall', 'Summer'];
const YEARS = ['2026', '2025', '2027'];

const WSU_SUBJECTS = [
  'CPT_S', 'CS', 'MATH', 'STAT', 'PHYS', 'CHEM', 'BIOL', 'EE', 'ME', 'CE',
  'ECONS', 'ENGL', 'COMM', 'PSYCH', 'SOC', 'HIST', 'POL_S', 'ANTH',
  'MUSIC', 'ARTS', 'ARCH', 'ACCTG', 'BUS', 'MIS', 'MBA', 'NURSING', 'KINES',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function apiToCourse(c: any, existingColors: string[]): Course {
  const validDays = (c.days ?? []).filter((d: string) =>
    DAYS_OF_WEEK.includes(d as typeof DAYS_OF_WEEK[number])
  ) as Course['days'];

  return {
    id: generateId(),
    courseCode: c.courseCode ?? '',
    name: c.title ?? c.name ?? '',
    instructor: c.instructor ?? '',
    room: c.location ?? c.room ?? '',
    days: validDays,
    timeSlot: {
      startTime: c.startTime || '08:00',
      endTime: c.endTime || '09:00',
    },
    units: c.credits ?? c.units ?? 3,
    classNumber: c.sln ?? c.classNumber ?? '',
    section: c.section ? `Sect ${c.section}` : 'Sect 01',
    color: getNextColor(existingColors),
    availability: (c.openSeats ?? 0) > 0 ? 'Open' : 'Closed',
    openSeats: c.openSeats,
    totalSeats: c.totalSeats,
  };
}

export default function CourseCatalogModal({ existingCourses, onAdd, onClose }: CourseCatalogModalProps) {
  const [query, setQuery] = useState('');
  const [campus, setCampus] = useState('Pullman');
  const [term, setTerm] = useState('Spring');
  const [year, setYear] = useState('2026');
  const [subject, setSubject] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const existingKeys = new Set(existingCourses.map(c => c.classNumber || c.courseCode));

  const search = useCallback(async (q: string, sub: string) => {
    if (!q && !sub) { setResults([]); return; }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ campus, term, year });
      if (q) params.set('q', q);
      if (sub) params.set('subject', sub);
      const res = await fetch(`/api/courses?${params}`, { signal: AbortSignal.timeout(12000) });
      const data = await res.json();
      if (data.error && !data.courses?.length) {
        setError(data.error);
      }
      setResults(data.courses ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reach WSU catalog';
      setError(msg.includes('timeout') || msg.includes('abort')
        ? 'Request timed out — WSU catalog may require campus network or VPN'
        : msg);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [campus, term, year]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query, subject), 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, subject, search]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleAdd(c: any) {
    const key = c.sln || c.courseCode;
    const course = apiToCourse(c, existingCourses.map(ec => ec.color));
    onAdd(course);
    setAddedKeys(prev => new Set([...prev, key]));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdded = (c: any) => addedKeys.has(c.sln || c.courseCode) || existingKeys.has(c.sln || c.courseCode);

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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Requires WSU campus network or VPN</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search course code, name, instructor, class #..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 placeholder-gray-400"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { value: campus, onChange: setCampus, options: CAMPUSES },
              { value: term, onChange: setTerm, options: TERMS },
              { value: year, onChange: setYear, options: YEARS },
            ].map((sel, i) => (
              <select key={i} value={sel.value} onChange={e => sel.onChange(e.target.value)} className={selectCls}>
                {sel.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ))}
            <select value={subject} onChange={e => setSubject(e.target.value)} className={selectCls}>
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
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-400">
              <p className="font-semibold mb-1">Could not reach WSU catalog</p>
              <p className="text-xs opacity-80">{error}</p>
              <p className="text-xs mt-2 opacity-70">Connect to WSU network or VPN and try again.</p>
            </div>
          )}

          {!loading && !error && results.length === 0 && (query || subject) && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <div className="text-3xl mb-2">🔎</div>
              <p className="font-medium">No courses found</p>
              <p className="text-sm">Try a different search or subject</p>
            </div>
          )}

          {!loading && !query && !subject && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <div className="text-3xl mb-2">📚</div>
              <p className="font-medium">Search WSU courses</p>
              <p className="text-sm">Type a course code or select a subject above</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                {results.length} course{results.length !== 1 ? 's' : ''} found
              </p>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {results.map((c: any, i: number) => {
                const added = isAdded(c);
                const seatPct = c.totalSeats > 0
                  ? Math.round(((c.totalSeats - c.openSeats) / c.totalSeats) * 100) : 0;
                const hasTime = c.startTime && c.endTime;

                return (
                  <div key={`${c.sln}-${i}`} className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-gray-900 dark:text-white text-sm">{c.courseCode}</span>
                        {c.section && <span className="text-xs text-gray-500">Sect {c.section}</span>}
                        {c.sln && <span className="text-xs text-gray-400">#{c.sln}</span>}
                        {c.isLab && <span className="text-xs bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 py-0.5 rounded-full">Lab</span>}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${c.openSeats > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {c.openSeats > 0 ? `${c.openSeats} open` : 'Full'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 truncate">{c.title}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {hasTime ? (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {(c.days ?? []).map((d: string) => d.slice(0, 3)).join('/')} {fmtTime(c.startTime)}–{fmtTime(c.endTime)}
                          </span>
                        ) : <span className="text-xs text-gray-400 italic">Time: Arranged</span>}
                        {c.location && <span className="text-xs text-gray-400 truncate max-w-[180px]">{c.location}</span>}
                        {c.instructor && c.instructor !== 'TBA' && <span className="text-xs text-gray-400">{c.instructor}</span>}
                        <span className="text-xs text-gray-400">{c.credits} cr</span>
                      </div>
                      {c.totalSeats > 0 && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1 w-16 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${seatPct >= 90 ? 'bg-red-400' : seatPct >= 70 ? 'bg-yellow-400' : 'bg-green-400'}`} style={{ width: `${seatPct}%` }} />
                          </div>
                          <span className="text-xs text-gray-400">{c.openSeats}/{c.totalSeats} seats</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleAdd(c)}
                      disabled={added}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${added ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-default' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'}`}
                    >
                      {added ? '✓ Added' : '+ Add'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
          <p className="text-xs text-gray-400">schedules.wsu.edu</p>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

const selectCls = "text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700";

function fmtTime(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const p = h >= 12 ? 'PM' : 'AM';
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${dh}:${m.toString().padStart(2, '0')} ${p}`;
}
