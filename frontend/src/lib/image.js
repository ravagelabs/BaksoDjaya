// Memperkecil foto di browser sebelum di-upload: sisi terpanjang maksimal 1000px, format WebP
export async function resizeImage(file, max = 1000, quality = 0.85) {
  if (!file.type.startsWith("image/")) throw new Error("File harus berupa gambar.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
