import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mist: '#edf2f4',
        navy: '#173f5f',
        mint: '#4b7c74',
        ember: '#d1495b',
        paper: '#f9f7f2'
      }
    }
  },
  plugins: []
};

export default config;
