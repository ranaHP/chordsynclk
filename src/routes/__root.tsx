import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, Outlet, createRootRouteWithContext, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, DataProvider } from "../lib/store";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stage-black px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-black text-amber-glow">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-white">Off the setlist</h2>
        <p className="mt-2 text-sm text-white/50">That song isn't in any of our binders.</p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-lg bg-amber-glow px-4 py-2 text-sm font-bold text-stage-black"
        >
          Back to stage
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-stage-black px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-white">Mic check failed</h1>
        <p className="mt-2 text-sm text-white/50">Something went wrong. Try again.</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex rounded-lg bg-amber-glow px-4 py-2 text-sm font-bold text-stage-black"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

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
