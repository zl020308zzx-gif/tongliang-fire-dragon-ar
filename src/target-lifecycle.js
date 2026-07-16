export function createTargetLifecycle({
  target,
  lostDelayMs,
  signal,
  onFound,
  onLost,
  onLostConfirmed,
  onDebug,
}) {
  let targetTracked = false
  let foundCount = 0
  let lostCount = 0
  let lostStartedAt = null
  let lostTimer = null

  const emit = () =>
    onDebug({
      targetTracked,
      foundCount,
      lostCount,
      lostDurationMs: lostStartedAt === null ? 0 : performance.now() - lostStartedAt,
    })

  target.addEventListener(
    'targetFound',
    () => {
      targetTracked = true
      foundCount += 1
      lostStartedAt = null
      if (lostTimer !== null) clearTimeout(lostTimer)
      lostTimer = null
      onFound({ firstFound: foundCount === 1, foundCount, lostCount })
      emit()
    },
    { signal },
  )

  target.addEventListener(
    'targetLost',
    () => {
      targetTracked = false
      lostCount += 1
      lostStartedAt = performance.now()
      onLost({ foundCount, lostCount })
      if (lostTimer !== null) clearTimeout(lostTimer)
      lostTimer = window.setTimeout(() => {
        lostTimer = null
        if (!targetTracked) onLostConfirmed({ foundCount, lostCount, lostDurationMs: performance.now() - lostStartedAt })
      }, lostDelayMs)
      emit()
    },
    { signal },
  )

  return {
    isTracked: () => targetTracked,
    getState: () => ({ targetTracked, foundCount, lostCount, lostStartedAt }),
    destroy() {
      if (lostTimer !== null) clearTimeout(lostTimer)
    },
  }
}
