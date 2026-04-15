# React & Modern Web Development Best Practices

**AI Coding Agent Guidelines** — ALWAYS follow these standards when making changes.

---

## 1. Performance First

### Eliminate Waterfalls (CRITICAL)
- **Parallel over sequential**: Use `Promise.all()` for independent async operations
- **Defer awaits**: Move `await` into branches where actually needed
- **Start early, await late**: Begin promises immediately in API routes, await at the end
- **Use Suspense boundaries**: Stream content instead of blocking entire pages

```typescript
// ❌ BAD: Sequential waterfall
const user = await fetchUser()
const posts = await fetchPosts()
const comments = await fetchComments()

// ✅ GOOD: Parallel execution
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
])
```

### Bundle Size Optimization (CRITICAL)
- **Avoid barrel imports**: Import directly from source files
- **Dynamic imports**: Use `next/dynamic` for heavy components not needed on initial render
- **Defer third-party**: Load analytics/logging after hydration with `ssr: false`
- **Conditional loading**: Load modules only when features are activated

### Minimize Re-renders (MEDIUM)
- Derive state during render, not in effects
- Use functional `setState` for updates based on previous state
- Extract expensive work into memoized components
- Split hooks with independent dependencies

---

## 2. Component Architecture

### Composition Over Configuration
- **Avoid boolean prop proliferation**: Don't add `isX` props; compose components instead
- **Use compound components**: Structure complex components with shared context
- **Lift state to providers**: Enable sibling access without prop drilling

```typescript
// ❌ BAD: Boolean prop hell
<Composer isThread isEditing={false} channelId="abc" showAttachments />

// ✅ GOOD: Explicit composition
<ThreadComposer channelId="abc" />
<EditComposer messageId="xyz" />
```

### Component Boundaries
- **Don't define components inside components**: Creates new types on every render
- **Pass props instead**: Avoid closures for accessing parent variables
- **Hoist static JSX**: Extract static elements outside components

### React 19 Patterns
- Use `ref` as a regular prop (no `forwardRef` needed)
- Use `use()` instead of `useContext()` (can be called conditionally)

---

## 3. Server Components & Next.js

### Server Component Rules
- **Authenticate server actions**: Always verify auth inside each Server Action
- **No module-level request state**: Avoid mutable shared state across concurrent renders
- **Hoist static I/O**: Load fonts/config at module level, not per-request
- **Minimize serialization**: Only pass fields client actually needs

### Data Fetching Patterns
- **Use `React.cache()`** for per-request deduplication (DB queries, auth)
- **Use LRU cache** for cross-request caching with `@/lib/lru-cache`
- **Use `after()`** for non-blocking operations (logging, analytics)

### Route Handlers
- Always `await params` before destructuring (Next.js 15+ async API)
- Start promises early, await at response time
- Return typed responses with proper status codes

---

## 4. TypeScript Standards

### Type Safety
- Use `unknown` over `any` — enforce type checking
- Prefer `interface` for object shapes (better error messages)
- Use `type` for unions and complex types
- Use discriminated unions for state machines

### Common Patterns
```typescript
// Discriminated unions for async state
type AsyncState<T> = 
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string }

// Type guards for narrowing
function isString(value: unknown): value is string {
  return typeof value === 'string'
}
```

### TypeScript Best Practices
- Leverage type inference when possible
- Use const assertions for literal types
- Create reusable type utilities
- Test complex types with type assertions

---

## 5. Styling with Tailwind CSS

### Mobile-First Approach
- Write base styles for mobile
- Add responsive prefixes (`sm:`, `md:`, `lg:`) for larger screens

### Common Patterns
```tsx
// Center content
<div className="flex items-center justify-center min-h-screen">

// Responsive grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

// Card component
<div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
```

### Tailwind Guidelines
- Use design tokens (spacing: 4, 8, 12, 16, etc.)
- Extract repeated patterns into components
- Include focus styles and ARIA labels
- Respect reduced-motion preferences

---

## 6. Code Quality & Maintainability

### General Principles
- **Single Responsibility**: Each function/component does one thing
- **Early returns**: Return early when result is determined
- **Immutability**: Use `.toSorted()`, `.toReversed()` instead of mutating
- **Map/Set for lookups**: O(1) instead of O(n) for repeated checks

### JavaScript Performance
- Cache property access in loops
- Combine multiple array iterations (filter + map → flatMap)
- Use `requestIdleCallback` for non-critical work
- Hoist RegExp creation outside loops

### Error Handling
- Always wrap `localStorage`/`sessionStorage` in try-catch
- Version your storage keys for schema evolution
- Validate inputs with Zod or similar before processing

---

## 7. Security Essentials

### Authentication & Authorization
- **Verify in Server Actions**: Don't rely solely on middleware
- **Input validation**: Validate before auth checks
- **Authorize after authenticate**: Check permissions after verifying identity

### Data Safety
- Never store sensitive data (tokens, PII) in localStorage without encryption
- Sanitize user inputs before rendering
- Use CSP headers and secure cookies

---

## 8. Accessibility (a11y)

### Required Practices
- Use semantic HTML elements
- Include proper ARIA labels
- Ensure keyboard navigation works
- Maintain focus management in modals
- Test with screen readers

### Focus & Interaction
- Visible focus indicators on all interactive elements
- Skip navigation links for keyboard users
- Trap focus in modals/dialogs

---

## 9. Testing Standards

### Unit Testing with Vitest
- Mock external dependencies
- Test behavior, not implementation
- Use meaningful test descriptions
- Follow AAA pattern (Arrange, Act, Assert)

### Component Testing
- Test user interactions, not internal state
- Use Testing Library queries that reflect user perspective
- Verify accessibility attributes

---

## 10. Version Control

### Commit Guidelines
- Follow conventional commits format
- Bump `package.json` version following SemVer:
  - **MAJOR (X.0.0)**: Breaking changes, API removals
  - **MINOR (0.X.0)**: New features, endpoints, components
  - **PATCH (0.0.X)**: Bug fixes, styling adjustments

### Code Reviews
- Self-review before requesting review
- Explain non-obvious changes in comments
- Keep PRs focused and small

---

## Quick Reference: Priority Checklist

Before submitting any code change, verify:

- [ ] No sequential async waterfalls — use `Promise.all()`
- [ ] No barrel file imports — use direct imports
- [ ] No boolean prop proliferation — use composition
- [ ] No components defined inside components
- [ ] Server Actions have auth checks
- [ ] TypeScript types are explicit (no implicit `any`)
- [ ] Tailwind classes follow mobile-first pattern
- [ ] `package.json` version is bumped appropriately
- [ ] CHANGELOG.md is updated for user-facing changes

---

## References

- [React Docs](https://react.dev)
- [Next.js Docs](https://nextjs.org)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Tailwind CSS Docs](https://tailwindcss.com)
- [Vercel React Best Practices](https://github.com/vercel/react-best-practices)

---

*Last updated: April 2026*
