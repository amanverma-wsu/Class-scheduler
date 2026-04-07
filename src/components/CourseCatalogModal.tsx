'use client';

import { useState, useCallback } from 'react';
import { Course, DayOfWeek } from '@/lib/types';
import { generateId, getNextColor, DAYS_OF_WEEK } from '@/lib/utils';

interface CourseCatalogModalProps {
  existingCourses: Course[];
  onAdd: (course: Course) => void;
  onClose: () => void;
}

// ── Parser ────────────────────────────────────────────────────────────────────

interface ParsedCourse {
  courseCode: string;
  name: string;
  section: string;
  classNumber: string;
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
  room: string;
  instructor: string;
  units: number;
  availability: 'Open' | 'Closed' | 'Waitlist';
  openSeats?: number;
  totalSeats?: number;
}

const DAY_WORDS: Record<string, DayOfWeek> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday',
};

function parseTime(raw: string): string {
  // e.g. "12:10PM" "1:00PM" "9:10AM"
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return '';
  let h = parseInt(m[1]);
  const min = m[2];
  const period = m[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${min}`;
}

function parseDayTime(text: string): { days: DayOfWeek[]; startTime: string; endTime: string } {
  // Matches: "Monday Wednesday Friday  12:10PM to 1:00PM"
  // or:      "Tuesday Thursday 9:10AM to 10:25AM"
  const lower = text.toLowerCase();
  const days: DayOfWeek[] = [];
  for (const [word, day] of Object.entries(DAY_WORDS)) {
    if (lower.includes(word)) days.push(day);
  }
  // Sort days in week order
  days.sort((a, b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b));

  const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[AP]M)\s+to\s+(\d{1,2}:\d{2}\s*[AP]M)/i);
  const startTime = timeMatch ? parseTime(timeMatch[1]) : '';
  const endTime = timeMatch ? parseTime(timeMatch[2]) : '';

  return { days, startTime, endTime };
}

function parseMyWSUText(raw: string): ParsedCourse[] {
  const courses: ParsedCourse[] = [];
  // Split into lines, clean up
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Each row is tab-separated when copied from a browser table
    // Cells: [select?] [availability] [class info] [description] [session] [days/times] [room] [instructor] [units] [seats] [prefs?]
    const cells = line.split('\t').map(c => c.trim()).filter(Boolean);

    // Try to find the course description cell: "DEPT_CODE NNN Course Name"
    const descIdx = cells.findIndex(c => /^[A-Z_]{2,6}\s+\d{3}/.test(c));
    if (descIdx === -1) continue;

    const descCell = cells[descIdx];
    const descMatch = descCell.match(/^([A-Z_]{2,6}\s+\d{3,4}[A-Z]?)\s+(.+)$/);
    if (!descMatch) continue;

    const courseCode = descMatch[1].trim();
    const name = descMatch[2].trim();

    // Class info cell: "Lecture - Sect 01 - Cls Nbr 2750"
    const classCell = cells.find(c => /Cls Nbr/i.test(c) || /Sect\s+\d+/.test(c)) ?? '';
    const sectionMatch = classCell.match(/Sect\s+(\d+[A-Z]?)/i);
    const clsNbrMatch = classCell.match(/Cls Nbr\s+(\d+)/i);
    const section = sectionMatch ? `Sect ${sectionMatch[1]}` : 'Sect 01';
    const classNumber = clsNbrMatch ? clsNbrMatch[1] : '';

    // Days/times cell
    const dayTimeCell = cells.find(c =>
      /monday|tuesday|wednesday|thursday|friday/i.test(c) ||
      /\d{1,2}:\d{2}[AP]M.*to.*\d{1,2}:\d{2}[AP]M/i.test(c)
    ) ?? '';
    const { days, startTime, endTime } = parseDayTime(dayTimeCell);

    // Availability
    const availCell = cells.find(c => /^(open|closed|waitlist)$/i.test(c)) ?? '';
    const availability: 'Open' | 'Closed' | 'Waitlist' =
      /closed/i.test(availCell) ? 'Closed' :
      /waitlist/i.test(availCell) ? 'Waitlist' : 'Open';

    // Seats: "Open Seats 121 of 123"
    const seatsCell = cells.find(c => /\d+\s+of\s+\d+/i.test(c) || /open seats/i.test(c)) ?? '';
    const seatsMatch = seatsCell.match(/(\d+)\s+of\s+(\d+)/i);
    const openSeats = seatsMatch ? parseInt(seatsMatch[1]) : undefined;
    const totalSeats = seatsMatch ? parseInt(seatsMatch[2]) : undefined;

    // Units
    const unitsCell = cells.find(c => /^\d+\.\d+$/.test(c) || /^\d+$/.test(c) && parseInt(c) <= 20 && parseInt(c) > 0) ?? '';
    const units = parseFloat(unitsCell) || 3;

    // Room (after days/times cell)
    const dayIdx = cells.indexOf(dayTimeCell);
    const room = dayIdx >= 0 && dayIdx + 1 < cells.length ? cells[dayIdx + 1] : '';

    // Instructor (after room)
    const instrCell = dayIdx >= 0 && dayIdx + 2 < cells.length ? cells[dayIdx + 2] : '';
    const instructor = instrCell && !/^\d/.test(instrCell) && instrCell.length < 40 && instrCell !== room
      ? instrCell : '';

    courses.push({
      courseCode, name, section, classNumber, days, startTime, endTime,
      room, instructor, units, availability, openSeats, totalSeats,
    });
  }

  return courses;
}

function parsedToCourse(p: ParsedCourse, existingColors: string[]): Course {
  return {
    id: generateId(),
    courseCode: p.courseCode,
    name: p.name,
    section: p.section,
    classNumber: p.classNumber,
    days: p.days,
    timeSlot: { startTime: p.startTime || '08:00', endTime: p.endTime || '09:00' },
    room: p.room,
    instructor: p.instructor,
    units: p.units,
    color: getNextColor(existingColors),
    availability: p.availability,
    openSeats: p.openSeats,
    totalSeats: p.totalSeats,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

type Tab = 'paste' | 'search';

export default function CourseCatalogModal({ existingCourses, onAdd, onClose }: CourseCatalogModalProps) {
  const [tab, setTab] = useState<Tab>('paste');
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState<ParsedCourse[]>([]);
  const [addedCodes, setAddedCodes] = useState<Set<string>>(new Set());

  // Search tab state
  const [query, setQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchResults, setSearchResults] = useState<ParsedCourse[]>([]);

  const existingCodes = new Set(existingCourses.map(c => c.courseCode + c.classNumber));

  function handlePaste(text: string) {
    setPasteText(text);
    const result = parseMyWSUText(text);
    setParsed(result);
  }

  function handleAdd(p: ParsedCourse) {
    const key = p.courseCode + p.classNumber;
    const colors = [...existingCourses.map(c => c.color), ...Array.from(addedCodes).map(() => '')];
    const course = parsedToCourse(p, existingCourses.map(c => c.color));
    onAdd(course);
    setAddedCodes(prev => new Set([...prev, key]));
  }

  const isAdded = (p: ParsedCourse) =>
    addedCodes.has(p.courseCode + p.classNumber) ||
    existingCodes.has(p.courseCode + p.classNumber);

  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearchLoading(true);
    setSearchError('');
    try {
      const res = await fetch(`/api/courses?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.error && !data.courses?.length) {
        setSearchError(data.error);
      }
      // Convert CatalogCourse → ParsedCourse shape for display
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: ParsedCourse[] = (data.courses ?? []).map((c: any) => ({
        courseCode: c.courseCode,
        name: c.title,
        section: `Sect ${c.section}`,
        classNumber: c.sln,
        days: c.days.filter((d: string) => DAYS_OF_WEEK.includes(d as DayOfWeek)) as DayOfWeek[],
        startTime: c.startTime,
        endTime: c.endTime,
        room: c.location,
        instructor: c.instructor,
        units: c.credits,
        availability: c.openSeats > 0 ? 'Open' : 'Closed',
        openSeats: c.openSeats,
        totalSeats: c.totalSeats,
      }));
      setSearchResults(items);
    } catch {
      setSearchError('Could not reach WSU catalog. Try using Paste instead.');
    } finally {
      setSearchLoading(false);
    }
  }, [query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add WSU Courses</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 flex-shrink-0 px-6">
          <TabBtn active={tab === 'paste'} onClick={() => setTab('paste')}>
            Paste from MyWSU
          </TabBtn>
          <TabBtn active={tab === 'search'} onClick={() => setTab('search')}>
            Search (on-campus/VPN)
          </TabBtn>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'paste' ? (
            <PasteTab
              pasteText={pasteText}
              parsed={parsed}
              onPaste={handlePaste}
              onAdd={handleAdd}
              isAdded={isAdded}
            />
          ) : (
            <SearchTab
              query={query}
              setQuery={setQuery}
              onSearch={doSearch}
              loading={searchLoading}
              error={searchError}
              results={searchResults}
              onAdd={handleAdd}
              isAdded={isAdded}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 flex justify-end">
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

// ── Paste Tab ─────────────────────────────────────────────────────────────────

function PasteTab({ pasteText, parsed, onPaste, onAdd, isAdded }: {
  pasteText: string;
  parsed: ParsedCourse[];
  onPaste: (text: string) => void;
  onAdd: (p: ParsedCourse) => void;
  isAdded: (p: ParsedCourse) => boolean;
}) {
  return (
    <div className="p-5 space-y-4">
      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300 space-y-1.5">
        <p className="font-semibold">How to import from MyWSU:</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-600 dark:text-blue-400">
          <li>Go to <strong>MyWSU → Manage Classes → Shopping Cart</strong> or the course search results page</li>
          <li>Select all rows in the table <span className="opacity-70">(click first row, Shift+click last)</span></li>
          <li>Copy <span className="opacity-70">(Cmd+C / Ctrl+C)</span></li>
          <li>Paste below</li>
        </ol>
      </div>

      {/* Paste area */}
      <textarea
        value={pasteText}
        onChange={e => onPaste(e.target.value)}
        onPaste={e => {
          // Capture paste event for instant processing
          const text = e.clipboardData.getData('text');
          e.preventDefault();
          onPaste(text);
        }}
        placeholder="Paste your MyWSU course table here..."
        rows={5}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 placeholder-gray-400 resize-none font-mono"
      />

      {/* Results */}
      {pasteText && parsed.length === 0 && (
        <div className="text-center py-6 text-gray-400 dark:text-gray-500">
          <p className="font-medium">Couldn&apos;t detect any courses</p>
          <p className="text-sm mt-1">Make sure you copied the full table rows from MyWSU</p>
        </div>
      )}

      {parsed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {parsed.length} course{parsed.length !== 1 ? 's' : ''} detected
          </p>
          {parsed.map((p, i) => (
            <CourseRow key={i} course={p} added={isAdded(p)} onAdd={() => onAdd(p)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Search Tab ────────────────────────────────────────────────────────────────

function SearchTab({ query, setQuery, onSearch, loading, error, results, onAdd, isAdded }: {
  query: string;
  setQuery: (q: string) => void;
  onSearch: () => void;
  loading: boolean;
  error: string;
  results: ParsedCourse[];
  onAdd: (p: ParsedCourse) => void;
  isAdded: (p: ParsedCourse) => boolean;
}) {
  return (
    <div className="p-5 space-y-4">
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400">
        Requires WSU campus network or VPN. If it doesn&apos;t work, use the <strong>Paste</strong> tab instead.
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSearch()}
          placeholder="Search: CPT_S 322, Software Engineering, P. Kumar..."
          className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 placeholder-gray-400"
        />
        <button
          onClick={onSearch}
          disabled={loading || !query.trim()}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {loading ? '...' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-10 gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Searching WSU catalog...</span>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          {results.map((p, i) => (
            <CourseRow key={i} course={p} added={isAdded(p)} onAdd={() => onAdd(p)} />
          ))}
        </div>
      )}

      {!loading && !error && results.length === 0 && query && (
        <div className="text-center py-10 text-gray-400 dark:text-gray-500">
          <p className="font-medium">No results</p>
          <p className="text-sm">Try a different term or use the Paste tab</p>
        </div>
      )}
    </div>
  );
}

// ── Shared row ────────────────────────────────────────────────────────────────

function CourseRow({ course, added, onAdd }: { course: ParsedCourse; added: boolean; onAdd: () => void }) {
  const hasTime = course.startTime && course.endTime;
  const seatPct = course.totalSeats && course.totalSeats > 0
    ? Math.round(((course.totalSeats - (course.openSeats ?? 0)) / course.totalSeats) * 100)
    : null;

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-gray-900 dark:text-white text-sm">{course.courseCode}</span>
          <span className="text-xs text-gray-500">{course.section}</span>
          {course.classNumber && <span className="text-xs text-gray-400">#{course.classNumber}</span>}
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
            course.availability === 'Open' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
            course.availability === 'Waitlist' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {course.availability}
          </span>
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 leading-snug">{course.name}</p>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
          {hasTime ? (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {course.days.map(d => d.slice(0, 3)).join('/')} &nbsp;
              {fmtTime(course.startTime)}–{fmtTime(course.endTime)}
            </span>
          ) : (
            <span className="text-xs text-gray-400 italic">Time: TBA</span>
          )}
          {course.room && <span className="text-xs text-gray-400 truncate max-w-[200px]">{course.room}</span>}
          {course.instructor && <span className="text-xs text-gray-400">{course.instructor}</span>}
          <span className="text-xs text-gray-400">{course.units} cr</span>
        </div>

        {seatPct !== null && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1 w-16 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${seatPct >= 90 ? 'bg-red-400' : seatPct >= 70 ? 'bg-yellow-400' : 'bg-green-400'}`}
                style={{ width: `${seatPct}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">{course.openSeats}/{course.totalSeats} open</span>
          </div>
        )}
      </div>

      <button
        onClick={onAdd}
        disabled={added}
        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
          added
            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-default'
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
        }`}
      >
        {added ? '✓ Added' : '+ Add'}
      </button>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

function fmtTime(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const p = h >= 12 ? 'PM' : 'AM';
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${dh}:${m.toString().padStart(2, '0')} ${p}`;
}
