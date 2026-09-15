import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const APPLY = process.argv.includes("--apply");
const BATCH_SIZE = 450;
const COLLECTION = "folder_items";
const TARGET_COLLECTION = "folder_items_v2";

function loadLocalEnv() {
  try {
    const content = requireEnvFile();
    return Object.fromEntries(content.split(/\r?\n/).filter(line => line && !line.trim().startsWith("#")).map(line => {
      const separator = line.indexOf("=");
      return separator < 0 ? [line.trim(), ""] : [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^(['\"])(.*)\1$/, "$2")];
    }));
  } catch {
    return {};
  }
}

function requireEnvFile() {
  return readFileSync(".env", "utf8");
}

const LOCAL_ENV = loadLocalEnv();
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || LOCAL_ENV.VITE_FIREBASE_PROJECT_ID;

function fail(message) {
  throw new Error(message);
}

async function loadServiceAccount() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (inline) return JSON.parse(inline);
  if (file) return JSON.parse(await fs.readFile(file, "utf8"));
  fail("Missing FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.");
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
  const signature = signer.sign(account.private_key, "base64url");
  const assertion = `${unsigned}.${signature}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const payload = await response.json();
  if (!response.ok) fail(`OAuth token request failed: ${JSON.stringify(payload)}`);
  return payload.access_token;
}

function decodeValue(value) {
  if (!value) return null;
  if (Object.hasOwn(value, "nullValue")) return null;
  if (Object.hasOwn(value, "stringValue")) return value.stringValue;
  if (Object.hasOwn(value, "integerValue")) return Number(value.integerValue);
  if (Object.hasOwn(value, "doubleValue")) return value.doubleValue;
  if (Object.hasOwn(value, "booleanValue")) return value.booleanValue;
  if (Object.hasOwn(value, "timestampValue")) return value.timestampValue;
  if (Object.hasOwn(value, "referenceValue")) return value.referenceValue;
  if (Object.hasOwn(value, "arrayValue")) return (value.arrayValue.values || []).map(decodeValue);
  if (Object.hasOwn(value, "mapValue")) return decodeFields(value.mapValue.fields || {});
  return null;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === "object") return { mapValue: { fields: encodeFields(value) } };
  return { stringValue: String(value) };
}

function encodeFields(value) {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, encodeValue(entry)]));
}

function stableId(rootKey, nodePath) {
  return crypto.createHash("sha256").update(`${rootKey}\0${nodePath}`).digest("hex").slice(0, 40);
}

function parseItems(value, source) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn(`[migration] Invalid JSON in ${source}: ${error.message}`);
    }
  }
  return [];
}

function nodeChildren(item) {
  if (!item || typeof item !== "object") return [];
  if (Array.isArray(item.children)) return item.children;
  if (Array.isArray(item.items)) return item.items;
  return [];
}

function flattenTree(items, rootKey, parentId = null, nodePath = "", output = []) {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item || typeof item !== "object") continue;
    const currentPath = nodePath ? `${nodePath}/${index}` : String(index);
    const id = stableId(rootKey, currentPath);
    const children = nodeChildren(item);
    const isFolder = item.type === "folder" || item.isFolder === true || children.length > 0;
    const record = {
      ...item,
      id,
      parentId,
      rootKey,
      order: index,
      type: isFolder ? "folder" : (item.type || "link"),
      isFolder,
      legacyId: item.id || null,
      legacyPath: currentPath,
      migratedAt: new Date().toISOString(),
    };
    delete record.children;
    delete record.items;
    output.push(record);
    if (isFolder) flattenTree(children, rootKey, id, currentPath, output);
  }
  return output;
}

async function firestoreRequest(baseUrl, token, options = {}) {
  const response = await fetch(baseUrl, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok) fail(`Firestore request failed (${response.status}): ${typeof payload === "string" ? payload : JSON.stringify(payload)}`);
  return payload;
}

async function listDocuments(baseUrl, token, collection) {
  const documents = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "300", ...(pageToken ? { pageToken } : {}) });
    const payload = await firestoreRequest(`${baseUrl}/${collection}?${query}`, token);
    documents.push(...(payload.documents || []));
    pageToken = payload.nextPageToken || "";
  } while (pageToken);
  return documents;
}

function extractRoots(config, folderDocuments) {
  const roots = new Map();
  for (const document of folderDocuments) {
    const rootKey = document.name.split("/").pop();
    const fields = decodeFields(document.fields || {});
    const items = parseItems(fields.items, `folder_items/${rootKey}`);
    if (items.length) roots.set(rootKey, { rootKey, items, source: "folder_items", documentId: rootKey });
  }
  for (const [key, value] of Object.entries(config || {})) {
    if (!key.startsWith("folder_")) continue;
    if (roots.has(key)) continue;
    const items = parseItems(value, `app_config/main.${key}`);
    if (items.length) roots.set(key, { rootKey: key, items, source: "app_config", documentId: "main" });
  }
  const structure = config?.folderStructure;
  if (structure && typeof structure === "object") {
    for (const [rootKey, value] of Object.entries(structure)) {
      if (roots.has(rootKey)) continue;
      const items = parseItems(value, `app_config/main.folderStructure.${rootKey}`);
      if (items.length) roots.set(rootKey, { rootKey, items, source: "folderStructure", documentId: "main" });
    }
  }
  return [...roots.values()];
}

async function writeBatch(baseUrl, token, writes) {
  for (let offset = 0; offset < writes.length; offset += BATCH_SIZE) {
    const chunk = writes.slice(offset, offset + BATCH_SIZE);
    await firestoreRequest(`${baseUrl}:batchWrite`, token, { method: "POST", body: JSON.stringify({ writes: chunk }) });
    console.log(`[migration] wrote ${Math.min(offset + chunk.length, writes.length)}/${writes.length} documents`);
  }
}

async function main() {
  if (!PROJECT_ID) fail("Missing FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID.");
  const account = await loadServiceAccount();
  const token = await getAccessToken(account);
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const [configDocument, folderDocuments] = await Promise.all([
    firestoreRequest(`${baseUrl}/app_config/main`, token),
    listDocuments(baseUrl, token, COLLECTION),
  ]);
  const config = decodeFields(configDocument.fields || {});
  const roots = extractRoots(config, folderDocuments);
  const migratedItems = roots.flatMap(root => flattenTree(root.items, root.rootKey));
  const sourceCount = roots.reduce((sum, root) => sum + flattenTree(root.items, root.rootKey).length, 0);
  const timestamp = new Date().toISOString();
  const backupDir = path.resolve("backups");
  const backupPath = path.join(backupDir, `folder-migration-v1-${timestamp.replace(/[:.]/g, "-")}.json`);
  const snapshot = {
    exportedAt: timestamp,
    sourceCount,
    appConfigMain: config,
    folderItemsDocuments: folderDocuments,
    roots: roots.map(({ items, ...metadata }) => ({ ...metadata, itemCount: flattenTree(items, metadata.rootKey).length })),
  };
  await fs.mkdir(backupDir, { recursive: true });
  await fs.writeFile(backupPath, JSON.stringify(snapshot, null, 2), "utf8");
  console.log(`[migration] backup written: ${backupPath}`);
  console.log(`[migration] source roots: ${roots.length}; source items: ${sourceCount}; transformed items: ${migratedItems.length}`);
  if (sourceCount !== migratedItems.length) fail("Zero-loss check failed: source and transformed item counts differ.");
  if (!APPLY) {
    console.log("[migration] DRY RUN complete. No Firestore data was mutated. Use --apply after reviewing the backup.");
    return;
  }
  const writes = migratedItems.map(item => ({
    update: {
      name: `projects/${PROJECT_ID}/databases/(default)/documents/${TARGET_COLLECTION}/${item.id}`,
      fields: encodeFields(item),
    },
  }));
  await writeBatch(baseUrl, token, writes);
  const version = `${timestamp}-${crypto.createHash("sha256").update(migratedItems.map(item => item.id).join("\n")).digest("hex").slice(0, 12)}`;
  await firestoreRequest(`${baseUrl}/app_metadata/version`, token, {
    method: "PATCH",
    body: JSON.stringify({ fields: encodeFields({ version, lastUpdated: timestamp }) }),
  });
  console.log(`[migration] version written: ${version}`);
  console.log(`[migration] completed without deleting or mutating app_config/main or folder_items.`);
}

main().catch(error => {
  console.error(`[migration] FAILED: ${error.message}`);
  process.exitCode = 1;
});
