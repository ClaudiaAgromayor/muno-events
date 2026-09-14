import JoinGroup from "@/app/components/JoinGroup";

export default async function UnirseGrupoPage(props: PageProps<"/grupos/unirse/[code]">) {
  const { code } = await props.params;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <JoinGroup inviteCode={code} />
    </main>
  );
}
