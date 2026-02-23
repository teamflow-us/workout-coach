import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/apiFetch'

interface ProfileEditorProps {
  onSignOut?: () => void
  userEmail?: string | null
}

interface CoachingProfile {
  id: number | null
  biometrics: {
    height?: string
    weight?: number
    age?: number
    bodyType?: string
  }
  maxes: Record<string, number>
  injuries: string[]
  equipment: string[]
  dietaryConstraints: string[]
  preferences: {
    daysPerWeek?: number
    sessionMinutes?: number
    trainingTime?: string
    goals?: string[]
    exercisesToAvoid?: string[]
    communicationStyle?: string
  }
}

const DEFAULT_EQUIPMENT = [
  'Barbell',
  'Plates (245 lbs total)',
  'Bench',
  '4-Post Rack (93")',
  'Pull-up Bar (multigrip)',
  'Dip Station',
  'Push-up Grips',
  '5 lb Dumbbells',
  '35 lb Backpack',
  'Yoga Mat',
  'Wooden Box',
]

const DEFAULT_MAX_LIFTS = ['Floor Press', 'Overhead Press', 'Glute Bridge']

export default function ProfileEditor({ onSignOut, userEmail }: ProfileEditorProps) {
  const [profile, setProfile] = useState<CoachingProfile>({
    id: null,
    biometrics: {},
    maxes: {},
    injuries: [],
    equipment: [],
    dietaryConstraints: [],
    preferences: {},
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newInjury, setNewInjury] = useState('')
  const [newDietary, setNewDietary] = useState('')
  const [newGoal, setNewGoal] = useState('')
  const [newAvoid, setNewAvoid] = useState('')
  const [newEquipment, setNewEquipment] = useState('')
  const [newMaxLift, setNewMaxLift] = useState('')
  const [newMaxValue, setNewMaxValue] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const res = await apiFetch('/api/profile')
      if (!res.ok) throw new Error('Failed to load profile')
      const data = await res.json()
      setProfile({
        id: data.id,
        biometrics: data.biometrics || {},
        maxes: data.maxes || {},
        injuries: data.injuries || [],
        equipment: data.equipment || [],
        dietaryConstraints: data.dietaryConstraints || [],
        preferences: data.preferences || {},
      })
    } catch (err) {
      console.error('Failed to load profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const saveProfile = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const res = await apiFetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          biometrics: profile.biometrics,
          maxes: profile.maxes,
          injuries: profile.injuries,
          equipment: profile.equipment,
          dietaryConstraints: profile.dietaryConstraints,
          preferences: profile.preferences,
        }),
      })
      if (!res.ok) throw new Error('Failed to save profile')
      const data = await res.json()
      setProfile(prev => ({ ...prev, id: data.id }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save profile:', err)
    } finally {
      setSaving(false)
    }
  }

  const updateBiometric = (field: string, value: string) => {
    setProfile(prev => ({
      ...prev,
      biometrics: {
        ...prev.biometrics,
        [field]: field === 'weight' || field === 'age'
          ? (parseInt(value, 10) || undefined)
          : value || undefined,
      },
    }))
  }

  const updateMax = (lift: string, value: string) => {
    const num = parseInt(value, 10)
    setProfile(prev => ({
      ...prev,
      maxes: {
        ...prev.maxes,
        [lift.toLowerCase()]: isNaN(num) ? 0 : num,
      },
    }))
  }

  const toggleEquipment = (item: string) => {
    setProfile(prev => {
      const lower = item.toLowerCase()
      const has = prev.equipment.map(e => e.toLowerCase()).includes(lower)
      return {
        ...prev,
        equipment: has
          ? prev.equipment.filter(e => e.toLowerCase() !== lower)
          : [...prev.equipment, item],
      }
    })
  }

  const addInjury = () => {
    if (!newInjury.trim()) return
    setProfile(prev => ({
      ...prev,
      injuries: [...prev.injuries, newInjury.trim()],
    }))
    setNewInjury('')
  }

  const removeInjury = (index: number) => {
    setProfile(prev => ({
      ...prev,
      injuries: prev.injuries.filter((_, i) => i !== index),
    }))
  }

  const addDietary = () => {
    if (!newDietary.trim()) return
    setProfile(prev => ({
      ...prev,
      dietaryConstraints: [...prev.dietaryConstraints, newDietary.trim()],
    }))
    setNewDietary('')
  }

  const removeDietary = (index: number) => {
    setProfile(prev => ({
      ...prev,
      dietaryConstraints: prev.dietaryConstraints.filter((_, i) => i !== index),
    }))
  }

  const addGoal = () => {
    if (!newGoal.trim()) return
    setProfile(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        goals: [...(prev.preferences.goals || []), newGoal.trim()],
      },
    }))
    setNewGoal('')
  }

  const removeGoal = (index: number) => {
    setProfile(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        goals: (prev.preferences.goals || []).filter((_, i) => i !== index),
      },
    }))
  }

  const addAvoid = () => {
    if (!newAvoid.trim()) return
    setProfile(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        exercisesToAvoid: [...(prev.preferences.exercisesToAvoid || []), newAvoid.trim()],
      },
    }))
    setNewAvoid('')
  }

  const removeAvoid = (index: number) => {
    setProfile(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        exercisesToAvoid: (prev.preferences.exercisesToAvoid || []).filter((_, i) => i !== index),
      },
    }))
  }

  const addEquipment = () => {
    if (!newEquipment.trim()) return
    const item = newEquipment.trim()
    const lower = item.toLowerCase()
    const already = profile.equipment.map(e => e.toLowerCase()).includes(lower)
    if (already) {
      setNewEquipment('')
      return
    }
    setProfile(prev => ({
      ...prev,
      equipment: [...prev.equipment, item],
    }))
    setNewEquipment('')
  }

  const removeCustomEquipment = (item: string) => {
    setProfile(prev => ({
      ...prev,
      equipment: prev.equipment.filter(e => e.toLowerCase() !== item.toLowerCase()),
    }))
  }

  const addMaxLift = () => {
    if (!newMaxLift.trim()) return
    const lift = newMaxLift.trim()
    const num = parseInt(newMaxValue, 10)
    setProfile(prev => ({
      ...prev,
      maxes: {
        ...prev.maxes,
        [lift.toLowerCase()]: isNaN(num) ? 0 : num,
      },
    }))
    setNewMaxLift('')
    setNewMaxValue('')
  }

  const removeMax = (lift: string) => {
    setProfile(prev => {
      const { [lift]: _, ...rest } = prev.maxes
      return { ...prev, maxes: rest }
    })
  }

  if (loading) {
    return (
      <div className="profile-loading">
        <p>Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="profile-editor">
      <h2 className="profile-title">Coaching Profile</h2>

      {/* Biometrics Section */}
      <section className="profile-section">
        <h3 className="profile-section-title">Biometrics</h3>
        <div className="profile-prefs">
          <div className="profile-pref-row">
            <label className="profile-pref-label">Height</label>
            <input
              className="profile-pref-input"
              type="text"
              placeholder={`6'0"`}
              value={profile.biometrics.height || ''}
              onChange={e => updateBiometric('height', e.target.value)}
              style={{ width: '100px' }}
            />
          </div>
          <div className="profile-pref-row">
            <label className="profile-pref-label">Weight (lbs)</label>
            <input
              className="profile-pref-input"
              type="number"
              inputMode="numeric"
              placeholder="180"
              value={profile.biometrics.weight || ''}
              onChange={e => updateBiometric('weight', e.target.value)}
            />
          </div>
          <div className="profile-pref-row">
            <label className="profile-pref-label">Age</label>
            <input
              className="profile-pref-input"
              type="number"
              inputMode="numeric"
              placeholder="30"
              value={profile.biometrics.age || ''}
              onChange={e => updateBiometric('age', e.target.value)}
            />
          </div>
          <div className="profile-pref-row">
            <label className="profile-pref-label">Body Type</label>
            <input
              className="profile-pref-input"
              type="text"
              placeholder="e.g. Ectomorph"
              value={profile.biometrics.bodyType || ''}
              onChange={e => updateBiometric('bodyType', e.target.value)}
              style={{ width: '140px' }}
            />
          </div>
        </div>
      </section>

      {/* Maxes Section */}
      <section className="profile-section">
        <h3 className="profile-section-title">Current Maxes (lbs)</h3>
        <div className="profile-maxes">
          {DEFAULT_MAX_LIFTS.map(lift => (
            <div key={lift} className="profile-max-row">
              <label className="profile-max-label">{lift}</label>
              <input
                className="profile-max-input"
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={profile.maxes[lift.toLowerCase()] || ''}
                onChange={e => updateMax(lift, e.target.value)}
              />
            </div>
          ))}
          {Object.entries(profile.maxes)
            .filter(([key]) => !DEFAULT_MAX_LIFTS.map(l => l.toLowerCase()).includes(key))
            .map(([lift, value]) => (
              <div key={lift} className="profile-max-row">
                <label className="profile-max-label" style={{ textTransform: 'capitalize' }}>{lift}</label>
                <input
                  className="profile-max-input"
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={value || ''}
                  onChange={e => updateMax(lift, e.target.value)}
                />
                <button
                  className="profile-remove-btn tap-target"
                  onClick={() => removeMax(lift)}
                  aria-label={`Remove ${lift}`}
                >
                  x
                </button>
              </div>
            ))}
        </div>
        <div className="profile-add-row">
          <input
            className="profile-add-input"
            type="text"
            placeholder="e.g. Bench Press"
            value={newMaxLift}
            onChange={e => setNewMaxLift(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMaxLift()}
          />
          <input
            className="profile-max-input"
            type="number"
            inputMode="numeric"
            placeholder="lbs"
            value={newMaxValue}
            onChange={e => setNewMaxValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMaxLift()}
          />
          <button className="btn-secondary tap-target" onClick={addMaxLift}>
            Add
          </button>
        </div>
      </section>

      {/* Goals Section */}
      <section className="profile-section">
        <h3 className="profile-section-title">Goals (Priority Order)</h3>
        <div className="profile-goals">
          {(profile.preferences.goals || []).map((goal, idx) => (
            <button
              key={idx}
              className="profile-tag profile-goal-tag tap-target"
              onClick={() => removeGoal(idx)}
            >
              <span className="profile-goal-number">{idx + 1}</span>
              {goal} x
            </button>
          ))}
        </div>
        <div className="profile-add-row">
          <input
            className="profile-add-input"
            type="text"
            placeholder="e.g. Build chest size"
            value={newGoal}
            onChange={e => setNewGoal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addGoal()}
          />
          <button className="btn-secondary tap-target" onClick={addGoal}>
            Add
          </button>
        </div>
      </section>

      {/* Injuries Section */}
      <section className="profile-section">
        <h3 className="profile-section-title">Injuries / Limitations</h3>
        <div className="profile-tags">
          {profile.injuries.map((injury, idx) => (
            <button
              key={idx}
              className="profile-tag tap-target"
              onClick={() => removeInjury(idx)}
            >
              {injury} x
            </button>
          ))}
        </div>
        <div className="profile-add-row">
          <input
            className="profile-add-input"
            type="text"
            placeholder="e.g. Left shoulder impingement"
            value={newInjury}
            onChange={e => setNewInjury(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addInjury()}
          />
          <button className="btn-secondary tap-target" onClick={addInjury}>
            Add
          </button>
        </div>
      </section>

      {/* Equipment Section */}
      <section className="profile-section">
        <h3 className="profile-section-title">Available Equipment</h3>
        <div className="profile-equipment">
          {DEFAULT_EQUIPMENT.map(item => {
            const isSelected = profile.equipment
              .map(e => e.toLowerCase())
              .includes(item.toLowerCase())
            return (
              <button
                key={item}
                className={`profile-equipment-btn tap-target${isSelected ? ' selected' : ''}`}
                onClick={() => toggleEquipment(item)}
              >
                {item}
              </button>
            )
          })}
          {profile.equipment
            .filter(item => !DEFAULT_EQUIPMENT.map(d => d.toLowerCase()).includes(item.toLowerCase()))
            .map(item => (
              <button
                key={item}
                className="profile-equipment-btn tap-target selected"
                onClick={() => removeCustomEquipment(item)}
              >
                {item} x
              </button>
            ))}
        </div>
        <div className="profile-add-row">
          <input
            className="profile-add-input"
            type="text"
            placeholder="e.g. Kettlebell 35 lb"
            value={newEquipment}
            onChange={e => setNewEquipment(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addEquipment()}
          />
          <button className="btn-secondary tap-target" onClick={addEquipment}>
            Add
          </button>
        </div>
      </section>

      {/* Exercises to Avoid Section */}
      <section className="profile-section">
        <h3 className="profile-section-title">Exercises to Avoid</h3>
        <div className="profile-tags">
          {(profile.preferences.exercisesToAvoid || []).map((item, idx) => (
            <button
              key={idx}
              className="profile-tag tap-target"
              onClick={() => removeAvoid(idx)}
            >
              {item} x
            </button>
          ))}
        </div>
        <div className="profile-add-row">
          <input
            className="profile-add-input"
            type="text"
            placeholder="e.g. Deadlifts - injury risk"
            value={newAvoid}
            onChange={e => setNewAvoid(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addAvoid()}
          />
          <button className="btn-secondary tap-target" onClick={addAvoid}>
            Add
          </button>
        </div>
      </section>

      {/* Dietary Constraints */}
      <section className="profile-section">
        <h3 className="profile-section-title">Dietary / Nutrition</h3>
        <div className="profile-tags">
          {profile.dietaryConstraints.map((item, idx) => (
            <button
              key={idx}
              className="profile-tag tap-target"
              onClick={() => removeDietary(idx)}
            >
              {item} x
            </button>
          ))}
        </div>
        <div className="profile-add-row">
          <input
            className="profile-add-input"
            type="text"
            placeholder="e.g. Gluten-free"
            value={newDietary}
            onChange={e => setNewDietary(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addDietary()}
          />
          <button className="btn-secondary tap-target" onClick={addDietary}>
            Add
          </button>
        </div>
      </section>

      {/* Training Preferences */}
      <section className="profile-section">
        <h3 className="profile-section-title">Training Preferences</h3>
        <div className="profile-prefs">
          <div className="profile-pref-row">
            <label className="profile-pref-label">Days per week</label>
            <input
              className="profile-pref-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={7}
              placeholder="4"
              value={profile.preferences.daysPerWeek || ''}
              onChange={e =>
                setProfile(prev => ({
                  ...prev,
                  preferences: {
                    ...prev.preferences,
                    daysPerWeek: parseInt(e.target.value, 10) || undefined,
                  },
                }))
              }
            />
          </div>
          <div className="profile-pref-row">
            <label className="profile-pref-label">Session length (min)</label>
            <input
              className="profile-pref-input"
              type="number"
              inputMode="numeric"
              min={15}
              max={180}
              placeholder="60"
              value={profile.preferences.sessionMinutes || ''}
              onChange={e =>
                setProfile(prev => ({
                  ...prev,
                  preferences: {
                    ...prev.preferences,
                    sessionMinutes: parseInt(e.target.value, 10) || undefined,
                  },
                }))
              }
            />
          </div>
          <div className="profile-pref-row">
            <label className="profile-pref-label">Training time</label>
            <input
              className="profile-pref-input"
              type="text"
              placeholder="e.g. Morning"
              value={profile.preferences.trainingTime || ''}
              onChange={e =>
                setProfile(prev => ({
                  ...prev,
                  preferences: {
                    ...prev.preferences,
                    trainingTime: e.target.value || undefined,
                  },
                }))
              }
              style={{ width: '140px' }}
            />
          </div>
          <div className="profile-pref-row">
            <label className="profile-pref-label">Communication style</label>
            <input
              className="profile-pref-input"
              type="text"
              placeholder="e.g. Data-driven"
              value={profile.preferences.communicationStyle || ''}
              onChange={e =>
                setProfile(prev => ({
                  ...prev,
                  preferences: {
                    ...prev.preferences,
                    communicationStyle: e.target.value || undefined,
                  },
                }))
              }
              style={{ width: '140px' }}
            />
          </div>
        </div>
      </section>

      {/* Save Button */}
      <button
        className={`btn-primary tap-target profile-save${saved ? ' saved' : ''}`}
        onClick={saveProfile}
        disabled={saving}
      >
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Profile'}
      </button>

      {/* Account Section */}
      {onSignOut && (
        <section className="profile-account">
          <h3 className="profile-section-title">Account</h3>
          {userEmail && (
            <p className="profile-account-email">{userEmail}</p>
          )}
          <button
            type="button"
            className="profile-signout-btn tap-target"
            onClick={onSignOut}
          >
            Sign Out
          </button>
        </section>
      )}
    </div>
  )
}
