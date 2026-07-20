const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml";

/** Opens a native file picker restricted to raster images + SVG, reads the chosen file as a data URI, and probes its intrinsic size via a throwaway `Image` (works for SVGs too - browsers rasterize far enough to report a size, falling back to 160x160 if a malformed file never fires `load`). */
export function openImageFilePicker(onLoad: (dataUrl: string, naturalWidth: number, naturalHeight: number) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ACCEPT;
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const probe = new Image();
      probe.onload = () => onLoad(dataUrl, probe.naturalWidth || 160, probe.naturalHeight || 160);
      probe.onerror = () => onLoad(dataUrl, 160, 160);
      probe.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
  input.click();
}
