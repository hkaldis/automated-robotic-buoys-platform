# Weather Insights Feature Proposal

## Executive Summary

A comprehensive wind analytics component for Race Officers that transforms raw buoy weather data into actionable sailing insights. The system identifies wind patterns, predicts shifts, and recommends course-side advantages - making race management decisions data-driven and intuitive.

---

## 1. Sailing Wind Physics Background

### 1.1 Wind Shift Types

| Pattern | Description | Racing Impact |
|---------|-------------|---------------|
| **Oscillating** | Wind swings back-and-forth around a median (5-15 min cycles) | Most common pattern; boats tack on headers |
| **Persistent** | Wind gradually moves in one direction, doesn't return | Creates clear favored side; early position wins |
| **Oscillating-Persistent** | Oscillates while median slowly drifts | Hybrid strategy required |

### 1.2 Physics Behind Shifts

**Oscillating Shifts Caused By:**
- Vertically unstable air (thermal mixing)
- Cumulus cloud activity
- Offshore breezes over heated land
- Atmospheric pressure layer mixing

**Persistent Shifts Caused By:**
- Frontal passages
- Sea breeze development
- Large-scale meteorological changes
- High/low pressure system movement

### 1.3 Key Racing Metrics

| Metric | Description | Importance |
|--------|-------------|------------|
| **Median Direction** | Average wind direction over time | Reference for shift detection |
| **Shift Range** | High-low direction spread | Indicates oscillation amplitude |
| **Shift Period** | Time between shift peaks | Predicts next shift timing |
| **Velocity Gradient** | Speed differences across buoys | Identifies favored pressure zones |
| **Trend Direction** | Persistent drift in median | Critical for strategy |

---

## 2. Data Architecture

### 2.1 New Database Table: `buoy_weather_history`

```typescript
export const buoyWeatherHistory = pgTable("buoy_weather_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  buoyId: varchar("buoy_id").notNull(),
  eventId: varchar("event_id"),
  
  // Wind data
  windDirection: real("wind_direction").notNull(),        // degrees (0-360)
  windSpeed: real("wind_speed").notNull(),                // knots
  gustSpeed: real("gust_speed"),                          // knots (peak in interval)
  
  // Current data (if sensor equipped)
  currentDirection: real("current_direction"),            // degrees
  currentSpeed: real("current_speed"),                    // knots
  
  // Metadata
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  sensorQuality: integer("sensor_quality"),               // 0-100 signal quality
  
  // Pre-computed analytics (updated periodically)
  rollingAvgDirection: real("rolling_avg_direction"),     // 5-min rolling average
  rollingAvgSpeed: real("rolling_avg_speed"),             // 5-min rolling average
});

// Index for efficient time-range queries
// CREATE INDEX idx_weather_history_buoy_time ON buoy_weather_history(buoy_id, timestamp DESC);
```

### 2.2 Analytics Cache Table: `wind_analytics`

```typescript
export const windAnalytics = pgTable("wind_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull(),
  
  // Pattern detection
  patternType: text("pattern_type"),                      // oscillating | persistent | stable
  medianDirection: real("median_direction"),
  shiftRange: real("shift_range"),                        // degrees (high-low spread)
  avgShiftPeriodMinutes: real("avg_shift_period_minutes"),
  persistentTrendDegrees: real("persistent_trend_degrees"), // degrees per hour
  
  // Velocity analysis
  avgWindSpeed: real("avg_wind_speed"),
  maxGust: real("max_gust"),
  velocityTrend: text("velocity_trend"),                  // increasing | decreasing | stable
  
  // Favored side calculation
  favoredSide: text("favored_side"),                      // left | right | neutral
  favoredConfidence: real("favored_confidence"),          // 0-1 confidence score
  
  // Timestamps
  analysisWindow: integer("analysis_window_minutes"),     // 15, 30, 60 min windows
  computedAt: timestamp("computed_at").defaultNow(),
  validUntil: timestamp("valid_until"),
});
```

### 2.3 Data Collection Strategy

| Source | Interval | Retention |
|--------|----------|-----------|
| Buoy live readings | 10 seconds | 24 hours (raw) |
| 5-minute averages | 5 minutes | 7 days |
| Hourly summaries | 1 hour | 30 days |

---

## 3. Analytics Engine

### 3.1 Pattern Detection Algorithm

