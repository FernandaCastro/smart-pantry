import React from 'react';
import {
  Apple,
  Bean,
  Beef,
  CakeSlice,
  Candy,
  Carrot,
  CookingPot,
  Croissant,
  Fish,
  GlassWater,
  Milk,
  Package,
  Snowflake,
  Sparkles,
  Soup,
  SprayCan,
  Wheat,
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

type CategoryStyle = {
  icons: LucideIcon[];
  bgClass: string;
};

const categoryStyles: Record<string, CategoryStyle> = {
  cereals_grains: { icons: [Wheat, Bean], bgClass: 'bg-gradient-to-br from-amber-400 to-orange-500' },
  fruits_vegetables: { icons: [Apple, Carrot], bgClass: 'bg-gradient-to-br from-emerald-400 to-lime-500' },
  canned_goods: { icons: [Soup], bgClass: 'bg-gradient-to-br from-cyan-500 to-blue-600' },
  meat_fish: { icons: [Beef, Fish], bgClass: 'bg-gradient-to-br from-rose-500 to-red-600' },
  bakery: { icons: [Croissant], bgClass: 'bg-gradient-to-br from-orange-400 to-amber-500' },
  cooking_baking: { icons: [CookingPot, CakeSlice], bgClass: 'bg-gradient-to-br from-fuchsia-500 to-violet-600' },
  sweets_savory_snacks: { icons: [Candy, Sparkles], bgClass: 'bg-gradient-to-br from-pink-500 to-fuchsia-600' },
  dairy: { icons: [Milk], bgClass: 'bg-gradient-to-br from-sky-400 to-indigo-500' },
  cleaning: { icons: [SprayCan], bgClass: 'bg-gradient-to-br from-teal-500 to-cyan-600' },
  hygiene: { icons: [Sparkles], bgClass: 'bg-gradient-to-br from-violet-500 to-purple-600' },
  beverages: { icons: [GlassWater], bgClass: 'bg-gradient-to-br from-blue-500 to-indigo-600' },
  frozen: { icons: [Snowflake], bgClass: 'bg-gradient-to-br from-cyan-400 to-sky-500' },
  others: { icons: [Package], bgClass: 'bg-gradient-to-br from-slate-500 to-gray-600' },
};

interface CategoryIconProps {
  categoryId: string;
  size?: number;
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ categoryId, size = 14, className = '' }) => {
  const style = categoryStyles[categoryId] || categoryStyles.others;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-hidden="true">
      {style.icons.map((Icon, index) => (
        <span
          key={`${categoryId}-${index}`}
          className={`inline-flex items-center justify-center rounded-xl text-white shadow-sm ${style.bgClass}`}
          style={{ width: size + 10, height: size + 10 }}
        >
          <Icon size={size} strokeWidth={2.4} />
        </span>
      ))}
    </span>
  );
};

// Referência de estilo (ícones gratuitos):
// https://www.flaticon.com/free-icon/rice_9921058?term=cereals+and+grains&page=1&position=3&origin=search&related_id=9921058
