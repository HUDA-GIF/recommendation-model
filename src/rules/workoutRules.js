/**
 * Workout HARD FILTERS — workout_templates + profiles (Supabase).
 */

import {
  canonicalGoal,
  getWorkoutFields,
  levelRank,
  normalizeText,
  toArray,
  unique,
} from '../utils/normalize.js';

export function getWorkoutProfileFields(profile = {}) {
  const availableMinutes = Number(
    profile.available_workout_duration ??
      profile.availableWorkoutDuration ??
      profile.available_time ??
      profile.availableTime ??
      profile.preferred_duration_min
  );

  return {
    goal: canonicalGoal(profile.fitness_goal ?? profile.fitnessGoal),
    level: normalizeText(profile.fitness_level ?? profile.fitnessLevel),
    availableMinutes: Number.isFinite(availableMinutes) ? availableMinutes : NaN,
    // Supabase: profiles.equipment text[]
    equipment: unique(
      toArray(
        profile.equipment ??
          profile.available_equipment ??
          profile.availableEquipment
      )
    ),
    restrictions: unique(
      toArray(profile.workout_restrictions ?? profile.workoutRestrictions)
    ),
    preferredTypes: unique(
      toArray(
        profile.preferred_workout_types ??
          profile.preferredWorkoutTypes ??
          profile.workout_preference ??
          profile.workoutPreference
      )
    ),
    recentIds: unique(
      (profile.recent_workout_ids ?? profile.recentWorkoutIds ?? []).map(String)
    ),
    // Biometrics provide scoring/context only; they are not hard filters or invented targets.
    age: Number(profile.age),
    gender: normalizeText(profile.gender ?? profile.sex),
    heightCm: Number(profile.height_cm ?? profile.heightCm),
    weightKg: Number(profile.weight_kg ?? profile.weightKg),
  };
}

/**
 * Every template equipment item must be covered by the user's profile equipment.
 * none / bodyweight / empty → no special gear.
 */
export function equipmentCompatible(requiredEquipment, userEquipment) {
  const required = toArray(requiredEquipment).filter(
    (item) => !['none', 'bodyweight', 'no_equipment'].includes(item)
  );
  if (required.length === 0) return true;

  const available = new Set(userEquipment);
  if (available.size === 0 || (available.size === 1 && available.has('none'))) {
    return false;
  }
  return required.every((item) => available.has(item));
}

export function passesRestrictions(workout, userRestrictions) {
  if (!userRestrictions.length) return true;
  const w = getWorkoutFields(workout);
  const tags = unique([
    ...toArray(w.tags),
    ...toArray(workout.restriction_flags ?? workout.restrictionFlags),
    ...toArray(w.focus),
  ]);
  const tagSet = new Set(tags);
  return !userRestrictions.some((r) => tagSet.has(r));
}

/**
 * Exclude workouts that are harder than the user's level.
 * Do not offer beginner workouts to an advanced user (a two-level gap).
 */
export function levelCompatible(workoutLevel, userLevel) {
  const w = levelRank(workoutLevel);
  const u = levelRank(userLevel);
  if (u == null) return true;
  if (w == null) return true;
  return w === u;
}

export function timeCompatible(durationMinutes, availableMinutes) {
  if (!Number.isFinite(availableMinutes) || availableMinutes <= 0) return true;
  const duration = Number(durationMinutes);
  if (!Number.isFinite(duration)) return false;
  return duration <= availableMinutes && duration >= availableMinutes * 0.6;
}

/**
 * Specific goals require an exact catalogue goal match. General fitness remains
 * a broad option when that is the user's selected goal.
 */
export function goalCompatible(workoutGoal, userGoal) {
  if (!userGoal) return true;
  const w = canonicalGoal(workoutGoal);
  if (userGoal === 'general_fitness') return true;
  if (!w) return false;
  return w === userGoal;
}

function focusCompatible(workout, userGoal) {
  if (userGoal !== 'muscle_gain') return true;

  const w = getWorkoutFields(workout);
  const labels = [
    w.focus,
    w.name,
    ...toArray(w.tags),
    ...toArray(workout.workout_type ?? workout.workoutType),
  ]
    .map(normalizeText)
    .join('_');

  return !/(^|_)(cardio|mobility|stretch|stretching|recovery)(_|$)/.test(labels);
}

export function passesWorkoutHardFilters(workout, profileFields) {
  const w = getWorkoutFields(workout);
  const { goal, level, availableMinutes, equipment, restrictions } = profileFields;

  if (!levelCompatible(w.level, level)) {
    return { pass: false, reason: 'fitness_level' };
  }

  if (!timeCompatible(w.durationMinutes, availableMinutes)) {
    return { pass: false, reason: 'duration' };
  }

  if (!equipmentCompatible(w.equipment, equipment)) {
    return { pass: false, reason: 'equipment' };
  }

  if (!passesRestrictions(workout, restrictions)) {
    return { pass: false, reason: 'restrictions' };
  }

  if (!goalCompatible(w.goal, goal)) {
    return { pass: false, reason: 'goal' };
  }

  if (!focusCompatible(workout, goal)) {
    return { pass: false, reason: 'focus' };
  }

  return { pass: true, reason: null };
}

export function filterWorkouts(workouts, profileFields) {
  const passed = [];
  const rejected = [];

  for (const workout of workouts) {
    const result = passesWorkoutHardFilters(workout, profileFields);
    if (result.pass) {
      passed.push(workout);
    } else {
      rejected.push({ id: workout.id, reason: result.reason });
    }
  }

  return { passed, rejected };
}