```typescript
interface WindPattern {
  type: "oscillating" | "persistent" | "oscillating_persistent" | "stable";
  confidence: number;           // 0-1
  medianDirection: number;      // degrees
  shiftRange: number;           // degrees (oscillation amplitude)
  periodMinutes: number | null; // null if not oscillating
  trendDegreesPerHour: number;  // 0 if not persistent
}

// Algorithm steps:
// 1. Compute 5-min rolling averages
// 2. Find direction peaks/troughs using zero-crossing detection
// 3. Calculate oscillation period from peak-to-peak timing
// 4. Detect persistent drift using linear regression on median
// 5. Classify pattern based on thresholds:
//    - Oscillating: range > 10°, period detectable, drift < 5°/hr
//    - Persistent: drift > 10°/hr, low oscillation
//    - Oscillating-Persistent: both significant oscillation AND drift
//    - Stable: range < 10°, drift < 5°/hr
```

### 3.2 Shift Prediction

```typescript
interface ShiftPrediction {
  expectedDirection: number;       // next shift direction (left/right)
  expectedTimeMinutes: number;     // time until shift
  magnitude: number;               // expected degrees of shift
  confidence: number;              // 0-1
}

// Based on:
// - Detected oscillation period
// - Current position in cycle
// - Persistent trend overlay
// - Cross-buoy correlation (if multiple buoys have sensors)
```

### 3.3 Favored Side Calculation

The system determines which side of the course is advantageous:

```typescript
interface FavoredSideAnalysis {
  side: "left" | "right" | "neutral";
  reason: string;
  confidence: number;
  factors: {
    moreWind: "left" | "right" | "equal";      // which side has more pressure
    nextShift: "left" | "right" | "unknown";   // expected shift direction
    persistent: "left" | "right" | "none";     // persistent trend direction
  };
}

// Calculation considers:
// 1. Wind velocity gradient across buoys
// 2. Expected shift direction and timing
// 3. Persistent trend direction
// 4. Current position vs course geometry
```

---

## 4. UX Design Proposal

### 4.1 Entry Point: FloatingActionBar

Add a **Wind Insights** button to the FloatingActionBar:

```
┌─────────────────────────────────────────────────────────────┐
│ [Status] │ [Align] │ [Deploy] │ [Hold] │ [Wind📊] │ [Undo] │
└─────────────────────────────────────────────────────────────┘
```

- **Icon**: `BarChart3` or `TrendingUp` from Lucide
- **Touch target**: 56px minimum (wet-finger compliant)
- **Badge indicator**: Shows alert dot when shift detected

### 4.2 Wind Insights Panel

Opens as a **Sheet** from the right side (460px width on tablet):

