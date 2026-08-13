import takoya from "@/assets/canteen-takoya.jpg";
import unclefong from "@/assets/canteen-unclefong.jpg";
import fuel from "@/assets/canteen-fuel.jpg";
import ichi from "@/assets/canteen-ichi.jpg";
import ceria from "@/assets/canteen-ceria.jpg";

export const canteenImages: Record<string, string> = {
  takoya,
  "uncle-fong": unclefong,
  "fuel-catering": fuel,
  "ichi-gourmet": ichi,
  ceria,
};

export function canteenImage(slug: string, fallback?: string | null) {
  return fallback || canteenImages[slug] || takoya;
}
