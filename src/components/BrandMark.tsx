/**
 * The Inner Cirql brand mark — ten gold dots arranged as a cirql.
 * Always ten. Always gold. Always evenly spaced.
 */
interface BrandMarkProps {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 28, className = "" }: BrandMarkProps) {
  const dots = Array.from({ length: 10 }, (_, i) => i);
  const radius = size * 0.42;
  const dotSize = Math.max(2, size * 0.085);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden="true"
    >
      {dots.map((i) => {
        const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const cx = size / 2 + radius * Math.cos(angle);
        const cy = size / 2 + radius * Math.sin(angle);
        return <circle key={i} cx={cx} cy={cy} r={dotSize / 2} fill="hsl(36 43% 61%)" />;
      })}
    </svg>
  );
}

/**
 * The wordmark: "GEO" in Cormorant Garamond.
 * Stands alone or sits to the right of the BrandMark.
 */
export function Wordmark({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`font-display font-normal text-ink leading-none tracking-[0.02em] ${className}`}
      style={{ fontSize: size }}
    >
      GEO
    </span>
  );
}

/**
 * Full lockup: mark + wordmark side by side.
 */
export function BrandLockup({
  markSize = 28,
  wordmarkSize = 22,
  className = "",
}: {
  markSize?: number;
  wordmarkSize?: number;
  className?: string;
}) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <BrandMark size={markSize} />
      <Wordmark size={wordmarkSize} />
    </div>
  );
}
