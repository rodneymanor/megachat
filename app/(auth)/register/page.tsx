import { redirect } from "next/navigation";
import { signupsAllowed } from "@/lib/instance-config";
import { isSupabaseConfigured } from "@/lib/config";
import RegisterForm from "./register-form";

export default async function RegisterPage() {
  if (!isSupabaseConfigured()) redirect("/setup");
  const open = await signupsAllowed();
  if (!open) redirect("/login");

  return <RegisterForm />;
}
