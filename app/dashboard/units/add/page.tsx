import { redirect } from "next/navigation";

export default function LegacyAddUnitPage() {
  redirect("/dashboard/properties");
}
