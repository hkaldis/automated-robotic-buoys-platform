# Automated Robotic Buoys Platform - Design Guidelines

## Design Approach: Professional Maritime Control System

**Selected Framework**: Material Design 3 foundation with maritime/industrial interface patterns
**Rationale**: Mission-critical, data-dense application requiring clarity, real-time feedback, and tablet landscape optimization

---

## Layout System (Landscape Tablet-First)

**Spatial Organization**:
- Primary layout: Map occupies 60-70% of viewport (left/center), persistent side panel (30-40% right)
- Tailwind spacing primitives: **2, 4, 6, 8, 12, 16** units consistently throughout
- Panel padding: p-6 for dense content areas, p-8 for breathing room
- Component gaps: gap-4 for lists/grids, gap-6 for major sections
- Screen margins: Fixed 16px (p-4) minimum touch-safe zones on all edges

**Grid Structure**:
```
[Top Bar: 16 height] - Navigation, weather summary, alerts
[Main Area: flex-1]
  ├─ [Map View: flex-grow] - Course visualization
  └─ [Side Panel: w-96 to w-[440px]] - Controls & data
```

---

## Typography

**Font Stack**: 
- Primary: **Inter** (400, 500, 600, 700) via Google Fonts
- Monospace: **JetBrains Mono** for coordinates, telemetry data

**Hierarchy**:
- Page titles: text-2xl font-semibold (24px)
- Section headers: text-lg font-semibold (18px)
- Body content: text-base font-normal (16px)
- Labels/meta: text-sm font-medium (14px)
- Data readouts: text-sm font-mono (14px monospace)
- Compact info: text-xs font-medium (12px)

---

## Component Library

### Map Interface
- **Fullscreen canvas** with overlay controls
- Buoy markers: 40x40px interactive circles with state indicators
- Course marks: 32x32px geometric shapes (triangle/diamond/circle by role)
- Lines: 3px stroke width, dashed for proposed, solid for active
- Wind vectors: 24px arrow icons with rotation
- Distance labels: Floating text-sm badges with backdrop blur
- Selection halos: 8px ring around selected elements

### Top Navigation Bar
- Height: h-16
- Left: Club logo + event name (text-lg font-semibold)
- Center: Real-time wind indicator (direction arrow + speed in user units)
- Right: Battery status, connection indicator, user menu (all icon-text combinations)
- Alert banner: Slides down below nav when course validity issues detected

### Side Panel (Contextual)
**Default State** - Event Overview:
- Event type badge + class info
- Course shape selector (grid of 6 preset shapes, 2x3)
- Mark assignment status list (compact)
- "Deploy Course" primary action button

**Buoy Detail State**:
- Header: Buoy ID + state badge
- Telemetry grid (2 columns): GPS, speed, battery, ETA
- Weather data card: Wind/current with directional indicators
- Control buttons: Stacked full-width, gap-3
- Timeline: Recent state changes (text-xs with timestamps)

### Data Cards
- Rounded corners: rounded-lg
- Borders: 1px solid
- Padding: p-4 for compact, p-6 for detailed
- Shadow: subtle drop shadow for elevation
- Grid layouts: grid-cols-2 for key-value pairs, gap-3

### Buttons & Actions
**Primary Actions**: Full-width, h-12, rounded-md, font-medium
**Secondary Actions**: Outlined variant, same dimensions
**Icon Buttons**: 40x40px tap targets, 24px icons inside
**Button Groups**: Segmented control pattern for mode switches (Manual/Auto assignment)

### Status Indicators
- **Badges**: Inline, rounded-full, px-3 py-1, text-xs font-semibold
- **Icons**: Heroicons library, 20px for inline, 24px for standalone
- **Progress**: Linear bars for battery (h-2), circular for ETA countdown
- **Connection Status**: Pulsing dot (8px) + text label combination

### Forms & Inputs
- Input height: h-12 for touch-friendly interaction
- Labels: text-sm font-medium, mb-2
- Number inputs with +/- steppers for manual wind/coordinates
- Dropdowns: Custom styled with chevron icons, scrollable lists
- Radio groups: Large touch targets (h-10), clear visual selection state

### Tables & Lists
- Row height: h-12 minimum for buoy fleet lists
- Alternating row backgrounds for scannability
- Sticky headers on scrollable lists
- Right-aligned actions column (icon buttons)
- Compact mode: h-10 rows for dense data when panel space limited

---

## Interaction Patterns

**Map Gestures**:
- Pinch to zoom, drag to pan (standard map controls)
- Tap mark/buoy: Opens detail panel
- Long-press mark: Drag to reposition
- Two-finger rotation: Rotate entire course

**Real-time Feedback**:
- Animated progress bars for buoy movement
- ETA countdowns update every 2 seconds
- State transitions: Smooth badge color/icon changes
- Distance recalculations: Instant as marks move

**Modal Dialogs**:
- Center overlay: max-w-lg, p-8, rounded-xl
- Use for: Course shape selection, buoy assignment, confirmations
- Backdrop blur + reduced opacity map underneath

---

## Responsive Behavior (Landscape Focus)

**Target Resolution**: 1024x768 to 1920x1080 (tablet landscape)
- Side panel: w-96 (384px) at 1024px, w-[440px] at 1440px+
- Map scales fluidly to remaining space
- Top bar remains fixed h-16 across all sizes
- Font sizes: No breakpoints needed, optimized for 10-13" tablets

---

## Icons

**Library**: Heroicons (via CDN - outline for most UI, solid for active states)
- Navigation: map, user-circle, cog-6-tooth
- Buoy states: signal, battery-100/50/0, wifi, wrench
- Actions: play, pause, arrow-path, x-mark
- Weather: wind (custom rotation), arrows for current
- Course: flag (start), flag-checkered (finish), location-marker

---

## Images

**No hero images** - This is a functional tool, not marketing
**Operational Graphics**:
- Club logos: 40x40px in top bar
- Buoy icons: Use SVG graphics for different states (not photos)
- Weather icons: Vector illustrations for clarity
- All imagery secondary to data and map

---

## Accessibility

- Minimum touch target: 40x40px for all interactive elements
- High contrast text (WCAG AAA for data readouts)
- Clear focus states: 2px ring on keyboard navigation
- Status communicated via icon + text (never icon alone)
- Form labels always visible (no placeholder-only inputs)