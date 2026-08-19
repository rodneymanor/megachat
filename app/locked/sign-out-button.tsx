"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

/**
 * Sign-out for the locked page, mirroring components/sidebar.tsx's
 * handleSignOut — the dashboard sidebar isn't reachable from here since
 * getWorkspace() (behind the (dashboard) layout) is what redirects here.
 */
export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="w-full rounded-lg border border-[#F2EFEA]/12 px-4 py-2.5 text-sm font-medium text-[#F2EFEA] hover:bg-[#141312]"
    >
      Sign out
    </button>
  );
}
