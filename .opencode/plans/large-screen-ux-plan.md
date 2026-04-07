# Large Screen UX Improvement Plan

## Current State Analysis

### App Structure
- **Name**: Brygg (Coffee Recipe Buddy)
- **Stack**: Next.js 16 + React 19 + Tailwind CSS v4
- **Current Approach**: Mobile-first with constrained layout
- **Breakpoints**: Currently only uses `lg` breakpoint (1024px+)

### Current Layout Constraints
```
Mobile (<1024px): max-w-sm (384px), centered
Desktop (≥1024px): max-w-md (448px), centered + SideNav (224px)
```

### Problem Statement
On large screens (laptops, desktops, tablets in landscape):
- Content is too narrow (448px max on a 1440px screen = 31% width, 69% whitespace)
- No content hierarchy differentiation
- Single-column layout wastes horizontal space
- No adaptive typography or spacing
- Tables and grids don't expand to use available space

---

## Proposed Solution: Progressive Layout Enhancement

### Breakpoint Strategy

| Breakpoint | Min Width | Target Device | Layout Strategy |
|------------|-----------|---------------|-----------------|
| Default | 0 | Mobile phones | Current layout, single column |
| `sm` | 640px | Large phones, small tablets | Slight padding increase |
| `md` | 768px | Tablets portrait | Increased content width |
| `lg` | 1024px | Tablets landscape, small laptops | SideNav + wider content |
| `xl` | 1280px | Laptops, desktops | Multi-column layouts where appropriate |
| `2xl` | 1536px | Large desktops | Full content density |

### Content Width Strategy

Replace the current binary approach (`max-w-sm` → `max-w-md`) with progressive width:

```
Default:  max-w-full px-4 (mobile-first)
sm:       sm:px-6
md:       md:max-w-2xl md:mx-auto (672px)
lg:       lg:max-w-3xl (768px) + SideNav visible
xl:       xl:max-w-5xl (1024px) - multi-column opportunities
2xl:      2xl:max-w-6xl (1152px)
```

---

## Page-by-Page Enhancement Plan

### 1. Home Page (`/`)

**Current Issues:**
- Hero image could be larger
- Recipe cards stack vertically only
- CTA buttons are narrow

**Proposed Changes:**

| Element | Mobile | Tablet (md+) | Desktop (xl+) |
|---------|--------|--------------|---------------|
| Container | px-4 | max-w-2xl | max-w-5xl |
| Hero Image | Full width | 80% width, centered | 60% width, left aligned |
| CTAs | Stack vertical | Horizontal row | Horizontal with icons |
| Recipe List | Single column | 2-column grid | 3-column grid |
| Typography | text-3xl | text-4xl | text-5xl |

**Layout Shift Example:**
```tsx
// Current
<div className="max-w-sm mx-auto lg:max-w-md">

// Proposed
<div className="max-w-full px-4 sm:px-6 md:max-w-2xl md:mx-auto lg:max-w-3xl xl:max-w-5xl">
```

---

### 2. Recipe List Page (`/recipes`)

**Current Issues:**
- Single column recipe cards waste space
- Search bar is narrow
- Filter chips overflow horizontally

**Proposed Changes:**

| Element | Mobile | Tablet (md+) | Desktop (xl+) |
|---------|--------|--------------|---------------|
| Recipe Cards | Single column | 2-column grid | 2-column with larger cards |
| Card Layout | Horizontal compact | Vertical detailed | Vertical with image focus |
| Filters | Horizontal scroll | Wrap to multiple rows | Horizontal with more visible |
| Search | Full width | 80% width | 60% width with filters beside |

---

### 3. Recipe Detail Page (`/recipes/[id]`)

**Current Issues:**
- Parameters grid is 3-column, could be larger
- Brew steps are single column
- Images are constrained

**Proposed Changes:**

| Element | Mobile | Tablet (md+) | Desktop (xl+) |
|---------|--------|--------------|---------------|
| Layout | Single column | Two-column split | Two-column with sidebar |
| Left Column | Full width | 55% | 50% |
| Right Column | N/A | 45% (parameters) | 50% (steps + image) |
| Parameters | 3-col grid | 3-col larger | 6-col grid |
| Brew Steps | Full width | Full width | Timed step cards |
| Bag Photo | Full width, 4:3 | Smaller, floating | Side panel |

