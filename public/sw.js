/* MIS Hub offline worker. Password and reveal endpoints are never persisted. */
const VERSION = "mis-hub-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];

const OFFLINE_DATA_ROUTES = new Set([
  "/api/auth/me",
  "/api/records",
  "/api/directory",
  "/api/sap-users",
  "/api/microsoft-365",
  "/api/personal-tasks",
  "/api/personal-notes",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("mis-hub-") &&
                ![SHELL_CACHE, DATA_CACHE].includes(key),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (
    event.data?.type !== "CACHE_APP_ASSETS" ||
    !Array.isArray(event.data.assets)
  )
    return;
  const localAssets = event.data.assets.filter((asset) => {
    try {
      return new URL(asset).origin === self.location.origin;
    } catch {
      return false;
    }
  });
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(localAssets)),
  );
});

function offlineDataKey(request) {
  const url = new URL(request.url);
  const dealership = request.headers.get("x-dealership-id") || "shared";
  url.searchParams.set("__offline_dealership", dealership);
  return new Request(url.toString(), { method: "GET" });
}

async function clearOfflineData() {
  await caches.delete(DATA_CACHE);
}

async function networkFirstData(request) {
  const cache = await caches.open(DATA_CACHE);
  const key = offlineDataKey(request);
  try {
    const response = await fetch(request);
    if (response.status === 401) await clearOfflineData();
    if (response.ok) await cache.put(key, response.clone());
    return response;
  } catch (error) {
    const saved = await cache.match(key);
    if (!saved) throw error;
    const headers = new Headers(saved.headers);
    headers.set("X-MIS-Offline", "true");
    return new Response(saved.body, {
      status: saved.status,
      statusText: saved.statusText,
      headers,
    });
  }
}

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    return (
      (await cache.match(request)) ||
      (await cache.match("/")) ||
      Promise.reject(error)
    );
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.method !== "GET") {
    if (url.pathname === "/api/auth/logout") {
      event.respondWith(
        fetch(request).then(async (response) => {
          if (response.ok) await clearOfflineData();
          return response;
        }),
      );
    }
    return;
  }

  if (OFFLINE_DATA_ROUTES.has(url.pathname)) {
    event.respondWith(networkFirstData(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/icon.svg"
  ) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const saved = await cache.match(request);
        if (saved) return saved;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      }),
    );
  }
});
