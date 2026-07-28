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
      <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-lg bg-surface-2">
        <img
          src={image.url}
          alt={image.alt || "product image"}
          className="max-h-28 max-w-full object-contain"
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
          className="px-2 py-1 text-xs"
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