---

### 4. Brew Timer Page (`/recipe`)

**Current Issues:**
- Step cards are narrow
- Timer is small
- Parameter cards could be larger

**Proposed Changes:**

| Element | Mobile | Tablet (md+) | Desktop (xl+) |
|---------|--------|--------------|---------------|
| Layout | Single column | Two-column | Two-column with sticky timer |
| Step Cards | Full width | Larger padding | Progress indicators |
| Timer | Small button | Prominent display | Fixed position, large |
| Parameters | 3-col grid | 3-col larger | Horizontal bar |

---

### 5. Scan Page (`/scan`)

**Current Issues:**
- Upload zone is narrow
- Preview image is constrained

**Proposed Changes:**

| Element | Mobile | Tablet (md+) | Desktop (xl+) |
|---------|--------|--------------|---------------|
| Upload Zone | Full width - 40px | Max 600px centered | Max 700px with drag overlay |
| Buttons | Stack vertical | Horizontal | Horizontal with larger hit areas |
| Instructions | Centered text | Left-aligned tips | Visual guide with icons |

---

### 6. Analysis Page (`/analysis`)

**Current Issues:**
- Form fields are narrow
- Editable fields stack vertically

**Proposed Changes:**

| Element | Mobile | Tablet (md+) | Desktop (xl+) |
|---------|--------|--------------|---------------|
| Bean Profile Grid | 2 columns | 2 columns larger | 4 columns |
| Flavor Notes | Wrap | Wrap with larger tags | Horizontal list |
| Form Layout | Single column | Two-column | Three-column with groups |
| Image Preview | Small | Medium | Large with zoom |

---

### 7. Settings Page (`/settings`)

**Current Issues:**
- Form is narrow
- Buttons stack vertically

**Proposed Changes:**

| Element | Mobile | Tablet (md+) | Desktop (xl+) |
|---------|--------|--------------|---------------|
| Form Layout | Single column | Two-column sections | Two-column with sidebar |
| Settings Groups | Stacked | Card-based | Accordion cards |
| Save/Sign Out | Full width buttons | Button row | Sticky save bar |

---

## Global Component Updates

### Layout Container

**Create a reusable layout wrapper:**

```tsx
// components/ResponsiveContainer.tsx
export function ResponsiveContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="
      w-full
      px-4
      sm:px-6
      md:max-w-2xl md:mx-auto md:px-8
      lg:max-w-3xl
      xl:max-w-5xl
      2xl:max-w-6xl
    ">
      {children}
    </div>
  )
}
```

### SideNav Enhancement

**Current:** Fixed 224px width, simple list
**Proposed:** Keep current, but add subtle improvements:
- Add hover states with transition
- Consider collapsible state for larger screens (user preference)
- Add keyboard shortcuts display on desktop

### Typography Scale

**Current:** Fixed sizes
**Proposed:** Responsive typography

```css
/* globals.css additions */
.text-responsive-h1 {
  @apply text-3xl sm:text-4xl lg:text-5xl;
}

.text-responsive-h2 {
  @apply text-2xl sm:text-3xl lg:text-4xl;
}

.text-responsive-body {
  @apply text-sm sm:text-base lg:text-lg;
}
```

### Spacing Scale

**Current:** Fixed spacing
**Proposed:** Responsive spacing

```
Section spacing:
Mobile: py-6 (24px)
Tablet: md:py-8 (32px)
Desktop: lg:py-12 (48px)

Card padding:
Mobile: p-3 (12px)
Tablet: md:p-4 (16px)
Desktop: lg:p-6 (24px)
```

---

## Grid System for Recipe Cards

**Current:** Single column flex
**Proposed:** CSS Grid with responsive columns

