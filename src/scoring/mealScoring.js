/**
 * Meal scoring — Supabase meals (kcal, protein_g, diet_tags, recommendation_tags).
 */

import { getMealFields } from '../utils/normalize.js';
import { dietaryCompatible } from '../rules/mealRules.js';

export const MEAL_WEIGHTS = {
  diet: 25,
  goal: 30,
  caloriePlan: 15,
  nutritionMeta: 15,
  variety: 15,
};

function hasNumber(value) {
  return value != null && value !== '' && Number.isFinite(Number(value));
}

function scoreDiet(meal, userPreference) {
  if (!userPreference || userPreference === 'none' || userPreference === 'any') {
    return Math.round(MEAL_WEIGHTS.diet / 2);
  }
  return dietaryCompatible(meal, userPreference) ? MEAL_WEIGHTS.diet : 0;
}

function scoreGoal(meal, userGoal) {
  if (!userGoal) return 0;
  const m = getMealFields(meal);
  const tags = new Set([
    ...m.goalTags,
    ...m.recommendationTags,
    ...m.dietTags,
  ]);
  if (tags.has(userGoal)) return MEAL_WEIGHTS.goal;

  if (userGoal === 'weight_loss') {
    if (tags.has('lower_calorie') || tags.has('portion_control')) return 26;
    if (tags.has('high_fibre')) return 22;
    return tags.has('balanced') ? 16 : 0;
  }

  if (userGoal === 'muscle_gain') {
    if (hasNumber(m.protein)) return Math.min(MEAL_WEIGHTS.goal, Number(m.protein));
    return tags.has('high_protein') ? 24 : 0;
  }

  if (userGoal === 'endurance') {
    if (tags.has('energy_dense') || tags.has('carb_focused')) return 24;
    return tags.has('balanced') ? 18 : 0;
  }

  return tags.has('balanced') ? 24 : tags.has('high_fibre') ? 18 : 0;
}

function scoreNutritionMeta(meal) {
  const m = getMealFields(meal);
  let points = 0;
  if (hasNumber(m.calories)) points += 5;
  if (hasNumber(m.protein)) points += 5;
  if (hasNumber(m.carbs)) points += 2;
  if (m.ingredients.length > 0 || m.recommendationTags.length > 0) points += 3;
  return Math.min(points, MEAL_WEIGHTS.nutritionMeta);
}

function scoreVariety(mealId, recentIds) {
  if (!recentIds.length) return MEAL_WEIGHTS.variety;
  if (recentIds.includes(String(mealId))) return 0;
  return MEAL_WEIGHTS.variety;
}

function scoreCaloriePlan(meal, dailyCalorieTarget) {
  if (!dailyCalorieTarget) return Math.round(MEAL_WEIGHTS.caloriePlan / 2);
  const m = getMealFields(meal);
  if (!hasNumber(m.calories)) return 0;

  const mealCal = Number(m.calories);
  const low = dailyCalorieTarget * 0.15;
  const high = dailyCalorieTarget * 0.35;

  if (mealCal >= low && mealCal <= high) return MEAL_WEIGHTS.caloriePlan;
  if (mealCal >= low * 0.8 && mealCal <= high * 1.2) return 10;
  return 3;
}

export function scoreMeal(meal, profileFields) {
  const breakdown = {
    diet: scoreDiet(meal, profileFields.dietaryPreference),
    goal: scoreGoal(meal, profileFields.goal),
    caloriePlan: scoreCaloriePlan(meal, profileFields.dailyCalorieTarget),
    nutritionMeta: scoreNutritionMeta(meal),
    variety: scoreVariety(meal.id, profileFields.recentIds),
  };

  const m = getMealFields(meal);
  const total = Object.values(breakdown).reduce((sum, n) => sum + n, 0);

  return {
    total,
    breakdown,
    nutritionAvailable: {
      calories: hasNumber(m.calories),
      protein: hasNumber(m.protein),
    },
  };
}

export function rankMeals(meals, profileFields) {
  return meals
    .map((meal) => {
      const m = getMealFields(meal);
      const { total, breakdown, nutritionAvailable } = scoreMeal(meal, profileFields);
      return {
        ...meal,
        score: total,
        scoreBreakdown: breakdown,
        nutritionAvailable,
        reason: buildMealReason(m, profileFields, breakdown),
      };
    })
    .sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
}

function buildMealReason(m, profileFields, breakdown) {
  const bits = [];
  if (breakdown.goal >= 20) bits.push(`Relevant for ${profileFields.goal}`);
  if (profileFields.dietaryPreference && profileFields.dietaryPreference !== 'any') {
    bits.push(`Fits ${profileFields.dietaryPreference} preference`);
  }
  if (hasNumber(m.protein)) bits.push(`${Number(m.protein)}g protein`);
  return bits.join(' · ') || 'Compatible with your profile';
}

export function formatMealForDisplay(meal) {
  const m = getMealFields(meal);
  const calories = hasNumber(m.calories) ? Number(m.calories) : null;
  const protein = hasNumber(m.protein) ? Number(m.protein) : null;

  return {
    id: meal.id,
    meal_name: m.name,
    title: m.name,
    description: m.description ?? null,
    dietary_type: m.dietTags[0] ?? null,
    diet_tags: m.dietTags,
    recommendation_tags: m.recommendationTags,
    allergens: m.allergens,
    calories,
    kcal: calories,
    protein,
    protein_g: protein,
    nutritionNote:
      calories == null && protein == null
        ? 'Nutrition data not available in database'
        : null,
    score: meal.score,
    scoreBreakdown: meal.scoreBreakdown,
    reason: meal.reason,
  };
}
