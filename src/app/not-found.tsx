import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="text-xl font-semibold">This page doesn&apos;t exist</h1>
      <p className="text-sm text-muted-foreground">It may have been deleted or you followed an old link.</p>
      <Link href="/" className="mt-2 text-sm font-medium text-primary hover:underline">
        Back to the panel
      </Link>
    </main>
  );
}
