import type { Metadata } from "next";

export const metadata: Metadata = { title: "Condiciones de uso" };

export default function TerminosPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 pt-10 pb-16 leading-relaxed [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_p]:mt-2">
      <h1 className="font-display text-3xl font-extrabold">Condiciones de uso</h1>
      <p className="text-sm text-muted">Última actualización: 1 de octubre de 2026</p>

      <h2>Qué es muno</h2>
      <p>
        Un proyecto personal y gratuito que reúne eventos de tecnología publicados en otras plataformas (Luma, Meetup,
        Eventbrite y webs de organizadores) y permite organizarse para ir con otras personas.
      </p>

      <h2>Información de los eventos</h2>
      <p>
        Los datos de cada evento (fecha, lugar, plazas, lista de espera) se copian de la plataforma original y pueden
        estar desactualizados unas horas. La inscripción real siempre se hace en la plataforma del organizador; muno
        no vende entradas ni garantiza plazas.
      </p>

      <h2>Lo que publicas</h2>
      <p>
        Eres responsable de los eventos, fotos y notas que subes. Sube solo contenido que tengas derecho a compartir y
        no publiques datos de otras personas sin su permiso. Podemos retirar contenido que incumpla esto.
      </p>

      <h2>Cuenta</h2>
      <p>
        Puedes dejar de usar muno y pedir el borrado de tu cuenta cuando quieras (ver la{" "}
        <a className="text-brand underline" href="/privacidad">
          política de privacidad
        </a>
        ). El servicio se ofrece tal cual, sin garantías de disponibilidad.
      </p>

      <h2>Contacto</h2>
      <p>
        <a className="text-brand underline" href="mailto:juanclo898@gmail.com">
          juanclo898@gmail.com
        </a>
      </p>
    </main>
  );
}
