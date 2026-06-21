const cache = new Map();
const inflight = new Map();
const tagIndex = new Map();

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function linkTags(key, tags) {
  tags.forEach((tag) => {
    if (!tagIndex.has(tag)) tagIndex.set(tag, new Set());
    tagIndex.get(tag)?.add(key);
  });
}

function unlinkTags(key, tags = []) {
  tags.forEach((tag) => {
    const bucket = tagIndex.get(tag);
    if (!bucket) return;
    bucket.delete(key);
    if (bucket.size === 0) tagIndex.delete(tag);
  });
}

function removeEntry(key) {
  const existing = cache.get(key);
  if (!existing) return;
  cache.delete(key);
  unlinkTags(key, existing.tags);
}

export function buildCacheKey(namespace, payload) {
  return `${namespace}:${stableStringify(payload)}`;
}

export async function remember(key, ttlMs, tags, loader) {
  const now = Date.now();
  const existing = cache.get(key);
  if (existing && existing.expiresAt > now) return existing.value;
  if (existing) removeEntry(key);

  if (inflight.has(key)) return inflight.get(key);

  const pending = Promise.resolve()
    .then(loader)
    .then((value) => {
      const entry = { value, expiresAt: Date.now() + ttlMs, tags };
      cache.set(key, entry);
      linkTags(key, tags);
      return value;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, pending);
  return pending;
}

export function invalidateTags(tags = []) {
  const keys = new Set();
  tags.forEach((tag) => {
    tagIndex.get(tag)?.forEach((key) => keys.add(key));
  });
  keys.forEach((key) => removeEntry(key));
}
