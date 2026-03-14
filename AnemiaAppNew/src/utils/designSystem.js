export const COLORS = {
  primary: '#C62828',
  primaryDark: '#8E0000',
  primaryLight: '#FF5F52',
  secondary: '#1565C0',
  secondaryLight: '#5E92F3',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  error: '#D32F2F',
  success: '#2E7D32',
  warning: '#F57F17',
  textPrimary: '#212121',
  textSecondary: '#757575',
  textLight: '#FFFFFF',
  border: '#E0E0E0',
  divider: '#EEEEEE',
  // Severity colors
  severe: '#B71C1C',
  moderate: '#E64A19',
  mild: '#F9A825',
  normal: '#2E7D32',
};

export const FONTS = {
  h1: {fontSize: 28, fontWeight: '700', color: COLORS.textPrimary},
  h2: {fontSize: 22, fontWeight: '700', color: COLORS.textPrimary},
  h3: {fontSize: 18, fontWeight: '600', color: COLORS.textPrimary},
  h4: {fontSize: 16, fontWeight: '600', color: COLORS.textPrimary},
  body1: {fontSize: 16, fontWeight: '400', color: COLORS.textPrimary},
  body2: {fontSize: 14, fontWeight: '400', color: COLORS.textSecondary},
  caption: {fontSize: 12, fontWeight: '400', color: COLORS.textSecondary},
  button: {fontSize: 16, fontWeight: '600', color: COLORS.textLight},
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  full: 999,
};

export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
};
