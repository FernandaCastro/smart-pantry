import React from 'react';
import {
  Apple,
  Bean,
  Beef,
  BottleWine,
  CakeSlice,
  Candy,
  Carrot,
  CookingPot,
  Croissant,
  Fish,
  Milk,
  Package,
  Popcorn,
  Snowflake,
  SoapDispenserDroplet,
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
  cereals_grains: { icons: [Wheat, Bean], bgClass: 'bg-gradient-to-br from-orange-200 to-red-500' },
  fruits_vegetables: { icons: [Apple, Carrot], bgClass: 'bg-gradient-to-br from-emerald-400 to-lime-500' },
  canned_goods: { icons: [Soup], bgClass: 'bg-gradient-to-br from-cyan-200 to-gray-500' },
  meat_fish: { icons: [Beef, Fish], bgClass: 'bg-gradient-to-br from-rose-500 to-red-600' },
  bakery: { icons: [Croissant], bgClass: 'bg-gradient-to-br from-amber-300 to-orange-600' },
  cooking_baking: { icons: [CookingPot, CakeSlice], bgClass: 'bg-gradient-to-br from-fuchsia-500 to-violet-600' },
  sweets_savory_snacks: { icons: [Candy, Popcorn], bgClass: 'bg-gradient-to-br from-pink-500 to-fuchsia-600' },
  dairy: { icons: [Milk], bgClass: 'bg-gradient-to-br from-yellow-200 to-amber-500' },
  cleaning: { icons: [SprayCan], bgClass: 'bg-gradient-to-br from-teal-500 to-cyan-600' },
  hygiene: { icons: [SoapDispenserDroplet], bgClass: 'bg-gradient-to-br from-violet-500 to-purple-600' },
  beverages: { icons: [BottleWine], bgClass: 'bg-gradient-to-br from-blue-500 to-indigo-600' },
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
    <span className={`inline-flex items-center ${className}`} aria-hidden="true">
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

