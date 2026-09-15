import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const ENV_PATH = path.join(PROJECT_ROOT, ".env");
const BACKUP_DIR = path.join(PROJECT_ROOT, "backups");

function loadEnvFile() {
  return fs.readFile(ENV_PATH, "utf8")
    .then(content => Object.fromEntries(content
      .split(/\r?\n/)
      .filter(line => line.trim() && !line.trim().startsWith("#"))
      .map(line => {
        const separator = line.indexOf("=");
        if (separator < 0) return [line.trim(), ""];
        const key = line.slice(0, separator).trim();
        const rawValue = line.slice(separator + 1).trim();
        const quote = rawValue[0];
        const value = quote === "\"" || quote === "'"
          ? rawValue.slice(1, rawValue.indexOf(quote, 1) > 0 ? rawValue.indexOf(quote, 1) : rawValue.length)
          : rawValue;
        return [key, value];
      })))
    .catch(() => ({}));
}

function fail(message) {
  throw new Error(message);
}

function base64Url(value) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(account) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(account.private_key, "base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = await response.json();
  if (!response.ok) fail(`OAuth token request failed: ${JSON.stringify(payload)}`);
  return payload.access_token;
}

async function firestoreRequest(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok) {
    const detail = typeof payload === "string" ? payload : JSON.stringify(payload);
    fail(`Firestore request failed (${response.status}): ${detail}`);
  }
  return payload;
}

async function listRootCollections(baseUrl, token) {
  const collections = [];
  let pageToken = "";
  do {
    const payload = await firestoreRequest(`${baseUrl}:listCollectionIds`, token, {
      method: "POST",
      body: JSON.stringify({ pageSize: 1000, ...(pageToken ? { pageToken } : {}) }),
    });
    collections.push(...(payload.collectionIds || []));
    pageToken = payload.nextPageToken || "";
  } while (pageToken);
  return collections.sort();
}

async function listDocuments(baseUrl, token, collectionId) {
  const documents = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "300", ...(pageToken ? { pageToken } : {}) });
    const payload = await firestoreRequest(`${baseUrl}/${encodeURIComponent(collectionId)}?${query}`, token);
    documents.push(...(payload.documents || []));
    pageToken = payload.nextPageToken || "";
  } while (pageToken);
  return documents;
}

function timestampForFilename(date = new Date()) {
  const pad = value => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

async function loadServiceAccount(env) {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || env.GOOGLE_APPLICATION_CREDENTIALS;
  if (inline) {
    try { return JSON.parse(inline); } catch (error) { fail(`Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${error.message}`); }
  }
  if (credentialsPath) {
    const resolvedPath = path.isAbsolute(credentialsPath) ? credentialsPath : path.resolve(PROJECT_ROOT, credentialsPath);
    try { return JSON.parse(await fs.readFile(resolvedPath, "utf8")); } catch (error) { fail(`Could not read GOOGLE_APPLICATION_CREDENTIALS: ${error.message}`); }
  }
  fail("Missing FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.");
}

async function main() {
  const env = await loadEnvFile();
  const projectId = process.env.FIREBASE_PROJECT_ID
    || process.env.VITE_FIREBASE_PROJECT_ID
    || env.FIREBASE_PROJECT_ID
    || env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) fail("Missing FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID in the environment or .env.");

  const account = await loadServiceAccount(env);
  const token = await getAccessToken(account);
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
  const collectionIds = await listRootCollections(baseUrl, token);
  const collections = {};
  let documentCount = 0;

  for (const collectionId of collectionIds) {
    const documents = await listDocuments(baseUrl, token, collectionId);
    collections[collectionId] = { documents };
    documentCount += documents.length;
    console.log(`[backup] ${collectionId}: ${documents.length} documents`);
  }

  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const outputPath = path.join(BACKUP_DIR, `firestore-backup-${timestampForFilename()}.json`);
  const backup = {
    exportedAt: new Date().toISOString(),
    projectId,
    database: "(default)",
    collectionCount: collectionIds.length,
    documentCount,
    collections,
  };
  await fs.writeFile(outputPath, `${JSON.stringify(backup, null, 2)}\n`, "utf8");

  console.log(`[backup] Completed: ${documentCount} documents across ${collectionIds.length} root collections.`);
  console.log(`[backup] File: ${path.relative(PROJECT_ROOT, outputPath)}`);
}

main().catch(error => {
  console.error(`[backup] Failed: ${error.message}`);
  process.exitCode = 1;
});
