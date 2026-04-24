// api/webhook.ts
// CineArgento Bot — Webhook principal de WhatsApp (Meta Cloud API)
// Deploy en Vercel como serverless function

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleIncomingMessage } from "../lib/bot/handler";

// ─── GET: Verificación del webhook por Meta ───────────────────────────────────
// Meta hace un GET con hub.challenge para verificar que el endpoint es tuyo
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log("✅ Webhook verificado por Meta");
      return res.status(200).send(challenge);
    }

    return res.status(403).json({ error: "Token inválido" });
  }

  // ─── POST: Mensajes entrantes ──────────────────────────────────────────────
  if (req.method === "POST") {
    try {
      const body = req.body;

      // Verificar que es un evento de WhatsApp
      if (body.object !== "whatsapp_business_account") {
        return res.status(400).json({ error: "Evento no reconocido" });
      }

      // Iterar sobre cada entry y cada change
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const value = change.value;

          // Solo procesar mensajes (ignorar status updates)
          if (!value.messages || value.messages.length === 0) continue;

          for (const message of value.messages) {
            // Solo mensajes de texto por ahora
            if (message.type !== "text") continue;

            const from = message.from;          // número del usuario
            const text = message.text.body;     // texto del mensaje
            const messageId = message.id;

            console.log(`📨 Mensaje de ${from}: "${text}"`);

            // Procesar en background (no bloquear el webhook)
            handleIncomingMessage({ from, text, messageId }).catch((err) =>
              console.error("Error procesando mensaje:", err)
            );
          }
        }
      }

      // Meta requiere respuesta 200 inmediata
      return res.status(200).json({ status: "ok" });
    } catch (error) {
      console.error("Error en webhook:", error);
      return res.status(500).json({ error: "Error interno" });
    }
  }

  return res.status(405).json({ error: "Método no permitido" });
}
