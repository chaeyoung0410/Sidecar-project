/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Apple SD Gothic Neo', 'Pretendard', 'Noto Sans KR', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        ink: '#000000',
        panel: '#1c1c1e',
        line: '#38383a',
        lime: '#30d158',
        apple: 'rgb(var(--accent-rgb) / <alpha-value>)',
        'apple-hover': 'rgb(var(--accent-hover-rgb) / <alpha-value>)',
      },
      boxShadow: {
        glow: '0 12px 40px rgba(0, 0, 0, 0.22)',
      },
    },
  },
  plugins: [],
}
