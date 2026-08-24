export type AccentTheme = 'blue' | 'purple' | 'green' | 'orange' | 'pink'

export const accentThemes: Record<AccentTheme, { label: string; primary: string; rgb: string; hoverRgb: string }> = {
  blue: { label: 'Blue', primary: '#0A84FF', rgb: '10 132 255', hoverRgb: '64 156 255' },
  purple: { label: 'Purple', primary: '#BF5AF2', rgb: '191 90 242', hoverRgb: '208 124 255' },
  green: { label: 'Green', primary: '#30D158', rgb: '48 209 88', hoverRgb: '75 222 111' },
  orange: { label: 'Orange', primary: '#FF9F0A', rgb: '255 159 10', hoverRgb: '255 179 64' },
  pink: { label: 'Pink', primary: '#FF375F', rgb: '255 55 95', hoverRgb: '255 105 135' },
}

const STORAGE_KEY = 'codepad.accentTheme'

export function loadAccentTheme(): AccentTheme {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored && stored in accentThemes ? stored as AccentTheme : 'blue'
}

export function applyAccentTheme(theme: AccentTheme): void {
  const colors = accentThemes[theme]
  document.documentElement.style.setProperty('--accent-rgb', colors.rgb)
  document.documentElement.style.setProperty('--accent-hover-rgb', colors.hoverRgb)
  document.documentElement.dataset.accent = theme
}

export function saveAccentTheme(theme: AccentTheme): void {
  window.localStorage.setItem(STORAGE_KEY, theme)
  applyAccentTheme(theme)
}

export function initializeAccentTheme(): void {
  applyAccentTheme(loadAccentTheme())
}
