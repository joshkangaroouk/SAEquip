import { useEffect, useRef } from "react";

const MODEL_VIEWER_SRC =
  "https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer.min.js";
/**
 * ⚠️ The same pin AND hash as the public widget's MODEL_VIEWER_SRI. The
 * dashboard holds the staff session, so a third-party script here needs the
 * integrity check more than the live site does — and had none (fixed
 * 2026-10-12). Change the version and the hash together, in both places:
 *   curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A
 */
const MODEL_VIEWER_SRI = "sha384-cprcVQt7wbUl0xngF3PGP6yBB7n4/t+4AoAMG9biiMCGFiWOdzUH10Ie2COTqFNW";

let loaderPromise: Promise<void> | null = null;

/** Loads the <model-viewer> custom element once, however many previews mount. */
function ensureModelViewerLoaded(): Promise<void> {
  if (customElements.get("model-viewer")) return Promise.resolve();
  if (!loaderPromise) {
    loaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.type = "module";
      script.integrity = MODEL_VIEWER_SRI;
      script.crossOrigin = "anonymous";
      script.src = MODEL_VIEWER_SRC;
      script.onload = () => resolve();
      script.onerror = () => {
        // Not remembered: a network blip must not disable previews until reload.
        loaderPromise = null;
        script.remove();
        reject(new Error("Failed to load the 3D viewer."));
      };
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

  return <div ref={ref} className="overflow-hidden rounded-md border border-border bg-paper" />;
}
