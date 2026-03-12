-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 1. workouts
CREATE TABLE IF NOT EXISTS public.workouts (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  program_name TEXT,
  notes TEXT,
  feedback TEXT,
  created_at TEXT NOT NULL DEFAULT NOW()
);

-- 2. exercises
CREATE TABLE IF NOT EXISTS public.exercises (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  workout_id INTEGER NOT NULL REFERENCES public.workouts(id),
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  rest_seconds INTEGER
);

-- 3. sets
CREATE TABLE IF NOT EXISTS public.sets (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  exercise_id INTEGER NOT NULL REFERENCES public.exercises(id),
  set_number INTEGER NOT NULL,
  reps INTEGER,
  weight REAL,
  rpe REAL,
  notes TEXT,
  actual_reps INTEGER,
  actual_weight REAL
);

-- 4. messages
CREATE TABLE IF NOT EXISTS public.messages (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  workout_id INTEGER REFERENCES public.workouts(id),
  nutrition_logged TEXT,
  created_at TEXT NOT NULL DEFAULT NOW()
);

-- 5. coaching_profiles (one per user)
CREATE TABLE IF NOT EXISTS public.coaching_profiles (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  biometrics TEXT NOT NULL DEFAULT '{}',
  maxes TEXT NOT NULL DEFAULT '{}',
  injuries TEXT NOT NULL DEFAULT '[]',
  equipment TEXT NOT NULL DEFAULT '[]',
  dietary_constraints TEXT NOT NULL DEFAULT '[]',
  preferences TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT NOW()
);

-- 6. nutrition_goals (one per user)
CREATE TABLE IF NOT EXISTS public.nutrition_goals (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  calories_target INTEGER NOT NULL DEFAULT 2000,
  protein_target INTEGER NOT NULL DEFAULT 150,
  carbs_target INTEGER NOT NULL DEFAULT 200,
  fat_target INTEGER NOT NULL DEFAULT 65,
  fiber_target INTEGER NOT NULL DEFAULT 30,
  updated_at TEXT NOT NULL DEFAULT NOW()
);

-- 7. food_log
CREATE TABLE IF NOT EXISTS public.food_log (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  logged_at TEXT NOT NULL,
  meal_type TEXT NOT NULL,
  food_name TEXT NOT NULL,
  brand TEXT,
  serving_size TEXT,
  servings REAL NOT NULL DEFAULT 1,
  calories REAL NOT NULL DEFAULT 0,
  protein REAL NOT NULL DEFAULT 0,
  carbs REAL NOT NULL DEFAULT 0,
  fat REAL NOT NULL DEFAULT 0,
  fiber REAL NOT NULL DEFAULT 0,
  sugar REAL NOT NULL DEFAULT 0,
  sodium REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'complete',
  created_at TEXT NOT NULL DEFAULT NOW()
);

-- 8. favorite_foods
CREATE TABLE IF NOT EXISTS public.favorite_foods (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  food_name TEXT NOT NULL,
  brand TEXT,
  serving_size TEXT,
  serving_weight REAL,
  calories REAL NOT NULL DEFAULT 0,
  protein REAL NOT NULL DEFAULT 0,
  carbs REAL NOT NULL DEFAULT 0,
  fat REAL NOT NULL DEFAULT 0,
  fiber REAL NOT NULL DEFAULT 0,
  sugar REAL NOT NULL DEFAULT 0,
  sodium REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  use_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT NOW()
);

-- 9. coaching_embeddings (pgvector - 768-dim for MRL-reduced Gemini embeddings)
CREATE TABLE IF NOT EXISTS public.coaching_embeddings (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  embedding_id TEXT NOT NULL UNIQUE,
  document TEXT NOT NULL,
  embedding extensions.vector(768),
  date TEXT,
  type TEXT,
  exercises_csv TEXT,
  muscle_groups_csv TEXT,
  created_at TEXT NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS coaching_profiles_user_id_idx ON public.coaching_profiles(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS nutrition_goals_user_id_idx ON public.nutrition_goals(user_id);
CREATE INDEX IF NOT EXISTS food_log_user_date_idx ON public.food_log(user_id, logged_at);
CREATE UNIQUE INDEX IF NOT EXISTS favorite_foods_user_source_id_idx ON public.favorite_foods(user_id, source, source_id);
CREATE INDEX IF NOT EXISTS coaching_embeddings_user_id_idx ON public.coaching_embeddings(user_id);
CREATE INDEX IF NOT EXISTS coaching_embeddings_vector_idx
  ON public.coaching_embeddings USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Row Level Security (defense-in-depth for future PostgREST usage)
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON public.workouts
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON public.exercises
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

ALTER TABLE public.sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON public.sets
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON public.messages
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

ALTER TABLE public.coaching_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON public.coaching_profiles
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

ALTER TABLE public.nutrition_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON public.nutrition_goals
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

ALTER TABLE public.food_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON public.food_log
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

ALTER TABLE public.favorite_foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON public.favorite_foods
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

ALTER TABLE public.coaching_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON public.coaching_embeddings
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Grant access to postgres role (used by the app connection)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT CREATE ON SCHEMA public TO postgres;
