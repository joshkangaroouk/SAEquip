import { useState, type ReactNode } from "react";
import { ImageOff, Package } from "lucide-react";
import { cn } from "../../lib/cn";

type Fallback = "image" | "box" | ReactNode;

const SIZE = {
  40: { box: "h-10 w-10", icon: 16 },
  56: { box: "h-14 w-14", icon: 20 },
  100: { box: "h-[100px] w-[100px]", icon: 28 },
} as const;

/**
 * The picture, or the fallback when there is none or it fails to load — the
 * same box either way, so a row never changes height and no broken-image
 * glyph shows. Reset when `src` changes.
 */
function Picture({
  src,
  alt,
  fit,
  fallback,
  iconSize,
}: {
  src?: string | null;
  alt: string;
  fit: "contain" | "cover";
  fallback: Fallback;
  iconSize: number;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  if (src && broken !== src) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(src)}
        // The picture sits on --paper (white in both themes); the box behind it
        // is --surface-2, which is what shows round the fallback.
        className={cn("h-full w-full bg-paper", fit === "cover" ? "object-cover" : "object-contain")}
      />
    );
  }
  if (fallback === "image" || fallback === "box") {
    const Icon = fallback === "box" ? Package : ImageOff;
    return <Icon size={iconSize} strokeWidth={1.75} aria-hidden="true" className="text-muted" />;
  }
  return <>{fallback}</>;
}

/**
 * A product, category or logo thumbnail: a square box with a 1px --border, the
 * image on --paper, and an icon on --surface-2 when there is no image or it
 * fails to load. Sizes 40 (lists and pickers), 56 (product rows) and 100.
 *
 * Decorative by default (`alt=""`) — the name beside it says what it is. Pass
 * `alt` when the image is the only content of a control.
 */
export function Thumb({
  src,
  alt = "",
  size,
  fit = "contain",
  fallback = "image",
  className,
}: {
  src?: string | null;
  alt?: string;
  size: 40 | 56 | 100;
  fit?: "contain" | "cover";
  fallback?: Fallback;
  className?: string;
}) {
  const s = SIZE[size];
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden border border-border bg-surface-2",
        s.box,
        className,
      )}
    >
      <Picture src={src} alt={alt} fit={fit} fallback={fallback} iconSize={s.icon} />
    </span>
  );
}

/**
 * The same, filling its container's width: tiles in grids (the media picker).
 * `aspect` sets the height from the width; leave it out to size it with a
 * height class instead.
 */
export function ImageWell({
  src,
  alt = "",
  aspect,
  fit = "contain",
  fallback = "image",
  className,
}: {
  src?: string | null;
  alt?: string;
  aspect?: "square" | "4/3";
  fit?: "contain" | "cover";
  fallback?: Fallback;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex w-full items-center justify-center overflow-hidden border border-border bg-surface-2",
        aspect === "square" && "aspect-square",
        aspect === "4/3" && "aspect-[4/3]",
        className,
      )}
    >
      <Picture src={src} alt={alt} fit={fit} fallback={fallback} iconSize={24} />
    </span>
  );
}
