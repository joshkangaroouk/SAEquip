import type { ReactNode } from "react";
import { SegmentedControl } from "../ui";
import { EditorSection } from "./EditorSection";
import { AccessorySection } from "./AccessorySection";

/**
 * The side panel's Visibility card (10 §3, 12 §2): the Status field as an
 * Active / Hidden switch (the `status` field of `details`), the Accessory
 * toggle (the `accessory` key), and at its foot, under a rule that runs the
 * card's full width, Delete product, which sits outside the save flow.
 */
export function VisibilitySection({
  status,
  onStatusChange,
  isAccessory,
  onAccessoryChange,
  error,
  deleteControl,
}: {
  status: string;
  onStatusChange: (status: "ACTIVE" | "HIDDEN") => void;
  isAccessory: boolean;
  onAccessoryChange: (next: boolean) => void;
  error?: string;
  /** DeleteProductButton in the editor. */
  deleteControl: ReactNode;
}) {
  return (
    <EditorSection title="Visibility" error={error}>
      <div className="space-y-5">
        <div>
          <SegmentedControl
            ariaLabel="Visibility"
            value={status === "ACTIVE" ? "ACTIVE" : "HIDDEN"}
            onChange={onStatusChange}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "HIDDEN", label: "Hidden" },
            ]}
          />
          <p className="t-help mt-2">Hidden products aren't shown in the store.</p>
        </div>
        <AccessorySection checked={isAccessory} onChange={onAccessoryChange} />
        <div className="-mx-5 border-t border-border px-5 pt-4">{deleteControl}</div>
      </div>
    </EditorSection>
  );
}
