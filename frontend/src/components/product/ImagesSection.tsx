import { useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { ImagePlus, Upload } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  DragHandle,
  Field,
  ImageWell,
  Input,
  Modal,
  SortableList,
  UploadList,
  toast,
  useUploadQueue,
} from "../ui";
import { MediaPicker } from "../MediaPicker";
import { EditorSection } from "./EditorSection";
import type { ImageDraft } from "./productEditorTypes";
import type { MediaAsset } from "../../lib/types";

/** True for an image Duda has already ingested onto its CDN. */
const isDudaHosted = (url: string) => url.includes("cdn-website.com");

const ACCEPT = { "image/png": [], "image/jpeg": [], "image/webp": [] };

/**
 * The product gallery: the Images card at the top of the editor's side panel
 * (11 §2), WordPress-style. The featured image large, the whole gallery
 * underneath as thumbnails to drag into order, and a thumbnail opens an
 * "Image" dialog for its alt text, Set as featured and Remove.
 *
 * ⚠️ The featured image IS the first one. There is no primary flag: Duda's
 * image shape is only {url, alt}, the array is a full replacement and
 * position is the order, and index 0 is the product thumbnail (the products
 * list and the band read images[0]). So "Set as featured" moves an image to
 * the front, exactly as dragging it there does.
 *
 * Uploads go to our Supabase media bucket first, which yields a public URL.
 * On save, Duda fetches that URL and re-hosts the image on its own CDN — so
 * the Supabase copy is staging plus a reusable original in Media, and the
 * product ends up referencing Duda only. That's why a newly added image shows
 * "Pending upload" until saved. A drop anywhere on the card uploads, as the
 * dashed dropzone did (`useUploadQueue`).
 */
