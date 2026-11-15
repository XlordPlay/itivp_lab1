import {
  Briefcase,
  Bus,
  Coffee,
  Film,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  Package,
  Percent,
  PiggyBank,
  Repeat,
  Shirt,
  ShoppingCart,
  Smartphone,
} from 'lucide-react';
import { useApp } from '../context';

const ICONS = {
  briefcase: Briefcase,
  bus: Bus,
  coffee: Coffee,
  film: Film,
  gift: Gift,
  'graduation-cap': GraduationCap,
  'heart-pulse': HeartPulse,
  home: Home,
  laptop: Laptop,
  package: Package,
  percent: Percent,
  'piggy-bank': PiggyBank,
  repeat: Repeat,
  shirt: Shirt,
  'shopping-cart': ShoppingCart,
  smartphone: Smartphone,
};

// Плитка категории: иконка и цвет по слоту палитры (цвет меняется вместе с темой)
export function CategoryIcon({ name, type, icon, small = false }) {
  const { categoryMeta } = useApp();
  const meta = categoryMeta(name, type);
  const Icon = ICONS[icon || meta.icon] || Package;
  return (
    <span className={`cat-icon${small ? ' sm' : ''}`} style={{ '--c': `var(--series-${meta.slot})` }} aria-hidden="true">
      <Icon size={small ? 15 : 18} strokeWidth={2} />
    </span>
  );
}
