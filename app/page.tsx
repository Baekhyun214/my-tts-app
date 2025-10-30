"use client";
import { useEffect, useMemo, useState } from "react";

type VoiceInfo = {
  name?: string | null;
  languageCodes?: string[] | null;
  ssmlGender?: string | null;
  naturalSampleRateHertz?: number | null;
};

export default function Home() {
  const [text, setText] = useState("");
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [voice, setVoice] = useState("ko-KR-Standard-A");
  const [rate, setRate] = useState(1.05);
  const [pitch, setPitch] = useState(0);
  const [busy, setBusy] = useState<"preview" | "download" | null>(null);

  // 미리듣기 오디오
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  // 보이스 목록 로드
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/voices");
        const j = await res.json();
        if (j?.voices) {
          setVoices(j.voices);
          // ko-KR 기본 세팅 보이스가 없으면 첫 항목으로
          const hasKorean = j.voices.some((v: VoiceInfo) =>
            (v.languageCodes || []).includes("ko-KR")
          );
          if (!hasKorean && j.voices[0]?.name) {
            setVoice(j.voices[0].name);
          }
        }
      } catch {
        // 무시: API 실패해도 기본값으로 작동
      }
    })();
  }, []);

  // 언어 필터(선택): 드롭다운이 너무 길면 ko-KR을 상단에
  const sortedVoices = useMemo(() => {
    const list = [...voices];
    list.sort((a, b) => {
      const aK = (a.languageCodes || []).includes("ko-KR") ? -1 : 0;
      const bK = (b.languageCodes || []).includes("ko-KR") ? -1 : 0;
      if (aK !== bK) return aK - bK; // ko-KR 먼저
      return (a.name || "").localeCompare(b.name || "");
    });
    return list;
  }, [voices]);

  function stepRate(delta: number) {
    setRate(v => {
      const next = Math.round((v + delta) * 100) / 100;
      return Math.min(4, Math.max(0.25, next));
    });
  }
  function stepPitch(delta: number) {
    setPitch(v => Math.min(20, Math.max(-20, v + delta)));
  }

  async function callTTS(): Promise<Blob> {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice, rate, pitch }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "TTS 실패");
    }
    return await res.blob();
  }

  async function onPreview() {
    if (!text.trim()) return alert("텍스트를 입력하세요.");
    setBusy("preview");
    try {
      const blob = await callTTS();
      setPreviewBlob(blob);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (e: any) {
      alert(e?.message || "TTS 실패");
    } finally {
      setBusy(null);
    }
  }

  async function onDownload() {
    if (!text.trim()) return alert("텍스트를 입력하세요.");
    setBusy("download");
    try {
      const blob = await callTTS();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tts_${Date.now()}.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || "TTS 실패");
    } finally {
      setBusy(null);
    }
  }

  function downloadPreview() {
    if (!previewBlob) return;
    const url = URL.createObjectURL(previewBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tts_preview_${Date.now()}.mp3`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: 24, color: "#eee" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>
        Google Cloud TTS (Vercel)
      </h1>

      <textarea
        className="field"
        style={{
          width: "100%", height: 260, padding: 12,
          background: "#111", color: "#eee",
          border: "1px solid #333", borderRadius: 10
        }}
        placeholder="여기에 텍스트를 입력하세요"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      {/* ✅ 컨트롤 바: 데스크톱 3컬럼, 모바일 1컬럼 */}
      <div className="controls" style={{ marginTop: 16 }}>
        {/* Voice */}
        <label className="field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Voice</span>
          <select
            className="field"
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            style={{ padding: 10, borderRadius: 10, background: "#111", color: "#eee", border: "1px solid #333" }}
          >
            {/* ...보이스 옵션 렌더링 그대로... */}
          </select>
        </label>

        {/* Rate */}
        <label className="field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Rate</span>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="field"
              type="number"
              step="0.05" min={0.25} max={4}
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value))}
              style={{ flex: 1, padding: 10, borderRadius: 10, background: "#111", color: "#eee", border: "1px solid #333" }}
            />
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => stepRate(-0.05)} style={btnMini}>▼</button>
              <button onClick={() => stepRate(+0.05)} style={btnMini}>▲</button>
            </div>
          </div>
        </label>

        {/* Pitch */}
        <label className="field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Pitch</span>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="field"
              type="number"
              step={1} min={-20} max={20}
              value={pitch}
              onChange={(e) => setPitch(parseFloat(e.target.value))}
              style={{ flex: 1, padding: 10, borderRadius: 10, background: "#111", color: "#eee", border: "1px solid #333" }}
            />
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => stepPitch(-1)} style={btnMini}>▼</button>
              <button onClick={() => stepPitch(+1)} style={btnMini}>▲</button>
            </div>
          </div>
        </label>
      </div>

      {/* 버튼 줄 */}
      <div className="btns" style={{ marginTop: 16 }}>
        <button onClick={onPreview} disabled={busy !== null} style={btnPrimary}>
          {busy === "preview" ? "미리듣기 생성 중..." : "미리듣기"}
        </button>
        <button onClick={onDownload} disabled={busy !== null} style={btnSecondary}>
          {busy === "download" ? "다운로드 생성 중..." : "MP3 다운로드"}
        </button>
      </div>

      {/* 미리듣기 */}
      {previewUrl && (
        <div className="audio-wrap" style={{ marginTop: 14, padding: 12, border: "1px solid #333", borderRadius: 10, background: "#0d0d0d" }}>
          <audio src={previewUrl} controls />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={downloadPreview} style={btnOutline}>미리듣기 파일 다운로드</button>
            <button onClick={() => { if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); setPreviewBlob(null); } }} style={btnGhost}>
              미리듣기 닫기
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

const btnPrimary: React.CSSProperties = {
  background: "#0ea5e9", color: "#000", padding: "10px 14px",
  borderRadius: 10, border: "none", fontWeight: 700
};
const btnSecondary: React.CSSProperties = {
  background: "#111", color: "#fff", padding: "10px 14px",
  borderRadius: 10, border: "1px solid #333", fontWeight: 700
};
const btnMini: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 10,
  border: "1px solid #333", background: "#1a1a1a", color: "#eee"
};
const btnOutline: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 10,
  border: "1px solid #333", background: "transparent", color: "#eee"
};
const btnGhost: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 10,
  border: "none", background: "transparent", color: "#aaa"
};