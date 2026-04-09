export function shouldGuardBrewExit(
  timerRunning: boolean,
  elapsedSeconds: number,
) {
  return timerRunning || elapsedSeconds > 0
}
