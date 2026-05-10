import { useEffect, useState } from "react";
import { BrandMark } from "./BrandMark";

interface GeoTalkingModalProps {
  open: boolean;
  messages: string[];
  thinkingMs?: number;
  perMessageMs?: number;
  onComplete?: () => void;
  footer?: React.ReactNode;
}

/**
 * A modal where GEO "talks" to the user. Shows a thinking indicator,
 * then reveals each message in sequence. Calls onComplete after the
 * last message has been shown for perMessageMs.
 */
export function GeoTalkingModal({
  open,
  messages,
  thinkingMs = 1200,
  perMessageMs = 2200,
  onComplete,
  footer,
}: GeoTalkingModalProps) {
  // -1 = thinking, 0..n-1 = showing message i
  const [index, setIndex] = useState(-1);

  useEffect(() => {
    if (!open) {
      setIndex(-1);
      return;
    }
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setIndex(0), thinkingMs));
    for (let i = 1; i < messages.length; i++) {
      timers.push(
        window.setTimeout(() => setIndex(i), thinkingMs + perMessageMs * i)
      );
    }
    if (onComplete) {
      timers.push(
        window.setTimeout(
          () => onComplete(),
          thinkingMs + perMessageMs * messages.length
        )
      );
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [open, messages, thinkingMs, perMessageMs, onComplete]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(26,26,26,0.55)" }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[460px] bg-white border border-ink/[0.08] p-7"
        style={{ borderRadius: 0 }}
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 bg-ink flex items-center justify-center">
            <BrandMark size={22} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="text-[10px] tracking-[2px] uppercase text-ink/50 mb-2">
              GEO
            </div>
            {index === -1 ? (
              <ThinkingDots />
            ) : (
              <div className="space-y-3">
                {messages.slice(0, index + 1).map((m, i) => (
                  <p
                    key={i}
                    className="text-[15px] text-ink leading-[1.6] animate-fade-in"
                  >
                    {m}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
        {footer && (
          <div className="mt-6 pt-5 border-t border-ink/[0.08]">{footer}</div>
        )}
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 h-6">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 bg-ink/60 inline-block"
          style={{
            animation: "geo-dot 1.2s infinite ease-in-out",
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes geo-dot {
          0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
}
