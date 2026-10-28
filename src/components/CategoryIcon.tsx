import {
  Baby, Banknote, Briefcase, Building2, Car, Coffee, Coins, CreditCard, Dumbbell, Fuel, Gamepad2, Gift, GraduationCap,
  Heart, HeartPulse, House, Laptop, MoreHorizontal, Music, PawPrint, PiggyBank, Plane, CirclePlus, Receipt, Shirt, ShoppingBag,
  ShoppingBasket, Smartphone, Store, Tag, TrendingUp, Tv, Undo2, UtensilsCrossed, Wrench, Landmark,
  type LucideIcon,
} from 'lucide-react'

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  home: House,
  receipt: Receipt,
  food: UtensilsCrossed,
  basket: ShoppingBasket,
  car: Car,
  fuel: Fuel,
  health: HeartPulse,
  bag: ShoppingBag,
  shirt: Shirt,
  game: Gamepad2,
  tv: Tv,
  school: GraduationCap,
  paw: PawPrint,
  gift: Gift,
  plane: Plane,
  sport: Dumbbell,
  bank: Landmark,
  piggy: PiggyBank,
  briefcase: Briefcase,
  laptop: Laptop,
  store: Store,
  building: Building2,
  trend: TrendingUp,
  refund: Undo2,
  coffee: Coffee,
  music: Music,
  phone: Smartphone,
  wrench: Wrench,
  baby: Baby,
  heart: Heart,
  card: CreditCard,
  coins: Coins,
  tag: Tag,
  plus: CirclePlus,
  dots: MoreHorizontal,
  money: Banknote,
}

/** Círculo de color con el ícono de la categoría (como en las apps de gastos). */
export function CategoryIcon({ icon, color, size = 18 }: { icon: string; color: string; size?: number }) {
  const Icon = CATEGORY_ICONS[icon] ?? Tag
  return (
    <span className="cat-icon" style={{ background: color, width: size + 16, height: size + 16 }} aria-hidden="true">
      <Icon size={size} color="#fff" strokeWidth={2.2} />
    </span>
  )
}
