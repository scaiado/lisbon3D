# Lisbon 3D Explorer — Design System

> A premium yet approachable visual identity inspired by Lisbon's soul — azulejo blues, terracotta warmth, and golden hour light.

---

## 🎨 Color Palette

### Primary Colors — Lisbon Essence

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `--lisbon-azul` | `#1E4D6B` | `30, 77, 107` | Primary brand, headers, active states |
| `--lisbon-azul-light` | `#4A90A4` | `74, 144, 164` | Hover states, secondary accents |
| `--lisbon-azul-dark` | `#0F2D3D` | `15, 45, 61` | Deep backgrounds, shadows |

### Secondary Colors — Terracotta & Warmth

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `--lisbon-terracotta` | `#C75B39` | `199, 91, 57` | CTAs, highlights, important actions |
| `--lisbon-terracotta-light` | `#E07A5F` | `224, 122, 95` | Hover, soft accents |
| `--lisbon-terracotta-dark` | `#A04020` | `160, 64, 32` | Active/pressed states |

### Golden Hour Accents

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `--lisbon-gold` | `#D4A574` | `212, 165, 116` | Success states, premium highlights |
| `--lisbon-gold-light` | `#E8C9A0` | `232, 201, 160` | Soft glows, backgrounds |
| `--lisbon-sunset` | `#F4A261` | `244, 162, 97` | Warm notifications, energy |

### Neutral Scale — Stone & Mist

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `--stone-50` | `#FAFAF9` | `250, 250, 249` | Page background |
| `--stone-100` | `#F5F5F4` | `245, 245, 244` | Card backgrounds |
| `--stone-200` | `#E7E5E4` | `231, 229, 228` | Borders, dividers |
| `--stone-300` | `#D6D3D1` | `214, 211, 209` | Disabled states |
| `--stone-400` | `#A8A29E` | `168, 162, 158` | Muted text |
| `--stone-500` | `#78716C` | `120, 113, 108` | Secondary text |
| `--stone-600` | `#57534E` | `87, 83, 78` | Body text |
| `--stone-700` | `#44403C` | `68, 64, 60` | Strong text |
| `--stone-800` | `#292524` | `41, 37, 36` | Headings |
| `--stone-900` | `#1C1917` | `28, 25, 23` | Deep text, dark mode bg |

### Map-Specific Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--map-water` | `#A8D5E5` | Tagus River, ocean |
| `--map-park` | `#7CB87C` | Gardens, parks (Estrela, Eduardo VII) |
| `--map-building` | `#E8DDD4` | Building extrusions |
| `--map-building-highlight` | `#C75B39` | Selected building |
| `--map-road` | `#F5F5F4` | Streets, avenues |
| `--map-road-major` | `#FFFFFF` | Major arteries (Avenida da Liberdade) |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--info` | `--lisbon-azul` | Information |
| `--success` | `#059669` | Success states |
| `--warning` | `--lisbon-sunset` | Warnings |
| `--error` | `#DC2626` | Errors, critical |

---

## 🔤 Typography

### Font Families

```css
:root {
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'Inter', sans-serif;
}
```

#### Display Font: Space Grotesk
- **Weights**: 300 (Light), 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
- **Usage**: Headings, logo, navigation, UI labels
- **Character**: Modern, geometric, slightly quirky — matches Lisbon's mix of old and new
- **Load**: Google Fonts or self-host

#### Body Font: Inter
- **Weights**: 400 (Regular), 500 (Medium), 600 (SemiBold)
- **Usage**: Body text, descriptions, data, tooltips
- **Character**: Highly readable, professional, neutral
- **Load**: Google Fonts or self-host

### Type Scale

