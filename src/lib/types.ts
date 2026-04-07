export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';

export interface TimeSlot {
  startTime: string; // "HH:MM" 24h format
  endTime: string;   // "HH:MM" 24h format
}

export interface Course {
  id: string;
  courseCode: string;      // e.g. "CPT_S 322"
  name: string;            // e.g. "Software Engineering I"
  instructor: string;
  room: string;
  days: DayOfWeek[];
  timeSlot: TimeSlot;
  units: number;
  classNumber: string;     // e.g. "2750"
  section: string;         // e.g. "Sect 01"
  color: string;           // hex color
  availability: 'Open' | 'Closed' | 'Waitlist';
  openSeats?: number;
  totalSeats?: number;
  notes?: string;
}

export interface Semester {
  id: string;
  name: string;            // e.g. "Spring 2026"
  courses: Course[];
}

export interface AppState {
  semesters: Semester[];
  activeSemesterId: string;
}

export interface ConflictInfo {
  courseA: Course;
  courseB: Course;
  conflictDays: DayOfWeek[];
}
