import Discover from "@/app/components/Discover";
import { getLastRun, getUpcomingEvents } from "@/app/lib/queries";

// La lista se regenera como mucho cada 5 minutos (el scraper escribe cada 3 horas, y los
// eventos añadidos a mano aparecen en ≤5 min). Lo social (quién va) se carga en el navegador.
export const revalidate = 300;

function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}

export default async function Home() {
  const [events, run] = await Promise.all([getUpcomingEvents(), getLastRun()]);
  return <Discover events={events} updatedAt={run?.finished_at ? ago(run.finished_at) : null} />;
}
