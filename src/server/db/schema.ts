import { sqliteTable, integer, text, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { relations, sql } from 'drizzle-orm'

// ---------- Tables ----------

export const workouts = sqliteTable('workouts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(), // ISO date string (YYYY-MM-DD)
  programName: text('program_name'),
  notes: text('notes'),
  feedback: text('feedback'),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
})

export const exercises = sqliteTable('exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workoutId: integer('workout_id')
    .notNull()
    .references(() => workouts.id),
  name: text('name').notNull(),
  order: integer('order').notNull(),
  restSeconds: integer('rest_seconds'), // rest between sets in seconds
})

export const sets = sqliteTable('sets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  exerciseId: integer('exercise_id')
    .notNull()
    .references(() => exercises.id),
  setNumber: integer('set_number').notNull(),
  reps: integer('reps'),
  weight: real('weight'),
  rpe: real('rpe'),
  notes: text('notes'),
  actualReps: integer('actual_reps'),   // what the user actually did; null = followed plan
  actualWeight: real('actual_weight'),  // what the user actually used; null = followed plan
})

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  role: text('role').notNull(), // 'user' | 'model'
  content: text('content').notNull(),
  workoutId: integer('workout_id').references(() => workouts.id), // nullable - linked if workout was generated
  nutritionLogged: text('nutrition_logged'), // nullable JSON: logged food items from chat
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
})

export const coachingProfiles = sqliteTable('coaching_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  biometrics: text('biometrics').notNull().default('{}'), // JSON: { "height": "6'6\"", "weight": 209, "age": 42, "bodyType": "hard-gainer" }
  maxes: text('maxes').notNull().default('{}'), // JSON: { "floor press": 145, "overhead press": 60, ... }
  injuries: text('injuries').notNull().default('[]'), // JSON: ["left shoulder impingement"]
  equipment: text('equipment').notNull().default('[]'), // JSON: ["barbell", "dumbbells", "cable machine"]
  dietaryConstraints: text('dietary_constraints').notNull().default('[]'), // JSON: ["gluten-free"]
  preferences: text('preferences').notNull().default('{}'), // JSON: { "daysPerWeek": 4, "sessionMinutes": 60, "goals": [...] }
  updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
})

// ---------- Nutrition Tables ----------

export const nutritionGoals = sqliteTable('nutrition_goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  caloriesTarget: integer('calories_target').notNull().default(2000),
  proteinTarget: integer('protein_target').notNull().default(150),
  carbsTarget: integer('carbs_target').notNull().default(200),
  fatTarget: integer('fat_target').notNull().default(65),
  fiberTarget: integer('fiber_target').notNull().default(30),
  updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
})

export const foodLog = sqliteTable('food_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  loggedAt: text('logged_at').notNull(), // YYYY-MM-DD
  mealType: text('meal_type').notNull(), // 'breakfast' | 'lunch' | 'dinner' | 'snack'
  foodName: text('food_name').notNull(),
  brand: text('brand'),
  servingSize: text('serving_size'),
  servings: real('servings').notNull().default(1),
  calories: real('calories').notNull().default(0),
  protein: real('protein').notNull().default(0),
  carbs: real('carbs').notNull().default(0),
  fat: real('fat').notNull().default(0),
  fiber: real('fiber').notNull().default(0),
  sugar: real('sugar').notNull().default(0),
  sodium: real('sodium').notNull().default(0),
  source: text('source').notNull(), // 'usda' | 'openfoodfacts'
  sourceId: text('source_id').notNull(),
  status: text('status').notNull().default('complete'), // 'pending' | 'complete' | 'failed'
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => [
  index('food_log_user_date_idx').on(table.loggedAt),
])

export const favoriteFoods = sqliteTable('favorite_foods', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  foodName: text('food_name').notNull(),
  brand: text('brand'),
  servingSize: text('serving_size'),
  servingWeight: real('serving_weight'),
  calories: real('calories').notNull().default(0),
  protein: real('protein').notNull().default(0),
  carbs: real('carbs').notNull().default(0),
  fat: real('fat').notNull().default(0),
  fiber: real('fiber').notNull().default(0),
  sugar: real('sugar').notNull().default(0),
  sodium: real('sodium').notNull().default(0),
  source: text('source').notNull(), // 'usda' | 'openfoodfacts'
  sourceId: text('source_id').notNull(),
  useCount: integer('use_count').notNull().default(1),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => [
  uniqueIndex('favorite_foods_source_id_idx').on(table.source, table.sourceId),
])

// ---------- Relations ----------

export const workoutsRelations = relations(workouts, ({ many }) => ({
  exercises: many(exercises),
}))

export const exercisesRelations = relations(exercises, ({ one, many }) => ({
  workout: one(workouts, {
    fields: [exercises.workoutId],
    references: [workouts.id],
  }),
  sets: many(sets),
}))

export const setsRelations = relations(sets, ({ one }) => ({
  exercise: one(exercises, {
    fields: [sets.exerciseId],
    references: [exercises.id],
  }),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  workout: one(workouts, {
    fields: [messages.workoutId],
    references: [workouts.id],
  }),
}))
