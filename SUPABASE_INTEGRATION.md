# Supabase integration

The recommendation package does not create a Supabase client or require a
service-role key. Pass your app's existing Supabase client to
`getSupabaseRecommendations`; it reads the user's profile and the two catalogues
under that client's signed-in session and Row-Level Security (RLS) policies.

## Expected tables and columns

The default table names are `profiles`, `workout_templates`, and `meals`. The
profile lookup uses `profiles.id = userId`. Table names and the profile ID
column can be overridden in the function call if your schema uses different
names.

| Table | Fields used |
| --- | --- |
| `profiles` | `fitness_goal`, `fitness_level`, `available_workout_duration`, `equipment`, `diet_preference`, `disliked_foods`, `allergies`, `dietary_restrictions`, `daily_calorie_target` |
| `workout_templates` | `id`, `title`, `goal`, `difficulty`, `duration_min`, `equipment`, `focus`, `tags`, `restriction_flags` |
| `meals` | `id`, `title`, `diet_tags`, `goal_tags`, `recommendation_tags`, `ingredients`, `allergens`, `restriction_flags`, `kcal`, `protein_g`, `carbs_g`, `fat_g` |

Use the canonical goal values `weight_loss`, `muscle_gain`, `endurance`, and
`general_fitness`. Workouts must have a matching goal and fitness level, and
their duration must be positive and no longer than the user's available time.
Provide that time in the profile or as a runtime override.

Meal ranking uses explicit catalogue tags where available. Suggested tags are
`lower_calorie`, `portion_control`, `high_fibre`, and `balanced` for weight loss;
`high_protein` for muscle gain; and `energy_dense`, `carb_focused`, or `balanced`
for endurance. `goal_tags` may contain canonical goal values to make a direct
goal match. For halal preferences, a meal must have `halal` in `diet_tags`;
halal status is not inferred from missing pork/alcohol terms. If a user has
allergies, each meal must include an `allergens`, `allergen_tags`, or
`ingredients` field. Keep these fields complete and accurate; the engine cannot
verify ingredients that are absent or mislabeled in the database.

## Usage

Create and configure the Supabase client in your application, then:

```js
import { getSupabaseRecommendations } from './src/index.js';

const { data: { user }, error } = await supabase.auth.getUser();
if (error) throw error;
if (!user) throw new Error('Sign in before requesting recommendations.');

const result = await getSupabaseRecommendations({
  supabase,
  userId: user.id,
  profileOverrides: {
    // Values selected for this session, not necessarily stored in profiles.
    available_workout_duration: 30,
  },
  limit: 5,
});

console.log(result.workoutRecommendations.recommendations);
console.log(result.mealRecommendations.recommendations);
```

The helper throws if a Supabase query fails, if no profile is found, or if a
catalogue query does not return an array. Recommendation-level profile problems
are returned in each result's `reason` and `message` fields.

Configure RLS so a user can read only their own profile, for example by checking
`auth.uid() = id` on `profiles`. Grant the app's authenticated role read access
to the workout and meal catalogues. Never put a Supabase service-role key in a
mobile app.
