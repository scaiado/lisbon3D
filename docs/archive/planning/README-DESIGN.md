# 🎮 Lisbon 3D — Drive Mode Design System

A viral-worthy night driving UI/UX design system for the Lisbon 3D Explorer.

![Design Preview](docs/design-preview.png)

## 🎯 Design Philosophy

- **Dark Mode First**: Immersive night driving aesthetic
- **Neon Accents**: Lisbon nightlife vibes with cyan, magenta, and amber
- **Screenshot-Worthy**: Every moment should be shareable
- **Performance-First**: CSS animations only, no heavy JS
- **Mobile-Responsive**: Works on all screen sizes
- **Indie Game Quality**: Built-in-public aesthetic

## 📁 File Structure

```
lisbon3D/
├── css/
│   └── drive-mode.css          # Complete design system
├── js/
│   └── drive-mode-ui.js        # UI controller
├── assets/
│   └── icons/
│       └── drive-mode-icons.svg # SVG icon library
├── drive-mode-dashboard.html    # HTML structure template
├── DRIVE_MODE_DESIGN.md         # Design documentation
└── README-DESIGN.md            # This file
```

## 🎨 Color Palette

### Neon Accents
| Color | Hex | Usage |
|-------|-----|-------|
| Cyan | `#00f5d4` | Speedometer, primary actions |
| Magenta | `#ff006e` | Checkpoints, achievements |
| Amber | `#ffbe0b` | Score, warnings |
| Purple | `#8338ec` | Milestones, secondary |

### Dark Theme
| Color | Hex | Usage |
|-------|-----|-------|
| Obsidian | `#0a0a0f` | Background |
| Slate 900 | `#12121a` | Panels |
| Slate 800 | `#1a1a25` | Elevated surfaces |
| Slate 700 | `#252536` | Borders |

## 🚀 Quick Start

The design system is already integrated into `index.html`. The drive mode UI automatically shows when entering drive mode.

### Manual Integration

If you need to integrate into another project:

1. **Include CSS**:
```html
<link rel="stylesheet" href="./css/drive-mode.css">
```

2. **Include JavaScript**:
```html
<script src="./js/drive-mode-ui.js"></script>
```

3. **Add HTML Structure** (copy from `drive-mode-dashboard.html`)

4. **Dispatch Events** from your game loop:
```javascript
// Update UI with game state
updateDriveUI({
  speed: currentSpeed,
  maxSpeed: 80,
  score: currentScore,
  distance: metersTraveled
});

// Trigger checkpoint
triggerCheckpoint({
  name: 'São Jorge Castle',
  points: 500,
  landmarkId: 1
});

// Trigger viral moment
triggerViralMoment({
  emoji: '💨',
  title: 'Speed Demon!',
  subtitle: 'You hit 80 km/h'
});
```

## 🎮 UI Components

### Speedometer
- Circular gauge with 240° sweep
- Neon cyan fill with gradient at high speeds
- Glow effect intensifies with speed
- Changes to magenta above 80% max speed

### Score Display
- Large monospace digits with amber glow
- Distance badge below
- Floating score animation on points gain

### Mini Map
- Circular radar-style display
- Car position always centered
- Landmark dots with color coding
- Visited landmarks fade out

### Car Interior Frame
- Windshield gradient overlay
- Dashboard silhouette at bottom
- Subtle steering wheel hint
- Fades in during drive mode transition

### Checkpoint Popup
- Centered card with particle burst
- Icon bounce animation
- Auto-dismiss after 2.5s
- Magenta glow effect

### Viral Moment Overlay
- Large centered badge
- Emoji + title + subtitle
- Screenshot hint
- Auto-dismiss after 4s

### Speed Lines
- Radial lines emanating from center
- Opacity tied to speed (activates above 60%)
- Pure CSS animation, no JS

## 📱 Responsive Breakpoints

| Breakpoint | Width | Adjustments |
|------------|-------|-------------|
| Desktop | > 768px | Full layout |
| Tablet | 481-768px | Reduced sizes |
| Mobile | < 480px | Single column, no minimap |

## ✨ Animations

All animations are CSS-only for performance:

| Animation | Duration | Description |
|-----------|----------|-------------|
| `hudEntrance` | 0.4s | Dashboard fade in |
| `checkpointIn` | 0.6s | Popup scale + bounce |
| `checkpointOut` | 0.4s | Popup fade out |
| `viralPop` | 0.8s | Viral badge entrance |
| `speedPulse` | 0.5s | High speed vibration |
| `scorePop` | 0.3s | Score change bounce |
| `floatUp` | 1s | Floating score animation |
| `particleBurst` | 1s | Checkpoint ring expand |
| `speedLine` | 0.8s | Radial speed streaks |

## 🔥 Viral Moment Triggers

Built-in viral moments that trigger automatically:

1. **Speed Demon** (💨) - Hit 75+ km/h
2. **Lisbon Explorer** (🌟) - Visit all 3 landmarks
3. **Distance Milestones** (🎯) - Every 1km traveled

## 🛠️ Customization

### Change Colors
Edit CSS variables in `drive-mode.css`:
```css
:root {
  --neon-cyan: #00f5d4;
  --neon-magenta: #ff006e;
  /* ... */
}
```

### Add New Landmarks
Update in `main.js`:
```javascript
const LANDMARKS = [
  { name: 'Your Landmark', coords: [lng, lat], color: '#hex', points: 500 }
];
```

### Customize Speedometer
The SVG gauge uses `stroke-dasharray` for the arc. Adjust:
```css
.speedometer-fill {
  stroke-dasharray: 283; /* Circumference */
  /* 240° = 2/3 of circle */
}
```

## 📸 Screenshot Tips

Best moments to screenshot:
- High speed with speed lines active
- Checkpoint popups
- Viral moment overlays
- All 3 landmarks visited
- Golden hour in Lisbon (sunset lighting)

## 🎮 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| W | Accelerate |
| S | Brake/Reverse |
| A/D | Steer |
| P / ESC | Exit drive mode |
| R | Reset to Lisbon center |
| Mouse Drag | Look around |

## 🔧 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires CSS custom properties, backdrop-filter, and SVG support.

## 📦 Dependencies

- MapLibre GL JS (for map)
- Google Fonts (Rajdhani, JetBrains Mono, Inter)

## 🤝 Credits

Design system created by **Pixel** (TTL-12 AI Team)
- Part of the Tiny Little Lab project
- Built for Lisbon 3D Explorer

---

*Made with 💜 for viral moments*
