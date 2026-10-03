import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn, initials } from '@/lib/utils';

export function UserAvatar({ name, className }: { name: string; className?: string }): JSX.Element {
  return (
    <Avatar className={cn(className)} aria-hidden>
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
