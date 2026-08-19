import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Cached per-request: whether this instance currently accepts new signups.
 * Backed by the `signups_allowed()` Postgres function (true when auth.users
 * is empty, or when instance_config.allow_signups is set).
 *
 * Fails closed: any RPC error is treated as signups disabled.
 */
export const signupsAllowed = cache(async (): Promise<boolean> => {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("signups_allowed");

  if (error) {
    console.error("signupsAllowed: RPC error, failing closed", error);
    return false;
  }

  return Boolean(data);
});
