import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recommendWorkouts } from '../src/recommendWorkouts.js';
import { SAMPLE_WORKOUTS } from './fixtures/sampleData.js';

describe('Workout recommendations (Supabase-aligned)', () => {
  it('Test 1: beginner weight_loss within 20 minutes', () => {
    const result = recommendWorkouts({
      profile: {
        fitness_goal: 'weight_loss',
        fitness_level: 'beginner',
        available_workout_duration: 20,
        equipment: ['none'],
      },
      workouts: SAMPLE_WORKOUTS,
    });

    assert.equal(result.ok, true);
    assert.ok(result.recommendations.length > 0);

    const titles = result.recommendations.map((w) => w.title);
    assert.ok(titles.includes('Fat Burn Express'));

    for (const w of result.recommendations) {
      assert.equal(w.difficulty, 'beginner');
      assert.ok(w.duration_min <= 20);
    }

    assert.equal(titles.includes('Pull Day Advanced'), false);
    assert.equal(titles.includes('HIIT Cardio Blast'), false);
  });

  it('Test 2: intermediate muscle_gain with gym equipment', () => {
    const result = recommendWorkouts({
      profile: {
        fitness_goal: 'muscle_gain',
        fitness_level: 'intermediate',
        available_workout_duration: 45,
        equipment: ['dumbbells', 'barbell'],
      },
      workouts: SAMPLE_WORKOUTS,
    });

    assert.equal(result.ok, true);
    const titles = result.recommendations.map((w) => w.title);
    assert.ok(
      titles.includes('Back and Biceps Gym') || titles.includes('Leg Day Gym')
    );
    assert.equal(titles.includes('Pull Day Advanced'), false);
    assert.equal(titles.includes('Fat Burn Express'), false);
  });

  it('Test 3: filters duration over available time', () => {
    const result = recommendWorkouts({
      profile: {
        fitness_goal: 'weight_loss',
        fitness_level: 'beginner',
        available_workout_duration: 20,
        equipment: ['none'],
      },
      workouts: SAMPLE_WORKOUTS,
    });

    const over = result.recommendations.filter((w) => w.duration_min > 20);
    assert.equal(over.length, 0);
    assert.ok(
      result.rejected.some(
        (r) => r.id === 'wt17' && r.reason === 'duration'
      )
    );
  });

  it('matches selected level, goal, and workout duration', () => {
    const result = recommendWorkouts({
      profile: {
        fitness_goal: 'muscle_gain',
        fitness_level: 'intermediate',
        available_workout_duration: 30,
        equipment: ['dumbbells'],
      },
      workouts: [
        {
          id: 'match',
          title: 'Intermediate Chest Strength',
          goal: 'muscle_gain',
          difficulty: 'intermediate',
          duration_min: 28,
          equipment: ['dumbbells'],
          focus: 'chest',
        },
        {
          id: 'short',
          title: 'Short Back Strength',
          goal: 'muscle_gain',
          difficulty: 'intermediate',
          duration_min: 15,
          equipment: ['dumbbells'],
          focus: 'back',
        },
        {
          id: 'beginner',
          title: 'Beginner Chest Strength',
          goal: 'muscle_gain',
          difficulty: 'beginner',
          duration_min: 28,
          equipment: ['dumbbells'],
          focus: 'chest',
        },
        {
          id: 'general',
          title: 'General Full Body',
          goal: 'general_fitness',
          difficulty: 'intermediate',
          duration_min: 28,
          equipment: ['dumbbells'],
          focus: 'full_body',
        },
        {
          id: 'cardio',
          title: 'Muscle Gain Cardio',
          goal: 'muscle_gain',
          difficulty: 'intermediate',
          duration_min: 28,
          equipment: ['dumbbells'],
          focus: 'cardio',
        },
        {
          id: 'mobility',
          title: 'Morning Mobility',
          goal: 'muscle_gain',
          difficulty: 'intermediate',
          duration_min: 28,
          equipment: ['dumbbells'],
          focus: 'full_body',
        },
        {
          id: 'long',
          title: 'Long Chest Strength',
          goal: 'muscle_gain',
          difficulty: 'intermediate',
          duration_min: 35,
          equipment: ['dumbbells'],
          focus: 'chest',
        },
      ],
    });

    assert.deepEqual(
      result.recommendations.map((workout) => workout.id),
      ['match', 'short']
    );
    assert.ok(result.recommendations[0].score > result.recommendations[1].score);
  });

  it('finds matching weight-loss workouts for a 40-minute intermediate profile', () => {
    const result = recommendWorkouts({
      profile: {
        gender: 'male',
        age: 19,
        height_cm: 172,
        weight_kg: 95,
        fitness_goal: 'weight_loss',
        fitness_level: 'intermediate',
        available_workout_duration: 40,
        equipment: ['none'],
      },
      workouts: SAMPLE_WORKOUTS,
    });

    assert.ok(result.recommendations.length > 0);
    for (const workout of result.recommendations) {
      assert.equal(workout.difficulty, 'intermediate');
      assert.equal(workout.goal, 'weight_loss');
      assert.ok(workout.duration_min > 0);
      assert.ok(workout.duration_min <= 40);
    }
  });

  it('Test 4: missing fitness_goal blocks personalized list', () => {
    const result = recommendWorkouts({
      profile: {
        fitness_level: 'beginner',
        equipment: ['none'],
      },
      workouts: SAMPLE_WORKOUTS,
    });

    assert.equal(result.ok, false);
    assert.equal(result.needsProfile, true);
    assert.equal(result.reason, 'missing_fitness_goal');
    assert.equal(
      result.message,
      'Fitness goal is missing. Complete your profile to get personalized workout recommendations.'
    );
    assert.deepEqual(result.recommendations, []);
  });

  it('60-minute slot prefers longer workouts over 15-30 min fillers', () => {
    const result = recommendWorkouts({
      profile: {
        fitness_goal: 'muscle_gain',
        fitness_level: 'advanced',
        available_workout_duration: 60,
        equipment: ['dumbbells', 'barbell', 'cable'],
      },
      workouts: SAMPLE_WORKOUTS,
      limit: 3,
    });

    assert.ok(result.recommendations.length > 0);
    const top = result.recommendations[0];
    assert.ok(top.duration_min >= 45, `expected long session, got ${top.duration_min}`);
    assert.notEqual(top.title, 'Full Body Beginner');
  });

  it('advanced user is not given beginner-only templates', () => {
    const result = recommendWorkouts({
      profile: {
        fitness_goal: 'general_fitness',
        fitness_level: 'advanced',
        available_workout_duration: 40,
        equipment: ['none'],
      },
      workouts: SAMPLE_WORKOUTS,
      limit: 10,
    });

    for (const w of result.recommendations) {
      assert.notEqual(w.difficulty, 'beginner', w.title);
    }
  });

  it('does not recommend a workout longer than available time or for another goal', () => {
    const result = recommendWorkouts({
      profile: {
        fitness_goal: 'general_fitness',
        fitness_level: 'intermediate',
        available_workout_duration: 30,
        equipment: ['none'],
      },
      workouts: [
        {
          id: 'short-general',
          title: 'Short General Session',
          goal: 'general_fitness',
          difficulty: 'intermediate',
          duration_min: 10,
          equipment: ['none'],
        },
        {
          id: 'other-goal',
          title: 'Weight Loss Session',
          goal: 'weight_loss',
          difficulty: 'intermediate',
          duration_min: 20,
          equipment: ['none'],
        },
        {
          id: 'too-long',
          title: 'Long General Session',
          goal: 'general_fitness',
          difficulty: 'intermediate',
          duration_min: 31,
          equipment: ['none'],
        },
      ],
    });

    assert.deepEqual(
      result.recommendations.map((workout) => workout.id),
      ['short-general']
    );
    assert.ok(result.rejected.some((item) => item.reason === 'goal'));
    assert.ok(result.rejected.some((item) => item.reason === 'duration'));
  });

  it('requires fitness level and available time for workout recommendations', () => {
    const missingLevel = recommendWorkouts({
      profile: {
        fitness_goal: 'weight_loss',
        available_workout_duration: 30,
      },
      workouts: SAMPLE_WORKOUTS,
    });
    const missingTime = recommendWorkouts({
      profile: {
        fitness_goal: 'weight_loss',
        fitness_level: 'beginner',
      },
      workouts: SAMPLE_WORKOUTS,
    });

    assert.equal(missingLevel.reason, 'missing_fitness_level');
    assert.equal(missingTime.reason, 'missing_available_time');
  });

  it('different profiles produce different top recommendations', () => {
    const a = recommendWorkouts({
      profile: {
        fitness_goal: 'weight_loss',
        fitness_level: 'beginner',
        available_workout_duration: 20,
        equipment: ['none'],
      },
      workouts: SAMPLE_WORKOUTS,
    });
    const b = recommendWorkouts({
      profile: {
        fitness_goal: 'muscle_gain',
        fitness_level: 'intermediate',
        available_workout_duration: 45,
        equipment: ['dumbbells', 'barbell'],
      },
      workouts: SAMPLE_WORKOUTS,
    });

    assert.notEqual(a.recommendations[0]?.id, b.recommendations[0]?.id);
  });
});