| Style | Font | Size | Weight | Line Height | Letter Spacing |
|-------|------|------|--------|-------------|----------------|
| Hero | Space Grotesk | 48px / 3rem | 700 | 1.1 | -0.02em |
| H1 | Space Grotesk | 36px / 2.25rem | 600 | 1.2 | -0.01em |
| H2 | Space Grotesk | 28px / 1.75rem | 600 | 1.3 | -0.01em |
| H3 | Space Grotesk | 22px / 1.375rem | 500 | 1.4 | 0 |
| H4 | Space Grotesk | 18px / 1.125rem | 500 | 1.4 | 0 |
| Body Large | Inter | 18px / 1.125rem | 400 | 1.6 | 0 |
| Body | Inter | 16px / 1rem | 400 | 1.6 | 0 |
| Body Small | Inter | 14px / 0.875rem | 400 | 1.5 | 0 |
| Caption | Inter | 12px / 0.75rem | 500 | 1.4 | 0.02em |
| Label | Space Grotesk | 11px / 0.6875rem | 600 | 1.2 | 0.05em |

---

## 📐 Spacing System

Based on 4px base unit:

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight gaps, icon padding |
| `--space-2` | 8px | Compact spacing |
| `--space-3` | 12px | Default element gaps |
| `--space-4` | 16px | Standard padding |
| `--space-5` | 20px | Card padding |
| `--space-6` | 24px | Section gaps |
| `--space-8` | 32px | Large sections |
| `--space-10` | 40px | Major divisions |
| `--space-12` | 48px | Hero spacing |
| `--space-16` | 64px | Page-level |

---

## 🧩 UI Components

### Navigation Controls (Map)

```
┌─────────────────────┐
│  [+]                │  Zoom In
│  [−]                │  Zoom Out
│  ───────────        │  Divider
│  [⌘]                │  Compass/Reset
│  [↻]                │  Rotate
│  [⤢]                │  Tilt
└─────────────────────┘
```

**Style:**
- Size: 40px × 40px buttons
- Background: `--stone-50` with 90% opacity + backdrop blur
- Border: 1px solid `--stone-200`
- Border radius: 12px (container), 8px (buttons)
- Shadow: `0 4px 12px rgba(0,0,0,0.08)`
- Icon color: `--stone-700`
- Hover: Background `--stone-100`, icon `--lisbon-azul`
- Active: Background `--lisbon-azul`, icon white

### Layer Toggle Panel

```
┌──────────────────────┐
│  Layers         ▼    │  Header
├──────────────────────┤
│  ☑ Terrain           │  Checkbox + Label
│  ☑ Buildings         │
│  ☐ Satellite         │
│  ☑ Labels            │
│  ─────────────       │  Divider
│  ○ Light             │  Theme radio
│  ◉ Lisbon            │
│  ○ Dark              │
└──────────────────────┘
```

**Style:**
- Width: 200px
- Background: `--stone-50` / 95% opacity
- Border radius: 16px
- Padding: `--space-4`
- Header: Space Grotesk 500, 14px
- Items: Inter 400, 14px
- Active check: `--lisbon-azul` fill

### Info Panel (Selected Building)

```
┌──────────────────────────┐
│  ┌────┐ Building Name    │  Image thumbnail + Title
│  │    │ Avenida da Liberd│  Address
│  └────┘ 📐 245m²  🏗 1910 │  Metadata chips
│  ─────────────────────   │
│  Description text here   │  Body
│  that wraps nicely...    │
│  [View Details →]        │  CTA Link
└──────────────────────────┘
```

**Style:**
- Width: 320px
- Background: white
- Border radius: 20px
- Shadow: `0 8px 32px rgba(0,0,0,0.12)`
- Header: H4 (Space Grotesk)
- Chips: Rounded pills, `--stone-100` bg

### Loading States

**Initial Load:**
- Full-screen overlay with `--stone-50` background
- Animated logo (azulejo tile pattern rotating)
- Progress bar: `--lisbon-azul` fill on `--stone-200` track
- Loading text: "Exploring Lisbon..." (Space Grotesk, 18px)

**Lazy Loading (Tiles):**
- Skeleton shimmer on tile placeholders
- Gradient animation: `--stone-100` → `--stone-200` → `--stone-100`
- Duration: 1.5s infinite

---

## 🎯 Shadows & Elevation

