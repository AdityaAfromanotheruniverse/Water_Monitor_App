// theme.js — design tokens from the "Water Monitor App — UI/UX" Figma file.
// Every screen should import from here so a look change is a one-file edit.

export const colors = {
  // backgrounds
  bg: '#000000',
  navy: '#0A0E1A',
  card: '#16181D',
  surface: '#1E2128',
  line: '#2E323C',

  // text
  text: '#FFFFFF',
  textBlue: '#8FB4FF',
  muted: '#5C6B8A',

  // accents / status
  blue: '#4A90FF',
  red: '#FF3B30',
  redDim: '#3A1215',
  amber: '#FFB020',
  amberDim: '#3A2A0A',
  green: '#34D399',
  greenDim: '#0D2B21',
};

export const spacing = {
  page: 20, // horizontal screen padding
  gap: 8,
  gapLg: 12,
};

export const radii = {
  card: 14,
  row: 12,
  chip: 20,
  pill: 6,
};

// Font family names assume @expo-google-fonts/inter (see StatusScreen.js notes).
// If you don't load Inter, change these to 'System' and the layout still works.
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
};

export const type = {
  title: { fontFamily: fonts.bold, fontSize: 22, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  sectionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.muted,
  },
  cardLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.muted,
  },
  cardValue: { fontFamily: fonts.bold, fontSize: 18 },
  cardNote: { fontFamily: fonts.regular, fontSize: 11, color: colors.textBlue },
  body: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
};

export default { colors, spacing, radii, fonts, type };
