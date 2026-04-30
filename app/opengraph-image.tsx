import { ImageResponse } from 'next/og';

/**
 * Default Open Graph / Twitter share image. Next will hash this output and
 * serve it at /opengraph-image.<hash>.png; metadata picks it up
 * automatically since the file lives next to the root layout. Twitter +
 * LinkedIn + Slack unfurls all want a 1200×630 PNG, which is what this
 * produces.
 */

export const runtime = 'edge';
export const alt = 'Pocketdb — Database Explorer';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
          color: '#e6edf3',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: '#2f81f7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              fontWeight: 700,
              color: '#0d1117',
            }}
          >
            ⌘
          </div>
          <span style={{ fontSize: 32, fontWeight: 600, color: '#8d96a0' }}>Pocketdb</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
            Your database
          </div>
          <div
            style={{
              fontSize: 88,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
              color: '#2f81f7',
            }}
          >
            in your pocket.
          </div>
          <div style={{ marginTop: 32, fontSize: 32, color: '#8d96a0', maxWidth: 900 }}>
            Browse tables, run queries, and inspect schemas on any device.
            Connects directly — nothing leaves your browser.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 24,
            fontSize: 22,
            color: '#8d96a0',
            borderTop: '1px solid #30363d',
            paddingTop: 24,
          }}
        >
          <span>PostgreSQL</span>
          <span>·</span>
          <span>MySQL</span>
          <span>·</span>
          <span>SQLite</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
