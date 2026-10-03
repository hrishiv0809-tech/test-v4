import { httpDelete, httpGet, httpPatch, httpPostForm } from './client';
import type { Product, ProductVariant, Size } from './types';

export const productsApi = {
  list: (activeOnly = true) => httpGet<Product[]>('/products', { active_only: activeOnly }),
  detail: (id: number) => httpGet<Product>(`/products/${id}`),
  create: (payload: { name: string; description: string; base_price: number; active: boolean; variants: { size: Size; stock: number }[] }, image?: File | null) => {
    const form = new FormData();
    form.append('name', payload.name);
    form.append('description', payload.description);
    form.append('base_price', String(payload.base_price));
    form.append('active', String(payload.active));
    form.append('variants', JSON.stringify(payload.variants));
    if (image) form.append('image', image);
    return httpPostForm<Product>('/products', form);
  },
  update: (id: number, payload: { name?: string; description?: string; base_price?: number; active?: boolean; variants?: { id?: number; size: Size; stock: number }[] }, image?: File | null) => {
    const form = new FormData();
    if (payload.name !== undefined) form.append('name', payload.name);
    if (payload.description !== undefined) form.append('description', payload.description);
    if (payload.base_price !== undefined) form.append('base_price', String(payload.base_price));
    if (payload.active !== undefined) form.append('active', String(payload.active));
    if (payload.variants) form.append('variants', JSON.stringify(payload.variants));
    if (image) form.append('image', image);
    return httpPatch<Product>(`/products/${id}`, form);
  },
  remove: (id: number) => httpDelete<{ deleted: boolean }>(`/products/${id}`),
  setStock: (variantId: number, stock: number) => httpPatch<ProductVariant>(`/variants/${variantId}`, { stock }),
};
