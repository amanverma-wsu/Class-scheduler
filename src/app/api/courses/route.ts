import { NextRequest, NextResponse } from 'next/server';

export const WSU_SUBJECTS = [
  'ACCTG', 'ADVERT', 'AGBIO', 'AGR', 'AGROEC', 'AGSC', 'AMST', 'ANTH', 'APM',
  'ARCH', 'ARTHI', 'ARTS', 'ASIAN', 'ASTRO', 'BCHM', 'BES', 'BIOL', 'BME',
  'BSYSE', 'BUS', 'CE', 'CES', 'CHEM', 'CHIN', 'CIS', 'COMM', 'COMMU',
  'CPT_S', 'CRIM', 'CS', 'DES', 'ECONS', 'EDUC', 'EE', 'ENGL', 'ENGR',
  'ENTOM', 'ENV', 'ES', 'FINSC', 'FOOD', 'FREN', 'GENED', 'GEOL', 'GERM',
  'HIST', 'HLTH', 'HM', 'HORT', 'HUMAN', 'INTLB', 'ITAL', 'JAPN', 'JRNL',
  'KINES', 'LANG', 'LARC', 'LATIN', 'LAW', 'LIBS', 'LING', 'MATH',
  'MBA', 'ME', 'MIS', 'MMSC', 'MUSIC', 'NATSC', 'NRSC', 'NURSING', 'NUTR',
  'PHOTO', 'PHYS', 'POL_S', 'PSYCH', 'SOC', 'SOIL', 'SPAN', 'STAT',
  'TC', 'TEACH', 'THEAT', 'UCORE', 'UNIV', 'VETM', 'WGSS',
];

export interface CatalogCourse {
  sln: string;
  courseCode: string;
  prefix: string;
  courseNumber: string;
  section: string;
  title: string;
  instructor: string;
  credits: number;
  days: string[];
  startTime: string;
  endTime: string;
  location: string;
  openSeats: number;
  totalSeats: number;
  campus: string;
  isLab: boolean;
}

// Parse WSU DayTime string: "MWF 12:10-1:00 PM", "TTH 9:10-10:25 AM", "T 2:55-4:10 PM"
function parseDayTime(dayTime: string): { days: string[]; startTime: string; endTime: string } {
  const raw = (dayTime ?? '').trim();
  if (!raw || /arr/i.test(raw) || raw === 'TBA') {
    return { days: [], startTime: '', endTime: '' };
  }

  const match = raw.match(/^([A-Za-z]+)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)?/i);
  if (!match) return { days: [], startTime: '', endTime: '' };

  const [, dayStr, startRaw, endRaw, period] = match;

  // Parse days — TH/TTH must be checked before T
  const days: string[] = [];
  const upper = dayStr.toUpperCase();
  let i = 0;
  while (i < upper.length) {
    if (upper.slice(i, i + 3) === 'TTH') { days.push('Tuesday', 'Thursday'); i += 3; }
    else if (upper.slice(i, i + 2) === 'TH') { days.push('Thursday'); i += 2; }
    else if (upper[i] === 'M') { days.push('Monday'); i++; }
    else if (upper[i] === 'T') { days.push('Tuesday'); i++; }
    else if (upper[i] === 'W') { days.push('Wednesday'); i++; }
    else if (upper[i] === 'F') { days.push('Friday'); i++; }
    else if (upper[i] === 'S') { days.push('Saturday'); i++; }
    else { i++; }
  }

  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  let startMin = toMinutes(startRaw);
  let endMin = toMinutes(endRaw);
  const isPM = period?.toUpperCase() === 'PM';
  const isAM = period?.toUpperCase() === 'AM';

  if (isPM) {
    // End time is PM — bump end hour if not 12
    const [eh] = endRaw.split(':').map(Number);
    if (eh !== 12) endMin += 12 * 60;
    // If start would be before end only if also bumped to PM, bump it too
    const [sh] = startRaw.split(':').map(Number);
    if (sh !== 12 && sh + 12 <= Math.floor(endMin / 60)) startMin += 12 * 60;
  } else if (isAM) {
    const [sh] = startRaw.split(':').map(Number);
    const [eh] = endRaw.split(':').map(Number);
    if (sh === 12) startMin -= 12 * 60;
    if (eh === 12) endMin -= 12 * 60;
  } else {
    // No period: use heuristic
    const [sh] = startRaw.split(':').map(Number);
    const [eh] = endRaw.split(':').map(Number);
    // If end < start (e.g. start=10, end=2), end is PM
    if (eh < sh) endMin += 12 * 60;
    // Times before 7 are likely PM
    if (sh < 7) startMin += 12 * 60;
    if (eh < 7) endMin += 12 * 60;
  }

  const fmt = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  };

  return { days, startTime: fmt(startMin), endTime: fmt(endMin) };
}

