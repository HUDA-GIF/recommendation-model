# AlphaFit Personalized Recommendation Engine

**Rule-based** engine (not a trained ML model).
Aligned with the live Supabase schema: `profiles`, `workout_templates`, `meals`.

## Supabase profile fields used

| Column | Allowed / notes |
|--------|------------------|
| `fitness_goal` | `weight_loss`, `muscle_gain`, `endurance`, `general_fitness` |
| `fitness_level` | `beginner`, `intermediate`, `advanced` |
| `equipment` | text[] e.g. `{none}`, `dumbbells` — same keys as exercises |
| `diet_preference` | `any`, `vegetarian`, `halal`, `vegan` |
| `disliked_foods` | text[] hard exclude |
| `age`, `gender`, `height_cm`, `weight_kg` | biometrics (context; no invented medical targets) |

Optional engine inputs (app may pass): `available_workout_duration`, `allergies`, `daily_calorie_target`.

The `fitness_score` column does not exist, so the engine does not use it.

## Catalogue tables ranked

- **Workouts:** `workout_templates` (`goal`, `difficulty`, `duration_min`, `equipment`, `focus`, …)
- **Meals:** `meals` (`diet_tags`, `recommendation_tags`, `allergens`, `kcal`, `protein_g`, …)

## Run

```bash
npm start   # Enter your own profile in the terminal (no user is pre-filled)
npm test
npm run demo
```

## App integration sketch

```js
const { data: profile } = await supabase.from('profiles').select(`
  fitness_goal, fitness_level, age, gender, height_cm, weight_kg,
  equipment, diet_preference, disliked_foods
`).eq('id', userId).single();

const { data: templates } = await supabase.from('workout_templates').select('*');
const { data: meals } = await supabase.from('meals').select('*');

import { recommendWorkouts, recommendMeals } from './src/index.js';

const workouts = recommendWorkouts({ profile, workouts: templates });
const mealRecs = recommendMeals({ profile, meals });
```

RLS: catalogue read for signed-in users; never put service-role key in the app.

## FYP wording

> AlphaFit uses a **rule-based Personalized Recommendation Engine** that filters and ranks `workout_templates` and `meals` using each user’s live profile data. It is **not** a separately trained deep-learning model.
