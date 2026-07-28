import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, CardHeader, Field, Input, Modal, toast } from "../ui";
import { apiJson } from "../../lib/api";

interface DeletePreview {
  name: string;
  sku: string;
  destroys: { specRows: number; textItems: number; activeLogos: number; downloads: number };
  retains: { leads: number };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Product deletion. Irreversible on Duda's side, so it's gated behind a
 * preview of exactly what goes and what stays, plus typing the product name.
 *
 * Captured leads and quote requests are NOT destroyed — leads survive via a
 * SetNull FK plus their capture-time snapshot, and quote requests never
 * referenced the product to begin with.
 */
export function DangerZoneSection({
  productId,
  productName,
  onBeforeNavigate,
}: {
  productId: string;
  productName: string;
  /** Disarms the unsaved-changes guard so the post-delete navigate is clean. */
  onBeforeNavigate: () => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<DeletePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function openDialog() {
    setOpen(true);
    setTyped("");
    setPreview(null);
    setLoading(true);
    try {
      setPreview(await apiJson<DeletePreview>(`/api/products/${productId}/delete-preview`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load what this would delete");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (typed !== productName || deleting) return;
    setDeleting(true);
    try {
      await apiJson(`/api/products/${productId}?confirm=true`, { method: "DELETE" });
      toast.success(`Deleted “${productName}”`);
      onBeforeNavigate();
      navigate("/", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  }

  const destroyed = preview
    ? [
        preview.destroys.specRows && plural(preview.destroys.specRows, "spec row"),
        preview.destroys.textItems && plural(preview.destroys.textItems, "benefit/application"),
        preview.destroys.activeLogos && plural(preview.destroys.activeLogos, "logo activation"),
        preview.destroys.downloads && plural(preview.destroys.downloads, "download"),
      ].filter(Boolean)
    : [];

  return (
    <>
      <Card id="section-danger" className="border-danger/40">
        <CardHeader
          title="Delete product"
          description="Removes the product from Duda along with its Hub content. Captured leads and quote requests are kept."
          actions={
            <Button variant="danger" size="sm" onClick={() => void openDialog()}>
              Delete…
            </Button>
          }
        />
      </Card>

      <Modal
        open={open}
        onClose={() => !deleting && setOpen(false)}
        dismissable={!deleting}
        size="md"
        title={`Delete “${productName}”?`}
        description="This cannot be undone — the product is removed from Duda immediately."
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void confirmDelete()}
              disabled={typed !== productName || loading}
              loading={deleting}
            >
              Delete permanently
            </Button>
          </div>
        }
      >
        {loading && <p className="text-small text-muted">Checking what this would remove…</p>}

        {preview && (
          <div className="space-y-4">
            <div>
              <p className="text-small font-semibold text-text">Will be deleted</p>
              <ul className="mt-1 list-inside list-disc text-small text-muted">
                <li>The Duda product{preview.sku ? ` (SKU ${preview.sku})` : ""} and its images</li>
                {destroyed.length > 0 ? (
                  destroyed.map((d) => <li key={String(d)}>{d}</li>)
                ) : (
                  <li>No Hub content has been added yet</li>
                )}
              </ul>
            </div>

            <div>
              <p className="text-small font-semibold text-success">Will be kept</p>
              <ul className="mt-1 list-inside list-disc text-small text-muted">
                <li>
                  {preview.retains.leads > 0
                    ? `${plural(preview.retains.leads, "captured download lead")} — retained with this product's name recorded`
                    : "Captured download leads (there are none for this product)"}
                </li>
                <li>All quote requests, including any listing this product</li>
              </ul>
            </div>

            <Field
              label={`Type “${productName}” to confirm`}
              htmlFor="confirm-name"
              error={typed && typed !== productName ? "Doesn't match" : undefined}
            >
              <Input
                id="confirm-name"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                disabled={deleting}
              />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
