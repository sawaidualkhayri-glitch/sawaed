export function isImageFile(fileName = "", mimeType = "", title = "") {
  const itemType = typeof fileName === "object" ? fileName.type : "";
  const name = typeof fileName === "object" ? fileName.name || fileName.title || fileName.url || "" : `${fileName} ${title}`;
  return /^image\//i.test(String(mimeType || ""))
    || /^image$/i.test(String(itemType || ""))
    || /\.(jpg|jpeg|png|webp|gif|svg)(\?|#|$)/i.test(String(name || ""));
}

export function isPdfFile(fileName = "", mimeType = "", title = "") {
  const itemType = typeof fileName === "object" ? fileName.type : "";
  const name = typeof fileName === "object" ? fileName.name || fileName.title || fileName.url || "" : `${fileName} ${title}`;
  return String(mimeType || "").toLowerCase().includes("pdf")
    || String(itemType || "").toLowerCase().includes("pdf")
    || /\.pdf(\?|#|$)/i.test(String(name || ""));
}
