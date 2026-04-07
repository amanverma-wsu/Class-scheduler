import { AppState, Semester, Course } from './types';
import { generateId, COURSE_COLORS } from './utils';

// Bump this version when default data changes — forces a fresh load
const STORAGE_KEY = 'class-scheduler-data-v2';

export const DEFAULT_COURSES: Course[] = [
  {
    id: generateId(),
    courseCode: 'CPT_S 322',
    name: 'Software Engineering I',
    instructor: 'P. Kumar',
    room: 'Carpenter Hall 102',
    days: ['Monday', 'Wednesday', 'Friday'],
    timeSlot: { startTime: '12:10', endTime: '13:00' },
    units: 3,
    classNumber: '2750',
    section: 'Sect 01',
    color: COURSE_COLORS[0],
    availability: 'Open',
    openSeats: 121,
    totalSeats: 123,
  },
  {
    id: generateId(),
    courseCode: 'CPT_S 350',
    name: 'Design & Analysis Algorithms',
    instructor: 'Z. Dang',
    room: 'Schweitzer Engineering 105',
    days: ['Monday', 'Wednesday', 'Friday'],
    timeSlot: { startTime: '13:10', endTime: '14:00' },
    units: 3,
    classNumber: '4210',
    section: 'Sect 01',
    color: COURSE_COLORS[1],
    availability: 'Open',
    openSeats: 126,
    totalSeats: 126,
  },
  {
    id: generateId(),
    courseCode: 'CPT_S 427',
    name: 'Cyber Security',
    instructor: 'A. Jillepalli',
    room: 'Elect/Mech Engine Bldg B0046',
    days: ['Monday', 'Wednesday', 'Friday'],
    timeSlot: { startTime: '11:10', endTime: '12:00' },
    units: 3,
    classNumber: '11465',
    section: 'Sect 01',
    color: COURSE_COLORS[2],
    availability: 'Open',
    openSeats: 40,
    totalSeats: 40,
  },
  {
    id: generateId(),
    courseCode: 'CPT_S 428',
    name: 'Software Security, Reverse Eng',
    instructor: 'X. Lin',
    room: 'Elect/Mech Engine Bldg B0046',
    days: ['Monday', 'Wednesday', 'Friday'],
    timeSlot: { startTime: '15:10', endTime: '16:00' },
    units: 3,
    classNumber: '5023',
    section: 'Sect 01',
    color: COURSE_COLORS[3],
    availability: 'Open',
    openSeats: 40,
    totalSeats: 40,
  },
  {
    id: generateId(),
    courseCode: 'CPT_S 431',
    name: 'Security Analytics & DevSecOps',
    instructor: 'M. Liu',
    room: 'Engine Teach/Res Lab Bldg 101',
    days: ['Tuesday', 'Thursday'],
    timeSlot: { startTime: '09:10', endTime: '10:25' },
    units: 3,
    classNumber: '11831',
    section: 'Sect 01',
    color: COURSE_COLORS[4],
    availability: 'Open',
    openSeats: 30,
    totalSeats: 30,
  },
  {
    id: generateId(),
    courseCode: 'CPT_S 455',
    name: 'Computer Networks & Security',
    instructor: 'I. Priyadarshini',
    room: 'Schweitzer Engineering 210',
    days: ['Tuesday', 'Thursday'],
    timeSlot: { startTime: '14:55', endTime: '16:10' },
    units: 3,
    classNumber: '11221',
    section: 'Sect 01',
    color: COURSE_COLORS[5],
    availability: 'Open',
    openSeats: 60,
    totalSeats: 60,
  },
];

export function getDefaultState(): AppState {
  const semesterId = generateId();
  return {
    semesters: [
      {
        id: semesterId,
        name: 'Spring 2026',
        courses: DEFAULT_COURSES,
      },
    ],
    activeSemesterId: semesterId,
  };
}

export function loadState(): AppState {
  if (typeof window === 'undefined') return getDefaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw) as AppState;
    // Validate minimum required shape — fall back to defaults if corrupt
    if (
      !parsed ||
      !Array.isArray(parsed.semesters) ||
      parsed.semesters.length === 0 ||
      !parsed.activeSemesterId
    ) {
      return getDefaultState();
    }
    return parsed;
  } catch {
    return getDefaultState();
  }
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export function exportToCSV(courses: Course[], semesterName: string): void {
  const headers = ['Course Code', 'Name', 'Section', 'Class #', 'Days', 'Start Time', 'End Time', 'Room', 'Instructor', 'Units', 'Availability', 'Open Seats', 'Total Seats'];
  const rows = courses.map(c => [
    c.courseCode,
    c.name,
    c.section,
    c.classNumber,
    c.days.join('/'),
    c.timeSlot.startTime,
    c.timeSlot.endTime,
    c.room,
    c.instructor,
    c.units,
    c.availability,
    c.openSeats ?? '',
    c.totalSeats ?? '',
  ]);
  const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${semesterName.replace(/\s+/g, '-')}-schedule.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