```
┌──────────────────────────────────────────────────────────┐
│  Wind Insights                              [×] Close    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │           CURRENT CONDITIONS CARD                   │ │
│  │  ┌──────────────┐  ┌──────────────┐                │ │
│  │  │   Wind Dir   │  │   Wind Spd   │                │ │
│  │  │    275°      │  │   12.3 kts   │                │ │
│  │  │   ↗ +5°      │  │    ↑ +2      │                │ │
│  │  └──────────────┘  └──────────────┘                │ │
│  │                                                     │ │
│  │  Pattern: OSCILLATING (±15°, ~8 min period)       │ │
│  │                                                     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │           FAVORED SIDE INDICATOR                    │ │
│  │                                                     │ │
│  │     LEFT ◀━━━━━●━━━━━━━━▶ RIGHT                   │ │
│  │            (65% confidence)                        │ │
│  │                                                     │ │
│  │  Reason: More wind pressure on left               │ │
│  │  Next shift expected: RIGHT in ~4 min             │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │           TIMELINE CHART                            │ │
│  │  [15m] [30m] [60m] [All]        Source: [Buoy ▾]   │ │
│  │                                                     │ │
│  │  Direction ────────────────────────────────         │ │
│  │  290° ┤                    ╱╲                       │ │
│  │  280° ┤        ╱╲        ╱  ╲       ╱              │ │
│  │  270° ┼━━━━━╱━━╲━━━━━╱━━━━╲━━━╱━━━median          │ │
│  │  260° ┤  ╱      ╲  ╱        ╲╱                     │ │
│  │  250° ┤╱         ╲╱                                │ │
│  │       └────┬────┬────┬────┬────┬────▶             │ │
│  │          -30  -20  -10   0   Now                   │ │
│  │                                                     │ │
│  │  Speed ─────────────────────────────────           │ │
│  │  15 ┤              ●●●●                           │ │
│  │  12 ┼━━━━━━━━━━━━━━━━━━━━━━━━avg                  │ │
│  │   9 ┤  ●●●●●                      ●●●●●           │ │
│  │     └────────────────────────────────▶            │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │           SHIFT HISTORY TABLE                       │ │
│  │                                                     │ │
│  │  Time      Direction   Change   Type               │ │
│  │  ─────────────────────────────────────             │ │
│  │  14:32     285°        +12°     Header             │ │
│  │  14:24     273°        -8°      Lift               │ │
│  │  14:17     281°        +9°      Header             │ │
│  │  14:08     272°        —        Baseline           │ │
│  │                                                     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │           PER-BUOY COMPARISON                       │ │
│  │                                                     │ │
│  │  Buoy      Dir    Speed   Trend                    │ │
│  │  ─────────────────────────────────                 │ │
│  │  Mark 1    278°   12.1    ↗ building               │ │
│  │  Mark 3    275°   11.8    → steady                 │ │
│  │  Pin       281°   13.2    ↗ building               │ │
│  │                                                     │ │
│  │  Delta: Pin has 1.4 kts more wind than Mark 3     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 4.3 Component Breakdown

#### A. Current Conditions Card
- **Primary KPIs**: Wind direction & speed (large, prominent)
- **Delta indicators**: Show change from 5-min average
- **Pattern badge**: Oscillating/Persistent/Stable with parameters

#### B. Favored Side Indicator
- **Visual slider**: Shows left/right bias with position marker
- **Confidence level**: Percentage confidence in recommendation
- **Reason text**: Simple explanation (1-2 lines)
- **Prediction**: Next expected shift direction and timing

#### C. Timeline Chart
- **Dual-axis chart**: Direction (line) + Speed (area/bars)
- **Median line**: Dashed reference line for direction
- **Shift annotations**: Vertical markers for detected shifts
- **Time controls**: 15m, 30m, 60m, All buttons
- **Buoy selector**: Dropdown to switch between buoys
- **Touch-friendly**: Large hit areas, pinch-to-zoom

#### D. Shift History Table
- **Scrollable list**: Recent shifts with timestamps
- **Color coding**: Headers (amber), Lifts (green)
- **Magnitude**: Degrees of change
- **Hover/tap details**: Show additional context

#### E. Per-Buoy Comparison
- **Side-by-side data**: All weather-equipped buoys
- **Trend indicators**: Arrow icons (↗ ↘ →)
- **Delta highlight**: Shows wind pressure differences
- **Tap to select**: Opens buoy on map

---

## 5. Enhanced Features

### 5.1 Shift Alert System

**Real-time notifications when significant shifts detected:**

```typescript
interface ShiftAlert {
  type: "header" | "lift" | "pressure_change" | "pattern_change";
  severity: "info" | "warning" | "critical";
  message: string;
  timestamp: Date;
  actionable: boolean;
  suggestedAction?: string;
}
```

**Alert Examples:**
- "Wind shifted 15° right - LEFT side now favored"
- "Wind building from 8 to 14 kts - conditions changing"
- "Pattern changed from oscillating to persistent LEFT"

**Display**: Toast notification + badge on Wind Insights button

### 5.2 Course Overlay Visualization

On the map, overlay a **wind advantage gradient**:

```
        ┌─ WINDWARD MARK ─┐
       /                   \
      /   🟢 FAVORED        \
     /      (more wind)      \
    /                         \
   /           🟡              \
  /         NEUTRAL             \
 /                               \
/  🔴 LESS FAVORABLE              \
───────── START LINE ─────────────
```

- **Gradient shading**: Green (favored) → Yellow → Red (less favored)
- **Toggleable**: On/off via settings or quick toggle
- **Updates live**: Recalculates as wind data changes

### 5.3 Pre-Race Wind Recording

**Structured data collection before race start:**

```
┌──────────────────────────────────────────────────────────┐
│  Pre-Race Wind Survey                        [Complete]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Recording wind for: 45 minutes                         │
│  Samples collected: 27                                   │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  DETECTED PATTERN                                  │ │
│  │                                                    │ │
│  │  Type: Oscillating                                │ │
│  │  Range: 258° - 288° (30° spread)                  │ │
│  │  Median: 273°                                      │ │
│  │  Period: ~7-8 minutes                              │ │
│  │                                                    │ │
│  │  Confidence: HIGH (based on 6 complete cycles)    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  STRATEGY RECOMMENDATION                          │ │
│  │                                                    │ │
│  │  • Tack on headers back to median (273°)          │ │
│  │  • Stay in middle of course                       │ │
│  │  • Avoid laylines early                           │ │
│  │  • Next expected right shift in ~3 min            │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  [Save to Event Notes]        [Share with Competitors]  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 5.4 Historical Pattern Database

For clubs with frequent racing at the same venue:

