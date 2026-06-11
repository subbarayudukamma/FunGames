import { useState } from 'react';
import { version } from '../package.json';

export default function VersionInfo() {
  const [show, setShow] = useState(false);

  return (
    <>
      <button
        onClick={() => setShow(true)}
        style={{
          position: 'fixed', bottom: '1rem', left: '1rem', zIndex: 1000,
          width: '32px', height: '32px', borderRadius: '50%',
          background: 'var(--primary, #3b82f6)', color: 'white',
          border: 'none', cursor: 'pointer', fontSize: '1rem',
          fontWeight: 700, display: 'flex', alignItems: 'center',
          justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
        title="Version info"
      >
        i
      </button>

      {show && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.4)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setShow(false)}
        >
          <div
            style={{
              background: 'white', borderRadius: '12px', padding: '1.5rem',
              maxWidth: '320px', width: '90%', textAlign: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem' }}>🎯 Icebreaker Bingo</h2>
            <p style={{ fontSize: '0.9rem', color: '#6b7280', margin: '0.25rem 0' }}>
              Version <strong>{version}</strong>
            </p>
            <hr style={{ margin: '0.75rem 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0.25rem 0' }}>
              © 2026 Subbarayudu Kamma
            </p>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0.25rem 0' }}>
              Built for team icebreaker events
            </p>
            <button
              onClick={() => setShow(false)}
              className="btn"
              style={{ marginTop: '1rem', width: 'auto', padding: '0.4rem 1.5rem', background: 'var(--primary, #3b82f6)', color: 'white' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
