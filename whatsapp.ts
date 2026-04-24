// lib/bot/whatsapp.ts
// Envía mensajes a través de Meta WhatsApp Cloud API

interface SendMessageParams {
  to: string;   // número destino con código de país (ej: "5491112345678")
  text: string; // texto a enviar
}

export async function sendWhatsAppMessage({
  to,
  text,
}: SendMessageParams): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN!;

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
  }

  const result = await response.json();
  console.log(`📤 Mensaje enviado. ID: ${result.messages?.[0]?.id}`);
}