// In-memory cache: key = "campus|term|year|subject"
const cache = new Map<string, { data: CatalogCourse[]; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 min

// URL formats to try in order — handles CPT_S underscore variants and casing
function buildURLs(campus: string, term: string, year: string, subject: string): string[] {
  const base = 'https://schedules.wsu.edu/api/Data/GetSectionListDTO';
  // For subjects like CPT_S, also try without underscore (CPTS) and encoded underscore
  const subVariants = Array.from(new Set([
    subject,
    subject.replace(/_/g, ''),          // CPT_S → CPTS
    subject.replace(/_/g, '%5F'),       // CPT_S → CPT%5FS (pre-encoded)
  ]));
  const urls: string[] = [];
  for (const sub of subVariants) {
    urls.push(`${base}/${encodeURIComponent(campus)}/${encodeURIComponent(term)}/${encodeURIComponent(year)}/${sub}/tocsv`);
    urls.push(`${base}/${encodeURIComponent(campus)}/${term.toLowerCase()}/${encodeURIComponent(year)}/${sub}/tocsv`);
  }
  return urls;
}

function parseCSV(csv: string, campus: string): CatalogCourse[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse a CSV line properly (handles quoted fields with commas)
  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  }

  const headers = parseLine(lines[0]);
  const idx = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());

  const iPrefix = idx('Prefix');
  const iSubject = idx('Subject');
  const iCourseNum = idx('CourseNumber');
  const iSection = idx('SectionNumber');
  const iTitle = idx('Title');
  const iDesc = idx('CourseDescription');
  const iSln = idx('Sln');
  const iCredits = idx('Credits');
  const iInstructor = idx('Instructor');
  const iDayTime = idx('DayTime');
  const iLocation = idx('Location');
  const iLimit = idx('EnrollmentLimit');
  const iEnrollment = idx('Enrollment');
  const iIsLab = idx('IsLab');

  const courses: CatalogCourse[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const f = parseLine(lines[i]);
    const get = (index: number) => (index >= 0 ? f[index] ?? '' : '');

    const prefix = get(iPrefix) || get(iSubject);
    const courseNumber = get(iCourseNum);
    if (!prefix && !courseNumber) continue;

    const { days, startTime, endTime } = parseDayTime(get(iDayTime));
    const totalSeats = parseInt(get(iLimit)) || 0;
    const enrolled = parseInt(get(iEnrollment)) || 0;

    courses.push({
      sln: get(iSln),
      courseCode: `${prefix} ${courseNumber}`.trim(),
      prefix,
      courseNumber,
      section: get(iSection),
      title: get(iTitle) || get(iDesc),
      instructor: get(iInstructor) || 'TBA',
      credits: parseFloat(get(iCredits)) || 3,
      days,
      startTime,
      endTime,
      location: get(iLocation),
      openSeats: Math.max(0, totalSeats - enrolled),
      totalSeats,
      campus,
      isLab: get(iIsLab).toLowerCase() === 'true' || get(iIsLab) === '1',
    });
  }
  return courses;
}

