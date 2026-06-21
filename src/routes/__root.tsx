import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter,
  HeadContent, Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, DataProvider } from "../lib/store";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stage-black px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-black text-amber-glow">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-white">Off the setlist</h2>
        <p className="mt-2 text-sm text-white/50">That song isn't in any of our binders.</p>
        <Link to="/" className="mt-6 inline-flex px-4 py-2 rounded-lg bg-amber-glow text-stage-black text-sm font-bold">
          Back to stage
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-stage-black px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-white">Mic check failed</h1>
        <p className="mt-2 text-sm text-white/50">Something went wrong. Try again.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex px-4 py-2 rounded-lg bg-amber-glow text-stage-black text-sm font-bold"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "ChordSync Live — chords & sync for performers" },
      { name: "description", content: "Search guitar chords, build live setlists, and sync your group's stage view in real time." },
      { name: "theme-color", content: "#050505" },
      { property: "og:title", content: "ChordSync Live" },
      { property: "og:description", content: "Chords, setlists, and synced stage mode for musicians." },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body className="bg-stage-black">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DataProvider>
          <Outlet />
        </DataProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
