import type { APIRoute } from "astro";
import { Buffer } from "node:buffer";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.formData();
    const image = data.get("image");

    if (!(image instanceof File)) {
      return new Response(JSON.stringify({ error: "No hay imagen" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = import.meta.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Falta OPENAI_API_KEY en .env" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await image.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Analiza este logo. Devuelve únicamente un JSON puro con: " +
                  "{ \"colores\": [\"#hex1\", \"#hex2\"], \"diagnostico\": \"...\", \"sugerencias\": [\"...\", \"...\"] }",
              },
              {
                type: "input_image",
                image_url: `data:${image.type};base64,${base64Image}`,
              },
            ],
          },
        ],
        // fuerza JSON válido
        text: { format: { type: "json_object" } },
        max_output_tokens: 500,
      }),
    });

    const result = await resp.json();

    if (!resp.ok) {
      const msg = result?.error?.message ?? "Error en OpenAI";
      return new Response(JSON.stringify({ error: msg }), {
        status: resp.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // En Responses API, el texto final suele venir aquí:
    const content =
      result?.output?.[0]?.content?.find((c: any) => c.type === "output_text")?.text;

    if (!content) {
      return new Response(JSON.stringify({ error: "Respuesta vacía del modelo" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(content, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Error de conexión con OpenAI" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
