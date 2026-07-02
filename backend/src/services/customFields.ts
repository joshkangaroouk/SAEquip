import type { CustomFieldMap } from "@prisma/client";
import type { DudaCustomField, DudaImage } from "./duda.js";

export interface DecoratedCustomField {
  id: string;
  label: string | null; // from the map, or null when unmapped
  kind: string; // from the map, or inferred ("image" if an image is present, else "html")
  value: string;
  image: DudaImage | null;
  unmapped: boolean;
}

/**
 * Decorates Duda custom_fields with local metadata from CustomFieldMap rows.
 *
 * Duda gives us only { id, value, image? } with no label. We look each field's
 * id up in the map (keyed by dudaFieldId) for a label + kind. Fields with no map
 * entry get label:null and unmapped:true. Never fails on an empty map.
 */
export function decorateCustomFields(
  fields: DudaCustomField[],
  maps: CustomFieldMap[],
): DecoratedCustomField[] {
  const byId = new Map(maps.map((m) => [m.dudaFieldId, m]));

  return fields.map((f) => {
    const map = byId.get(f.id);
    const inferredKind = f.image ? "image" : "html";
    return {
      id: f.id,
      label: map?.label ?? null,
      kind: map?.kind ?? inferredKind,
      value: f.value,
      image: f.image ?? null,
      unmapped: !map,
    };
  });
}