async function fetchWSUCourses(
  campus: string, term: string, year: string, subject: string
): Promise<{ courses: CatalogCourse[]; error?: string }> {
  const cacheKey = `${campus}|${term}|${year}|${subject}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { courses: cached.data };
  }

  const urls = buildURLs(campus, term, year, subject);
  let lastError = '';

  for (const url of urls) {
    try {
      console.log(`[WSU API] Fetching: ${url}`);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ClassScheduler/1.0)',
          'Accept': 'text/csv, text/plain, */*',
        },
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      console.log(`[WSU API] Status: ${res.status} for ${url}`);

      if (!res.ok) {
        lastError = `HTTP ${res.status} from ${url}`;
        continue;
      }

      const contentType = res.headers.get('content-type') ?? '';
      const text = await res.text();

      // If server returned HTML (error page), skip
      if (contentType.includes('html') || text.trim().startsWith('<')) {
        lastError = `Got HTML response instead of CSV from ${url}`;
        console.warn(`[WSU API] HTML response received, skipping`);
        continue;
      }

      if (!text.trim()) {
        lastError = 'Empty response from WSU API';
        continue;
      }

      const courses = parseCSV(text, campus);
      console.log(`[WSU API] Parsed ${courses.length} courses from ${subject}`);
      cache.set(cacheKey, { data: courses, timestamp: Date.now() });
      return { courses };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[WSU API] Fetch error for ${url}:`, lastError);
    }
  }

  return { courses: [], error: lastError };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = searchParams.get('q')?.toLowerCase().trim() ?? '';
  const campus = searchParams.get('campus') ?? 'Pullman';
  const term = searchParams.get('term') ?? 'Spring';
  const year = searchParams.get('year') ?? '2026';
  const subject = searchParams.get('subject') ?? '';

  if (!query && !subject) {
    return NextResponse.json({ courses: [], subjects: WSU_SUBJECTS });
  }

  // Determine which subjects to fetch
  let subjects: string[] = [];
  if (subject) {
    subjects = [subject];
  } else {
    // Try to infer subject from query
    const q = query.toUpperCase();
    const inferred = WSU_SUBJECTS.find(s =>
      q.startsWith(s.replace('_S', ' ')) ||
      q.startsWith(s + ' ') ||
      q.startsWith(s)
    );
    subjects = inferred ? [inferred] : [];
    // If no subject inferred and query looks like a course code, try common ones
    if (!inferred && /^[A-Z_]+\s*\d/.test(q)) {
      const prefix = q.split(/\s|\d/)[0];
      const matched = WSU_SUBJECTS.find(s => s === prefix || s.replace('_', '') === prefix);
      if (matched) subjects = [matched];
    }
    if (subjects.length === 0) {
      // Broad search: fetch top subjects and filter
      subjects = WSU_SUBJECTS.slice(0, 5);
    }
  }

  try {
    const fetchResults = await Promise.all(
      subjects.map(s => fetchWSUCourses(campus, term, year, s))
    );

    const allErrors = fetchResults.map(r => r.error).filter(Boolean);
    let courses = fetchResults.flatMap(r => r.courses);

    if (query) {
      courses = courses.filter(c =>
        c.courseCode.toLowerCase().includes(query) ||
        c.title.toLowerCase().includes(query) ||
        c.instructor.toLowerCase().includes(query) ||
        c.sln.includes(query)
      );
    }

    courses = courses.slice(0, 100);

    const responseError =
      courses.length === 0 && allErrors.length > 0
        ? allErrors[0]
        : undefined;

    return NextResponse.json({
      courses,
      subjects: WSU_SUBJECTS,
      ...(responseError ? { error: responseError } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[WSU API] Unexpected error:', msg);
    return NextResponse.json(
      { courses: [], subjects: WSU_SUBJECTS, error: msg },
      { status: 200 }
    );
  }
}
