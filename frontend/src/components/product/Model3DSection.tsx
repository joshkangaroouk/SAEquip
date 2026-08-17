import { useState } from "react";
import { Badge, Button, Card, CardHeader, RemoveButton } from "../ui";
import { MediaPicker } from "../MediaPicker";
import { Model3DPreview } from "./Model3DPreview";
import type { MediaAsset } from "../../lib/types";
import type { Model3DDraft } from "./productEditorTypes";

/**
 * Per-product 3D model attachment (.glb). Unlike Logos there's no shared
 * catalog to browse — one model belongs to exactly one product — so this is
 * just an upload/replace/remove slot, staged in the unified draft like every
 * other section (no immediate-apply, no separate Save).
 */
export function Model3DSection({
  value,
  onChange,
  dirty,
  error,
}: {
  value: Model3DDraft;
  onChange: (next: Model3DDraft) => void;
  dirty: boolean;
  error?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  function handlePick(asset: MediaAsset) {
    onChange({ mediaAssetId: asset.id, filename: asset.filename, url: asset.url });
    setPickerOpen(false);
  }

  return (
    <Card>
      <CardHeader
        title="3D Model"
        description="Upload a .glb file to show an interactive 3D viewer on the product page."
        actions={dirty && <Badge tone="accent">Unsaved</Badge>}
      />

      {error && <p className="mb-3 text-small text-danger">{error}</p>}

      {value.mediaAssetId && value.url ? (
        <div className="space-y-3">
          <Model3DPreview src={value.url} />
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-small text-muted" title={value.filename ?? ""}>
              {value.filename}
            </span>
            <div className="flex items-center gap-1">
              <Button type="button" variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
                Replace
              </Button>
              <RemoveButton
                title="Remove 3D model"
                onClick={() => onChange({ mediaAssetId: null, filename: null, url: null })}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-body text-subtle">No 3D model uploaded yet.</p>
          <Button type="button" size="sm" onClick={() => setPickerOpen(true)}>
            Upload GLB file
          </Button>
        </div>
      )}

      {pickerOpen && (
        <MediaPicker kind="model" onPick={handlePick} onClose={() => setPickerOpen(false)} />
      )}
    </Card>
  );
}
