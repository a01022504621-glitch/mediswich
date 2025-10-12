// app/(m-protected)/m/page.tsx
import { redirect } from "next/navigation";

export default function MIndex() {
  redirect("/m/dashboard");
}


