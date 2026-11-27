import { recommendMeals } from './recommendMeals.js';
import { recommendWorkouts } from './recommendWorkouts.js';

function assertQuerySucceeded(result, resource) {
  if (result?.error) {
    throw new Error(`Failed to load ${resource} from Supabase: ${result.error.message}`);
  }
  return result?.data;
}

/**
 * Load the signed-in user's profile and catalogues, then generate recommendations.
 * The supplied Supabase client must use that user's session and applicable RLS policies.
 */
export async function getSupabaseRecommendations({
  supabase,
  userId,
  profileOverrides = {},
  limit = 5,
  profileTable = 'profiles',
  profileIdColumn = 'id',
  workoutTable = 'workout_templates',
  mealTable = 'meals',
} = {}) {
  if (!supabase || typeof supabase.from !== 'function') {
    throw new TypeError('A configured Supabase client is required.');
  }
  if (userId == null || String(userId).trim() === '') {
    throw new TypeError('The signed-in user ID is required.');
  }

  const profileResult = await supabase
    .from(profileTable)
    .select('*')
    .eq(profileIdColumn, userId)
    .maybeSingle();
  const profile = assertQuerySucceeded(profileResult, 'user profile');
  if (!profile) {
    throw new Error(`No profile found in "${profileTable}" for the signed-in user.`);
  }

  const [workoutsResult, mealsResult] = await Promise.all([
    supabase.from(workoutTable).select('*'),
    supabase.from(mealTable).select('*'),
  ]);
  const workouts = assertQuerySucceeded(workoutsResult, 'workout catalogue');
  const meals = assertQuerySucceeded(mealsResult, 'meal catalogue');

  if (!Array.isArray(workouts)) {
    throw new TypeError(`Supabase table "${workoutTable}" did not return workout rows.`);
  }
  if (!Array.isArray(meals)) {
    throw new TypeError(`Supabase table "${mealTable}" did not return meal rows.`);
  }

  const resolvedProfile = { ...profile, ...profileOverrides };
  return {
    profile: resolvedProfile,
    workoutRecommendations: recommendWorkouts({
      profile: resolvedProfile,
      workouts,
      limit,
    }),
    mealRecommendations: recommendMeals({
      profile: resolvedProfile,
      meals,
      limit,
    }),
  };
}
