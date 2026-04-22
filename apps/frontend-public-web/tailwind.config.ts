import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f6f2e8',
        ink: '#1f2a20',
        leaf: '#31533a',
        clay: '#d98752',
        sand: '#efe0bf'
      }
    }
  },
  plugins: []
};

export default config;
