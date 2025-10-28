"use client";
import { useState } from "react";

export default function Home() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("ko-KR-Standard-A");
  const [rate, setRate] = useState(1.05);
  const [pitch, setPitch] = useState(0);
  const [downloading, setDownloading] = useState(false);

  async function handleTTS() {
    if (!text.trim()) return alert("텍스트를 입력하세요.");
    setDownloading(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice, rate, pitch }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "TTS 실패");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tts_${Date.now()}.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || "에러");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
        Google Cloud TTS (Vercel)
      </h1>
      <textarea
        style={{ width: "100%", height: 240, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}
        placeholder="여기에 텍스트를 입력하세요"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, margin: "16px 0" }}>
        <label style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 12, marginBottom: 4 }}>Voice</span>
          <input
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            placeholder="ko-KR-Standard-A"
            style={{ padding: 8, border: "1px solid #ddd", borderRadius: 8 }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 12, marginBottom: 4 }}>Rate</span>
          <input
            type="number"
            step="0.05"
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            style={{ padding: 8, border: "1px solid #ddd", borderRadius: 8 }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 12, marginBottom: 4 }}>Pitch</span>
          <input
            type="number"
            step="1"
            value={pitch}
            onChange={(e) => setPitch(parseFloat(e.target.value))}
            style={{ padding: 8, border: "1px solid #ddd", borderRadius: 8 }}
          />
        </label>
      </div>
      <button
        onClick={handleTTS}
        disabled={downloading}
        style={{ background: "#000", color: "#fff", padding: "10px 14px", borderRadius: 8, opacity: downloading ? 0.6 : 1 }}
      >
        {downloading ? "생성 중..." : "MP3 생성 & 다운로드"}
      </button>
    </main>
  );
}