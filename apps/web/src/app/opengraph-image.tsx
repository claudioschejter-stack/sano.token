import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Sanova Global — Tokenized Real Estate in Vaca Muerta, Argentina';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0B2240 0%, #0D2E56 60%, #0B2240 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px 80px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
        }}
      >
        {/* Top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'linear-gradient(90deg, #4B9CE8 0%, #2563EB 50%, #4B9CE8 100%)',
          }}
        />

        {/* Eyebrow */}
        <div
          style={{
            color: '#4B9CE8',
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: 4,
            textTransform: 'uppercase',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#4B9CE8',
            }}
          />
          SANOVA GLOBAL · RWA INVESTMENT
        </div>

        {/* Main headline */}
        <div
          style={{
            color: '#FFFFFF',
            fontSize: 54,
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: 24,
            letterSpacing: -1,
          }}
        >
          Real Estate Tokenizado
          <br />
          en Vaca Muerta
        </div>

        {/* Subtitle */}
        <div
          style={{
            color: '#94B8D4',
            fontSize: 22,
            marginBottom: 44,
            lineHeight: 1.4,
          }}
        >
          Rendimientos en USDC · Hasta 12.8% APY · KYC Compliant · Base blockchain
        </div>

        {/* Tag chips */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {['ERC-4626 Tokens', 'On-chain Dividends', 'B2B Lease Contracts', 'Global Investors'].map(
            (tag) => (
              <div
                key={tag}
                style={{
                  background: 'rgba(75, 156, 232, 0.12)',
                  border: '1px solid rgba(75, 156, 232, 0.35)',
                  color: '#7BB8EA',
                  borderRadius: 8,
                  padding: '8px 18px',
                  fontSize: 15,
                  fontWeight: 500,
                }}
              >
                {tag}
              </div>
            )
          )}
        </div>

        {/* Bottom watermark */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            right: 80,
            color: '#2A4A6A',
            fontSize: 18,
            fontWeight: 500,
            letterSpacing: 1,
          }}
        >
          sanovacapital.com
        </div>

        {/* Decorative circle */}
        <div
          style={{
            position: 'absolute',
            right: -80,
            top: -80,
            width: 400,
            height: 400,
            borderRadius: '50%',
            border: '1px solid rgba(75, 156, 232, 0.08)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: -40,
            top: -40,
            width: 280,
            height: 280,
            borderRadius: '50%',
            border: '1px solid rgba(75, 156, 232, 0.12)',
          }}
        />
      </div>
    ),
    size
  );
}
