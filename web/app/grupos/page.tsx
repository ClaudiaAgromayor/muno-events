import Groups from "@/app/components/Groups";

export default function GruposPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-10 sm:py-16">
      <a href="/" className="text-xs uppercase tracking-wider text-muted underline decoration-1 underline-offset-2 hover:text-foreground">
        ← Volver
      </a>
      <h1 className="font-display mt-4 text-5xl leading-none">Mis grupos</h1>
      <p className="mt-3 max-w-md text-sm text-muted">
        Crea un grupo, comparte el link con tus amigas, y cualquiera del grupo puede marcar &quot;vamos&quot; en nombre de todas a un evento de golpe.
      </p>
      <div className="pt-10">
        <Groups />
      </div>
    </main>
  );
}
