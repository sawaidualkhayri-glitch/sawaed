export async function fetchBinaryBlob(url, expectedTypes = ["application/pdf"], onProgress) {
  let response;
  try {
    response = await fetch(url, { mode: "cors", cache: "no-store" });
  } catch (err) {
    throw new Error("NETWORK_ERROR:" + (err?.message || err));
  }

  if (!response.ok) throw new Error("HTTP " + response.status);
  const contentType = (response.headers.get("Content-Type") || "").toLowerCase();
  if (contentType.includes("text/html") || contentType.includes("application/xhtml+xml")) {
    const text = await response.text().catch(() => "");
    throw new Error("HTML_RESPONSE:" + (text || "").slice(0, 512).replace(/\s+/g, " "));
  }

  const isAllowed = expectedTypes.some((type) => contentType.includes(type))
    || contentType.includes("application/pdf")
    || contentType.includes("image/")
    || contentType.includes("octet-stream");
  if (!isAllowed) throw new Error(`Invalid response type: ${contentType}`);

  const contentLength = response.headers.get("content-length") || response.headers.get("Content-Length");
  const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
  const reader = response.body?.getReader();
  if (!reader) {
    const blob = await response.blob();
    if (!blob || blob.size === 0) throw new Error("Empty binary response");
    onProgress?.(100);
    return new Blob([blob], { type: response.headers.get("Content-Type") || expectedTypes[0] });
  }

  const chunks = [];
  let loadedBytes = 0;
  let lastPercent = 0;
  onProgress?.(0);
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loadedBytes += value.byteLength;
    const percent = totalBytes > 0
      ? Math.min(99, Math.round((loadedBytes / totalBytes) * 100))
      : Math.min(99, Math.max(lastPercent + 1, Math.round(loadedBytes / (1024 * 1024))));
    lastPercent = percent;
    onProgress?.(percent);
  }

  const blob = new Blob(chunks, { type: response.headers.get("Content-Type") || expectedTypes[0] });
  if (!blob || blob.size === 0) throw new Error("Empty binary response");
  onProgress?.(100);
  return blob;
}
