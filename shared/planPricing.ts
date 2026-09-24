export const UNLIMITED_STUDENTS = 999999;
export const MAX_SLIDER_STUDENTS = 5000;

export interface SimPlan {
  id: string;
  name: string;
  priceMonthly: number;
  maxStudents: number;
  allowExtraStudents: boolean;
  extraStudentPrice: number;
  isPopular?: boolean;
  order?: number;
}

export interface PlanRange {
  min: number;
  max: number;
  initial: number;
  step: number;
}

export interface Simulation {
  students: number;
  basePrice: number;
  excessCount: number;
  excessSubtotal: number;
  total: number;
  isUnlimited: boolean;
  exceedsLimit: boolean;
  isExcessAllowed: boolean;
}

export interface Recommendation {
  plan: SimPlan | null;
  needsCustomQuote: boolean;
}

function toCents(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isUnlimitedPlan(plan: SimPlan): boolean {
  return plan.maxStudents >= UNLIMITED_STUDENTS;
}

export function sortPlans(plans: SimPlan[]): SimPlan[] {
  return [...plans].sort((a, b) => {
    if (a.maxStudents !== b.maxStudents) return a.maxStudents - b.maxStudents;
    const extraPreference = Number(b.allowExtraStudents) - Number(a.allowExtraStudents);
    if (extraPreference !== 0) return extraPreference;
    return toCents(a.priceMonthly) - toCents(b.priceMonthly);
  });
}

export function computePlanRange(plans: SimPlan[]): PlanRange {
  const finiteLimits = plans
    .filter((plan) => !isUnlimitedPlan(plan))
    .map((plan) => Math.floor(plan.maxStudents))
    .filter((limit) => Number.isFinite(limit) && limit > 0);

  const min = finiteLimits.length > 0 ? Math.max(1, Math.min(...finiteLimits)) : 10;
  const largest = finiteLimits.length > 0 ? Math.max(...finiteLimits) : 500;
  const max = clamp(Math.ceil(Math.max(largest * 1.5, 500) / 50) * 50, 50, MAX_SLIDER_STUDENTS);

  return { min, max, initial: min, step: 1 };
}

export function normalizeStudentCount(value: number, range: PlanRange): number {
  if (!Number.isFinite(value)) return range.initial;
  return clamp(Math.round(value), range.min, range.max);
}

export function simulateMonthly(plan: SimPlan, students: number): Simulation {
  const unlimited = isUnlimitedPlan(plan);
  const safeStudents = Math.max(0, Math.floor(Number.isFinite(students) ? students : 0));
  const excessCount = unlimited ? 0 : Math.max(0, safeStudents - Math.floor(plan.maxStudents));
  const exceedsLimit = excessCount > 0;
  const isExcessAllowed = exceedsLimit && plan.allowExtraStudents === true;
  const excessCents = isExcessAllowed ? excessCount * toCents(plan.extraStudentPrice) : 0;
  const baseCents = toCents(plan.priceMonthly);

  return {
    students: safeStudents,
    basePrice: baseCents / 100,
    excessCount,
    excessSubtotal: excessCents / 100,
    total: (baseCents + excessCents) / 100,
    isUnlimited: unlimited,
    exceedsLimit,
    isExcessAllowed,
  };
}

export function recommendPlan(plans: SimPlan[], students: number): Recommendation {
  const sorted = sortPlans(plans);
  if (sorted.length === 0) return { plan: null, needsCustomQuote: true };

  const safeStudents = Math.max(0, Math.floor(Number.isFinite(students) ? students : 0));
  const fitting = sorted.find((plan) => plan.maxStudents >= safeStudents);
  if (fitting) return { plan: fitting, needsCustomQuote: false };

  const allowsExtra = sorted.filter((plan) => plan.allowExtraStudents);
  if (allowsExtra.length > 0) {
    return { plan: allowsExtra[allowsExtra.length - 1], needsCustomQuote: false };
  }

  return { plan: sorted[sorted.length - 1], needsCustomQuote: true };
}
