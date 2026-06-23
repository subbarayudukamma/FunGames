import { version } from '../package.json';

// Shared rules content used on the landing page and the in-game (?) rules modal.
// Pass showVersion to render the app/version footer at the bottom.
export default function RulesContent({ showVersion = false }) {
  return (
    <div style={{ textAlign: 'left' }}>
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>🎯 How It Works</h3>
      <ul style={{ paddingLeft: '1.25rem', lineHeight: '1.7', fontSize: '0.9rem', margin: '0 0 1rem' }}>
        <li>Each tile = a prompt describing a person to find (e.g. "someone who has a pet")</li>
        <li>Mingle and find <strong>people who match the criteria</strong>, then add them as your answer</li>
        <li>Anyone who matches counts — same team or different team. A different-team match earns you <strong>more raffle entries</strong>! 🙂</li>
      </ul>

      <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>🏅 Scoring</h3>
      <ul style={{ paddingLeft: '1.25rem', lineHeight: '1.7', fontSize: '0.9rem', margin: '0 0 0.75rem' }}>
        <li>✅ Log into the app → <strong>1 raffle entry</strong></li>
        <li>✅ Complete a tile with a <strong>teammate</strong> (same team) → <strong>+1 entry</strong></li>
        <li>✅ Complete a tile with someone from a <strong>different team</strong> → <strong>+3 entries</strong></li>
      </ul>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        The more people you connect with — especially across teams — the better your odds! 🎉
      </p>

      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', fontStyle: 'italic' }}>
        💡 Don't worry if you don't remember all the names you entered. We'll connect you with the people in your answers via email after the game.
      </p>

      <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>🧩 Earn Extra Raffle Entries</h3>
      <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
        Complete the puzzle with the piece you got, then sit together as a team. When the admin checks
        your table and sees a completed puzzle, everyone at the table gets
        <strong> 10 extra raffle entries</strong>. 🧩
      </p>

      <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>🎁 Raffle & Prizes</h3>
      <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>We'll wrap up with a raffle — <strong>10 winners</strong> in total!</p>
      <p style={{ fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.25rem' }}>What can be won?</p>
      <ul style={{ paddingLeft: '1.25rem', lineHeight: '1.7', fontSize: '0.9rem', margin: '0 0 1rem' }}>
        <li>🎁 6 Gift cards</li>
        <li>🍽️ 4 opportunities for a 1:1 lunch with:</li>
        <ul style={{ paddingLeft: '1.25rem', listStyle: 'none' }}>
          <li>• Raja</li>
          <li>• Tessa</li>
          <li>• Alexei</li>
          <li>• Kati</li>
        </ul>
      </ul>

      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: showVersion ? '1rem' : 0 }}>
        🏆 Winners will be chosen in order of the draw.
      </p>

      <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
        <p style={{ fontSize: '0.85rem', color: '#065f46', margin: 0 }}>
          💾 Your progress is saved automatically. You can close this page and come back anytime — your session never expires.
        </p>
      </div>

      {showVersion && (
        <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0.15rem 0' }}>
            🎯 Icebreaker Bingo • Version <strong>{version}</strong>
          </p>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0.15rem 0' }}>
            © 2026 Subba Kamma • Built for team icebreaker events
          </p>
        </div>
      )}
    </div>
  );
}
