import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (next: number) => void;
  size?: number;
  readonly?: boolean;
  className?: string;
}

/**
 * Five-star rating control. Interactive when `onChange` is provided and
 * `readonly` is false. Pure visual otherwise (used to display existing
 * ratings).
 */
export function StarRating({
  value,
  onChange,
  size = 24,
  readonly = false,
  className,
}: StarRatingProps) {
  const [hover, setHover] = useState<number | null>(null);
  const interactive = !readonly && !!onChange;
  const display = hover ?? value;

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role={interactive ? "radiogroup" : undefined}
      aria-label="Rating"
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= display;
        const Cmp = interactive ? "button" : "span";
        return (
          <Cmp
            key={n}
            type={interactive ? "button" : undefined}
            onClick={interactive ? () => onChange?.(n) : undefined}
            onMouseEnter={interactive ? () => setHover(n) : undefined}
            onMouseLeave={interactive ? () => setHover(null) : undefined}
            aria-label={interactive ? `${n} star${n === 1 ? "" : "s"}` : undefined}
            aria-checked={interactive ? value === n : undefined}
            role={interactive ? "radio" : undefined}
            className={cn(
              "transition-transform",
              interactive && "cursor-pointer hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded",
            )}
          >
            <Star
              style={{ width: size, height: size }}
              className={cn(
                "transition-colors",
                filled
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-transparent text-muted-foreground/40",
              )}
            />
          </Cmp>
        );
      })}
    </div>
  );
}