import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The Inner Cirql buttons (brand bible §16).
 * - Square edges everywhere.
 * - Helvetica Neue 500, 13px, letter-spacing 0.5px.
 * - Hover = opacity shift only. No color flip, no scale, no shadow.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-ui font-medium transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-[13px] tracking-[0.02em] rounded-none",
  {
    variants: {
      variant: {
        // Primary — ink bg, off-white text
        default: "bg-ink text-off-white hover:opacity-85",
        // Form submit / high-emphasis CTA — gold bg, ink text
        gold: "bg-gold text-ink hover:opacity-85",
        // Ghost — transparent, ink-28 border
        outline: "bg-transparent text-ink border border-ink/[0.28] hover:opacity-70",
        secondary: "bg-transparent text-ink border border-ink/[0.28] hover:opacity-70",
        // Subtle — no border, hover off-white bg
        ghost: "text-ink hover:bg-off-white",
        link: "text-ink underline underline-offset-4 hover:opacity-70",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-85",
      },
      size: {
        default: "h-10 px-9 py-4",       // 16px y / 36px x per brand
        sm: "h-9 px-5",
        lg: "h-12 px-10",
        icon: "h-10 w-10 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
