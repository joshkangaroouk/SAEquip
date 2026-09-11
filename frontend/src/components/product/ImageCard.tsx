import { Badge, DragHandle, Input, RemoveButton, type DragHandleProps } from "../ui";
import type { ImageDraft } from "./productEditorTypes";

/** True for an image Duda has already ingested onto its CDN. */
const isDudaHosted = (url: string) => url.includes("cdn-website.com");

export function ImageCard({
  image,
  handle,
  isPrimary,
  onAltChange,
  onRemove,
}: {
  image: ImageDraft;
  handle: DragHandleProps;
  isPrimary: boolean;
  onAltChange: (alt: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface p-3">
      {/*
        Square, not a fixed height. Product photos arrive in mixed aspect
        ratios, and a fixed-height box let the cards' overall heights drift
        apart as the grid narrowed. A square well keeps every tile identical
        and matches how Duda crops the gallery thumbnail.
      */}
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-surface-2">
        <img
          src={image.url}
          alt={image.alt || "product image"}
          // object-contain, so a tall or wide photo is shown whole inside the
          // square rather than cropped — this is a picker, not a preview of
          // the final crop.
          className="max-h-full max-w-full object-contain"
        />
        {isPrimary && (
          <span className="absolute left-1 top-1">
            <Badge tone="accent">Primary</Badge>
          </span>
        )}
        {!isDudaHosted(image.url) && (
          <span className="absolute bottom-1 left-1">
            <Badge tone="neutral">Pending upload</Badge>
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1">
        <DragHandle handle={handle} />
        <Input
          size="sm"
          value={image.alt}
          onChange={(e) => onAltChange(e.target.value)}
          placeholder="Alt text"
          aria-label="Alt text"
        />
        <RemoveButton onClick={onRemove} title="Remove image" />
      </div>
    </div>
  );
}
