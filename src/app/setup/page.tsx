import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up" };

export default async function SetupPage() {
  // One-time screen: closed forever once any user exists.
  if ((await db.user.count()) > 0) redirect("/login");
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
          <h1 className="text-lg font-semibold">Create the admin account</h1>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">
            First-time setup. This account can add and remove everyone else. This screen closes once it&apos;s created.
          </p>
          <SetupForm />
        </div>
      </div>
    </main>
  );
}
