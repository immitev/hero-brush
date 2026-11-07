/** Pre-session countdown: 3, 2, 1, then "GO!" shown briefly before the clock starts. */
export const COUNTDOWN_NUMBERS = 3;
export const GO_FLASH_SECONDS = 0.7;
export const COUNTDOWN_TOTAL_SECONDS = COUNTDOWN_NUMBERS + GO_FLASH_SECONDS;

export interface CountdownState {
  /** 3, 2, 1 while counting; 0 while "GO!" is shown. */
  step: number;
  label: string;
  /** True once the session should start. */
  started: boolean;
}

export function countdownAt(t: number): CountdownState {
  const tt = Math.max(0, t);
  const step = Math.max(0, Math.ceil(COUNTDOWN_NUMBERS - tt));
  return {
    step,
    label: step > 0 ? String(step) : 'GO!',
    started: tt >= COUNTDOWN_TOTAL_SECONDS,
  };
}
