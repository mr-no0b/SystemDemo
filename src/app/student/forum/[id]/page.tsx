import { redirect } from "next/navigation";

export default async function StudentForumPostRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/forum/${id}`);
}
