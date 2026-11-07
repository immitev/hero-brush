/**
 * Parent gate (PLAN §8): press-and-hold for 3 s, then a sum that is not
 * kid-guessable. A new question is drawn after every miss and three misses in
 * a row lock the gate for a cooldown (kept in module state so remounting the
 * screen does not reset it).
 */
import { useEffect, useRef, useState } from 'react';

export const HOLD_SECONDS = 3;
export const MAX_MISSES = 3;
export const LOCKOUT_SECONDS = 60;

interface Question {
  text: string;
  answer: number;
}

export function makeQuestion(rnd: () => number = Math.random): Question {
  const pick = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const a = pick(6, 12);
  const b = pick(3, 12);
  const c = pick(1, 9);
  return rnd() < 0.5
    ? { text: `${a} × ${b} + ${c}`, answer: a * b + c }
    : { text: `${a} × ${b} − ${c}`, answer: a * b - c };
}

// survives screen remounts within the page session
let misses = 0;
let lockedUntil = 0;

export function Gate({ onPass }: { onPass: () => void }) {
  const [held, setHeld] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [question, setQuestion] = useState<Question>(() => makeQuestion());
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const holdStart = useRef<number | null>(null);
  const raf = useRef(0);

  const locked = lockedUntil > now;
  const lockLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));

  useEffect(() => {
    if (!locked) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [locked]);

  const stopHold = () => {
    holdStart.current = null;
    cancelAnimationFrame(raf.current);
    setHoldProgress(0);
  };

  const startHold = () => {
    if (locked || held) return;
    holdStart.current = performance.now();
    const tick = () => {
      if (holdStart.current === null) return;
      const p = (performance.now() - holdStart.current) / 1000 / HOLD_SECONDS;
      if (p >= 1) {
        setHoldProgress(1);
        setHeld(true);
        holdStart.current = null;
        return;
      }
      setHoldProgress(p);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const check = (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return;
    if (Number(answer) === question.answer) {
      misses = 0;
      onPass();
      return;
    }
    misses++;
    setWrong(true);
    setAnswer('');
    setQuestion(makeQuestion());
    if (misses >= MAX_MISSES) {
      misses = 0;
      lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000;
      setNow(Date.now());
      setHeld(false);
    }
  };

  if (locked) {
    return (
      <div className="card gate">
        <h2>Parents only</h2>
        <p>Too many tries. Try again in {lockLeft} s.</p>
      </div>
    );
  }

  if (!held) {
    return (
      <div className="card gate">
        <h2>Parents only</h2>
        <p>Press and hold for {HOLD_SECONDS} seconds.</p>
        <button
          type="button"
          className="hold-btn"
          onPointerDown={startHold}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Press and hold to open the parent area"
        >
          <span className="hold-fill" style={{ transform: `scaleX(${holdProgress})` }} />
          <span>Hold</span>
        </button>
      </div>
    );
  }

  return (
    <form className="card gate" onSubmit={check}>
      <h2>Parents only</h2>
      <p>What is {question.text}?</p>
      <input type="number" inputMode="numeric" value={answer} onChange={(e) => setAnswer(e.target.value)} autoFocus aria-label="Answer" />
      {wrong && <small className="error">Not quite, here is a new one.</small>}
      <button className="btn" type="submit">
        Enter
      </button>
    </form>
  );
}
