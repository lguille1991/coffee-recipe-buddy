# Brew Timer — Implementation Plan

**Goal:** Add an interactive brew timer to the recipe page (`src/app/recipe/page.tsx`) that helps users follow steps in real time.

---

## Overview

- A play/stop button lives in the Brew Steps section header
- When running, an elapsed timer is shown (MM:SS format)
- The currently active step gets a focus animation + progress bar (background fill)
- Timer text turns red when elapsed time exceeds `total_time`
- Timer never auto-stops — only the user can stop it

---

## Checklist

### 1. Parse helpers (pure functions, add near the top of the file)

- [ ] `parseTimeToSeconds(t: string): number` — converts `"m:ss"` or `"m:ss – m:ss"` strings into seconds. For a range, use the **lower bound**.  
  Examples: `"0:45"` → `45`, `"3:30"` → `210`, `"3:30 – 4:00"` → `210`
- [ ] `formatElapsed(s: number): string` — converts seconds back to `"M:SS"` display string

### 2. Timer state (inside `RecipePage`)

- [ ] Add `const [timerRunning, setTimerRunning] = useState(false)`
- [ ] Add `const [elapsedSeconds, setElapsedSeconds] = useState(0)`
- [ ] Add `const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)`
- [ ] On play: start `setInterval` (1 s tick), store ref
- [ ] On stop: clear interval, reset `elapsedSeconds` to `0`, set `timerRunning` to `false`
- [ ] Cleanup effect: `useEffect(() => () => clearInterval(intervalRef.current), [])`

### 3. Active step detection (derived value, no extra state)

- [ ] Derive `activeStepIndex: number` from `elapsedSeconds` and `recipe.steps`  
  Logic: parse each `step.time` via `parseTimeToSeconds`; the active step is the **last** step whose start time ≤ `elapsedSeconds`. Returns `-1` when timer is not running.

### 4. Step progress (derived value per step)

- [ ] For a given step at index `i`, progress `[0, 1]` =  
  `(elapsedSeconds - stepStart) / (nextStepStart - stepStart)`  
  - When it's the last step, use `parseTimeToSeconds(recipe.parameters.total_time)` as `nextStepStart`
  - Clamp to `[0, 1]`
  - Returns `0` when timer is not running or step is not yet active

### 5. Play/Stop button

- [ ] Add the button to the "Brew Steps" section header row (right side, next to the `<h3>` label)
- [ ] Use `Play` and `Square` icons from `lucide-react`
- [ ] Play: `size={18}`, filled appearance, `bg-[var(--foreground)] text-[var(--background)] rounded-full p-1.5`
- [ ] Stop: same container, `Square` icon (filled), same size
- [ ] Toggling play → sets `timerRunning = true`; toggling stop → clears timer and resets

### 6. Elapsed timer display

- [ ] Render `formatElapsed(elapsedSeconds)` next to the play/stop button (only when `timerRunning || elapsedSeconds > 0`)
- [ ] Compare `elapsedSeconds` to `parseTimeToSeconds(recipe.parameters.total_time)`
- [ ] When elapsed > total time → text color `text-red-500`; otherwise `text-[var(--foreground)]`

### 7. Brew step card — active focus + progress bar

Update the step card render in the `recipe.steps.map(...)` block:

- [ ] Replace the static `className` with a dynamic one using `activeStepIndex`
- [ ] **Active step:** add `ring-2 ring-[var(--foreground)]` and `scale-[1.01]` (CSS transition `transition-transform duration-300`)
- [ ] **Progress bar (background fill):** Render a `<div>` inside the step card as an absolutely-positioned background fill:
  ```
  position: absolute, inset-0, rounded-2xl, pointer-events-none
  background: bg-[var(--foreground)]/8   (subtle tint matching brand)
  width: `${progress * 100}%`
  transition: width 1s linear
  ```
  - Make the step card `relative overflow-hidden` to contain it
- [ ] Non-active steps that have already passed: slightly lower opacity (`opacity-60`) to visually de-emphasize them

### 8. Reset timer on recipe change

- [ ] In the `useEffect` that loads the recipe from `sessionStorage`, call the stop logic to clear any running interval and reset `elapsedSeconds` to `0`

---

## Files to change

| File | Change |
|---|---|
| `src/app/recipe/page.tsx` | All changes live here — no new files needed |

---

## Edge cases

- `total_time` range (e.g. `"3:30 – 4:00"`) → always use lower bound for red-threshold
- Last step has no "next step" start time → use `total_time` as the end anchor for progress
- User stops and restarts timer → elapsed resets to `0` (fresh start)
- Recipe adjustments update `recipe.steps` → active step recalculates automatically since it's derived
