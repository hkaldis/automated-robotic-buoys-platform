/**
 * ALCONMARKS DESIGN SYSTEM
 * ========================
 * 
 * A rule-based, implementation-ready design framework for the
 * Automated Robotic Buoys Platform PWA.
 * 
 * DESIGN PHILOSOPHY: Simplicity for wet fingers at sea
 * - Large touch targets (minimum 48px)
 * - High contrast for outdoor visibility
 * - Clear visual hierarchy
 * - Minimal cognitive load
 * 
 * @version 1.0.0
 */

// =============================================================================
// SECTION 1: VISUAL IDENTITY
// =============================================================================

export const VISUAL_IDENTITY = {
  /**
   * THEME: Maritime Professional
   * 
   * The application uses a nautical blue-grey palette that evokes
   * professionalism, trust, and maritime environments. The design
   * prioritizes clarity and functionality over decoration.
   */
  theme: "maritime-professional",
  
  /**
   * EMOTIONAL TONE
   * - Professional: Clean, organized, purposeful
   * - Reliable: Consistent, predictable behavior
   * - Calm: Muted palette, avoiding visual noise
   * - Actionable: Clear affordances for interaction
   */
  tone: ["professional", "reliable", "calm", "actionable"],
  
  /**
   * BASE HUE: 210 (Maritime Blue)
   * All neutral colors derive from this hue to create cohesion
   */
  baseHue: 210,
} as const;

// =============================================================================
// SECTION 2: COLOR SYSTEM
// =============================================================================

/**
 * CORE COLOR PALETTE
 * 
 * All colors use HSL format: "H S% L%"
 * Never use rgb() or hex directly in components
 */
export const COLOR_PALETTE = {
  // -------------------------------------------------------------------------
  // PRIMARY COLORS
  // -------------------------------------------------------------------------
  primary: {
    /**
     * PRIMARY: Action color for CTAs, links, active states
     * Use for: Primary buttons, links, focus rings, selected items
     * Never use for: Body text, backgrounds, decorative elements
     */
    light: "210 85% 42%",
    dark: "210 85% 48%",
    foreground: { light: "210 20% 98%", dark: "210 10% 98%" },
  },

  // -------------------------------------------------------------------------
  // SECONDARY COLORS
  // -------------------------------------------------------------------------
  secondary: {
    /**
     * SECONDARY: Subdued action color
     * Use for: Secondary buttons, less prominent actions
     * Never use for: Primary CTAs
     */
    light: "210 8% 88%",
    dark: "210 8% 20%",
    foreground: { light: "210 6% 16%", dark: "210 4% 86%" },
  },

  // -------------------------------------------------------------------------
  // ACCENT COLORS
  // -------------------------------------------------------------------------
  accent: {
    /**
     * ACCENT: Subtle highlight color
     * Use for: Hover states, selected sidebar items, subtle emphasis
     * Never use for: Primary actions
     */
    light: "210 12% 92%",
    dark: "210 10% 16%",
    foreground: { light: "210 6% 18%", dark: "210 4% 84%" },
  },

  // -------------------------------------------------------------------------
  // NEUTRAL COLORS
  // -------------------------------------------------------------------------
  neutral: {
    /**
     * BACKGROUND: Page background
     */
    background: { light: "210 4% 98%", dark: "210 6% 8%" },
    
    /**
     * FOREGROUND: Primary text color
     */
    foreground: { light: "210 6% 12%", dark: "210 4% 94%" },
    
    /**
     * MUTED: Reduced emphasis
     * Use for: Secondary text, placeholder text, disabled states
     */
    muted: { light: "210 8% 90%", dark: "210 8% 18%" },
    mutedForeground: { light: "210 6% 24%", dark: "210 4% 72%" },
    
    /**
     * BORDER: Default border color
     */
    border: { light: "210 4% 92%", dark: "210 6% 18%" },
    
    /**
     * CARD: Elevated surface
     */
    card: { light: "210 4% 96%", dark: "210 6% 10%" },
    cardForeground: { light: "210 6% 14%", dark: "210 4% 92%" },
  },
} as const;

// =============================================================================
// SECTION 3: SEMANTIC COLORS (STATUS INDICATORS)
// =============================================================================

