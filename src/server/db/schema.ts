import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core'
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
})

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  role: text('role').notNull(), // 'user' | 'model'
  content: text('content').notNull(),
  workoutId: integer('workout_id').references(() => workouts.id), // nullable - linked if workout was generated
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
