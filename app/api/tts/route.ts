export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import textToSpeech, { protos } from "@google-cloud/text-to-speech";

function getClient() {
  const json = process.env.GCP_TTS_CREDENTIALS_JSON;
  if (!json) throw new Error("Missing GCP_TTS_CREDENTIALS_JSON");
  const credentials = JSON.parse(json);
  return new textToSpeech.TextToSpeechClient({ credentials });
}

export async function POST(req: NextRequest) {
  const { text, voice, rate, pitch } = await req.json();
  if (!text || typeof text !== "string")
    return NextResponse.json({ error: "text is required" }, { status: 400 });

  const client = getClient();
  const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
    input: { text },
    voice: {
      languageCode: process.env.GCP_TTS_LANGUAGE || "ko-KR",
      name: voice || process.env.GCP_TTS_VOICE || "ko-KR-Standard-A",
    },
    audioConfig: {
      audioEncoding: "MP3",
      speakingRate: typeof rate === "number" ? rate : 1.05,
      pitch: typeof pitch === "number" ? pitch : 0,
    },
  };

  const [response] = await client.synthesizeSpeech(request);
  if (!response.audioContent) return NextResponse.json({ error: "no audio" }, { status: 500 });

  return new NextResponse(Buffer.from(response.audioContent as Buffer), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Disposition": `attachment; filename="tts_${Date.now()}.mp3"`,
      "Cache-Control": "no-store",
    },
  });
}