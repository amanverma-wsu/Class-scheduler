import { NextResponse } from 'next/server';

// Visit /api/courses/debug to diagnose CPT_S vs MATH
export async function GET() {
  const pairs = [
    { label: 'MATH (baseline)', url: 'https://schedules.wsu.edu/api/Data/GetSectionListDTO/Pullman/Spring/2026/MATH/tocsv' },
    { label: 'CPT_S raw',       url: 'https://schedules.wsu.edu/api/Data/GetSectionListDTO/Pullman/Spring/2026/CPT_S/tocsv' },
    { label: 'CPT%5FS encoded', url: 'https://schedules.wsu.edu/api/Data/GetSectionListDTO/Pullman/Spring/2026/CPT%5FS/tocsv' },
    { label: 'CPT%20S space',   url: 'https://schedules.wsu.edu/api/Data/GetSectionListDTO/Pullman/Spring/2026/CPT%20S/tocsv' },
    { label: 'CPTS no sep',     url: 'https://schedules.wsu.edu/api/Data/GetSectionListDTO/Pullman/Spring/2026/CPTS/tocsv' },
  ];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'text/csv,*/*',
    'Referer': 'https://schedules.wsu.edu/',
  };

  const results = await Promise.all(
    pairs.map(async ({ label, url }) => {
      try {
        const r = await fetch(url, { headers, signal: AbortSignal.timeout(6000) });
        const text = await r.text();
        const firstLine = text.split('\n')[0] ?? '';
        return {
          label, url,
          status: r.status,
          contentType: r.headers.get('content-type'),
          rows: text.trim().split('\n').length - 1,
          firstLine: firstLine.slice(0, 120),
          isHTML: text.trim().startsWith('<'),
        };
      } catch (e) {
        return { label, url, error: e instanceof Error ? e.message : String(e) };
      }
    })
  );

  return NextResponse.json(results, { status: 200 });
}
