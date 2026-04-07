import { NextResponse } from 'next/server';

// Debug endpoint — visit /api/courses/debug in your browser to see what WSU returns
export async function GET() {
  const testURLs = [
    'https://schedules.wsu.edu/api/Data/GetSectionListDTO/Pullman/Spring/2026/CPT_S/tocsv',
    'https://schedules.wsu.edu/api/Data/GetSectionListDTO/Pullman/Spring/2026/MATH/tocsv',
    'https://schedules.wsu.edu/api/Data/GetSectionListDTO/Pullman/spring/2026/CPT_S/tocsv',
    'https://schedules.wsu.edu/List/Pullman/2026/Spring/',
  ];

  const results: Record<string, unknown> = {};

  for (const url of testURLs) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
        },
        signal: AbortSignal.timeout(8000),
      });
      const text = await res.text();
      results[url] = {
        status: res.status,
        contentType: res.headers.get('content-type'),
        bodyPreview: text.slice(0, 300),
        bodyLength: text.length,
      };
    } catch (err) {
      results[url] = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json(results, { status: 200 });
}
