import { redirect } from "next/navigation";
import { signupsAllowed } from "@/lib/instance-config";
import RegisterForm from "./register-form";

export default async function RegisterPage() {
  const open = await signupsAllowed();
  if (!open) redirect("/login");

  return <RegisterForm />;
}
