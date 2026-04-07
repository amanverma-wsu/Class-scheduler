import { NextRequest, NextResponse } from 'next/server';

// WSU known subject prefixes (common ones - expandable)
const WSU_SUBJECTS = [
  'ACCTG', 'ADVERT', 'AGBIO', 'AGR', 'AGROEC', 'AGSC', 'AMST', 'ANTH', 'APM',
  'ARCH', 'ARTHI', 'ARTS', 'ASIAN', 'ASTRO', 'BCHM', 'BES', 'BIOL', 'BME',
  'BSYSE', 'BUS', 'CE', 'CES', 'CHEM', 'CHIN', 'CIS', 'COMM', 'COMMU',
  'CPT_S', 'CRIM', 'CS', 'DES', 'ECONS', 'EDUC', 'EE', 'ENGL', 'ENGR',
  'ENTOM', 'ENV', 'ES', 'FINSC', 'FOOD', 'FREN', 'GENED', 'GEOL', 'GERM',
  'HIST', 'HLTH', 'HM', 'HORT', 'HUMAN', 'INTLB', 'ITAL', 'JAPN', 'JRNL',
  'KINES', 'LANG', 'LARC', 'LATIN', 'LAW', 'LIBS', 'LING', 'M', 'MATH',
  'MBA', 'ME', 'MIS', 'MMSC', 'MUSIC', 'NATSC', 'NRSC', 'NURSING', 'NUTR',
  'PHOTO', 'PHYS', 'POL_S', 'PSYCH', 'SOC', 'SOIL', 'SPAN', 'STAT',
  'TC', 'TEACH', 'THEAT', 'UCORE', 'UNIV', 'VETM', 'WGSS',
];

interface WSUCourseRaw {
  CourseDescription?: string;
  Campus?: string;
  Year?: string;
  Term?: string;
  Prefix?: string;
  Subject?: string;
  CourseNumber?: string;
  SectionNumber?: string;
  Title?: string;
  Sln?: string;
  Credits?: string;
  Instructor?: string;
  DayTime?: string;
  Location?: string;
  EnrollmentLimit?: string;
  Enrollment?: string;
  IsLab?: string;
}

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

// Parse WSU DayTime string like "MWF 12:10-1:00 PM" or "TTH 9:10-10:25 AM"
function parseDayTime(dayTime: string): { days: string[]; startTime: string; endTime: string } {
  if (!dayTime || dayTime.trim() === '' || dayTime.toLowerCase().includes('arr')) {
    return { days: [], startTime: '', endTime: '' };
  }

  const dayMap: Record<string, string> = {
    M: 'Monday', T: 'Tuesday', W: 'Wednesday', TH: 'Thursday', TT: 'Thursday',
    F: 'Friday', S: 'Saturday', U: 'Sunday',
  };

  // Split on first space or digit to separate days from times
  const match = dayTime.trim().match(/^([A-Za-z]+)\s+(.+)$/);
  if (!match) return { days: [], startTime: '', endTime: '' };

  const dayStr = match[1].toUpperCase();
  const timeStr = match[2];

  // Parse days (handle TH before T)
  const days: string[] = [];
  let i = 0;
  while (i < dayStr.length) {
    if (dayStr.slice(i, i + 2) === 'TH') {
      days.push('Thursday');
      i += 2;
    } else if (dayStr[i] === 'T') {
      days.push('Tuesday');
      i++;
    } else if (dayStr[i] === 'M') {
      days.push('Monday');
      i++;
    } else if (dayStr[i] === 'W') {
      days.push('Wednesday');
      i++;
    } else if (dayStr[i] === 'F') {
      days.push('Friday');
      i++;
    } else if (dayStr[i] === 'S') {
      days.push('Saturday');
      i++;
    } else {
      i++;
    }
  }

  // Parse times like "12:10-1:00 PM" or "9:10-10:25 AM"
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!timeMatch) return { days, startTime: '', endTime: '' };

  const [, sh, sm, eh, em, period] = timeMatch;
  let startH = parseInt(sh);
  let endH = parseInt(eh);
  const isPM = period?.toUpperCase() === 'PM';
  const isAM = period?.toUpperCase() === 'AM';

  // Apply AM/PM: if PM, end hour gets +12 (unless already 12)
  if (isPM) {
    if (endH !== 12) endH += 12;
    // If start is less than end after adjustment, start might also be PM
    if (startH < 12 && startH + 12 <= endH) startH += 12;
  } else if (isAM) {
    if (startH === 12) startH = 0;
    if (endH === 12) endH = 0;
  } else {
    // No period specified — heuristic: if endH < startH, endH is PM
    if (endH < startH) endH += 12;
    if (startH < 8) startH += 12; // 1:00 means 13:00
  }

  const startTime = `${startH.toString().padStart(2, '0')}:${sm}`;
  const endTime = `${endH.toString().padStart(2, '0')}:${em}`;

  return { days, startTime, endTime };
}

