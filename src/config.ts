// All tuning values live here. The dev panel edits a live copy (`tuning`);
// change a default below to change it permanently.

export const COLS = 6;
export const ROWS = 12;
export const SPAWN_COL = 2;

export const ANIMALS = ["cat", "dog", "fish", "bird"] as const;
export type Animal = (typeof ANIMALS)[number];

export interface Tuning {
  /** Seconds per row at the start of a battle (forgiving for young children). */
  fallInterval: number;
  /** Fastest seconds per row reached by the slow speed ramp. */
  fallIntervalMin: number;
  /** Battle seconds before the speed starts to ramp, and seconds to reach the minimum. */
  rampStart: number;
  rampDuration: number;
  /** Seconds per row while soft drop is held. */
  softDropInterval: number;
  /** Seconds a grounded piece may still slide/rotate before it locks. */
  lockDelay: number;
  /** A crash gem appears on roughly every Nth pair. */
  crashEvery: number;
  /** A word gem appears every Nth pair; its picture pair is the very next pair. */
  englishEvery: number;
  /** Extra attack points for every charged English gem cleared. */
  chargedBonus: number;
  /** Correct matches needed to fill the English power meter. */
  powerMax: number;
  /** Damage of the English Blast fired when the power meter fills. */
  blastDamage: number;
  /** Seconds the English Blast pushes back the monster's next attack. */
  blastStun: number;
  monsterHp: number;
  attacksEnabled: boolean;
  /** Seconds between monster attacks (each attack picks a value in this range). */
  attackIntervalMin: number;
  attackIntervalMax: number;
  /** Seconds of telegraph before an attack is ready. It lands after the next piece locks. */
  attackWarning: number;
  /** Pieces placed before a gray garbage gem turns into a normal colored gem. */
  garbageTurns: number;
  /** Chain multiplier per chain step (last value repeats). */
  chainMultipliers: number[];
}

export const DEFAULT_TUNING: Tuning = {
  fallInterval: 0.85,
  fallIntervalMin: 0.55,
  rampStart: 75,
  rampDuration: 90,
  softDropInterval: 0.04,
  lockDelay: 0.5,
  crashEvery: 2, // plan said ~4; the balance sim showed boards topping out at 4 (see DESIGN_DECISIONS)
  englishEvery: 5,
  chargedBonus: 3,
  powerMax: 3,
  blastDamage: 15,
  blastStun: 6,
  monsterHp: 100,
  attacksEnabled: true,
  attackIntervalMin: 13,
  attackIntervalMax: 18,
  attackWarning: 4,
  garbageTurns: 5,
  chainMultipliers: [1, 1.5, 2, 2.5, 3]
};

export function cloneTuning(t: Tuning = DEFAULT_TUNING): Tuning {
  return { ...t, chainMultipliers: [...t.chainMultipliers] };
}

/** Monster attack sizes cycle through this list: learnable but not constant. */
export const ATTACK_PATTERN = [1, 2, 1, 1, 2, 2];
