import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The Inner Cirql badges: square, hairline, ink-on-white or gold-on-ink.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-none border px-2 py-0.5 font-ui text-[10px] font-medium uppercase tracking-[0.15em] transition-opacity",
  {
    variants: {
      variant: {
        default: "border-ink/[0.16] bg-white text-ink",
        secondary: "border-ink/[0.08] bg-off-white text-ink",
        gold: "border-transparent bg-gold text-ink",
        outline: "border-ink/[0.28] bg-transparent text-ink",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
