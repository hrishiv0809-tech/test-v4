import { useCallback, useEffect, useState } from 'react';

export interface CartLine {
  variant_id: number;
  product_id: number;
  product_name: string;
  size: string;
  unit_price: number;
  quantity: number;
  max_stock: number;
}

const CART_KEY = 'skyline_cart';
const EVENT = 'skyline-cart-changed';

function read(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

function write(lines: CartLine[]): void {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(lines));
  } catch {
    /* noop */
  }
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Cart state shared across components via a window event — the storefront, the
 * navbar badge and the checkout page all stay in sync without a provider.
 */
export function useCart() {
  const [lines, setLines] = useState<CartLine[]>(() => read());

  useEffect(() => {
    const sync = (): void => setLines(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const add = useCallback((line: Omit<CartLine, 'quantity'>, quantity = 1): void => {
    const current = read();
    const existing = current.find((l) => l.variant_id === line.variant_id);
    if (existing) {
      existing.quantity = Math.min(line.max_stock, existing.quantity + quantity);
    } else {
      current.push({ ...line, quantity: Math.min(quantity, line.max_stock) });
    }
    write(current);
  }, []);

  const setQuantity = useCallback((variantId: number, quantity: number): void => {
    const current = read()
      .map((l) => (l.variant_id === variantId ? { ...l, quantity: Math.max(1, Math.min(l.max_stock, quantity)) } : l))
      .filter((l) => l.quantity > 0);
    write(current);
  }, []);

  const remove = useCallback((variantId: number): void => {
    write(read().filter((l) => l.variant_id !== variantId));
  }, []);

  const clear = useCallback((): void => write([]), []);

  const count = lines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);

  return { lines, add, setQuantity, remove, clear, count, subtotal };
}
