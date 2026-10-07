import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { homePathFor } from "@/lib/permissions";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  if ((await db.user.count()) === 0) redirect("/setup");
  const { next } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-white">B</span>
          <div className="leading-tight">
            <p className="text-[15px] font-bold tracking-tight">BUYUR</p>
            <p className="text-xs text-muted-foreground">Growth & Sales Panel</p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h1 className="text-lg font-semibold">Sign in</h1>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">Use your BUYUR team account.</p>
          <LoginForm next={next} />
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">Internal tool · Access is restricted to the BUYUR team</p>
      </div>
    </main>
  );
}
