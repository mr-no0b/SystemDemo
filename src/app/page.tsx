import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  if (session?.user?.role) {
    redirect(`/${session.user.role}`);
  }
  redirect("/login");
}