/**
 * SEMANTIC COLOR RULES
 * 
 * These colors have SPECIFIC meanings and must ONLY be used
 * for their designated purposes. Never mix semantic colors.
 */
export const SEMANTIC_COLORS = {
  // -------------------------------------------------------------------------
  // SUCCESS (Green)
  // -------------------------------------------------------------------------
  success: {
    /**
     * SUCCESS: Positive outcomes, operational status
     * Use for: Loitering/On-Station buoys, successful operations, confirmations
     * Tailwind: text-green-500, bg-green-500, bg-green-50
     */
    hex: "#22c55e",
    tailwind: {
      text: "text-green-500",
      bg: "bg-green-500",
      bgLight: "bg-green-50 dark:bg-green-900/20",
      ring: "ring-green-500",
    },
    usage: ["Buoy state: Loitering/On-Station", "Successful save/create", "Online status"],
  },

  // -------------------------------------------------------------------------
  // WARNING (Orange)
  // -------------------------------------------------------------------------
  warning: {
    /**
     * WARNING: Action in progress, attention needed
     * Use for: Moving buoys, pending states, caution messages
     * Tailwind: text-orange-500, bg-orange-500, bg-orange-50
     */
    hex: "#f97316",
    tailwind: {
      text: "text-orange-500",
      bg: "bg-orange-500",
      bgLight: "bg-orange-50 dark:bg-orange-900/20",
      ring: "ring-orange-500",
    },
    usage: ["Buoy state: Moving", "ETA displays", "Pending operations"],
  },

  // -------------------------------------------------------------------------
  // INFO (Blue)
  // -------------------------------------------------------------------------
  info: {
    /**
     * INFO: Neutral informational states
     * Use for: Idle buoys, informational messages, neutral status
     * Tailwind: text-blue-500, bg-blue-500, bg-blue-50
     */
    hex: "#3b82f6",
    tailwind: {
      text: "text-blue-500",
      bg: "bg-blue-500",
      bgLight: "bg-blue-50 dark:bg-blue-900/20",
      ring: "ring-blue-500",
    },
    usage: ["Buoy state: Idle", "Informational tooltips", "Help text"],
  },

  // -------------------------------------------------------------------------
  // ERROR (Red)
  // -------------------------------------------------------------------------
  error: {
    /**
     * ERROR: Critical failures, destructive actions
     * Use for: Fault state, validation errors, delete confirmations
     * Tailwind: text-red-500, bg-red-500, bg-red-50 OR text-destructive
     */
    hex: "#ef4444",
    tailwind: {
      text: "text-red-500",
      bg: "bg-red-500",
      bgLight: "bg-red-50 dark:bg-red-900/20",
      ring: "ring-red-500",
      semantic: "text-destructive bg-destructive",
    },
    usage: ["Buoy state: Fault", "Validation errors", "Delete warnings"],
  },

  // -------------------------------------------------------------------------
  // ALERT (Purple)
  // -------------------------------------------------------------------------
  alert: {
    /**
     * ALERT: Resource warning, secondary alert
     * Use for: Low battery status (< 20%), resource warnings
     * Tailwind: text-purple-500, bg-purple-500, bg-purple-50
     * 
     * SPECIAL: Can be combined with other states via ring overlay
     */
    hex: "#a855f7",
    tailwind: {
      text: "text-purple-500",
      bg: "bg-purple-500",
      bgLight: "bg-purple-50 dark:bg-purple-900/20",
      ring: "ring-purple-500",
      dashedRing: "ring-2 ring-purple-500 ring-dashed",
    },
    usage: ["Low battery (< 20%)", "Resource warnings"],
    combinable: true, // Can overlay on other states
  },

  // -------------------------------------------------------------------------
  // DISABLED
  // -------------------------------------------------------------------------
  disabled: {
    /**
     * DISABLED: Unavailable, inactive elements
     * Use for: Disabled buttons, unavailable options
     * Apply: opacity-50 + pointer-events-none
     */
    tailwind: {
      modifier: "disabled:opacity-50 disabled:pointer-events-none",
      text: "text-muted-foreground",
    },
    usage: ["Disabled controls", "Unavailable options"],
  },
} as const;

// =============================================================================
// SECTION 4: BUOY STATE COLORS (DOMAIN-SPECIFIC)
// =============================================================================

