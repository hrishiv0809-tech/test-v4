import { Package } from 'lucide-react';
import { cn, gradientFor } from '@/lib/utils';

interface ProductImageProps {
  name: string;
  imageUrl?: string | null;
  className?: string;
  iconClassName?: string;
}

/**
 * Image block that never depends on the network: uploads render directly, and
 * products without a photo get a deterministic brand gradient + icon.
 */
export function ProductImage({ name, imageUrl, className, iconClassName }: ProductImageProps): JSX.Element {
  if (imageUrl) {
    return <img src={imageUrl} alt={name} className={cn('h-full w-full object-cover', className)} loading="lazy" />;
  }
  return (
    <div
      className={cn('grid h-full w-full place-items-center', className)}
      style={{ backgroundImage: gradientFor(name) }}
      role="img"
      aria-label={`${name} placeholder image`}
    >
      <Package className={cn('size-8 text-white/85 drop-shadow', iconClassName)} />
    </div>
  );
}

export function EventImage({ title, imageUrl, className }: { title: string; imageUrl?: string | null; className?: string }): JSX.Element {
  if (imageUrl) return <img src={imageUrl} alt={title} className={cn('h-full w-full object-cover', className)} />;
  return (
    <div className={cn('grid h-full w-full place-items-center', className)} style={{ backgroundImage: gradientFor(title) }} role="img" aria-label={`${title} placeholder image`}>
      <span className="px-4 text-center text-lg font-semibold text-white/90 drop-shadow">{title}</span>
    </div>
  );
}
