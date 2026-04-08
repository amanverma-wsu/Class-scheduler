import { NextRequest, NextResponse } from 'next/server';
import { Task, TaskType } from '@/lib/types';

// Unfold iCal lines (RFC 5545: long lines folded with CRLF + whitespace)
function unfold(ical: string): string {
  return ical.replace(/\r?\n[ \t]/g, '');
}

// Parse iCal date/datetime value to ISO string
// Handles: "20231115T070000Z", "20231115T080000", "20231115"
function parseIcalDate(raw: string): string {
  const clean = raw.trim();
  if (/^\d{8}T\d{6}Z$/.test(clean)) {
    const d = clean;
    return new Date(
      `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T${d.slice(9,11)}:${d.slice(11,13)}:${d.slice(13,15)}Z`
    ).toISOString();
  }
  if (/^\d{8}T\d{6}$/.test(clean)) {
    return `${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}T${clean.slice(9,11)}:${clean.slice(11,13)}:${clean.slice(13,15)}`;
  }
  if (/^\d{8}$/.test(clean)) {
    // Date-only = all-day, treat as end of that day
    return `${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}T23:59:00`;
  }
  return clean;
}

function detectType(summary: string): TaskType {
  const s = summary.toLowerCase();
  if (s.startsWith('quiz:') || s.startsWith('quiz ')) return 'quiz';
  if (s.startsWith('assignment:') || s.endsWith(' due')) return 'assignment';
  if (s.startsWith('discussion:')) return 'discussion';
  if (s.startsWith('event:') || s.includes('office hours') || s.includes('lecture')) return 'event';
  return 'other';
}

function cleanTitle(summary: string): string {
  return summary
    .replace(/^(assignment|quiz|discussion|event):\s*/i, '')
    .replace(/\\,/g, ',')
    .replace(/\\n/g, ' ')
    .trim();
}

// Extract "Course: <name>" from Canvas iCal DESCRIPTION field
function parseCourse(description: string): string {
  const unescaped = description
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\\\/g, '\\');
  const match = unescaped.match(/Course:\s*(.+?)(\n|$)/i);
  return match ? match[1].trim() : '';
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }
  if (!/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: 'Invalid URL — must start with https://' }, { status: 400 });
  }

  let ical: string;
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'text/calendar, */*', 'User-Agent': 'ClassScheduler/1.0' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Canvas returned HTTP ${res.status}` });
    }
    ical = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes('timeout') || msg.includes('abort');
    return NextResponse.json({
      error: isTimeout ? 'Timed out fetching Canvas calendar' : `Fetch failed: ${msg}`,
    });
  }

  if (!ical.includes('BEGIN:VCALENDAR')) {
    return NextResponse.json({ error: 'URL did not return a valid iCal feed' });
  }

  const lines = unfold(ical).split(/\r?\n/);
  const tasks: Task[] = [];
  let inEvent = false;
  let ev: Record<string, string> = {};

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      ev = {};
    } else if (line === 'END:VEVENT') {
      if (inEvent && ev.SUMMARY) {
        const summary = ev.SUMMARY.replace(/\\,/g, ',').trim();
        const title = cleanTitle(summary);
        // Canvas puts the due date in DTSTART (DTEND is usually identical)
        const dtRaw = ev.DTSTART ?? ev.DTEND ?? '';
        const dueDate = dtRaw ? parseIcalDate(dtRaw) : '';

        if (title && dueDate) {
          tasks.push({
            id: ev.UID || `${dueDate}-${title}`,
            title,
            dueDate,
            courseName: parseCourse(ev.DESCRIPTION ?? ''),
            url: ev.URL ?? '',
            type: detectType(summary),
          });
        }
      }
      inEvent = false;
      ev = {};
    } else if (inEvent) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      // Key may have params: "DTSTART;TZID=America/Los_Angeles" → use base key
      const key = line.slice(0, colonIdx).split(';')[0].toUpperCase();
      const value = line.slice(colonIdx + 1);
      // Only capture fields we need
      if (['SUMMARY', 'DTSTART', 'DTEND', 'DESCRIPTION', 'URL', 'UID'].includes(key)) {
        ev[key] = value;
      }
    }
  }

  // Sort by due date ascending
  tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return NextResponse.json({ tasks });
}