/**
 * BUOY STATE COLOR MAPPING
 * 
 * These are the ONLY colors to use for buoy states.
 * All components MUST use these exact values.
 */
export const BUOY_STATE_COLORS = {
  loitering: {
    state: "loitering",
    label: "Loitering",
    color: SEMANTIC_COLORS.success,
    description: "Buoy is on station and maintaining position",
  },
  moving_to_target: {
    state: "moving_to_target",
    label: "Moving",
    color: SEMANTIC_COLORS.warning,
    description: "Buoy is transiting to target position",
  },
  idle: {
    state: "idle",
    label: "Idle",
    color: SEMANTIC_COLORS.info,
    description: "Buoy is stationary, awaiting commands",
  },
  fault: {
    state: "fault",
    label: "Fault",
    color: SEMANTIC_COLORS.error,
    description: "Buoy has encountered an error",
  },
  unavailable: {
    state: "unavailable",
    label: "Unavailable",
    color: SEMANTIC_COLORS.error,
    description: "Buoy is offline or unreachable",
  },
  low_battery: {
    state: "low_battery",
    label: "Low Batt",
    color: SEMANTIC_COLORS.alert,
    threshold: 20, // percentage
    description: "Battery below 20% - shown as overlay ring",
    isOverlay: true, // Combines with primary state
  },
} as const;

// =============================================================================
// SECTION 5: UI STATE COLORS (INTERACTION STATES)
// =============================================================================

/**
 * INTERACTION STATE RULES
 * 
 * All interactive elements MUST follow these state transitions.
 * Use the elevation system (hover-elevate, active-elevate-2) instead
 * of manually specifying hover/active colors.
 */
