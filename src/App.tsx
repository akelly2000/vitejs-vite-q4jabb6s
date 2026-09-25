import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { Share2, RotateCcw } from 'lucide-react';
// @ts-ignore
import puzzlesData from './puzzles.json';

// ----- Constants -----

const TOTAL_ROUNDS = 3;
const MAX_GUESSES = 5;
const MAX_POINTS_PER_ROUND = 5;
const MAX_POINTS_PER_GAME = TOTAL_ROUNDS * MAX_POINTS_PER_ROUND;

// ----- Puzzle helpers -----

type Puzzle = {
  number: number;
  puzzleNumber: number;
  difficulty: string;
  players: any[];
};

function formatPuzzle(raw: any): Puzzle {
  return {
    number: raw.number,
    puzzleNumber: raw.id,
    difficulty:
      raw.difficulty.charAt(0).toUpperCase() + raw.difficulty.slice(1),
    players: raw.players,
  };
}

function pickRandomPuzzle(excludeIds: number[] = []): Puzzle {
  const pool = puzzlesData.puzzles;
  const eligible = pool.filter((p: any) => !excludeIds.includes(p.id));
  const sourcePool = eligible.length > 0 ? eligible : pool;
  return formatPuzzle(sourcePool[Math.floor(Math.random() * sourcePool.length)]);
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  return {
    first: parts[0] || '',
    last: parts.slice(1).join(' '),
  };
}

function evaluateGuess(guess: number, answer: number) {
  const guessStr = String(guess).padStart(2, '0');
  const answerStr = String(answer).padStart(2, '0');
  return {
    value: guess,
    digits: [guessStr[0], guessStr[1]],
    matches: [guessStr[0] === answerStr[0], guessStr[1] === answerStr[1]],
  };
}

function calculatePoints(won: boolean, guessesUsed: number): number {
  if (!won) return 0;
  return Math.max(0, MAX_POINTS_PER_ROUND + 1 - guessesUsed);
}

type GuessResult = ReturnType<typeof evaluateGuess>;

// ----- Daily puzzle helpers -----

// Daily #1 is this date. Every day after it counts up by one.
const DAILY_START = { year: 2026, month: 9, day: 24 };
const DAILY_STORAGE_KEY = 'jersey-number-daily-v1';

function dayIndex(d: Date): number {
  // Uses the player's local calendar date, so the daily flips at their midnight
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

function getDailyNumber(now: Date = new Date()): number {
  const start =
    Date.UTC(DAILY_START.year, DAILY_START.month - 1, DAILY_START.day) / 86400000;
  return Math.max(1, dayIndex(now) - start + 1);
}

// Same 3 puzzles for everyone on a given day (walks through puzzles.json in order,
// skipping repeats of a number already used that day).
function getDailyPuzzles(dailyNumber: number): Puzzle[] {
  const pool = puzzlesData.puzzles;
  const picked: any[] = [];
  const numbers = new Set<number>();
  let i = ((dailyNumber - 1) * TOTAL_ROUNDS) % pool.length;
  for (let steps = 0; picked.length < TOTAL_ROUNDS && steps < pool.length; steps++) {
    const p = pool[i];
    if (!numbers.has(p.number)) {
      picked.push(p);
      numbers.add(p.number);
    }
    i = (i + 1) % pool.length;
  }
  return picked.map(formatPuzzle);
}

function getDailyIds(dailyNumber: number): number[] {
  return getDailyPuzzles(dailyNumber).map((p) => p.puzzleNumber);
}

function timeUntilNextDaily(now: Date): string {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const mins = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

type RoundResult = {
  puzzleId: number;
  answer: number;
  guesses: GuessResult[];
  won: boolean;
  points: number;
};

type GameState = 'playing' | 'roundEnd' | 'gameEnd';

type Mode = 'daily' | 'practice';

type Session = {
  puzzle: Puzzle;
  rounds: RoundResult[];
  guesses: GuessResult[];
  gameState: GameState;
};

function newDailySession(dailyNumber: number): Session {
  return {
    puzzle: getDailyPuzzles(dailyNumber)[0],
    rounds: [],
    guesses: [],
    gameState: 'playing',
  };
}

function newPracticeSession(excludeIds: number[]): Session {
  return {
    puzzle: pickRandomPuzzle(excludeIds),
    rounds: [],
    guesses: [],
    gameState: 'playing',
  };
}

// If someone refreshed right after their last guess, finish recording that round.
function finishPendingRound(s: Session): Session {
  if (s.gameState !== 'playing' || s.guesses.length === 0) return s;
  const last = s.guesses[s.guesses.length - 1];
  const won = last.matches[0] && last.matches[1];
  if (!won && s.guesses.length < MAX_GUESSES) return s;
  const rounds = [
    ...s.rounds,
    {
      puzzleId: s.puzzle.puzzleNumber,
      answer: s.puzzle.number,
      guesses: s.guesses,
      won,
      points: calculatePoints(won, s.guesses.length),
    },
  ];
  return { ...s, rounds, gameState: rounds.length >= TOTAL_ROUNDS ? 'gameEnd' : 'roundEnd' };
}

function loadDailySession(dailyNumber: number): Session {
  try {
    const raw = localStorage.getItem(DAILY_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.day === dailyNumber && saved.session) {
        return finishPendingRound(saved.session as Session);
      }
    }
  } catch {
    // Storage unavailable or corrupted: start fresh
  }
  return newDailySession(dailyNumber);
}

function saveDailySession(dailyNumber: number, session: Session) {
  try {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify({ day: dailyNumber, session }));
  } catch {
    // Ignore: progress just won't survive a refresh
  }
}

