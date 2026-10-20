# Lisbon 3D — Drive Mode Design System

## 🎨 Color Palette

### Primary Colors (Neon Night Drive)

| Color | Hex | Usage |
|-------|-----|-------|
| **Neon Cyan** | `#00f5d4` | Speedometer, primary accents, active states |
| **Neon Magenta** | `#ff006e` | Score, checkpoints, viral moments |
| **Neon Amber** | `#ffbe0b` | Warning, highlights, landmarks |
| **Deep Purple** | `#8338ec` | Secondary accents, gradients |

### Dark Theme Base

| Color | Hex | Usage |
|-------|-----|-------|
| **Obsidian** | `#0a0a0f` | Main background |
| **Slate 900** | `#12121a` | Dashboard panels |
| **Slate 800** | `#1a1a25` | Elevated surfaces |
| **Slate 700** | `#252536` | Borders, dividers |

### Map Overlay Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **Glass Dark** | `rgba(10, 10, 15, 0.85)` | HUD panels |
| **Glass Light** | `rgba(255, 255, 255, 0.05)` | Subtle overlays |
| **Neon Glow** | `rgba(0, 245, 212, 0.3)` | Cyan glows |
| **Magenta Glow** | `rgba(255, 0, 110, 0.3)` | Checkpoint glows |

## 🖋️ Typography

### Font Stack
```css
--font-display: 'Rajdhani', 'Orbitron', sans-serif;  /* Gaming headers */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace; /* Data/metrics */
--font-ui: 'Inter', system-ui, sans-serif;             /* UI text */
```

### Size Hierarchy

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| **H1** | 48px | 700 | Checkpoint titles, viral moments |
| **H2** | 32px | 600 | Score displays |
| **H3** | 24px | 600 | Speedometer value |
| **Body** | 16px | 400 | Labels, descriptions |
| **Small** | 12px | 500 | Units, metadata |
| **Data** | 56px | 700 | Large metrics (mono) |

## 🎮 UI Components

### Speedometer
- Circular gauge with 240° sweep
- Neon cyan gradient fill
- Digital readout in center
- Speed indicator glows at high speeds

### Score Display
- Large monospace digits
- "+" animations on points gain
- Combo multiplier indicator
- Progress bar for next milestone

### Mini-Map
- Circular or corner inset
- Car position centered
- Landmark icons as dots
- Route glow trail

### Car Interior Frame
- Bottom dashboard silhouette
- Subtle windshield frame overlay
- Steering wheel hint (bottom corners)

## ✨ Animations

### Speed Lines
- Radial lines emanating from center
- Opacity tied to speed
- CSS-only, no JS overhead

### Checkpoint Celebration
- Scale pulse + glow burst
- Particle burst (CSS pseudo-elements)
- Floating score text

### Viral Moment Triggers
- Screenshot prompt overlay
- Achievement badge animation
- Share button pulse

## 📱 Responsive Breakpoints

| Breakpoint | Width | Adjustments |
|------------|-------|-------------|
| Mobile | < 480px | Single column, smaller fonts |
| Tablet | 481-768px | Two column, medium fonts |
| Desktop | > 768px | Full layout, all features |

## 🎯 Asset Suggestions

### SVG Icons (24x24)
- Speed/gauge icon
- Trophy/achievement icon
- Location pin variants
- Steering wheel icon
- Share button icon

### Effects
- Speed blur overlay (CSS)
- Checkpoint burst (CSS animation)
- Glow under car (radial gradient)

## 🔥 Viral Moment Opportunities

1. **First Landmark**: "🏰 You discovered São Jorge Castle!"
2. **Speed Demon**: Hit 80km/h → "💨 Speed Demon!"
3. **Explorer**: Visit all 3 landmarks → "🌟 Lisbon Explorer!"
4. **Distance Milestones**: Every 1km celebration
