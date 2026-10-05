import { useState } from "react";
import { ImageOff } from "lucide-react";

/**
 * A product's picture at list size, or a neutral placeholder of the same size
 * when there is none or it fails to load — so rows never change height.
 * Shared by Quote Requests and Resource Requests.
 */
export function ProductThumb({ url }: { url: string | null }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-white">
      {url && !broken ? (
        <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-contain" />
      ) : (
        <ImageOff className="h-4 w-4 text-subtle" aria-hidden="true" />
      )}
    </span>
  );
}
