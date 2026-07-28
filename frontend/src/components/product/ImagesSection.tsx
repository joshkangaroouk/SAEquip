import { useState } from "react";
import { rectSortingStrategy } from "@dnd-kit/sortable";
import { Badge, Button, Card, CardHeader, EmptyState, FileDropzone, SortableList } from "../ui";
import { MediaPicker } from "../MediaPicker";
import { ImageCard } from "./ImageCard";
import type { ImageDraft } from "./productEditorTypes";
import type { MediaAsset } from "../../lib/types";

/**
 * Product gallery editor.
 *
 * Uploads go to our Supabase media bucket first (via the existing POST
 * /api/media), which yields a public URL. On save, Duda fetches that URL and
 * re-hosts the image on its own CDN — so the Supabase copy is staging plus a
 * reusable Media Centre original, and the product ends up referencing Duda
 * only. That's why a newly-dropped image shows "Pending upload" until saved.
 *
 * The array is a full replacement and position IS the order, with index 0 as
 * the product thumbnail (the products list reads images[0]).
 */
export function ImagesSection({
  images,
  onChange,
  dirty,
  error,
}: {
  images: ImageDraft[];
  onChange: (next: ImageDraft[]) => void;
  dirty: boolean;
  error?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const append = (url: string, alt: string) =>
    onChange([...images, { key: crypto.randomUUID(), url, alt }]);

  const setAlt = (key: string, alt: string) =>
    onChange(images.map((img) => (img.key === key ? { ...img, alt } : img)));

  const remove = (key: string) => onChange(images.filter((img) => img.key !== key));

  return (
    <>
      <Card id="section-images">
        <CardHeader
          title="Images"
          description="Drag to reorder — the first image is the product thumbnail."
          actions={
            <>
              {dirty && <Badge tone="accent">Unsaved</Badge>}
              <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
                Add from Media Centre
              </Button>
            </>
          }
        />

        {error && (
          <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-small text-danger">
            {error}
          </div>
        )}

        {images.length === 0 ? (
          <EmptyState
            title="No images yet"
            description="Drop an image below, or pick one from the Media Centre."
          />
        ) : (
          <SortableList
            items={images}
            getId={(img) => img.key}
            onReorder={onChange}
            strategy={rectSortingStrategy}
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
            renderItem={(img, handle, index) => (
              <ImageCard
                image={img}
                handle={handle}
                isPrimary={index === 0}
                onAltChange={(alt) => setAlt(img.key, alt)}
                onRemove={() => remove(img.key)}
              />
            )}
          />
        )}

        <div className="mt-4">
          <FileDropzone
            uploadUrl="/api/media"
            accept={{ "image/png": [], "image/jpeg": [], "image/webp": [] }}
            multiple
            label="Drop images here or click to browse"
            hint="PNG, JPEG or WebP, up to 25MB. They upload now and transfer to Duda when you save."
            onUploaded={(asset: MediaAsset) => append(asset.url, asset.alt ?? "")}
          />
        </div>
      </Card>

      {pickerOpen && (
        <MediaPicker
          kind="image"
          onPick={(asset) => {
            append(asset.url, asset.alt ?? "");
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}