// In-memory cache: key = "campus|term|year|subject"
const cache = new Map<string, { data: CatalogCourse[]; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

async function fetchWSUCourses(campus: string, term: string, year: string, subject: string): Promise<CatalogCourse[]> {
  const cacheKey = `${campus}|${term}|${year}|${subject}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const url = `https://schedules.wsu.edu/api/Data/GetSectionListDTO/${encodeURIComponent(campus)}/${encodeURIComponent(term)}/${encodeURIComponent(year)}/${encodeURIComponent(subject)}/tojson`;

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'ClassScheduler/1.0' },
    next: { revalidate: 1800 },
  });

  if (!res.ok) {
    // Try CSV fallback
    const csvUrl = `https://schedules.wsu.edu/api/Data/GetSectionListDTO/${encodeURIComponent(campus)}/${encodeURIComponent(term)}/${encodeURIComponent(year)}/${encodeURIComponent(subject)}/tocsv`;
    const csvRes = await fetch(csvUrl, {
      headers: { 'User-Agent': 'ClassScheduler/1.0' },
    });
    if (!csvRes.ok) return [];
    const csvText = await csvRes.text();
    return parseCSV(csvText, campus);
  }

  const json: WSUCourseRaw[] = await res.json();
  const courses = json.map(r => transformCourse(r, campus));
  cache.set(cacheKey, { data: courses, timestamp: Date.now() });
  return courses;
}

function transformCourse(r: WSUCourseRaw, campus: string): CatalogCourse {
  const { days, startTime, endTime } = parseDayTime(r.DayTime ?? '');
  const totalSeats = parseInt(r.EnrollmentLimit ?? '0') || 0;
  const enrolled = parseInt(r.Enrollment ?? '0') || 0;
  const prefix = r.Prefix ?? r.Subject ?? '';
  return {
    sln: r.Sln ?? '',
    courseCode: `${prefix} ${r.CourseNumber ?? ''}`.trim(),
    prefix,
    courseNumber: r.CourseNumber ?? '',
    section: r.SectionNumber ?? '',
    title: r.Title ?? r.CourseDescription ?? '',
    instructor: r.Instructor ?? 'TBA',
    credits: parseFloat(r.Credits ?? '3') || 3,
    days,
    startTime,
    endTime,
    location: r.Location ?? '',
    openSeats: Math.max(0, totalSeats - enrolled),
    totalSeats,
    campus,
    isLab: r.IsLab === 'true' || r.IsLab === '1',
  };
}

function parseCSV(csv: string, campus: string): CatalogCourse[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  const courses: CatalogCourse[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].match(/(".*?"|[^,]+)(?=,|$)/g) ?? [];
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').replace(/^"|"$/g, '').trim();
    });
    const raw: WSUCourseRaw = {
      Prefix: row['Prefix'] ?? row['Subject'],
      Subject: row['Subject'],
      CourseNumber: row['CourseNumber'],
      SectionNumber: row['SectionNumber'],
      Title: row['Title'] ?? row['CourseDescription'],
      CourseDescription: row['CourseDescription'],
      Sln: row['Sln'],
      Credits: row['Credits'],
      Instructor: row['Instructor'],
      DayTime: row['DayTime'],
      Location: row['Location'],
      EnrollmentLimit: row['EnrollmentLimit'],
      Enrollment: row['Enrollment'],
      IsLab: row['IsLab'],
    };
    courses.push(transformCourse(raw, campus));
  }
  return courses;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = searchParams.get('q')?.toLowerCase().trim() ?? '';
  const campus = searchParams.get('campus') ?? 'Pullman';
  const term = searchParams.get('term') ?? 'Spring';
  const year = searchParams.get('year') ?? '2026';
  const subject = searchParams.get('subject') ?? '';

  // If a specific subject is requested, fetch only that
  // If a query is given with no subject, try to infer subject from query
  let subjects: string[] = [];

  if (subject) {
    subjects = [subject];
  } else if (query) {
    // Try to infer subject from query (e.g. "cpt_s 322" -> CPT_S)
    const inferred = WSU_SUBJECTS.find(s => query.toUpperCase().startsWith(s) || s.replace('_', ' ') === query.toUpperCase().split(' ')[0]);
    if (inferred) {
      subjects = [inferred];
    } else {
      // Search top relevant subjects
      subjects = WSU_SUBJECTS.slice(0, 8);
    }
  } else {
    return NextResponse.json({ courses: [], subjects: WSU_SUBJECTS });
  }

  try {
    const results = await Promise.all(
      subjects.map(s => fetchWSUCourses(campus, term, year, s).catch(() => [] as CatalogCourse[]))
    );
    let courses = results.flat();

    if (query) {
      courses = courses.filter(c =>
        c.courseCode.toLowerCase().includes(query) ||
        c.title.toLowerCase().includes(query) ||
        c.instructor.toLowerCase().includes(query) ||
        c.sln.includes(query)
      );
    }

    // Limit to 100 results
    courses = courses.slice(0, 100);

    return NextResponse.json({ courses, subjects: WSU_SUBJECTS });
  } catch (err) {
    console.error('WSU API error:', err);
    return NextResponse.json({ courses: [], subjects: WSU_SUBJECTS, error: 'Failed to fetch courses' }, { status: 200 });
  }
}
