// lib/bot/session.ts
// Manejo de sesiones de conversación en Supabase
// Guarda el historial de mensajes por usuario para mantener contexto

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Session {
  phone: string;
  history: Message[];
  updatedAt: string;
}

// Máximo de mensajes a conservar por sesión (para no superar el context window)
const MAX_HISTORY_LENGTH = 20;

export async function getOrCreateSession(phone: string): Promise<Session> {
  const { data, error } = await supabase
    .from("bot_sessions")
    .select("*")
    .eq("phone", phone)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows found, es esperado
    throw new Error(`Error obteniendo sesión: ${error.message}`);
  }

  if (!data) {
    // Crear sesión nueva
    const newSession: Session = {
      phone,
      history: [],
      updatedAt: new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from("bot_sessions")
      .insert({ phone, history: [], updated_at: new Date().toISOString() });

    if (insertError) {
      throw new Error(`Error creando sesión: ${insertError.message}`);
    }

    return newSession;
  }

  return {
    phone: data.phone,
    history: data.history ?? [],
    updatedAt: data.updated_at,
  };
}

export async function appendToSession(
  phone: string,
  currentHistory: Message[],
  assistantReply: string
): Promise<void> {
  const updatedHistory: Message[] = [
    ...currentHistory,
    { role: "assistant", content: assistantReply },
  ];

  // Mantener solo los últimos N mensajes para no crecer indefinidamente
  const trimmed = updatedHistory.slice(-MAX_HISTORY_LENGTH);

  const { error } = await supabase
    .from("bot_sessions")
    .update({
      history: trimmed,
      updated_at: new Date().toISOString(),
    })
    .eq("phone", phone);

  if (error) {
    throw new Error(`Error guardando sesión: ${error.message}`);
  }
}
