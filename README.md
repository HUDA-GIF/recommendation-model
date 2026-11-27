# AlphaFit Personalized Recommendation Engine

A rule-based engine for personalized workout and meal recommendations. This is
not a separately trained machine-learning model.

The package can run against local sample data or connect to the AlphaFit
Supabase tables `profiles`, `workout_templates`, and `meals`.

## Requirements and commands

Node.js 18 or newer.

```bash
npm start     # Enter a profile in the terminal; uses local sample data
npm test      # Run the automated tests
npm run demo  # Show recommendations for sample profiles
```

The sample catalogue contains 22 workouts and 12 meals. Running the local demo
does not require Supabase credentials.

## Supabase fields

| Table | Fields used |
|---|---|
| `profiles` | `id`, `fitness_goal`, `fitness_level`, `available_workout_duration`, `equipment`, `diet_preference`, `disliked_foods`, `allergies`, `dietary_restrictions`, `daily_calorie_target` |
| `workout_templates` | `id`, `title`, `goal`, `difficulty`, `duration_min`, `equipment`, `focus`, `tags`, `restriction_flags` |
| `meals` | `id`, `title`, `diet_tags`, `goal_tags`, `recommendation_tags`, `ingredients`, `allergens`, `restriction_flags`, `kcal`, `protein_g`, `carbs_g`, `fat_g` |

Supported fitness goals are `weight_loss`, `muscle_gain`, `endurance`, and
`general_fitness`. Supported fitness levels are `beginner`, `intermediate`, and
`advanced`. The `fitness_score` column is not used.

## Recommendation behavior

- Workouts require a valid goal, fitness level, and available time. They must
  match the user's goal and level, fit within the available time, and satisfy
  equipment and restriction filters. A workout may be shorter than 60% of the
  available time.
- Meals are filtered by dietary preference, allergies, disliked foods, and
  restrictions, then ranked by goal tags and available nutrition information.
- A halal preference requires an explicit `halal` value in `diet_tags`.
- If a user has allergies, a meal must have an `allergens`, `allergen_tags`, or
  `ingredients` field to be considered. Accurate catalogue metadata is
  essential; the engine cannot verify missing or mislabeled ingredients.
- Goal and nutrition scores are transparent heuristics, not medically
  validated dietary advice. No calorie or nutrition values are invented.
- If no catalogue entries match the profile, the engine returns an empty result.

Suggested meal tags include `lower_calorie`, `portion_control`, `high_fibre`,
and `balanced` for weight-loss ranking; `high_protein` for muscle-gain ranking;
and `energy_dense`, `carb_focused`, or `balanced` for endurance ranking.
`goal_tags` may include canonical fitness goals for a direct goal match.

## Connect to Supabase

The app must create and authenticate its Supabase client. Pass that client and
the signed-in user's ID to the adapter:

```js
import { getSupabaseRecommendations } from './src/index.js';

const { data: { user }, error } = await supabase.auth.getUser();
if (error) throw error;
if (!user) throw new Error('Sign in before requesting recommendations.');

const result = await getSupabaseRecommendations({
  supabase,
  userId: user.id,
  profileOverrides: {
    // Supply at runtime if this value is not stored in profiles.
    available_workout_duration: 30,
  },
  limit: 5,
});

const workouts = result.workoutRecommendations.recommendations;
const meals = result.mealRecommendations.recommendations;
```

By default, the helper reads `profiles` with `id = userId` and reads the
`workout_templates` and `meals` catalogues. Table names and the profile ID
column can be overridden. Query errors and missing profiles are reported as
errors; incomplete recommendation profiles are returned in the recommendation
result's `reason` and `message`.

Use the signed-in user's client and configure Row-Level Security (RLS) so a
user can read only their own profile (for example, `auth.uid() = id`). Grant
authenticated users read access to the catalogues. Never put a Supabase
service-role key in client-side code.

See [SUPABASE_INTEGRATION.md](./SUPABASE_INTEGRATION.md) for the full expected
schema and integration notes.

## Scope

This repository implements the recommendation component of AlphaFit. It does
not include the React Native app, pose estimation, rep counting, MET-based
calorie estimation, AI Coach, food logging, analytics, or notifications.
AlphaFit's recommendation engine is deterministic JavaScript logic, not a
trained neural network.

Suggested FYP description:

> AlphaFit uses a rule-based recommendation engine to filter and rank workout
> and meal catalogue entries using the user's fitness goals, fitness level,
> available time, equipment, dietary preferences, restrictions, and allergies.
> The engine is deterministic JavaScript logic and is not a separately trained
> machine-learning model.
