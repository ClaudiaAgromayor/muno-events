import { NextResponse } from "next/server";
import { getEvents } from "@/app/lib/data";

// Redirige a la URL real del evento (Luma/Meetup/Eventbrite) sin que el enlace
// visible en nuestra web muestre esa plataforma. En cuanto el navegador sigue
// la redireccion, la barra de direcciones si pasa a mostrar el dominio de
// destino -- eso no se puede ocultar, solo lo que nosotros mostramos antes del clic.
export async function GET(_request: Request, ctx: RouteContext<"/ir/[id]">) {
  const { id } = await ctx.params;
  const events = getEvents();
  const event = events.find((e) => e.id === decodeURIComponent(id));

  if (!event?.url) {
    return NextResponse.redirect(new URL("/", _request.url));
  }

  return NextResponse.redirect(event.url);
}
