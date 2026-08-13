import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes: string;
};

type Ctx = {
  canteenId: string | null;
  canteenName: string;
  items: CartItem[];
  add: (canteenId: string, canteenName: string, item: CartItem) => void;
  update: (menuItemId: string, patch: Partial<CartItem>) => void;
  remove: (menuItemId: string) => void;
  clear: () => void;
  count: number;
  total: number;
};

const CartContext = createContext<Ctx>({} as Ctx);
const KEY = "kantin-cart";
export const MAX_QTY = 20;

export function CartProvider({ children }: { children: ReactNode }) {
  const [canteenId, setCanteenId] = useState<string | null>(null);
  const [canteenName, setCanteenName] = useState("");
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { canteenId: string | null; canteenName: string; items: CartItem[] };
        setCanteenId(parsed.canteenId);
        setCanteenName(parsed.canteenName ?? "");
        setItems(parsed.items ?? []);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(KEY, JSON.stringify({ canteenId, canteenName, items }));
  }, [canteenId, canteenName, items, hydrated]);

  const value = useMemo<Ctx>(() => {
    const clampQty = (n: number) => Math.max(1, Math.min(MAX_QTY, Math.round(n) || 1));
    return {
      canteenId,
      canteenName,
      items,
      count: items.reduce((s, i) => s + i.quantity, 0),
      total: items.reduce((s, i) => s + i.quantity * i.price, 0),
      add: (cid, cname, item) => {
        setItems((prev) => {
          const base = cid === canteenId ? prev : [];
          const existing = base.find((i) => i.menuItemId === item.menuItemId);
          if (existing) {
            return base.map((i) =>
              i.menuItemId === item.menuItemId ? { ...i, quantity: clampQty(i.quantity + item.quantity) } : i,
            );
          }
          return [...base, { ...item, quantity: clampQty(item.quantity) }];
        });
        setCanteenId(cid);
        setCanteenName(cname);
      },
      update: (id, patch) =>
        setItems((prev) =>
          prev.map((i) =>
            i.menuItemId === id
              ? { ...i, ...patch, quantity: patch.quantity !== undefined ? clampQty(patch.quantity) : i.quantity }
              : i,
          ),
        ),
      remove: (id) => setItems((prev) => prev.filter((i) => i.menuItemId !== id)),
      clear: () => {
        setItems([]);
        setCanteenId(null);
        setCanteenName("");
      },
    };
  }, [canteenId, canteenName, items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