export function ImagesSection({
  images,
  onChange,
  error,
}: {
  images: ImageDraft[];
  /** A value, or a function of the gallery as it is when the change lands. */
  onChange: (next: ImageDraft[] | ((prev: ImageDraft[]) => ImageDraft[])) => void;
  error?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  /** The image whose dialog is open, by its cosmetic key. */
  const [openKey, setOpenKey] = useState<string | null>(null);
  /** After a Remove from the dialog: the position whose thumbnail gets focus. */
  const [refocusAt, setRefocusAt] = useState<number | null>(null);
  const thumbs = useRef(new Map<string, HTMLButtonElement>());
  const addButton = useRef<HTMLButtonElement>(null);

  /*
   * ⚠️ Functional updates, all of them. An upload completes seconds after the
   * drop, and appending to `images` as captured then kept only the LAST of
   * several dropped files, and undid any alt text typed or image removed while
   * the upload ran.
   */
  const append = (url: string, alt: string) =>
    onChange((prev) => [...prev, { key: crypto.randomUUID(), url, alt }]);

  const setAlt = (key: string, alt: string) =>
    onChange((prev) => prev.map((img) => (img.key === key ? { ...img, alt } : img)));

  const remove = (key: string) => onChange((prev) => prev.filter((img) => img.key !== key));

  /** What making an image primary has always been: moving it to the front. */
  const setFeatured = (key: string) =>
    onChange((prev) => {
      const from = prev.findIndex((img) => img.key === key);
      return from > 0 ? arrayMove(prev, from, 0) : prev;
    });

  /**
   * Add a library image to the gallery. Duda ingests a gallery image by
   * FETCHING its URL on save, so a URL that could not be resolved is refused
   * here rather than reaching Duda as a broken image.
   */
  function addAsset(asset: MediaAsset) {
    if (!asset.url) {
      toast.error(`“${asset.filename}” has no usable URL, so it cannot be added.`);
      return;
    }
    append(asset.url, asset.alt ?? "");
  }

  // The same queue as the dashed dropzone: one upload per file, its progress
  // row, toasts, and the CURRENT addAsset when each one lands.
  const queue = useUploadQueue({ onUploaded: (asset: MediaAsset) => addAsset(asset) });
  // The whole card takes a drop. noClick and noKeyboard: the card holds its
  // own controls, and Upload (below) is the keyboard and click way in.
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: queue.onDrop,
    accept: ACCEPT,
    multiple: true,
    noClick: true,
    noKeyboard: true,
  });

  // A removed image's thumbnail is gone, so the dialog cannot hand focus back
  // to it: the one now in its place takes it, or Add from Media when none is left.
  useEffect(() => {
    if (refocusAt === null) return;
    const target = images[Math.min(refocusAt, images.length - 1)];
    (target ? thumbs.current.get(target.key) : addButton.current)?.focus();
    setRefocusAt(null);
  }, [refocusAt, images]);

  const featured = images[0];
  const openIndex = openKey ? images.findIndex((img) => img.key === openKey) : -1;
  const openImage = openIndex >= 0 ? images[openIndex] : null;

  return (
    <div {...getRootProps({ className: "relative" })}>
      <input {...getInputProps({ "aria-label": "Upload images" })} />
      <EditorSection
        id="section-images"
        title="Images"
        meta={images.length ? `${images.length} ${images.length === 1 ? "image" : "images"}` : undefined}
        error={error}
      >
        <div className="space-y-4">
          <div>
            <p className="t-overline mb-2">Featured</p>
            {featured ? (
              // The first image, whole, on paper.
              <ImageWell src={featured.url} alt={featured.alt} aspect="4/3" />
            ) : (
              // Paper in both themes, so the words inside take the light theme's tokens.
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 border border-dashed border-border-strong bg-paper transition-colors duration-[120ms] hover:border-text"
              >
                <span data-theme="light" className="flex flex-col items-center gap-2 text-body font-semibold text-muted">
                  <ImagePlus size={24} strokeWidth={1.75} aria-hidden="true" />
                  Add a featured image
                </span>
              </button>
            )}
          </div>

          {images.length > 0 && (
            <div>
              <p className="t-overline">Gallery</p>
              <p className="t-help mb-2 mt-1">Drag to reorder. The first image is the featured image.</p>
              <SortableList
                items={images}
                getId={(img) => img.key}
                onReorder={onChange}
                strategy={rectSortingStrategy}
                className="grid grid-cols-3 gap-2"
                renderItem={(img, handle, index) => {
                  const pending = !isDudaHosted(img.url);
                  const n = index + 1;
                  return (
                    <div className="relative">
                      <button
                        type="button"
                        ref={(el) => {
                          if (el) thumbs.current.set(img.key, el);
                          else thumbs.current.delete(img.key);
                        }}
                        onClick={() => setOpenKey(img.key)}
                        aria-label={`Image ${n} of ${images.length}${index === 0 ? ", featured" : ""}${pending ? ", pending upload" : ""}: ${img.alt.trim() || "no alt text"}`}
                        // The picture is not a drag source of its own: a native
                        // image drag would read as a file dropped on the card.
                        className="block w-full [&_img]:pointer-events-none"
                      >
                        <ImageWell src={img.url} aspect="square" />
                      </button>
                      {/* In the button's name already, so hidden from assistive tech.
                          The chips and the handle sit on paper, so they take the light
                          theme's tokens in both (a near-white solid chip, or a
                          near-white focus ring, would vanish on the photo). */}
                      <span
                        aria-hidden="true"
                        data-theme="light"
                        className="pointer-events-none absolute bottom-1 left-1 right-1 flex flex-col items-start gap-0.5"
                      >
                        {pending && (
                          <Badge className="h-auto min-h-5 whitespace-normal px-1.5 py-0.5 text-micro leading-tight">
                            Pending upload
                          </Badge>
                        )}
                        {index === 0 && (
                          <Badge tone="solid" className="h-5 px-1.5 text-micro">
                            Featured
                          </Badge>
                        )}
                      </span>
                      <span data-theme="light" className="absolute right-1 top-1">
                        <DragHandle
                          handle={handle}
                          label={`Drag image ${n} to reorder`}
                          className="h-6 w-6 border border-border-strong bg-surface"
                        />
                      </span>
                    </div>
                  );
                }}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button ref={addButton} variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
              Add from Media
            </Button>
            <Button variant="secondary" size="sm" onClick={open}>
              <Upload size={16} aria-hidden="true" />
              Upload
            </Button>
          </div>
          <p className="t-help">
            Or drop images on this card. PNG, JPEG or WebP, up to 25MB. They upload now and transfer to Duda when you
            save.
          </p>
          <UploadList items={queue.items} />
        </div>
      </EditorSection>

      {/* The drop target's selected treatment (02a "Batch 8"), over the whole card. */}
      {isDragActive && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center border-2 border-dashed border-selected-bar bg-selected/95 text-body font-semibold text-text"
        >
          Drop images to upload
        </div>
      )}

      {pickerOpen && (
        <MediaPicker
          kind="image"
          onPick={(asset) => {
            addAsset(asset);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Focus goes back to the thumbnail that opened it (Modal), and it
          moves with its image, so Set as featured keeps it. */}
      <Modal
        open={!!openImage}
        onClose={() => setOpenKey(null)}
        title="Image"
        description={openImage ? `Image ${openIndex + 1} of ${images.length}` : undefined}
        footer={
          openImage && (
            <>
              <Button
                variant="danger"
                className="mr-auto"
                onClick={() => {
                  remove(openImage.key);
                  setOpenKey(null);
                  setRefocusAt(openIndex);
                }}
              >
                Remove
              </Button>
              <Button onClick={() => setOpenKey(null)}>Done</Button>
            </>
          )
        }
      >
        {openImage && (
          <div className="space-y-4">
            {/* The section's own error (the alt text's length among them), as on the card. */}
            {error && <Alert tone="danger">{error}</Alert>}
            <ImageWell src={openImage.url} alt={openImage.alt} aspect="4/3" />
            <div className="flex flex-wrap items-center gap-2">
              {openIndex === 0 ? (
                <Badge tone="solid">Featured</Badge>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    // This button goes once the image is first, so focus moves to
                    // the dialog itself rather than dropping to the page.
                    (e.currentTarget.closest("[role=dialog]") as HTMLElement | null)?.focus();
                    setFeatured(openImage.key);
                  }}
                >
                  Set as featured
                </Button>
              )}
              {!isDudaHosted(openImage.url) && <Badge>Pending upload</Badge>}
            </div>
            {/* Announced when Set as featured moves the image to the front. */}
            <p role="status" className="sr-only">
              {openIndex === 0 ? "This is the featured image." : ""}
            </p>
            <Field label="Alt text" hint="Describes the image for people who can't see it. Up to 300 characters.">
              <Input value={openImage.alt} onChange={(e) => setAlt(openImage.key, e.target.value)} />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
