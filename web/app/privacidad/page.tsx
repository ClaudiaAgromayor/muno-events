import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacidad" };

export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 pt-10 pb-16 leading-relaxed [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2">
      <h1 className="font-display text-3xl font-extrabold">Política de privacidad</h1>
      <p className="text-sm text-muted">Última actualización: 1 de octubre de 2026</p>

      <p>
        muno (muno-events.vercel.app) es un proyecto personal que reúne eventos de tecnología en Madrid y permite
        apuntarse con otras personas. Esta página explica qué datos guardamos y para qué.
      </p>

      <h2>Qué datos guardamos</h2>
      <ul>
        <li>
          <b>Al entrar</b> con Google, GitHub o email: tu email, tu nombre y tu foto de perfil, tal como los
          comparte ese proveedor. No recibimos ni guardamos tu contraseña.
        </li>
        <li>
          <b>Lo que haces en muno</b>: los eventos a los que marcas «Voy» o «Me interesa», las comunidades a las que te
          unes, y las fotos, notas y documentos que subes.
        </li>
        <li>
          <b>Lo que escribes en tu perfil</b>: a qué te dedicas y tu LinkedIn, si los añades.
        </li>
      </ul>

      <h2>Quién ve tus datos</h2>
      <ul>
        <li>Tu email no se muestra a nadie.</li>
        <li>
          Tu nombre está <b>oculto por defecto</b> para el resto de asistentes; solo se muestra si activas «Mostrar mi
          nombre» en tu perfil. Dentro de una comunidad a la que te unes, sus miembros sí ven tu nombre.
        </li>
        <li>
          Las fotos y notas de un evento solo las ven quienes también marcaron que fueron, salvo que elijas que sean
          públicas.
        </li>
      </ul>

      <h2>Para qué los usamos</h2>
      <p>
        Solo para que la app funcione: identificarte, guardar tus planes y mostrar quién va a cada evento. No vendemos
        datos, no hay publicidad y no los compartimos con terceros.
      </p>

      <h2>Dónde se guardan</h2>
      <p>
        En Supabase (base de datos y archivos) y la web se sirve desde Vercel. Ambos actúan como proveedores de
        infraestructura.
      </p>

      <h2>Datos de Google</h2>
      <p>
        Si entras con Google, solo pedimos los permisos básicos de identidad (email, nombre y foto). El uso de esa
        información cumple la{" "}
        <a className="text-brand underline" href="https://developers.google.com/terms/api-services-user-data-policy">
          Política de datos de usuario de los servicios de API de Google
        </a>
        , incluidos los requisitos de uso limitado.
      </p>

      <h2>Borrar tu cuenta</h2>
      <p>
        Puedes pedir que borremos tu cuenta y todo tu contenido escribiendo a{" "}
        <a className="text-brand underline" href="mailto:juanclo898@gmail.com">
          juanclo898@gmail.com
        </a>
        . Lo haremos en un plazo máximo de 30 días.
      </p>
    </main>
  );
}
