import { useEffect, useRef } from "react";

const MODEL_VIEWER_SRC =
  "https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer.min.js";

let loaderPromise: Promise<void> | null = null;

/** Loads the <model-viewer> custom element once, however many previews mount. */
function ensureModelViewerLoaded(): Promise<void> {
  if (customElements.get("model-viewer")) return Promise.resolve();
  if (!loaderPromise) {
    loaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.type = "module";
      script.src = MODEL_VIEWER_SRC;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load the 3D viewer."));
      document.head.appendChild(script);
    });
  }
  return loaderPromise;
}

/**
 * A small live preview of a .glb file, so staff can confirm the right model
 * was uploaded before saving. Built imperatively (not JSX) since <model-viewer>
 * is a web component with no ambient TSX typing in this project.
 */
export function Model3DPreview({ src }: { src: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const host = ref.current;
    if (!host) return;
    host.innerHTML = "";

    ensureModelViewerLoaded()
      .then(() => {
        if (cancelled || !host) return;
        const mv = document.createElement("model-viewer");
        mv.setAttribute("src", src);
        mv.setAttribute("camera-controls", "");
        mv.setAttribute("auto-rotate", "");
        mv.setAttribute("environment-image", "neutral");
        mv.setAttribute(
          "style",
          "width:100%;height:220px;display:block;background:transparent;--poster-color:transparent;",
        );
        host.appendChild(mv);
      })
      .catch(() => {
        if (!cancelled && host) host.textContent = "Couldn't load the 3D preview.";
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  return <div ref={ref} className="overflow-hidden rounded-md border border-border bg-surface-2" />;
}
