import { useState, useRef, useCallback } from 'react'

export type VoiceState = 'idle' | 'recording' | 'transcribing'

export function useVoiceInput(onTranscript: (text: string) => void) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const stopMediaStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const transcribe = useCallback(
    async (audioBlob: Blob) => {
      setVoiceState('transcribing')
      setError(null)

      try {
        const res = await fetch('/api/voice/transcribe', {
          method: 'POST',
          body: audioBlob,
          headers: {
            'Content-Type': audioBlob.type || 'audio/webm',
          },
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `Transcription failed (${res.status})`)
        }

        const { transcript } = await res.json()
        if (transcript && transcript.trim()) {
          onTranscript(transcript.trim())
        } else {
          setError('No speech detected')
        }
      } catch (err) {
        console.error('Voice transcription error:', err)
        setError(err instanceof Error ? err.message : 'Transcription failed')
      } finally {
        setVoiceState('idle')
      }
    },
    [onTranscript]
  )

  const startRecording = useCallback(async () => {
    setError(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone not supported in this browser')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Prefer webm/opus, fall back to whatever the browser supports
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        stopMediaStream()
        const blob = new Blob(chunksRef.current, {
          type: mimeType || 'audio/webm',
        })
        chunksRef.current = []
        if (blob.size > 0) {
          transcribe(blob)
        } else {
          setVoiceState('idle')
        }
      }

      recorder.onerror = () => {
        stopMediaStream()
        setError('Recording failed')
        setVoiceState('idle')
      }

      recorder.start()
      setVoiceState('recording')
    } catch (err) {
      stopMediaStream()
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Microphone permission denied')
      } else {
        setError('Could not access microphone')
      }
    }
  }, [transcribe, stopMediaStream])

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state === 'recording') {
      recorder.stop()
    }
  }, [])

  const toggleRecording = useCallback(() => {
    if (voiceState === 'recording') {
      stopRecording()
    } else if (voiceState === 'idle') {
      startRecording()
    }
    // If transcribing, ignore toggle
  }, [voiceState, startRecording, stopRecording])

  const clearError = useCallback(() => setError(null), [])

  return {
    voiceState,
    error,
    toggleRecording,
    clearError,
  }
}
