import { NextResponse } from 'next/server';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/csv,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://schedules.wsu.edu/',
  'Origin': 'https://schedules.wsu.edu',
};

async function probe(url: string) {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(6000),
    });
    const text = await res.text();
    return {
      status: res.status,
      contentType: res.headers.get('content-type'),
      bodyPreview: text.slice(0, 400),
      bodyLength: text.length,
      looksLikeCSV: text.trim().startsWith('"') || /^[A-Za-z].*,/.test(text.split('\n')[0] ?? ''),
      looksLikeHTML: text.trim().startsWith('<'),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET() {
  const testURLs = [
    'https://schedules.wsu.edu/api/Data/GetSectionListDTO/Pullman/Spring/2026/CPT_S/tocsv',
    'https://schedules.wsu.edu/api/Data/GetSectionListDTO/Pullman/Spring/2026/MATH/tocsv',
    'https://schedules.wsu.edu/api/Data/GetSectionListDTO/Pullman/spring/2026/CPT_S/tocsv',
    'https://schedules.wsu.edu/api/Data/GetSectionListDTO/pullman/Spring/2026/CPT_S/tocsv',
    'https://schedules.wsu.edu/List/Pullman/2026/Spring/',
    'https://schedules.wsu.edu/',
  ];

  // Run all requests in parallel — max 6 seconds total
  const entries = await Promise.all(
    testURLs.map(async url => [url, await probe(url)] as const)
  );

  return NextResponse.json(Object.fromEntries(entries), { status: 200 });
}
