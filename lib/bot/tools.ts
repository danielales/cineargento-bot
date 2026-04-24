// lib/bot/tools.ts
// Funciones que el bot puede llamar para consultar datos reales de Supabase
// Se integran como "tools" en la API de Claude (function calling)

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Definición de tools para Claude ─────────────────────────────────────────
// Claude lee estas definiciones y decide cuándo llamar cada función

export const TOOLS = [
  {
    name: "buscar_funciones",
    description:
      "Busca funciones de cine en la cartelera actual. Usar cuando el usuario pregunta por horarios, funciones o dónde ver una película.",
    input_schema: {
      type: "object",
      properties: {
        pelicula: {
          type: "string",
          description: "Nombre o parte del nombre de la película (opcional)",
        },
        barrio: {
          type: "string",
          description: "Barrio donde buscar cines (opcional)",
        },
        cadena: {
          type: "string",
          description: "Nombre de la cadena: Cinemark, Hoyts, Village, Showcase, Cinestar (opcional)",
        },
        formato: {
          type: "string",
          description: "Formato de la función: 2D, 3D, 4DX, XD, Premium (opcional)",
        },
        idioma: {
          type: "string",
          description: "Idioma: subtitulada, doblada (opcional)",
        },
      },
      required: [],
    },
  },
  {
    name: "buscar_descuentos",
    description:
      "Devuelve descuentos disponibles. Usar cuando el usuario pregunta por promociones, 2x1, descuentos de banco, jubilados, estudiantes, miércoles, etc.",
    input_schema: {
      type: "object",
      properties: {
        cadena: {
          type: "string",
          description: "Nombre de la cadena (opcional, devuelve todas si no se especifica)",
        },
        tipo: {
          type: "string",
          description: "Tipo de descuento: jubilado, estudiante, miercoles, banco, cupon, club (opcional)",
        },
        banco: {
          type: "string",
          description: "Nombre del banco (opcional)",
        },
      },
      required: [],
    },
  },
  {
    name: "listar_peliculas",
    description:
      "Lista las películas en cartelera actualmente. Usar cuando el usuario pregunta qué hay en cartelera o qué películas están disponibles.",
    input_schema: {
      type: "object",
      properties: {
        limite: {
          type: "number",
          description: "Cantidad máxima de películas a devolver (default: 10)",
        },
      },
      required: [],
    },
  },
  {
    name: "comparar_precios",
    description:
      "Compara el precio de una película en distintas cadenas. Usar cuando el usuario quiere saber dónde es más barata una entrada.",
    input_schema: {
      type: "object",
      properties: {
        pelicula: {
          type: "string",
          description: "Nombre de la película a comparar",
        },
      },
      required: ["pelicula"],
    },
  },
];

// ─── Implementaciones ─────────────────────────────────────────────────────────

export async function buscar_funciones(args: {
  pelicula?: string;
  barrio?: string;
  cadena?: string;
  formato?: string;
  idioma?: string;
}): Promise<string> {
  let query = supabase
    .from("funciones")
    .select(`
      hora,
      idioma,
      formato,
      observaciones,
      precio_base,
      nombre_cine,
      cines!inner (
        nombre,
        barrio,
        direccion,
        cadenas!inner ( nombre )
      )
    `)
    .limit(8);

  if (args.pelicula) {
    query = query.ilike("url_pelicula", `%${args.pelicula}%`);
  }

  if (args.barrio) {
    query = query.ilike("cines.barrio", `%${args.barrio}%`);
  }

  if (args.cadena) {
    query = query.ilike("cines.cadenas.nombre", `%${args.cadena}%`);
  }

  if (args.formato) {
    query = query.ilike("formato", `%${args.formato}%`);
  }

  if (args.idioma) {
    query = query.ilike("idioma", `%${args.idioma}%`);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Error buscando funciones: ${error.message}`);
  if (!data || data.length === 0) return "No encontré funciones con esos filtros.";

  return JSON.stringify(data);
}

export async function buscar_descuentos(args: {
  cadena?: string;
  tipo?: string;
  banco?: string;
}): Promise<string> {
  let query = supabase
    .from("discounts")
    .select(`
      name,
      discount_type,
      discount_value,
      trigger_type,
      trigger_day,
      trigger_credential,
      payment_methods,
      stackable,
      valid_until,
      cadenas!inner ( nombre )
    `)
    .eq("active", true)
    .limit(10);

  if (args.cadena) {
    query = query.ilike("cadenas.nombre", `%${args.cadena}%`);
  }

  if (args.tipo) {
    query = query.ilike("discount_type", `%${args.tipo}%`);
  }

  if (args.banco) {
    query = query.ilike("payment_methods", `%${args.banco}%`);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Error buscando descuentos: ${error.message}`);
  if (!data || data.length === 0) return "No encontré descuentos con esos filtros.";

  return JSON.stringify(data);
}

export async function listar_peliculas(args: {
  limite?: number;
}): Promise<string> {
  const limite = args.limite ?? 10;

  const { data, error } = await supabase
    .from("funciones")
    .select("url_pelicula, formato, idioma, nombre_cine")
    .limit(limite * 3); // traemos más y deduplicamos

  if (error) throw new Error(`Error listando películas: ${error.message}`);
  if (!data || data.length === 0) return "No hay películas en cartelera en este momento.";

  // Deduplicar por url_pelicula
  const unicas = Array.from(
    new Map(data.map((f) => [f.url_pelicula, f])).values()
  ).slice(0, limite);

  return JSON.stringify(unicas);
}

export async function comparar_precios(args: {
  pelicula: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from("funciones")
    .select(`
      nombre_cine,
      formato,
      precio_base,
      cines!inner (
        cadenas!inner ( nombre )
      )
    `)
    .ilike("url_pelicula", `%${args.pelicula}%`)
    .not("precio_base", "is", null)
    .order("precio_base", { ascending: true })
    .limit(10);

  if (error) throw new Error(`Error comparando precios: ${error.message}`);
  if (!data || data.length === 0) {
    return `No encontré precios para "${args.pelicula}". Puede que la película no tenga precios cargados.`;
  }

  return JSON.stringify(data);
}

// ─── Dispatcher: Claude llama a esta función con el nombre y args ─────────────

export async function ejecutarTool(
  nombre: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (nombre) {
    case "buscar_funciones":
      return buscar_funciones(args as Parameters<typeof buscar_funciones>[0]);
    case "buscar_descuentos":
      return buscar_descuentos(args as Parameters<typeof buscar_descuentos>[0]);
    case "listar_peliculas":
      return listar_peliculas(args as Parameters<typeof listar_peliculas>[0]);
    case "comparar_precios":
      return comparar_precios(args as Parameters<typeof comparar_precios>[0]);
    default:
      return `Tool desconocida: ${nombre}`;
  }
}
