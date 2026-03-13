// ============================================================
// HEMAVIEW — Design System Tokens
// Medical-grade color system with WCAG AA accessibility
// ============================================================

export const Colors = {
  // Primary — Deep Teal (trust, medicine, clarity)
  primary: {
    50:  '#E6F4F4',
    100: '#C0E4E4',
    200: '#96D1D1',
    300: '#6CBEBE',
    400: '#4DAFAF',
    500: '#2E9FA0',   // Brand primary
    600: '#27898A',
    700: '#1D6E6F',
    800: '#145455',
    900: '#0A3A3B',
  },

  // Accent — Warm Crimson (hemoglobin, blood, life)
  accent: {
    50:  '#FEF0F0',
    100: '#FDDADA',
    200: '#FAB3B3',
    300: '#F78080',
    400: '#F45858',
    500: '#E63946',   // Brand accent
    600: '#CC2F3B',
    700: '#A82430',
    800: '#841A25',
    900: '#61101A',
  },

  // Severity Classification Colors
  severity: {
    normal:   { bg: '#E8F5E9', text: '#2E7D32', border: '#4CAF50', dot: '#43A047' },
    mild:     { bg: '#FFF8E1', text: '#F57F17', border: '#FFB300', dot: '#FFB300' },
    moderate: { bg: '#FFF3E0', text: '#E65100', border: '#FF6D00', dot: '#FF6D00' },
    severe:   { bg: '#FFEBEE', text: '#B71C1C', border: '#D32F2F', dot: '#D32F2F' },
  },

  // Neutrals
  neutral: {
    0:   '#FFFFFF',
    50:  '#F8FAFB',
    100: '#F1F4F6',
    150: '#E8ECEF',
    200: '#DDE3E8',
    300: '#C5CDD5',
    400: '#9AAAB6',
    500: '#6E8493',
    600: '#506070',
    700: '#38484F',
    800: '#243035',
    900: '#141C20',
    1000:'#080D0F',
  },

  // Backgrounds
  bg: {
    primary:   '#F2F7F8',
    secondary: '#FFFFFF',
    card:      '#FFFFFF',
    elevated:  '#FFFFFF',
    dark:      '#0F1E21',
    darkCard:  '#162428',
  },

  // Status
  success: '#2ECC71',
  warning: '#F39C12',
  error:   '#E74C3C',
  info:    '#3498DB',

  // Gradients (as arrays for LinearGradient)
  gradients: {
    primary:    ['#1A6B6C', '#2E9FA0', '#4DAFAF'],
    accent:     ['#C0392B', '#E63946', '#F45858'],
    dark:       ['#0A2A2D', '#0F1E21', '#162428'],
    cardShimmer:['#F1F4F6', '#E8ECEF', '#F1F4F6'],
    heroCard:   ['#0D3D40', '#1A6B6C'],
    severeBg:   ['#FFEBEE', '#FFF5F5'],
    normalBg:   ['#E8F5E9', '#F1FFF2'],
  },
};

export const Typography = {
  // Font Families
  fonts: {
    heading:  'System',   // Will use platform default serif on device
    body:     'System',
    mono:     'Courier',
    label:    'System',
  },

  // Font Sizes (sp — scale-independent pixels)
  size: {
    xs:   10,
    sm:   12,
    base: 14,
    md:   16,
    lg:   18,
    xl:   20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 38,
    '6xl': 46,
  },

  // Font Weights
  weight: {
    light:    '300',
    regular:  '400',
    medium:   '500',
    semibold: '600',
    bold:     '700',
    extrabold:'800',
    black:    '900',
  },

  // Line Heights
  lineHeight: {
    tight:   1.2,
    snug:    1.35,
    normal:  1.5,
    relaxed: 1.65,
    loose:   2.0,
  },

  // Letter Spacing
  tracking: {
    tighter: -0.8,
    tight:   -0.4,
    normal:  0,
    wide:    0.4,
    wider:   0.8,
    widest:  1.6,
  },
};

export const Spacing = {
  0:   0,
  1:   4,
  2:   8,
  3:   12,
  4:   16,
  5:   20,
  6:   24,
  7:   28,
  8:   32,
  9:   36,
  10:  40,
  12:  48,
  14:  56,
  16:  64,
  20:  80,
  24:  96,
  28: 112,
  32: 128,
};

export const Radius = {
  none: 0,
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
};

export const Shadow = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 10,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  primary: {
    shadowColor: '#2E9FA0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.30,
    shadowRadius: 16,
    elevation: 10,
  },
  accent: {
    shadowColor: '#E63946',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const Animation = {
  duration: {
    instant:  100,
    fast:     200,
    normal:   300,
    slow:     500,
    slower:   800,
    slowest: 1200,
  },
  easing: {
    easeIn:    'ease-in',
    easeOut:   'ease-out',
    easeInOut: 'ease-in-out',
    spring:    'spring',
  },
};

export default { Colors, Typography, Spacing, Radius, Shadow, Animation };
