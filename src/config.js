const defaultWorkerUrl = "https://sawaed.hamodemsg.workers.dev";

const normalizeBaseUrl = (value) => {
  if (!value || typeof value !== "string") return defaultWorkerUrl;
  return value.trim().replace(/\/+$/, "");
};

export const cloudflareWorkerBaseUrl = normalizeBaseUrl(import.meta.env.VITE_CLOUDFLARE_WORKER_URL || defaultWorkerUrl);

export const buildCloudflareWorkerFileUrl = (fileId) => {
  const normalizedId = String(fileId ?? "").trim();
  if (!normalizedId) return `${cloudflareWorkerBaseUrl}/`;
  return `${cloudflareWorkerBaseUrl}/?fileId=${encodeURIComponent(normalizedId)}`;
};
