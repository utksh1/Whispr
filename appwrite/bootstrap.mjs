import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APPWRITE_ENDPOINT =
  process.env.APPWRITE_ENDPOINT?.trim() || "https://nyc.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID?.trim();
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY?.trim();
const APPWRITE_RESPONSE_FORMAT =
  process.env.APPWRITE_RESPONSE_FORMAT?.trim() || "1.8.0";
const BLUEPRINT_PATH =
  process.env.APPWRITE_BLUEPRINT_PATH?.trim() ||
  path.join(__dirname, "whispr-schema.blueprint.json");

function permissionCreateUsers() {
  return 'create("users")';
}

function collectionPermissionsFor(collectionId) {
  if (collectionId === "users" || collectionId === "user_keys") {
    return [permissionCreateUsers(), 'read("users")'];
  }

  return [permissionCreateUsers()];
}

async function sleep(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function ensureRequiredEnv() {
  if (!APPWRITE_PROJECT_ID) {
    throw new Error("Missing APPWRITE_PROJECT_ID.");
  }

  if (!APPWRITE_API_KEY) {
    throw new Error("Missing APPWRITE_API_KEY.");
  }
}

async function apiRequest(resourcePath, { method = "GET", body } = {}) {
  const response = await fetch(`${APPWRITE_ENDPOINT}${resourcePath}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": APPWRITE_PROJECT_ID,
      "X-Appwrite-Key": APPWRITE_API_KEY,
      "X-Appwrite-Response-Format": APPWRITE_RESPONSE_FORMAT,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || `${method} ${resourcePath} failed`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function getDatabase(databaseId) {
  try {
    return await apiRequest(`/databases/${databaseId}`);
  } catch (error) {
    if (error.status === 404) {
      return null;
    }

    throw error;
  }
}

async function ensureDatabase(database) {
  const existing = await getDatabase(database.id);

  if (existing) {
    console.log(`Database "${database.id}" already exists.`);
    return existing;
  }

  const created = await apiRequest("/databases", {
    method: "POST",
    body: {
      databaseId: database.id,
      name: database.name,
      enabled: true,
    },
  });

  console.log(`Created database "${database.id}".`);
  return created;
}

async function getCollection(databaseId, collectionId) {
  try {
    return await apiRequest(`/databases/${databaseId}/collections/${collectionId}`);
  } catch (error) {
    if (error.status === 404) {
      return null;
    }

    throw error;
  }
}

async function ensureCollection(databaseId, collection) {
  const desiredPermissions = collectionPermissionsFor(collection.id);
  const existing = await getCollection(databaseId, collection.id);

  if (!existing) {
    const created = await apiRequest(`/databases/${databaseId}/collections`, {
      method: "POST",
      body: {
        collectionId: collection.id,
        name: collection.name,
        permissions: desiredPermissions,
        documentSecurity: Boolean(collection.documentSecurity),
        enabled: true,
      },
    });

    console.log(`Created collection "${collection.id}".`);
    return created;
  }

  const currentPermissions = new Set(existing.$permissions || []);
  let needsUpdate = false;

  for (const permission of desiredPermissions) {
    if (!currentPermissions.has(permission)) {
      currentPermissions.add(permission);
      needsUpdate = true;
    }
  }

  if (needsUpdate) {
    await apiRequest(`/databases/${databaseId}/collections/${collection.id}`, {
      method: "PUT",
      body: {
        name: collection.name,
        permissions: Array.from(currentPermissions),
        documentSecurity: Boolean(collection.documentSecurity),
        enabled: true,
      },
    });
    console.log(`Updated collection permissions for "${collection.id}".`);
  } else {
    console.log(`Collection "${collection.id}" already exists.`);
  }

  return existing;
}

async function getAttribute(databaseId, collectionId, key) {
  try {
    return await apiRequest(`/databases/${databaseId}/collections/${collectionId}/attributes/${key}`);
  } catch (error) {
    if (error.status === 404) {
      return null;
    }

    throw error;
  }
}

function attributeEndpointFor(type) {
  if (type === "string" || type === "string[]") {
    return "string";
  }

  if (type === "boolean") {
    return "boolean";
  }

  throw new Error(`Unsupported attribute type "${type}".`);
}

function buildAttributePayload(attribute) {
  const payload = {
    key: attribute.key,
    required: Boolean(attribute.required),
  };

  if (attribute.type === "string" || attribute.type === "string[]") {
    payload.size = attribute.size;
    payload.array = attribute.type === "string[]" || Boolean(attribute.array);
  }

  if (attribute.type === "boolean") {
    payload.array = Boolean(attribute.array);
  }

  if (Object.prototype.hasOwnProperty.call(attribute, "default")) {
    payload.default = attribute.default;
  }

  return payload;
}

async function waitForAttribute(databaseId, collectionId, key) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const attribute = await getAttribute(databaseId, collectionId, key);

    if (!attribute) {
      await sleep(1000);
      continue;
    }

    if (attribute.status === "available") {
      return attribute;
    }

    if (attribute.status === "failed" || attribute.status === "stuck") {
      throw new Error(
        `Attribute "${key}" failed to become available: ${attribute.error || attribute.status}`
      );
    }

    await sleep(1000);
  }

  throw new Error(`Timed out waiting for attribute "${key}" to become available.`);
}

async function ensureAttribute(databaseId, collectionId, attribute) {
  const existing = await getAttribute(databaseId, collectionId, attribute.key);

  if (existing?.status === "available") {
    console.log(`Attribute "${collectionId}.${attribute.key}" already exists.`);
    return existing;
  }

  if (!existing) {
    await apiRequest(
      `/databases/${databaseId}/collections/${collectionId}/attributes/${attributeEndpointFor(attribute.type)}`,
      {
        method: "POST",
        body: buildAttributePayload(attribute),
      }
    );
    console.log(`Creating attribute "${collectionId}.${attribute.key}"...`);
  } else {
    console.log(`Waiting for attribute "${collectionId}.${attribute.key}"...`);
  }

  return waitForAttribute(databaseId, collectionId, attribute.key);
}

async function getIndex(databaseId, collectionId, key) {
  try {
    return await apiRequest(`/databases/${databaseId}/collections/${collectionId}/indexes/${key}`);
  } catch (error) {
    if (error.status === 404) {
      return null;
    }

    throw error;
  }
}

async function waitForIndex(databaseId, collectionId, key) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const index = await getIndex(databaseId, collectionId, key);

    if (!index) {
      await sleep(1000);
      continue;
    }

    if (index.status === "available") {
      return index;
    }

    if (index.status === "failed" || index.status === "stuck") {
      throw new Error(`Index "${key}" failed: ${index.error || index.status}`);
    }

    await sleep(1000);
  }

  throw new Error(`Timed out waiting for index "${key}" to become available.`);
}

async function ensureIndex(databaseId, collectionId, index) {
  const existing = await getIndex(databaseId, collectionId, index.key);

  if (existing?.status === "available") {
    console.log(`Index "${collectionId}.${index.key}" already exists.`);
    return existing;
  }

  if (!existing) {
    await apiRequest(`/databases/${databaseId}/collections/${collectionId}/indexes`, {
      method: "POST",
      body: {
        key: index.key,
        type: index.type,
        attributes: index.attributes,
        orders: index.orders || [],
        lengths: index.lengths || [],
      },
    });
    console.log(`Creating index "${collectionId}.${index.key}"...`);
  } else {
    console.log(`Waiting for index "${collectionId}.${index.key}"...`);
  }

  return waitForIndex(databaseId, collectionId, index.key);
}

async function main() {
  ensureRequiredEnv();

  const blueprint = JSON.parse(await readFile(BLUEPRINT_PATH, "utf8"));
  const { database, collections } = blueprint;

  console.log(`Bootstrapping Appwrite database "${database.id}" from ${BLUEPRINT_PATH}`);
  await ensureDatabase(database);

  for (const collection of collections) {
    await ensureCollection(database.id, collection);

    for (const attribute of collection.attributes || []) {
      await ensureAttribute(database.id, collection.id, attribute);
    }

    for (const index of collection.indexes || []) {
      await ensureIndex(database.id, collection.id, index);
    }
  }

  console.log("Appwrite bootstrap complete.");
}

main().catch((error) => {
  console.error("Bootstrap failed.");
  console.error(error.message || error);

  if (error.payload) {
    console.error(JSON.stringify(error.payload, null, 2));
  }

  process.exitCode = 1;
});
