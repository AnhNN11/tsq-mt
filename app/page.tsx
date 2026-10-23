import StudentWorkspace from "@/components/student-workspace";
import { AuthProvider } from "@/components/auth-context";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export default async function Home() {
  await connection();
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <AuthProvider user={user}>
      <StudentWorkspace />
    </AuthProvider>
  );
}
