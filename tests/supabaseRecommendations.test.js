import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSupabaseRecommendations } from '../src/supabaseRecommendations.js';
import { SAMPLE_MEALS, SAMPLE_WORKOUTS } from './fixtures/sampleData.js';

function createSupabaseMock({ profile, workouts, meals, profileError } = {}) {
  const calls = [];

  return {
    calls,
    from(table) {
      calls.push({ table });
      return {
        select() {
          if (table === 'profiles') {
            return {
              eq(column, value) {
                calls[calls.length - 1].filter = { column, value };
                return {
                  maybeSingle: async () => ({
                    data: profile ?? null,
                    error: profileError ?? null,
                  }),
                };
              },
            };
          }
          return Promise.resolve({
            data: table === 'workout_templates' ? workouts : meals,
            error: null,
          });
        },
      };
    },
  };
}

describe('Supabase recommendation integration', () => {
  it('loads the signed-in profile and catalogues, then applies runtime profile overrides', async () => {
    const supabase = createSupabaseMock({
      profile: {
        id: 'user-123',
        fitness_goal: 'weight_loss',
        fitness_level: 'beginner',
        equipment: ['none'],
      },
      workouts: SAMPLE_WORKOUTS,
      meals: SAMPLE_MEALS,
    });

    const result = await getSupabaseRecommendations({
      supabase,
      userId: 'user-123',
      profileOverrides: {
        available_workout_duration: 20,
        diet_preference: 'vegetarian',
      },
    });

    assert.deepEqual(supabase.calls[0], {
      table: 'profiles',
      filter: { column: 'id', value: 'user-123' },
    });
    assert.equal(result.profile.available_workout_duration, 20);
    assert.ok(result.workoutRecommendations.recommendations.length > 0);
    assert.ok(result.mealRecommendations.recommendations.length > 0);
  });

  it('surfaces Supabase query errors instead of returning empty recommendations', async () => {
    const supabase = createSupabaseMock({
      profileError: { message: 'permission denied' },
    });

    await assert.rejects(
      getSupabaseRecommendations({ supabase, userId: 'user-123' }),
      /Failed to load user profile from Supabase: permission denied/
    );
  });

  it('fails clearly when RLS hides or no profile exists for the user', async () => {
    const supabase = createSupabaseMock();

    await assert.rejects(
      getSupabaseRecommendations({ supabase, userId: 'user-123' }),
      /No profile found in "profiles" for the signed-in user/
    );
  });
});
