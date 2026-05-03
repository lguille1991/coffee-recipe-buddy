/** @vitest-environment jsdom */

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const routerReplaceMock = vi.fn()
const routerRefreshMock = vi.fn()
let searchParamsValue = ''
let viewportResizeHandler: (() => void) | null = null

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplaceMock, refresh: routerRefreshMock }),
  usePathname: () => '/coffees',
  useSearchParams: () => new URLSearchParams(searchParamsValue),
}))

vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import SavedCoffeesClient from './SavedCoffeesClient'

function clickButtonByText(container: HTMLElement, text: string) {
  const normalize = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim()
  const button = Array.from(container.querySelectorAll('button')).find(candidate => normalize(candidate.textContent) === text)
  if (!button) throw new Error(`Button not found: ${text}`)
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function findButtonByPrefix(container: HTMLElement, prefix: string) {
  const normalize = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim()
  return Array.from(container.querySelectorAll('button')).find(candidate => normalize(candidate.textContent).startsWith(prefix))
}

function setViewportHeight(height: number) {
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
}

describe('SavedCoffeesClient mobile UX behavior', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    routerReplaceMock.mockReset()
    routerRefreshMock.mockReset()
    viewportResizeHandler = null
    searchParamsValue = ''

    setViewportHeight(900)
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        get height() {
          return this._height
        },
        _height: 900,
        addEventListener: (_event: string, handler: () => void) => {
          viewportResizeHandler = handler
        },
        removeEventListener: () => {
          viewportResizeHandler = null
        },
      },
    })

    vi.spyOn(globalThis, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: async () => ({
        profiles: [
          {
            id: 'profile-1',
            label: 'Ethiopia Worka',
            bean_profile_json: { roaster: 'Luminous', roast_level: 'light' },
            last_used_at: null,
            primary_image: null,
          },
        ],
      }),
    } as Response)

    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.innerHTML = ''
    document.body.appendChild(container)
    root = createRoot(container)
  })

  it('sets correct selected accessibility state on active/archived toggle', async () => {
    await act(async () => {
      root.render(<SavedCoffeesClient />)
    })

    const active = container.querySelector('[data-testid="coffee-status-active"]')
    const archived = container.querySelector('[data-testid="coffee-status-archived"]')

    expect(active?.getAttribute('aria-pressed')).toBe('true')
    expect(archived?.getAttribute('aria-pressed')).toBe('false')
  })

  it('hides bulk action bar when keyboard opens and restores it when closed', async () => {
    await act(async () => {
      root.render(<SavedCoffeesClient />)
    })

    await act(async () => { clickButtonByText(container, 'Select') })
    await act(async () => { clickButtonByText(container, 'Select all visible') })
    expect(findButtonByPrefix(container, 'Archive (1)')).toBeTruthy()

    await act(async () => {
      setViewportHeight(900)
      ;(window.visualViewport as { _height: number })._height = 700
      viewportResizeHandler?.()
    })
    expect(findButtonByPrefix(container, 'Archive (1)')).toBeFalsy()

    await act(async () => {
      ;(window.visualViewport as { _height: number })._height = 900
      viewportResizeHandler?.()
    })
    expect(findButtonByPrefix(container, 'Archive (1)')).toBeTruthy()
  })

  it('still hides bulk action bar when keyboard open also shrinks window.innerHeight', async () => {
    await act(async () => {
      root.render(<SavedCoffeesClient />)
    })

    await act(async () => { clickButtonByText(container, 'Select') })
    await act(async () => { clickButtonByText(container, 'Select all visible') })
    expect(findButtonByPrefix(container, 'Archive (1)')).toBeTruthy()

    await act(async () => {
      setViewportHeight(760)
      ;(window.visualViewport as { _height: number })._height = 760
      viewportResizeHandler?.()
    })
    expect(findButtonByPrefix(container, 'Archive (1)')).toBeFalsy()
  })
})
