import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border border-[hsl(var(--shadcn-border))] px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--shadcn-ring))] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[hsl(var(--shadcn-primary))] text-[hsl(var(--shadcn-primary-foreground))] shadow',
        secondary:
          'border-transparent bg-[hsl(var(--shadcn-secondary))] text-[hsl(var(--shadcn-secondary-foreground))]',
        destructive:
          'border-transparent bg-[hsl(var(--shadcn-destructive))] text-[hsl(var(--shadcn-destructive-foreground))] shadow',
        outline: 'text-[hsl(var(--shadcn-foreground))]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