```tsx
// Recipe list grid
<div className="
  grid
  grid-cols-1
  md:grid-cols-2
  xl:grid-cols-3
  gap-3
  md:gap-4
">
  {recipes.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} />)}
</div>

// Recipe card adapts to grid
function RecipeCard({ recipe, view = 'compact' }: RecipeCardProps) {
  return (
    <div className={`
      bg-[var(--card)] rounded-2xl overflow-hidden
      ${view === 'compact' ? 'flex items-center gap-3 p-3' : ''}
      ${view === 'detailed' ? 'flex flex-col' : ''}
    `}>
      {/* Card content adapts */}
    </div>
  )
}
```

---

## Implementation Strategy

### Phase 1: Foundation (Minimal Risk)
1. Update `layout.tsx` container widths
2. Create `ResponsiveContainer` component
3. Update global CSS with responsive utilities
4. Test on all screen sizes

### Phase 2: Page-by-Page (Low Risk)
1. Home page - recipe grid
2. Recipe list - card grid
3. Recipe detail - two-column layout
4. Brew timer - enhanced layout
5. Scan/Analysis/Settings - width adjustments

### Phase 3: Advanced Features (Medium Risk)
1. Two-column recipe detail layout
2. Sticky elements on desktop
3. Keyboard shortcuts
4. Drag-and-drop improvements

---

## Technical Considerations

### Tailwind v4 Compatibility
The app uses Tailwind CSS v4. The breakpoint prefixes work the same:
- `sm:`, `md:`, `lg:`, `xl:`, `2xl:` are all valid

### Mobile-First Preservation
All changes use progressive enhancement - mobile stays exactly the same unless explicitly overridden.

### Performance
- No additional JavaScript required
- Pure CSS/Tailwind responsive classes
- Grid layouts are more performant than flex for 2D arrangements

### Accessibility
- Maintain touch targets (44x44px minimum)
- Keep readable line lengths (60-75 characters)
- Ensure color contrast remains compliant

---

## Testing Checklist

### Device Testing
- [ ] iPhone SE (375px)
- [ ] iPhone 14 (390px)
- [ ] iPad Mini (768px)
- [ ] iPad Pro 11" (834px)
- [ ] iPad Pro 12.9" (1024px landscape)
- [ ] Laptop (1280px)
- [ ] Desktop (1440px)
- [ ] Large Desktop (1920px)

### Functional Testing
- [ ] All buttons remain clickable
- [ ] Forms are usable at all sizes
- [ ] Images don't stretch/distort
- [ ] Text remains readable
- [ ] Navigation works on all devices
- [ ] Modal/sheets display correctly

---

## Migration Example: layout.tsx

**Current:**
```tsx
<div className="lg:ml-56">
  <div className="max-w-sm mx-auto lg:max-w-md">
    {children}
  </div>
</div>
```

**Proposed:**
```tsx
<div className="lg:ml-56 min-h-screen">
  <div className="
    w-full
    px-4
    sm:px-6
    md:max-w-2xl
    md:mx-auto
    lg:max-w-3xl
    xl:max-w-5xl
    xl:px-8
  ">
    {children}
  </div>
</div>
```

---

## Visual Design Mockups

See the `.pen` design file for visual mockups of:
1. Home page - desktop layout with 3-column recipe grid
2. Recipe detail - two-column layout
3. Brew timer - enhanced desktop view

---

## Success Metrics

After implementation, the app should:
1. ✅ Use >60% of screen width on 1440px displays (vs current 31%)
2. ✅ Show 2-3 recipe cards per row on desktop (vs current 1)
3. ✅ Display two-column layout on recipe detail page
4. ✅ Maintain 100% mobile experience parity
5. ✅ Pass all accessibility checks
6. ✅ Load with no layout shift

---

## Questions for Stakeholder

1. **Priority**: Which pages are most used on desktop? (Focus there first)
2. **Navigation**: Should SideNav collapse on xl+ screens? (User preference)
3. **Recipe Cards**: Preferred card style on desktop - compact list or detailed grid?
4. **Brew Timer**: Should timer be always-visible sticky on desktop?
5. **Data Density**: Preference for more recipes visible vs larger cards?
6. **Dark Mode**: Any desktop-specific dark mode preferences?

---

*Plan created: 2025-01-07*
*Version: 1.0*
*Status: Ready for Review*
