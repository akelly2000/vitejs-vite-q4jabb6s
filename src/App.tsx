import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { Share2, RotateCcw, Check } from 'lucide-react';
// @ts-ignore
import puzzlesData from './puzzles.json';

// ----- Puzzle selection (free-play: random pick from the pool) -----

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

function pickRandomPuzzle(excludeId?: number): Puzzle {
  const pool = puzzlesData.puzzles;
  if (pool.length === 1) return formatPuzzle(pool[0]);
  let candidate;
  do {
    candidate = pool[Math.floor(Math.random() * pool.length)];
  } while (excludeId !== undefined && candidate.id === excludeId);
  return formatPuzzle(candidate);
}

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
  miss: '#1f2733',
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

function evaluateGuess(guess: number, answer: number) {
  const guessStr = String(guess).padStart(2, '0');
  const answerStr = String(answer).padStart(2, '0');
  return {
    value: guess,
    digits: [guessStr[0], guessStr[1]],
    matches: [guessStr[0] === answerStr[0], guessStr[1] === answerStr[1]],
  };
}

type GuessResult = ReturnType<typeof evaluateGuess>;
type GameState = 'playing' | 'won' | 'lost';

export default function App() {
  const [puzzle, setPuzzle] = useState<Puzzle>(() => pickRandomPuzzle());
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [input, setInput] = useState('');
  const [gameState, setGameState] = useState<GameState>('playing');
  const [shareToast, setShareToast] = useState(false);

  // Lightweight session counter — resets on full page reload
  const [sessionPlayed, setSessionPlayed] = useState(0);
  const [sessionWon, setSessionWon] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  const maxGuesses = 5;
  const remaining = maxGuesses - guesses.length;

  useEffect(() => {
    if (gameState === 'playing' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [gameState, guesses.length, puzzle]);

  const handleGuess = () => {
    const n = parseInt(input, 10);
    if (isNaN(n) || n < 0 || n > 99) return;
    if (guesses.some((g) => g.value === n)) {
      setInput('');
      return;
    }

    const result = evaluateGuess(n, puzzle.number);
    const newGuesses = [...guesses, result];
    setGuesses(newGuesses);
    setInput('');

    const won = result.matches[0] && result.matches[1];
    const lost = !won && newGuesses.length >= maxGuesses;

    if (won || lost) {
      setSessionPlayed((p) => p + 1);
      if (won) setSessionWon((w) => w + 1);
      setTimeout(() => setGameState(won ? 'won' : 'lost'), 700);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleGuess();
  };

  // Pull a fresh puzzle (not the one we just played) and reset state
  const playAgain = () => {
    setPuzzle(pickRandomPuzzle(puzzle.puzzleNumber));
    setGuesses([]);
    setInput('');
    setGameState('playing');
  };

  const shareString = () => {
    const result = gameState === 'won' ? `${guesses.length}/5` : `X/5`;
    const lines = guesses
      .map((g) => g.matches.map((m) => (m ? '🟩' : '⬛')).join(''))
      .join('\n');
    return `Mystery Number #${puzzle.puzzleNumber} — ${result}\n${lines}`;
  };

  const handleShare = () => {
    navigator.clipboard.writeText(shareString());
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2000);
  };

  const DigitCell = ({ digit, match }: { digit: string; match: boolean }) => (
    <div
      className="flex items-center justify-center"
      style={{
        width: 56,
        height: 56,
        backgroundColor: match ? COLORS.success : COLORS.miss,
        border: `1px solid ${match ? COLORS.success : COLORS.border}`,
        fontFamily: FONTS.mono,
        fontSize: '1.75rem',
        fontWeight: 600,
        color: COLORS.text,
      }}
    >
      {digit}
    </div>
  );

  return (
    <>
      <style>{STYLE_BLOCK}</style>
      <div
        className="min-h-screen py-10 px-4"
        style={{
          backgroundColor: COLORS.bg,
          color: COLORS.text,
          fontFamily: FONTS.sans,
        }}
      >
        <div className="max-w-3xl mx-auto">
          <div
            className="flex items-baseline justify-between mb-10 pb-6"
            style={{ borderBottom: `1px solid ${COLORS.border}` }}
          >
            <div>
              <h1
                className="leading-none"
                style={{
                  fontFamily: FONTS.serif,
                  fontSize: '3.5rem',
                  letterSpacing: '-0.02em',
                }}
              >
                Mystery Number
              </h1>
              <p
                className="mt-3 uppercase"
                style={{
                  fontSize: '0.7rem',
                  color: COLORS.textDim,
                  letterSpacing: '0.2em',
                }}
              >
                Puzzle #{puzzle.puzzleNumber}
                {sessionPlayed > 0 && (
                  <>
                    {' · '}
                    Session {sessionWon}/{sessionPlayed}
                  </>
                )}
              </p>
            </div>
            <span
              className="hidden sm:inline px-3 py-1.5 uppercase"
              style={{
                fontSize: '0.625rem',
                border: `1px solid ${COLORS.border}`,
                color: COLORS.textDim,
                letterSpacing: '0.25em',
              }}
            >
              {puzzle.difficulty}
            </span>
          </div>

          <p
            className="mb-10 leading-relaxed max-w-2xl"
            style={{ color: COLORS.textMuted }}
          >
            These three players wore the same jersey number. You have{' '}
            <span style={{ color: COLORS.text, fontWeight: 600 }}>
              five guesses
            </span>
            . A digit turns{' '}
            <span style={{ color: COLORS.success, fontWeight: 600 }}>
              green
            </span>{' '}
            when it's in the right position — wrong position counts as a miss.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            {puzzle.players.map((player: any, i: number) => (
              <div
                key={`${puzzle.puzzleNumber}-${i}`}
                className="p-6 relative animate-fade-up"
                style={{
                  border: `1px solid ${COLORS.border}`,
                  backgroundColor: COLORS.bgCard,
                  animationDelay: `${i * 100}ms`,
                }}
              >
                <div className="flex items-start justify-between mb-5">
                  <span
                    className="uppercase"
                    style={{
                      fontSize: '0.625rem',
                      color: COLORS.accent,
                      letterSpacing: '0.25em',
                      fontWeight: 700,
                    }}
                  >
                    {player.sport}
                  </span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: COLORS.textFaint,
                      fontFamily: FONTS.mono,
                      letterSpacing: '0.1em',
                    }}
                  >
                    0{i + 1}
                  </span>
                </div>
                <div
                  className="mb-2 leading-tight"
                  style={{ fontFamily: FONTS.serif, fontSize: '1.5rem' }}
                >
                  {player.name}
                </div>
                <div
                  className="mb-6"
                  style={{ fontSize: '0.875rem', color: COLORS.textDim }}
                >
                  {player.team}
                </div>
                <div
                  className="flex items-center gap-2 pt-4"
                  style={{ borderTop: `1px solid ${COLORS.border}` }}
                >
                  <span
                    className="uppercase"
                    style={{
                      fontSize: '0.625rem',
                      color: COLORS.textFaint,
                      letterSpacing: '0.15em',
                    }}
                  >
                    No.
                  </span>
                  <div className="flex gap-1">
                    {[0, 1].map((j) => (
                      <div
                        key={j}
                        style={{
                          width: 18,
                          height: 18,
                          backgroundColor: COLORS.bg,
                          border: `1px solid ${COLORS.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.625rem',
                          color: COLORS.textFaint,
                          fontFamily: FONTS.mono,
                        }}
                      >
                        ?
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {gameState === 'playing' && (
            <div className="mb-8">
              <div className="flex gap-3 mb-3">
                <input
                  ref={inputRef}
                  type="number"
                  min="0"
                  max="99"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="0–99"
                  className="flex-1 px-5 py-4 outline-none"
                  style={{
                    backgroundColor: COLORS.bgCard,
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.text,
                    fontFamily: FONTS.mono,
                    fontSize: '1.5rem',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = COLORS.accent)}
                  onBlur={(e) => (e.target.style.borderColor = COLORS.border)}
                />
                <button
                  onClick={handleGuess}
                  disabled={!input}
                  className="px-8 font-bold uppercase"
                  style={{
                    backgroundColor: input ? COLORS.accent : COLORS.border,
                    color: input ? COLORS.bg : COLORS.textFaint,
                    fontSize: '0.875rem',
                    letterSpacing: '0.15em',
                    cursor: input ? 'pointer' : 'not-allowed',
                    transition: 'background-color 0.2s',
                    border: 'none',
                  }}
                >
                  Guess
                </button>
              </div>
              <p
                className="uppercase"
                style={{
                  fontSize: '0.625rem',
                  color: COLORS.textDim,
                  letterSpacing: '0.2em',
                }}
              >
                {remaining} {remaining === 1 ? 'guess' : 'guesses'} remaining
              </p>
            </div>
          )}

          <div className="space-y-3 mb-10">
            {guesses.map((guess, i) => {
              const won = guess.matches[0] && guess.matches[1];
              return (
                <div
                  key={i}
                  className="flex items-center gap-5 px-5 py-3 animate-slide-in"
                  style={{
                    border: `1px solid ${COLORS.border}`,
                    backgroundColor: COLORS.bgCard,
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: COLORS.textFaint,
                      fontFamily: FONTS.mono,
                      letterSpacing: '0.1em',
                      minWidth: 20,
                    }}
                  >
                    0{i + 1}
                  </span>
                  <div className="flex gap-2">
                    <DigitCell
                      digit={guess.digits[0]}
                      match={guess.matches[0]}
                    />
                    <DigitCell
                      digit={guess.digits[1]}
                      match={guess.matches[1]}
                    />
                  </div>
                  {won && (
                    <div className="flex items-center gap-2 ml-auto">
                      <Check
                        style={{ width: 16, height: 16, color: COLORS.success }}
                        strokeWidth={3}
                      />
                      <span
                        className="uppercase"
                        style={{
                          fontSize: '0.75rem',
                          color: COLORS.success,
                          letterSpacing: '0.2em',
                          fontWeight: 700,
                        }}
                      >
                        Solved
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {gameState !== 'playing' && (
            <div
              className="p-8 mb-6 animate-fade-up"
              style={{
                border: `1px solid ${COLORS.accent}`,
                backgroundColor: COLORS.bgCard,
              }}
            >
              <h2
                className="mb-3 leading-none"
                style={{ fontFamily: FONTS.serif, fontSize: '2.5rem' }}
              >
                {gameState === 'won' ? 'Solved.' : 'Out of guesses.'}
              </h2>
              <p className="mb-6" style={{ color: COLORS.textMuted }}>
                The number was{' '}
                <span
                  className="align-middle font-bold"
                  style={{
                    color: COLORS.accent,
                    fontSize: '1.75rem',
                    fontFamily: FONTS.mono,
                  }}
                >
                  {String(puzzle.number).padStart(2, '0')}
                </span>
              </p>

              <div
                className="p-4 mb-5 whitespace-pre"
                style={{
                  backgroundColor: COLORS.bg,
                  border: `1px solid ${COLORS.border}`,
                  fontFamily: FONTS.mono,
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                }}
              >
                {shareString()}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={playAgain}
                  className="flex items-center justify-center gap-2 font-bold px-6 py-3 uppercase"
                  style={{
                    backgroundColor: COLORS.accent,
                    color: COLORS.bg,
                    fontSize: '0.875rem',
                    letterSpacing: '0.15em',
                    transition: 'background-color 0.2s',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <RotateCcw style={{ width: 16, height: 16 }} />
                  Next Puzzle
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center justify-center gap-2 px-6 py-3 uppercase"
                  style={{
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.textMuted,
                    fontSize: '0.875rem',
                    letterSpacing: '0.15em',
                    transition: 'all 0.2s',
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
            className="text-center mt-16 pt-6 uppercase"
            style={{
              fontSize: '0.625rem',
              color: COLORS.textFaint,
              letterSpacing: '0.25em',
              borderTop: `1px solid ${COLORS.border}`,
            }}
          >
            A daily sports puzzle · Prototype v0.2
          </div>
        </div>
      </div>
    </>
  );
}
