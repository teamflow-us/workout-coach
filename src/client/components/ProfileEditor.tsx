import { useState, useEffect } from 'react'

interface CoachingProfile {
  id: number | null
  maxes: Record<string, number>
  injuries: string[]
  equipment: string[]
  dietaryConstraints: string[]
  preferences: {
    daysPerWeek?: number
    sessionMinutes?: number
  }
}

const DEFAULT_EQUIPMENT = [
  'Barbell',
  'Dumbbells',
  'Cable Machine',
  'Pull-up Bar',
  'Bench',
  'Squat Rack',
  'Leg Press',
  'Smith Machine',
  'Resistance Bands',
  'Kettlebells',
]

const DEFAULT_MAX_LIFTS = ['Bench Press', 'Squat', 'Deadlift', 'Overhead Press']

export default function ProfileEditor() {
  const [profile, setProfile] = useState<CoachingProfile>({
    id: null,
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

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/profile')
      if (!res.ok) throw new Error('Failed to load profile')
      const data = await res.json()
      setProfile({
        id: data.id,
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
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        </div>
      </section>

      {/* Dietary Constraints */}
      <section className="profile-section">
        <h3 className="profile-section-title">Dietary Constraints</h3>
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
    </div>
  )
}
