// app/api/voices/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import textToSpeech from "@google-cloud/text-to-speech";

function getClient() {
  const json = process.env.GCP_TTS_CREDENTIALS_JSON;
  if (!json) throw new Error("Missing GCP_TTS_CREDENTIALS_JSON");
  const credentials = JSON.parse(json);
  return new textToSpeech.TextToSpeechClient({ credentials });
}

export async function GET() {
  try {
    const client = getClient();
    const [res] = await client.listVoices({});
    const voices = (res.voices || []).map(v => ({
      name: v.name,
      languageCodes: v.languageCodes,
      ssmlGender: v.ssmlGender,
      naturalSampleRateHertz: v.naturalSampleRateHertz
    }));
    // 많이 반환되니 이름 기준 정렬
    voices.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return NextResponse.json({ voices });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 });
  }
}