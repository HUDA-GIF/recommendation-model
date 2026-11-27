import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recommendMeals } from '../src/recommendMeals.js';
import { SAMPLE_MEALS } from './fixtures/sampleData.js';

describe('Meal recommendations (Supabase-aligned)', () => {
  it('Test 5: vegetarian diet_preference only compatible meals', () => {
    const result = recommendMeals({
      profile: {
        fitness_goal: 'weight_loss',
        diet_preference: 'vegetarian',
        disliked_foods: [],
      },
      meals: SAMPLE_MEALS,
    });

    assert.equal(result.ok, true);
    assert.ok(result.recommendations.length > 0);

    for (const meal of result.recommendations) {
      assert.ok((meal.diet_tags ?? []).includes('vegetarian'));
    }

    const titles = result.recommendations.map((m) => m.title);
    assert.equal(titles.includes('Smoky Chicken Bowl'), false);
    assert.equal(titles.includes('Chicken Qeema Wrap'), false);
    assert.equal(titles.includes('Mystery Veg Plate'), false);
  });

  it('Test 6: peanut allergen / disliked never recommended', () => {
    const byAllergy = recommendMeals({
      profile: {
        fitness_goal: 'muscle_gain',
        diet_preference: 'any',
        allergies: ['peanut'],
      },
      meals: SAMPLE_MEALS,
    });

    const allergyTitles = byAllergy.recommendations.map((m) => m.title);
    assert.equal(allergyTitles.includes('Mango Cinnamon Oats'), false);
    assert.equal(allergyTitles.includes('Banana Peanut Butter Oats'), false);
    assert.ok(byAllergy.rejected.some((r) => r.reason === 'allergy'));

    const byDislike = recommendMeals({
      profile: {
        fitness_goal: 'muscle_gain',
        diet_preference: 'any',
        disliked_foods: ['chicken'],
      },
      meals: SAMPLE_MEALS,
    });

    assert.equal(
      byDislike.recommendations.some((m) => m.title.includes('Chicken')),
      false
    );
    assert.ok(byDislike.rejected.some((r) => r.reason === 'disliked_food'));
  });

  it('disliked greens excludes spinach/salad meals', () => {
    const result = recommendMeals({
      profile: {
        fitness_goal: 'muscle_gain',
        diet_preference: 'any',
        disliked_foods: ['greens'],
      },
      meals: SAMPLE_MEALS,
      limit: 12,
    });

    const titles = result.recommendations.map((m) => m.title);
    assert.equal(titles.includes('Chicken Salad'), false);
    assert.equal(titles.includes('Masala Egg Scramble'), false);
    assert.equal(titles.includes('Moong Dal Chilla'), false);
  });

  it('Test 7: muscle_gain ranks higher protein; does not invent protein', () => {
    const result = recommendMeals({
      profile: {
        fitness_goal: 'muscle_gain',
        diet_preference: 'any',
        disliked_foods: [],
      },
      meals: SAMPLE_MEALS,
      limit: 12,
    });

    const chicken = result.recommendations.find((m) => m.id === 'm3');
    const chickpea = result.recommendations.find((m) => m.id === 'm5');
    assert.ok(chicken);
    assert.ok(chickpea);
    assert.ok(chicken.score > chickpea.score);
    assert.ok(chicken.protein_g >= 40);

    for (const meal of result.recommendations) {
      if (meal.protein == null) {
        assert.ok(meal.nutritionNote);
      }
    }
  });

  it('Test 8: empty state when vegan and nothing tagged vegan', () => {
    const result = recommendMeals({
      profile: {
        fitness_goal: 'weight_loss',
        diet_preference: 'vegan',
        disliked_foods: [],
      },
      meals: SAMPLE_MEALS,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.recommendations, []);
    assert.equal(result.reason, 'no_suitable_matches');
    assert.equal(
      result.message,
      'No suitable meals matched your dietary preference, allergies, or restrictions.'
    );
  });

  it('missing goal blocks personalized meals', () => {
    const result = recommendMeals({
      profile: {
        diet_preference: 'vegetarian',
      },
      meals: SAMPLE_MEALS,
    });

    assert.equal(result.ok, false);
    assert.equal(result.needsProfile, true);
    assert.equal(
      result.message,
      'Fitness goal is missing. Complete your profile to get personalized meal recommendations.'
    );
  });

  it('requires an explicit halal tag instead of inferring halal from missing ingredients', () => {
    const result = recommendMeals({
      profile: {
        fitness_goal: 'general_fitness',
        diet_preference: 'halal',
      },
      meals: [
        {
          id: 'unknown',
          title: 'Unverified Recipe',
          diet_tags: [],
          ingredients: ['chicken'],
          allergens: [],
        },
        {
          id: 'verified',
          title: 'Halal Recipe',
          diet_tags: ['halal'],
          ingredients: ['chicken'],
          allergens: [],
        },
      ],
    });

    assert.deepEqual(result.recommendations.map((meal) => meal.id), ['verified']);
  });

  it('does not recommend meals with unknown allergen metadata when the user has allergies', () => {
    const result = recommendMeals({
      profile: {
        fitness_goal: 'general_fitness',
        allergies: ['peanut'],
      },
      meals: [
        { id: 'unknown', title: 'Unknown Ingredients' },
        {
          id: 'safe',
          title: 'Known Ingredients',
          ingredients: ['rice', 'vegetables'],
          allergens: [],
        },
      ],
    });

    assert.deepEqual(result.recommendations.map((meal) => meal.id), ['safe']);
    assert.ok(result.rejected.some((item) => item.reason === 'allergen_metadata_missing'));
  });

  it('uses explicit goal tags and nutrition rather than catalogue-relative medians', () => {
    const result = recommendMeals({
      profile: { fitness_goal: 'weight_loss' },
      meals: [
        {
          id: 'tagged',
          title: 'Portion-Controlled Meal',
          goal_tags: ['weight_loss'],
          ingredients: ['vegetables'],
          allergens: [],
        },
        {
          id: 'unmatched',
          title: 'Unclassified Meal',
          ingredients: ['rice'],
          allergens: [],
        },
      ],
    });

    assert.equal(result.recommendations[0].id, 'tagged');
    assert.equal(result.recommendations[0].scoreBreakdown.goal, 30);
  });
});
