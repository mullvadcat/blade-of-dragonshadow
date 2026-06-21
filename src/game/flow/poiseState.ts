export type PoiseState = {
  readonly current: number;
  readonly max: number;
  readonly brokenAt: number;
  readonly staggerDuration: number;
};

export function createPoise(max: number): PoiseState {
  return { current: max, max, brokenAt: 0, staggerDuration: 1500 };
}

export function takePoiseDamage(state: PoiseState, amount: number): PoiseState {
  return { ...state, current: Math.max(0, state.current - amount) };
}

export function resetPoise(state: PoiseState): PoiseState {
  return { ...state, current: state.max, brokenAt: 0 };
}

export function isPoiseBreaking(state: PoiseState): boolean {
  return state.current <= 0;
}

export function isStaggering(state: PoiseState, now: number): boolean {
  return state.brokenAt > 0 && now < state.brokenAt + state.staggerDuration;
}