- **Pattern library**: Common wind patterns for the location
- **Condition matching**: "Today looks like Pattern B (sea breeze oscillating)"
- **Success correlation**: Link patterns to past race outcomes
- **Seasonal trends**: Track how patterns change through the year

---

## 6. UX Optimizations for Wet-Finger Use

### 6.1 Touch Targets

| Element | Minimum Size | Justification |
|---------|--------------|---------------|
| Panel buttons | 56px | Critical actions |
| Timeline controls | 48px | Frequent interaction |
| Chart interaction | 44px | Touch scrubbing |
| Table rows | 56px row height | Easy selection |

### 6.2 Gesture Support

| Gesture | Action |
|---------|--------|
| Swipe left/right | Navigate timeline |
| Pinch | Zoom timeline |
| Long-press on chart | Show data tooltip |
| Tap buoy row | Select buoy on map |
| Pull-to-refresh | Update data |

### 6.3 Glance-able Design

- **5-second rule**: Critical info visible immediately
- **Large numbers**: Direction/speed prominently displayed
- **Color coding**: Consistent semantic colors
- **Icon + text**: For accessibility and quick recognition
- **Progressive disclosure**: Details on demand

### 6.4 Offline Considerations

- **Cache recent data**: 2 hours of history stored locally
- **Graceful degradation**: Show last known values with timestamp
- **Sync indicator**: Clear status when connection restored

---

## 7. Component API Design

### 7.1 WeatherInsightsPanel Props

```typescript
interface WeatherInsightsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buoys: Buoy[];
  marks: Mark[];
  eventId: string;
  windDirection?: number;
  windSpeed?: number;
}
```

### 7.2 Shared Hooks

```typescript
// Weather history data
function useWeatherHistory(buoyId: string, timeRangeMinutes: number): {
  data: WeatherReading[];
  isLoading: boolean;
}

// Wind analytics (computed patterns)
function useWindAnalytics(eventId: string): {
  pattern: WindPattern;
  favoredSide: FavoredSideAnalysis;
  shifts: ShiftEvent[];
  predictions: ShiftPrediction[];
}

// Shift alerts
function useShiftAlerts(eventId: string): {
  alerts: ShiftAlert[];
  dismissAlert: (id: string) => void;
}
```

---

## 8. Implementation Phases

### Phase 1: Data Foundation (1-2 weeks)
- [ ] Create `buoy_weather_history` table
- [ ] Implement data collection (10-second sampling)
- [ ] Add API endpoints for history queries
- [ ] Demo mode: Simulate realistic wind patterns

### Phase 2: Basic Insights Panel (1 week)
- [ ] Create WeatherInsightsPanel component
- [ ] Add FloatingActionBar button
- [ ] Implement current conditions card
- [ ] Build timeline chart (direction + speed)

### Phase 3: Pattern Detection (1-2 weeks)
- [ ] Implement oscillation detection algorithm
- [ ] Add persistent drift detection
- [ ] Create pattern classification logic
- [ ] Display pattern type and parameters

### Phase 4: Favored Side Calculator (1 week)
- [ ] Build cross-buoy velocity comparison
- [ ] Implement shift prediction algorithm
- [ ] Create favored side visualization
- [ ] Add confidence scoring

### Phase 5: Alerts & Polish (1 week)
- [ ] Implement shift alert system
- [ ] Add map overlay visualization
- [ ] Optimize for performance
- [ ] Add offline support

---

## 9. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Panel load time | < 500ms | Performance monitoring |
| Pattern detection accuracy | > 80% | Manual validation |
| Touch target compliance | 100% | UX audit |
| User engagement | > 50% sessions | Analytics |

---

## 10. Dependencies

### Required
- Recharts (already installed) - for timeline visualization
- TanStack Query (already installed) - for data fetching
- date-fns (already installed) - for timestamp handling

### Optional Additions
- None required - existing stack sufficient

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Buoys lack weather sensors | No data | Show empty state with explanation |
| Too much data (performance) | Slow UI | Use 5-min averages, pagination |
| Pattern detection errors | Bad advice | Show confidence levels, allow manual override |
| Complex UI | Hard to use | Focus on glance-able design, progressive disclosure |

---

## Summary

The Weather Insights feature transforms raw buoy data into actionable race management intelligence. By combining sailing physics knowledge with modern UX practices, race officers can make data-driven decisions about course setup and management while maintaining the "wet-finger" usability required for at-sea operation.

**Key differentiators:**
1. **Physics-based pattern detection** (oscillating vs persistent shifts)
2. **Favored side recommendations** with confidence scoring
3. **Shift predictions** based on detected patterns
4. **Multi-buoy comparison** for velocity gradients
5. **Glance-able design** optimized for race officers at sea
