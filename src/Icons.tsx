import type { CSSProperties } from 'react';
import {
  Wallet, ChartNoAxesCombined, Send, TrendingUp, ArrowRight, ArrowUp, ArrowDown,
  Leaf, Info, House, MessageCircle, Check, X, ChevronRight, ChevronDown, ChevronUp, CalendarDays, Sparkles, RotateCcw, Expand, ArrowLeft, Minimize2,
} from 'lucide-react';

const icons = {
  pocket: Wallet, accounts: Wallet, spending: ChartNoAxesCombined,
  payments: Send, investments: TrendingUp, sparkle: Sparkles,
  arrow: ArrowRight, up: ArrowUp, down: ArrowDown, wallet: Wallet,
  leaf: Leaf, info: Info, house: House, chat: MessageCircle,
  check: Check, close: X, chevron: ChevronRight, reset: RotateCcw,
  dropdown: ChevronDown, calendar: CalendarDays,
  expand: Expand, back: ArrowLeft, collapse: Minimize2, 'chevron-up': ChevronUp,
};

export type IconName = keyof typeof icons;

export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  const Component = icons[name];
  return <Component size={size} strokeWidth={1.8} aria-hidden="true" focusable="false" style={style} />;
}
