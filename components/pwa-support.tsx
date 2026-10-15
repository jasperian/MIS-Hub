"use client";

import { useEffect, useState } from "react";

export default function PwaSupport() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const updateConnection = () => setOffline(!navigator.onLine);
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then(async (registration) => {
          await navigator.serviceWorker.ready;
          const assets = [
            ...[
              ...document.querySelectorAll<HTMLScriptElement>("script[src]"),
            ].map((element) => element.src),
            ...[
              ...document.querySelectorAll<HTMLLinkElement>(
                'link[rel="stylesheet"][href]',
              ),
            ].map((element) => element.href),
          ];
          registration.active?.postMessage({
            type: "CACHE_APP_ASSETS",
            assets,
          });
        })
        .catch(() => {
          // The application still works normally when service workers are unavailable.
        });
    }

    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline-banner" role="status">
      Offline — showing the latest saved data. Changes need a connection.
    </div>
  );
}
