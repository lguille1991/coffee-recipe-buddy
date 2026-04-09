'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type WakeLockSentinelLike = {
  released: boolean
  release: () => Promise<void>
  addEventListener: (type: 'release', listener: () => void) => void
  removeEventListener: (type: 'release', listener: () => void) => void
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>
  }
}

export function parseTimeToSeconds(value: string): number {
  const lower = value.split('–')[0].trim()
  const [minutes, seconds] = lower.split(':').map(Number)
  return minutes * 60 + seconds
}

export function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

export function useWakeLockTimer(totalTime: string, stepTimes: string[]) {
  const [timerRunning, setTimerRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null)
  const wakeLockReleaseHandlerRef = useRef<(() => void) | null>(null)

  const releaseWakeLock = useCallback(async () => {
    const wakeLock = wakeLockRef.current
    const releaseHandler = wakeLockReleaseHandlerRef.current

    wakeLockRef.current = null
    wakeLockReleaseHandlerRef.current = null

    if (!wakeLock) return

    if (releaseHandler) {
      wakeLock.removeEventListener('release', releaseHandler)
    }

    if (!wakeLock.released) {
      try {
        await wakeLock.release()
      } catch {
        // Ignore release errors from browsers that already dropped the lock.
      }
    }
  }, [])

  const requestWakeLock = useCallback(async () => {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return

    const wakeLockApi = (navigator as NavigatorWithWakeLock).wakeLock
    if (!wakeLockApi || wakeLockRef.current) return

    try {
      const wakeLock = await wakeLockApi.request('screen')
      const handleRelease = () => {
        wakeLockRef.current = null
        wakeLockReleaseHandlerRef.current = null
      }

      wakeLock.addEventListener('release', handleRelease)
      wakeLockRef.current = wakeLock
      wakeLockReleaseHandlerRef.current = handleRelease
    } catch {
      // Some mobile browsers may reject the request based on battery, policy, or support.
    }
  }, [])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      void releaseWakeLock()
    }
  }, [releaseWakeLock])

  useEffect(() => {
    async function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && timerRunning) {
        await requestWakeLock()
        return
      }

      if (document.visibilityState !== 'visible') {
        await releaseWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [releaseWakeLock, requestWakeLock, timerRunning])

  const startTimer = useCallback(() => {
    if (intervalRef.current) return
    setTimerRunning(true)
    intervalRef.current = setInterval(() => {
      setElapsedSeconds(value => value + 1)
    }, 1000)
    void requestWakeLock()
  }, [requestWakeLock])

  const stopTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    setTimerRunning(false)
    setElapsedSeconds(0)
    void releaseWakeLock()
  }, [releaseWakeLock])

  const resetTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    setTimerRunning(false)
    setElapsedSeconds(0)
    void releaseWakeLock()
  }, [releaseWakeLock])

  const totalTimeSeconds = parseTimeToSeconds(totalTime)
  const timerOverrun = elapsedSeconds > totalTimeSeconds && totalTimeSeconds > 0
  const activeStepIndex = timerRunning
    ? stepTimes.reduce((active, time, index) => {
        return parseTimeToSeconds(time) <= elapsedSeconds ? index : active
      }, -1)
    : -1

  const getStepProgress = useCallback((index: number) => {
    if (activeStepIndex !== index) return 0

    const stepStart = parseTimeToSeconds(stepTimes[index])
    const nextStart = index + 1 < stepTimes.length
      ? parseTimeToSeconds(stepTimes[index + 1])
      : totalTimeSeconds

    if (nextStart <= stepStart) return 1
    return Math.min(1, (elapsedSeconds - stepStart) / (nextStart - stepStart))
  }, [activeStepIndex, elapsedSeconds, stepTimes, totalTimeSeconds])

  return {
    activeStepIndex,
    elapsedSeconds,
    getStepProgress,
    resetTimer,
    startTimer,
    stopTimer,
    timerOverrun,
    timerRunning,
    totalTimeSeconds,
  }
}
