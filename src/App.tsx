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

type RoundResult = {
  puzzleId: number;
  answer: number;
  guesses: GuessResult[];
  won: boolean;
  points: number;
};

type GameState = 'playing' | 'roundEnd' | 'gameEnd';

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
  const [puzzle, setPuzzle] = useState<Puzzle>(() => pickRandomPuzzle());
  const [rounds, setRounds] = useState<RoundResult[]>([]);
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [input, setInput] = useState('');
  const [gameState, setGameState] = useState<GameState>('playing');
  const [shareToast, setShareToast] = useState(false);

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
  }, [gameState, guesses.length, puzzle]);

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

    setGuesses(newGuesses);
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
        setRounds((prev) => [...prev, newRound]);
        if (completedRounds + 1 >= TOTAL_ROUNDS) {
          setGameState('gameEnd');
        } else {
          setGameState('roundEnd');
        }
      }, 700);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleGuess();
  };

  const nextRound = () => {
    const playedIds = rounds.map((r) => r.puzzleId);
    setPuzzle(pickRandomPuzzle(playedIds));
    setGuesses([]);
    setInput('');
    setGameState('playing');
  };

  const playAgain = () => {
    setRounds([]);
    setPuzzle(pickRandomPuzzle());
    setGuesses([]);
    setInput('');
    setGameState('playing');
  };

  const gameShareString = () => {
    const header = `Jersey Number — ${totalScore}/${MAX_POINTS_PER_GAME}`;
    const lines = rounds.map((r, i) => {
      const blocks = r.guesses
        .map((g) => g.matches.map((m) => (m ? '🟩' : '⬛')).join(''))
        .join(' ');
      const ptsLabel = r.points === 1 ? 'pt' : 'pts';
      return `R${i + 1}: ${blocks} (${r.points} ${ptsLabel})`;
    });
    return `${header}\n${lines.join('\n')}`;
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
              Day 1 · Round {currentRoundNumber}/{TOTAL_ROUNDS}
              {gameState !== 'playing' && (
                <>
                  {' · '}
                  Score {totalScore}/{MAX_POINTS_PER_GAME}
                </>
              )}
            </p>
          </div>

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
                Game complete.
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

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  onClick={playAgain}
                  style={{
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
                  }}
                >
                  <RotateCcw style={{ width: 16, height: 16 }} />
                  Play Again
                </button>
                <button
                  onClick={handleShare}
                  style={{
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
                  }}
                >
                  <Share2 style={{ width: 16, height: 16 }} />
                  {shareToast ? 'Copied' : 'Share'}
                </button>
              </div>
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