// ----- Styling -----

const COLORS = {
  bg: '#0f1419',
  bgCard: '#161c25',
  border: '#2a3340',
  text: '#f0e8d8',
  textMuted: '#c0b6a3',
  textDim: '#8a9ba8',
  textFaint: '#4a5765',
  accent: '#f59e0b',
  accentHover: '#fbbf24',
  success: '#10b981',
  successBg: '#0d3b2e',
  miss: '#2c3848',
  missBorder: '#3a4658',
};

const FONTS = {
  serif: "'Instrument Serif', Georgia, serif",
  sans: "'Manrope', system-ui, sans-serif",
  mono: "'JetBrains Mono', Menlo, monospace",
};

const STYLE_BLOCK = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}
.animate-fade-up { animation: fadeInUp 0.4s ease-out both; }
.animate-slide-in { animation: slideInLeft 0.3s ease-out both; }

input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type=number] { -moz-appearance: textfield; }
`;

// ----- Component -----

export default function App() {
  const [dailyNumber, setDailyNumber] = useState(() => getDailyNumber());
  const [now, setNow] = useState(() => new Date());
  const [mode, setMode] = useState<Mode>('daily');
  const [sessions, setSessions] = useState<Record<Mode, Session>>(() => {
    const day = getDailyNumber();
    return {
      daily: loadDailySession(day),
      practice: newPracticeSession(getDailyIds(day)),
    };
  });
  const [input, setInput] = useState('');
  const [shareToast, setShareToast] = useState(false);

  const { puzzle, rounds, guesses, gameState } = sessions[mode];
  const dailyDone = sessions.daily.gameState === 'gameEnd';

  const updateSession = (m: Mode, fn: (s: Session) => Session) =>
    setSessions((prev) => ({ ...prev, [m]: fn(prev[m]) }));

  const inputRef = useRef<HTMLInputElement>(null);

  const completedRounds = rounds.length;
  const currentRoundNumber =
    gameState === 'playing' ? completedRounds + 1 : Math.max(completedRounds, 1);
  const totalScore = rounds.reduce((sum, r) => sum + r.points, 0);
  const remaining = MAX_GUESSES - guesses.length;
  const lastRound = rounds[rounds.length - 1];

  useEffect(() => {
    if (gameState === 'playing' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [gameState, guesses.length, puzzle, mode]);

  // Save daily progress so a refresh can't replay today's puzzle
  useEffect(() => {
    saveDailySession(dailyNumber, sessions.daily);
  }, [dailyNumber, sessions.daily]);

  // Keep the countdown fresh and roll over to the new daily at midnight
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setNow(n);
      const day = getDailyNumber(n);
      if (day !== dailyNumber) {
        setDailyNumber(day);
        setSessions((prev) => ({ ...prev, daily: newDailySession(day) }));
      }
    };
    const id = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [dailyNumber]);

  const handleGuess = () => {
    if (gameState !== 'playing') return;

    // Guard against spamming Enter during the 700ms transition delay
    const latest = guesses[guesses.length - 1];
    const alreadyDone =
      (latest && latest.matches[0] && latest.matches[1]) ||
      guesses.length >= MAX_GUESSES;
    if (alreadyDone) return;

    const n = parseInt(input, 10);
    if (isNaN(n) || n < 0 || n > 99) return;
    if (guesses.some((g) => g.value === n)) {
      setInput('');
      return;
    }

    const result = evaluateGuess(n, puzzle.number);
    const newGuesses = [...guesses, result];
    const won = result.matches[0] && result.matches[1];
    const lost = !won && newGuesses.length >= MAX_GUESSES;

    const m = mode;
    updateSession(m, (s) => ({ ...s, guesses: newGuesses }));
    setInput('');

    if (won || lost) {
      const points = calculatePoints(won, newGuesses.length);
      const newRound: RoundResult = {
        puzzleId: puzzle.puzzleNumber,
        answer: puzzle.number,
        guesses: newGuesses,
        won,
        points,
      };
      setTimeout(() => {
        updateSession(m, (s) => {
          if (s.gameState !== 'playing') return s;
          const nextRounds = [...s.rounds, newRound];
          return {
            ...s,
            rounds: nextRounds,
            gameState: nextRounds.length >= TOTAL_ROUNDS ? 'gameEnd' : 'roundEnd',
          };
        });
      }, 700);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleGuess();
  };

  const nextRound = () => {
    setInput('');
    if (mode === 'daily') {
      const todays = getDailyPuzzles(dailyNumber);
      updateSession('daily', (s) => ({
        ...s,
        puzzle: todays[s.rounds.length],
        guesses: [],
        gameState: 'playing',
      }));
    } else {
      updateSession('practice', (s) => ({
        ...s,
        puzzle: pickRandomPuzzle([
          ...s.rounds.map((r) => r.puzzleId),
          ...getDailyIds(dailyNumber),
        ]),
        guesses: [],
        gameState: 'playing',
      }));
    }
  };

  const playAgain = () => {
    setInput('');
    updateSession('practice', () => newPracticeSession(getDailyIds(dailyNumber)));
  };

  const switchMode = (m: Mode) => {
    setInput('');
    setMode(m);
  };

  const keepPlaying = () => {
    setInput('');
    if (sessions.practice.gameState === 'gameEnd') {
      updateSession('practice', () => newPracticeSession(getDailyIds(dailyNumber)));
    }
    setMode('practice');
  };

  const gameShareString = () => {
    const header =
      mode === 'daily'
        ? `Jersey Number Daily #${dailyNumber} — ${totalScore}/${MAX_POINTS_PER_GAME}`
        : `Jersey Number (Practice) — ${totalScore}/${MAX_POINTS_PER_GAME}`;
    const lines = rounds.map((r, i) => {
      const blocks = r.guesses
        .map((g) => g.matches.map((m) => (m ? '🟩' : '⬛')).join(''))
        .join(' ');
      const ptsLabel = r.points === 1 ? 'pt' : 'pts';
      return `R${i + 1}: ${blocks} (${r.points} ${ptsLabel})`;
    });
    return `${header}\n${lines.join('\n')}\n${window.location.origin}`;
  };

  const handleShare = () => {
    navigator.clipboard.writeText(gameShareString());
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2000);
  };

  const DigitCell = ({
    digit,
    match,
    empty = false,
  }: {
    digit?: string;
    match?: boolean;
    empty?: boolean;
  }) => (
    <div
      style={{
        width: 32,
        height: 40,
        backgroundColor: empty ? 'transparent' : match ? COLORS.success : COLORS.miss,
        border: `1px solid ${empty ? COLORS.border : match ? COLORS.success : COLORS.missBorder}`,
        fontFamily: FONTS.mono,
        fontSize: '1.15rem',
        fontWeight: 600,
        color: empty ? COLORS.textFaint : COLORS.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {empty ? '' : digit}
    </div>
  );

  return (
    <>
      <style>{STYLE_BLOCK}</style>
      <div
        style={{
          minHeight: '100vh',
          padding: '24px 16px',
          backgroundColor: COLORS.bg,
          color: COLORS.text,
          fontFamily: FONTS.sans,
        }}
      >
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          {/* Header */}
          <div
            style={{
              marginBottom: 24,
              paddingBottom: 16,
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            <h1
              style={{
                fontFamily: FONTS.serif,
                fontSize: 'clamp(2.25rem, 9vw, 3rem)',
                letterSpacing: '-0.02em',
                lineHeight: 1,
                margin: 0,
                color: '#ffffff',
              }}
            >
              Jersey Number
            </h1>
            <p
              style={{
                marginTop: 12,
                fontSize: '0.7rem',
                color: COLORS.textDim,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              {mode === 'daily' ? `Daily #${dailyNumber}` : 'Practice'} · Round{' '}
              {currentRoundNumber}/{TOTAL_ROUNDS}
              {gameState !== 'playing' && (
                <>
                  {' · '}
                  Score {totalScore}/{MAX_POINTS_PER_GAME}
                </>
              )}
            </p>
          </div>

          {/* Daily / Practice switch */}
          <div
            role="tablist"
            aria-label="Game mode"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0,
              marginBottom: mode === 'practice' ? 12 : 24,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            {(['daily', 'practice'] as Mode[]).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  role="tab"
                  aria-selected={active}
                  onClick={() => switchMode(m)}
                  style={{
                    padding: '10px 12px',
                    border: 'none',
                    backgroundColor: active ? COLORS.accent : 'transparent',
                    color: active ? COLORS.bg : COLORS.textMuted,
                    fontFamily: FONTS.sans,
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s, color 0.2s',
                  }}
                >
                  {m === 'daily' ? (
                    <>
                      Daily #{dailyNumber}
                      {dailyDone && ' ✓'}
                    </>
                  ) : (
                    'Practice'
                  )}
                </button>
              );
            })}
          </div>

          {mode === 'practice' && (
            <p
              style={{
                marginBottom: 24,
                fontSize: '0.8rem',
                color: COLORS.textDim,
              }}
            >
              Practice games are random and don't count toward your daily score.
              {!dailyDone && (
                <>
                  {' '}
                  <button
                    onClick={() => switchMode('daily')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: COLORS.accent,
                      fontWeight: 600,
                      fontSize: 'inherit',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Play today's daily
                  </button>
                </>
              )}
            </p>
          )}

          {/* Instructions */}
          <p
            style={{
              marginBottom: 24,
              lineHeight: 1.5,
              color: COLORS.textMuted,
              fontSize: '0.9rem',
            }}
          >
            These three players wore the same jersey number.{' '}
            <span style={{ color: COLORS.text, fontWeight: 600 }}>Five guesses</span>{' '}
            per round. A digit turns{' '}
            <span style={{ color: COLORS.success, fontWeight: 600 }}>green</span>{' '}
            when it's in the right position. Three rounds per game,{' '}
            <span style={{ color: COLORS.text, fontWeight: 600 }}>15 points max</span>.
          </p>

          {/* Player cards — hidden during game-end (summary takes over) */}
          {gameState !== 'gameEnd' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                marginBottom: 24,
              }}
            >
              {puzzle.players.map((player: any, i: number) => {
                const { first, last } = splitName(player.name);
                return (
                  <div
                    key={`${puzzle.puzzleNumber}-${i}`}
                    className="animate-fade-up"
                    style={{
                      padding: '10px 8px',
                      border: `1px solid ${COLORS.border}`,
                      backgroundColor: COLORS.bgCard,
                      animationDelay: `${i * 100}ms`,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.55rem',
                        color: COLORS.accent,
                        letterSpacing: '0.2em',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        marginBottom: 8,
                      }}
                    >
                      {player.sport}
                    </div>
                    <div
                      style={{
                        fontFamily: FONTS.serif,
                        fontSize: 'clamp(0.85rem, 3.2vw, 1.05rem)',
                        lineHeight: 1.15,
                        color: COLORS.text,
                      }}
                    >
                      {first}
                    </div>
                    {last && (
                      <div
                        style={{
                          fontFamily: FONTS.serif,
                          fontSize: 'clamp(0.85rem, 3.2vw, 1.05rem)',
                          lineHeight: 1.15,
                          color: COLORS.text,
                        }}
                      >
                        {last}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: 'clamp(0.6rem, 2.2vw, 0.7rem)',
                        color: COLORS.textDim,
                        marginTop: 4,
                        marginBottom: 10,
                      }}
                    >
                      {player.team}
                    </div>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: 100,
                        aspectRatio: '8 / 11',
                        backgroundColor: COLORS.bg,
                        border: `1px solid ${COLORS.border}`,
                        marginTop: 'auto',
                        alignSelf: 'flex-start',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Input — only while playing */}
          {gameState === 'playing' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  ref={inputRef}
                  type="number"
                  min="0"
                  max="99"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="0–99"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '12px 16px',
                    backgroundColor: COLORS.bgCard,
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.text,
                    fontFamily: FONTS.mono,
                    fontSize: '1.25rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = COLORS.accent)}
                  onBlur={(e) => (e.target.style.borderColor = COLORS.border)}
                />
                <button
                  onClick={handleGuess}
                  disabled={!input}
                  style={{
                    padding: '0 24px',
                    backgroundColor: input ? COLORS.accent : COLORS.border,
                    color: input ? COLORS.bg : COLORS.textFaint,
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    cursor: input ? 'pointer' : 'not-allowed',
                    transition: 'background-color 0.2s',
                    border: 'none',
                  }}
                >
                  Guess
                </button>
              </div>
              <p
                style={{
                  fontSize: '0.625rem',
                  color: COLORS.textDim,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                }}
              >
                {remaining} {remaining === 1 ? 'guess' : 'guesses'} remaining
              </p>
            </div>
          )}

          {/* Guess history — visible during playing + roundEnd, hidden on gameEnd */}
          {gameState !== 'gameEnd' && (
            <div
              style={{
                marginBottom: 24,
                display: 'flex',
                justifyContent: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              {Array.from({ length: MAX_GUESSES }).map((_, i) => {
                const guess = guesses[i];
                return (
                  <div
                    key={i}
                    className={guess ? 'animate-slide-in' : ''}
                    style={{
                      display: 'flex',
                      gap: 2,
                      animationDelay: `${i * 50}ms`,
                    }}
                  >
                    {guess ? (
                      <>
                        <DigitCell digit={guess.digits[0]} match={guess.matches[0]} />
                        <DigitCell digit={guess.digits[1]} match={guess.matches[1]} />
                      </>
                    ) : (
                      <>
                        <DigitCell empty />
                        <DigitCell empty />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Round-end panel */}
          {gameState === 'roundEnd' && lastRound && (
            <div
              className="animate-fade-up"
              style={{
                padding: 24,
                marginBottom: 24,
                border: `1px solid ${COLORS.accent}`,
                backgroundColor: COLORS.bgCard,
              }}
            >
              <h2
                style={{
                  fontFamily: FONTS.serif,
                  fontSize: 'clamp(1.75rem, 7vw, 2.25rem)',
                  marginBottom: 12,
                  lineHeight: 1,
                  color: '#ffffff',
                }}
              >
                {lastRound.won ? 'Solved.' : 'Missed.'}
              </h2>
              <p style={{ marginBottom: 8, color: COLORS.textMuted }}>
                The number was{' '}
                <span
                  style={{
                    color: COLORS.accent,
                    fontSize: '1.6rem',
                    fontFamily: FONTS.mono,
                    fontWeight: 700,
                    verticalAlign: 'middle',
                  }}
                >
                  {String(lastRound.answer).padStart(2, '0')}
                </span>
              </p>
              <p
                style={{
                  marginBottom: 20,
                  color: COLORS.text,
                  fontWeight: 600,
                }}
              >
                + {lastRound.points} {lastRound.points === 1 ? 'point' : 'points'} · Total {totalScore}/{MAX_POINTS_PER_GAME}
              </p>

              <button
                onClick={nextRound}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 24px',
                  fontWeight: 700,
                  backgroundColor: COLORS.accent,
                  color: COLORS.bg,
                  fontSize: '0.85rem',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  border: 'none',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                Next Round
              </button>
            </div>
          )}

          {/* Game-end summary */}
          {gameState === 'gameEnd' && (
            <div
              className="animate-fade-up"
              style={{
                padding: 24,
                marginBottom: 24,
                border: `1px solid ${COLORS.accent}`,
                backgroundColor: COLORS.bgCard,
              }}
            >
              <h2
                style={{
                  fontFamily: FONTS.serif,
                  fontSize: 'clamp(1.75rem, 7vw, 2.25rem)',
                  marginBottom: 8,
                  lineHeight: 1,
                  color: '#ffffff',
                }}
              >
                {mode === 'daily' ? `Daily #${dailyNumber} complete.` : 'Game complete.'}
              </h2>
              <div
                style={{
                  fontFamily: FONTS.serif,
                  fontSize: 'clamp(3rem, 14vw, 4.5rem)',
                  color: COLORS.accent,
                  lineHeight: 1,
                  marginBottom: 4,
                }}
              >
                {totalScore} <span style={{ color: COLORS.textDim, fontSize: '0.5em' }}>/ {MAX_POINTS_PER_GAME}</span>
              </div>
              <p
                style={{
                  marginBottom: 20,
                  fontSize: '0.7rem',
                  color: COLORS.textDim,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                }}
              >
                Final score
              </p>

              {/* Per-round breakdown */}
              <div
                style={{
                  marginBottom: 20,
                  borderTop: `1px solid ${COLORS.border}`,
                  borderBottom: `1px solid ${COLORS.border}`,
                }}
              >
                {rounds.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 0',
                      borderBottom: i < rounds.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: r.won ? COLORS.success : COLORS.textFaint,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: '0.7rem',
                        color: COLORS.textDim,
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Round {i + 1}
                    </span>
                    <span
                      style={{
                        fontFamily: FONTS.mono,
                        color: COLORS.textMuted,
                        marginLeft: 'auto',
                        fontSize: '0.85rem',
                      }}
                    >
                      #{String(r.answer).padStart(2, '0')}
                    </span>
                    <span
                      style={{
                        fontFamily: FONTS.mono,
                        color: COLORS.text,
                        fontWeight: 700,
                        minWidth: 50,
                        textAlign: 'right',
                      }}
                    >
                      {r.points} {r.points === 1 ? 'pt' : 'pts'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Share string */}
              <div
                style={{
                  padding: 12,
                  marginBottom: 16,
                  whiteSpace: 'pre',
                  backgroundColor: COLORS.bg,
                  border: `1px solid ${COLORS.border}`,
                  fontFamily: FONTS.mono,
                  fontSize: '0.8rem',
                  lineHeight: 1.6,
                  overflowX: 'auto',
                }}
              >
                {gameShareString()}
              </div>

              {mode === 'daily' ? (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button onClick={handleShare} style={{
                    flex: '1 1 140px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '12px 20px',
                    fontWeight: 700,
                    backgroundColor: COLORS.accent,
                    color: COLORS.bg,
                    fontSize: '0.85rem',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    border: 'none',
                    cursor: 'pointer',
                  }}>
                      <Share2 style={{ width: 16, height: 16 }} />
                      {shareToast ? 'Copied' : 'Share'}
                    </button>
                    <button onClick={keepPlaying} style={{
                    flex: '1 1 140px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '12px 20px',
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.textMuted,
                    fontSize: '0.85rem',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                  }}>
                      <RotateCcw style={{ width: 16, height: 16 }} />
                      Keep playing
                    </button>
                  </div>
                  <p
                    style={{
                      marginTop: 16,
                      fontSize: '0.8rem',
                      color: COLORS.textDim,
                      textAlign: 'center',
                    }}
                  >
                    Next daily in {timeUntilNextDaily(now)}
                  </p>
                </>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button onClick={playAgain} style={{
                    flex: '1 1 140px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '12px 20px',
                    fontWeight: 700,
                    backgroundColor: COLORS.accent,
                    color: COLORS.bg,
                    fontSize: '0.85rem',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    border: 'none',
                    cursor: 'pointer',
                  }}>
                    <RotateCcw style={{ width: 16, height: 16 }} />
                    Play Again
                  </button>
                  <button onClick={handleShare} style={{
                    flex: '1 1 140px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '12px 20px',
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.textMuted,
                    fontSize: '0.85rem',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                  }}>
                    <Share2 style={{ width: 16, height: 16 }} />
                    {shareToast ? 'Copied' : 'Share'}
                  </button>
                </div>
              )}
            </div>
          )}

          <div
            style={{
              textAlign: 'center',
              marginTop: 40,
              paddingTop: 16,
              fontSize: '0.625rem',
              color: COLORS.textFaint,
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              borderTop: `1px solid ${COLORS.border}`,
            }}
          >
            A daily sports puzzle · Prototype v0.4
          </div>
        </div>
      </div>
    </>
  );
}