| Level | Shadow | Usage |
|-------|--------|-------|
| 1 | `0 1px 2px rgba(0,0,0,0.05)` | Subtle borders |
| 2 | `0 4px 6px rgba(0,0,0,0.07)` | Cards, buttons |
| 3 | `0 8px 16px rgba(0,0,0,0.08)` | Floating panels |
| 4 | `0 12px 24px rgba(0,0,0,0.12)` | Modals, info panels |
| 5 | `0 24px 48px rgba(0,0,0,0.15)` | Full-screen overlays |

---

## 🌗 Themes

### Light Theme (Default)
- Background: `--stone-50`
- Surface: white
- Text primary: `--stone-800`
- Text secondary: `--stone-500`

### Lisbon Theme (Signature)
- Background: `#FDF8F3` (warm off-white)
- Surface: white with warm tint
- Map: Custom tiles with azulejo-inspired water
- Accent: `--lisbon-terracotta`

### Dark Theme
- Background: `--stone-900`
- Surface: `--stone-800`
- Text primary: `--stone-100`
- Text secondary: `--stone-400`

---

## 📱 Responsive Breakpoints

| Breakpoint | Width | Adjustments |
|------------|-------|-------------|
| Mobile | < 640px | Full-screen panels, simplified controls |
| Tablet | 640–1024px | Side panels, compressed nav |
| Desktop | > 1024px | Full layout, persistent panels |

---

## 🎨 CSS Variables (Complete)

```css
:root {
  /* Primary */
  --lisbon-azul: #1E4D6B;
  --lisbon-azul-light: #4A90A4;
  --lisbon-azul-dark: #0F2D3D;
  
  /* Secondary */
  --lisbon-terracotta: #C75B39;
  --lisbon-terracotta-light: #E07A5F;
  --lisbon-terracotta-dark: #A04020;
  
  /* Accents */
  --lisbon-gold: #D4A574;
  --lisbon-gold-light: #E8C9A0;
  --lisbon-sunset: #F4A261;
  
  /* Neutrals */
  --stone-50: #FAFAF9;
  --stone-100: #F5F5F4;
  --stone-200: #E7E5E4;
  --stone-300: #D6D3D1;
  --stone-400: #A8A29E;
  --stone-500: #78716C;
  --stone-600: #57534E;
  --stone-700: #44403C;
  --stone-800: #292524;
  --stone-900: #1C1917;
  
  /* Map */
  --map-water: #A8D5E5;
  --map-park: #7CB87C;
  --map-building: #E8DDD4;
  --map-building-highlight: #C75B39;
  --map-road: #F5F5F4;
  --map-road-major: #FFFFFF;
  
  /* Typography */
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'Inter', sans-serif;
  
  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  
  /* Shadows */
  --shadow-1: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-2: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-3: 0 8px 16px rgba(0,0,0,0.08);
  --shadow-4: 0 12px 24px rgba(0,0,0,0.12);
  --shadow-5: 0 24px 48px rgba(0,0,0,0.15);
  
  /* Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-full: 9999px;
}
```

---

## 🖼️ Iconography

**Icon Set**: Lucide React (or Phosphor Icons)
- Weight: Regular (1.5px stroke)
- Size: 20px default, 16px compact, 24px prominent

**Key Icons:**
- Navigation: `ZoomIn`, `ZoomOut`, `Compass`, `RotateCw`, `Move3d`
- Layers: `Layers`, `Map`, `Building2`, `Trees`, `Satellite`
- UI: `X`, `Menu`, `Info`, `ChevronRight`, `Search`, `Share2`
- Brand: Custom Lisbon tile pattern

---

## 🔗 Assets Path Reference

```
web/assets/
├── logos/
│   ├── lisbon-3d-logo.svg          # Main logo
│   ├── lisbon-3d-logo-dark.svg     # Dark variant
│   └── lisbon-3d-wordmark.svg      # Text-only
├── icons/
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png
│   └── tile-icon.svg               # Azulejo-inspired
├── social/
│   ├── og-image.jpg                # 1200×630
│   ├── twitter-card.jpg            # 1200×600
│   └── github-banner.jpg           # 1280×640
└── ui-components/
    ├── nav-controls-preview.svg
    ├── layer-panel-preview.svg
    └── info-panel-preview.svg
```

---

*Document version: 1.0*  
*Last updated: 2026-03-24*  
*Next review: Implementation phase*