export const INTERACTION_STATES = {
  /**
   * DEFAULT STATE
   * The resting state of an element
   */
  default: {
    rule: "Use component's base variant color",
    example: "bg-primary text-primary-foreground",
  },

  /**
   * HOVER STATE
   * When cursor/finger approaches element
   * 
   * RULE: NEVER manually specify hover colors (hover:bg-*)
   * ALWAYS use the hover-elevate utility class
   */
  hover: {
    rule: "Apply hover-elevate class - NEVER hover:bg-*",
    utility: "hover-elevate",
    effect: "Subtle brightness increase via --elevate-1 overlay",
    forbidden: ["hover:bg-*", "hover:text-*", "hover:border-*"],
  },

  /**
   * ACTIVE/PRESSED STATE
   * During click/tap interaction
   * 
   * RULE: NEVER manually specify active colors
   * ALWAYS use the active-elevate-2 utility class
   */
  active: {
    rule: "Apply active-elevate-2 class - NEVER active:bg-*",
    utility: "active-elevate-2",
    effect: "More pronounced brightness via --elevate-2 overlay",
    forbidden: ["active:bg-*", "active:text-*"],
  },

  /**
   * FOCUS STATE
   * For keyboard navigation accessibility
   */
  focus: {
    rule: "Use focus-visible:ring-1 focus-visible:ring-ring",
    utility: "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  },

  /**
   * DISABLED STATE
   * Unavailable for interaction
   */
  disabled: {
    rule: "Apply opacity-50 and pointer-events-none",
    utility: "disabled:pointer-events-none disabled:opacity-50",
  },

  /**
   * SELECTED/TOGGLED STATE
   * For toggle buttons, selected items
   */
  selected: {
    rule: "Use toggle-elevate + toggle-elevated classes",
    utilities: ["toggle-elevate", "toggle-elevated"],
    dataAttribute: "data-[state=on]:toggle-elevated",
  },
} as const;

// =============================================================================
// SECTION 6: COMPONENT VARIANT RULES
// =============================================================================

/**
 * BUTTON VARIANTS
 * Use these exact variants - do not create custom button styles
 */
export const BUTTON_VARIANTS = {
  /**
   * DEFAULT: Primary actions
   * Use for: Submit, Save, Confirm, Primary CTAs
   */
  default: {
    classes: "bg-primary text-primary-foreground border border-primary-border",
    usage: ["Primary action", "Form submit", "Confirm dialogs"],
  },

  /**
   * SECONDARY: Secondary actions
   * Use for: Cancel, Back, Less important actions
   */
  secondary: {
    classes: "bg-secondary text-secondary-foreground border-secondary-border",
    usage: ["Secondary action", "Cancel button", "Alternative options"],
  },

  /**
   * OUTLINE: Subtle actions
   * Use for: Tertiary actions, toolbar buttons
   */
  outline: {
    classes: "border [border-color:var(--button-outline)]",
    usage: ["Tertiary action", "Toolbar", "Filter toggles"],
  },

  /**
   * GHOST: Minimal footprint
   * Use for: Icon buttons, sidebar items, inline actions
   */
  ghost: {
    classes: "border border-transparent",
    usage: ["Icon buttons", "Sidebar navigation", "Inline actions"],
  },

  /**
   * DESTRUCTIVE: Dangerous actions
   * Use for: Delete, Remove, Destructive operations
   */
  destructive: {
    classes: "bg-destructive text-destructive-foreground border-destructive-border",
    usage: ["Delete", "Remove", "Irreversible actions"],
  },
} as const;

/**
 * BUTTON SIZES
 * Use size prop - NEVER manually set h-* or px-* on buttons
 */
export const BUTTON_SIZES = {
  default: { height: "min-h-9", padding: "px-4 py-2" },
  sm: { height: "min-h-8", padding: "px-3" },
  lg: { height: "min-h-10", padding: "px-8" },
  icon: { height: "h-9", width: "w-9" },
} as const;

// =============================================================================
// SECTION 7: SPACING SYSTEM
// =============================================================================

/**
 * SPACING SCALE
 * Use Tailwind spacing utilities consistently
 */
export const SPACING = {
  /**
   * Touch targets: Minimum 48px (12 in Tailwind scale)
   */
  touchTarget: {
    min: "min-h-12 min-w-12",
    tailwindValue: 12,
    pixels: 48,
  },

  /**
   * Standard spacing levels
   */
  scale: {
    xs: 1,    // 4px - tight spacing
    sm: 2,    // 8px - compact elements
    md: 4,    // 16px - default spacing
    lg: 6,    // 24px - section spacing
    xl: 8,    // 32px - large sections
    "2xl": 12, // 48px - major sections
  },

  /**
   * Component internal padding
   */
  componentPadding: {
    card: "p-4",      // 16px
    button: "px-4 py-2",
    badge: "px-2.5 py-0.5",
    input: "px-3 py-2",
  },
} as const;

// =============================================================================
// SECTION 8: TYPOGRAPHY RULES
// =============================================================================

export const TYPOGRAPHY = {
  /**
   * FONT FAMILIES
   */
  families: {
    sans: "Inter, sans-serif",
    mono: "JetBrains Mono, monospace",
    serif: "Georgia, serif",
  },

  /**
   * TEXT HIERARCHY
   */
  hierarchy: {
    // Primary text: Default foreground
    primary: "text-foreground",
    // Secondary text: Reduced emphasis
    secondary: "text-muted-foreground",
    // Tertiary text: Least important
    tertiary: "text-muted-foreground/70",
  },

  /**
   * NUMERIC/DATA DISPLAY
   * Always use monospace for numbers, coordinates, times
   */
  numeric: {
    classes: "font-mono tabular-nums",
    usage: ["Coordinates", "Battery %", "ETA", "Speed", "Bearings"],
  },
} as const;

// =============================================================================
// SECTION 9: GLOBAL THEMING CONSTRAINTS
// =============================================================================

/**
 * THEMING RULES
 * These constraints MUST be followed to prevent inconsistent styling
 */
export const THEMING_CONSTRAINTS = {
  // -------------------------------------------------------------------------
  // FORBIDDEN PATTERNS
  // -------------------------------------------------------------------------
  forbidden: [
    // Never use arbitrary colors
    { pattern: "bg-[#...]", reason: "Use semantic color tokens" },
    { pattern: "text-[#...]", reason: "Use semantic color tokens" },
    
    // Never manually specify hover/active states
    { pattern: "hover:bg-*", reason: "Use hover-elevate utility" },
    { pattern: "active:bg-*", reason: "Use active-elevate-2 utility" },
    
    // Never use opacity for semantic meaning
    { pattern: "bg-*/[percentage]", reason: "Use defined opacity tokens" },
    
    // Never set dimensions on buttons
    { pattern: "h-* on Button", reason: "Use size prop (default, sm, lg, icon)" },
    { pattern: "w-* on Button", reason: "Use size prop for icon buttons only" },
    
    // Never nest cards
    { pattern: "Card inside Card", reason: "Use single-level card hierarchy" },
    
    // Never mix semantic colors
    { pattern: "bg-primary + border-accent", reason: "Use matching color families" },
  ],

  // -------------------------------------------------------------------------
  // REQUIRED PATTERNS
  // -------------------------------------------------------------------------
  required: [
    // All interactive elements need interaction states
    { pattern: "Interactive element", rule: "Must have hover-elevate active-elevate-2" },
    
    // All buttons need focus state
    { pattern: "Button/Link", rule: "Must have focus-visible:ring-1 focus-visible:ring-ring" },
    
    // Rounded elements need padding from container edges
    { pattern: "Rounded element in container", rule: "Container must have padding" },
    
    // Numeric data uses monospace
    { pattern: "Number display", rule: "Must use font-mono" },
    
    // Touch targets
    { pattern: "Interactive element", rule: "Minimum 48px touch target" },
  ],

  // -------------------------------------------------------------------------
  // DARK MODE RULES
  // -------------------------------------------------------------------------
  darkMode: {
    strategy: "class-based (.dark)",
    rule: "All color tokens automatically adapt - no manual dark: prefixes needed for semantic tokens",
    exception: "Only use dark: prefix for Tailwind literal colors (e.g., bg-green-50 dark:bg-green-900/20)",
  },

  // -------------------------------------------------------------------------
  // BORDER RULES
  // -------------------------------------------------------------------------
  borders: {
    radius: {
      default: "rounded-md",
      rule: "Never use large radii except for circles/pills",
    },
    color: {
      rule: "Use border token matching background (primary-border, secondary-border, etc.)",
    },
    partial: {
      forbidden: true,
      reason: "Never apply border to 1-3 sides of rounded elements",
    },
  },
} as const;

// =============================================================================
// SECTION 10: MAP-SPECIFIC COLORS
// =============================================================================

/**
 * MAP VISUALIZATION COLORS
 * Used for LeafletMap buoy markers and course elements
 */
export const MAP_COLORS = {
  buoyMarkers: {
    loitering: { fill: "#22c55e", stroke: "#16a34a" },
    moving: { fill: "#f97316", stroke: "#ea580c" },
    idle: { fill: "#3b82f6", stroke: "#2563eb" },
    fault: { fill: "#ef4444", stroke: "#dc2626" },
    lowBattery: { 
      ring: "#a855f7", 
      dashArray: "4 2",
      isOverlay: true,
    },
  },
  courseElements: {
    leg: "#3b82f6",
    startLine: "#22c55e",
    finishLine: "#ef4444",
    mark: "#3b82f6",
    selectedMark: "#f97316",
  },
  wind: {
    arrow: "#60a5fa",
    sector: "rgba(96, 165, 250, 0.2)",
  },
} as const;

// =============================================================================
// SECTION 11: HELPER FUNCTIONS
// =============================================================================

/**
 * Get the correct color classes for a buoy state
 */
export function getBuoyStateClasses(state: string, battery?: number) {
  const stateConfig = BUOY_STATE_COLORS[state as keyof typeof BUOY_STATE_COLORS];
  const isLowBattery = battery !== undefined && battery < BUOY_STATE_COLORS.low_battery.threshold;
  
  return {
    text: stateConfig?.color?.tailwind?.text ?? "text-muted-foreground",
    bg: stateConfig?.color?.tailwind?.bg ?? "bg-muted",
    bgLight: stateConfig?.color?.tailwind?.bgLight ?? "bg-muted/50",
    ring: isLowBattery ? SEMANTIC_COLORS.alert.tailwind.dashedRing : undefined,
  };
}

/**
 * Get battery color class based on percentage
 */
export function getBatteryColorClass(percentage: number): string {
  if (percentage < 20) return SEMANTIC_COLORS.alert.tailwind.text;
  if (percentage < 50) return "text-yellow-500";
  return SEMANTIC_COLORS.success.tailwind.text;
}
