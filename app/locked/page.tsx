import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

/**
 * Hosted-mode landing for a workspace whose billing isn't active.
 * Deliberately OUTSIDE the (dashboard) route group: it must not go through
 * getWorkspace() (lib/workspace.ts), which is what redirects here in the
 * first place — routing through it again would loop.
 */
export default async function LockedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0C0B0B] px-4 text-[#F2EFEA]">
      <div className="w-full max-w-sm space-y-6 text-center">
        <Image src="/logo.png" alt="MegaChat" width={48} height={48} className="mx-auto" />

        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#F2EFEA]">
            This workspace isn&apos;t active yet
          </h1>
          <p className="text-sm text-[#F2EFEA]/62">
            Your account exists — it just isn&apos;t switched on yet. Contact the
            person who runs this instance to activate it.
          </p>
        </div>

        <SignOutButton />
      </div>
    </div>
  );
}
