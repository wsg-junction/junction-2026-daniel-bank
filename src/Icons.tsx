import type { CSSProperties } from 'react';

const paths = {
  pocket: 'M5 5h14v8a7 7 0 0 1-14 0V5Zm4 6 3 3 3-3',
  overview: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
  explore: 'M4 20V10m8 10V4m8 16v-7M2 20h20',
  plan: 'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 12l9-9m-5 0h5v5',
  sparkle: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Zm7-1 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  up: 'm6 14 6-6 6 6M12 8v12',
  down: 'm6 10 6 6 6-6M12 16V4',
  wallet: 'M3 6h17v14H3V6Zm0 0V4h15v2m-2 6h5v4h-5v-4',
  leaf: 'M20 3C9 2 3 7 4 14s14 10 16-11ZM4 21l10-11',
  info: 'M12 17v-5m0-5v1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  house: 'm3 10 9-7 9 7M5 9v12h14V9m-10 12v-7h6v7',
  chat: 'M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5ZM8 10h8m-8 4h5',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
  chevron: 'm8 5 7 7-7 7',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
    <path d={paths[name]} />
  </svg>;
}
