// lib/bot/handler.ts
// Orquesta el flujo: mensaje → Claude → respuesta WhatsApp

import { getOrCreateSession, appendToSession } from "./session";
import { askClaude } from "./claude";
import { sendWhatsAppMessage } from "./whatsapp";
import { SYSTEM_PROMPT } from "./prompts";

interface IncomingMessage {
  from: string;       // número de teléfono (ej: "5491112345678")
  text: string;       // texto del mensaje
  messageId: string;  // ID único del mensaje de Meta
}

export async function handleIncomingMessage({
  from,
  text,
  messageId,
}: IncomingMessage): Promise<void> {
  // 1. Obtener o crear sesión del usuario (historial de conversación)
  const session = await getOrCreateSession(from);

  // 2. Agregar mensaje del usuario al historial
  const updatedHistory = [
    ...session.history,
    { role: "user" as const, content: text },
  ];

  // 3. Llamar a Claude con el historial completo
  const reply = await askClaude({
    systemPrompt: SYSTEM_PROMPT,
    messages: updatedHistory,
  });

  // 4. Guardar respuesta de Claude en el historial
  await appendToSession(from, updatedHistory, reply);

  // 5. Enviar respuesta por WhatsApp
  await sendWhatsAppMessage({ to: from, text: reply });

  console.log(`✅ Respuesta enviada a ${from}`);
}
