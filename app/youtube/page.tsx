"use client";
import { useMemo, useState } from "react";

type Item = {
  id: string;
  title: string;
  channelTitle: string;
  channelId?: string;
  publishedAt: string;
  thumbnail?: string;
  durationSec: number;
  viewCount: number;
};

function fmtNum(n: number) {
  return n.toLocaleString("ko-KR");
}
function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString("ko-KR"); } catch { return s; }
}
function fmtDur(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return (h ? `${h}:` : "") + `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function YoutubePage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all"|"short"|"long">("all");
  const [preset, setPreset] = useState<"custom"|"1m"|"2m"|"3m"|"6m"|"12m">("1m");
  const [after, setAfter] = useState<string>("");  // ISO
  const [before, setBefore] = useState<string>("");
  const [viewBand, setViewBand] = useState<"all"|"lt100k"|"100k_1m"|"gte1m">("all");
  const [max, setMax] = useState<number>(50);      // 10/50/100/전체(0)
  const [order, setOrder] = useState<"relevance"|"date"|"viewCount"|"subscriberCount">("relevance");
  const [lengthCap, setLengthCap] = useState<string>(""); // "00:30" 형태
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [subsMap, setSubsMap] = useState<Record<string, number>>({});

  // 기간 프리셋 계산
  function presetRange(p: typeof preset) {
    if (p === "custom") return { after: after || undefined, before: before || undefined };
    const now = new Date();
    const end = now.toISOString();
    const start = new Date();
    const months = p==="1m"?1:p==="2m"?2:p==="3m"?3:p==="6m"?6:12;
    start.setMonth(now.getMonth() - months);
    return { after: start.toISOString(), before: end };
  }

  function capToSec(s: string): number | null {
    if (!s) return null;
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  async function onSearch() {
    if (!q.trim()) return alert("키워드를 입력하세요.");
    setBusy(true);
    try {
      const range = presetRange(preset);
      const res = await fetch("/api/youtube/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q, type,
          publishedRange: range,
          viewBand, max: max === 0 ? 100 : max,
          order,
          lengthCapSec: capToSec(lengthCap),
        })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "검색 실패");
      setItems(j.items || []);
      setSubsMap(j.subsMap || {});
    } catch (e: any) {
      alert(e.message || "에러");
    } finally {
      setBusy(false);
    }
  }

  const totalViews = useMemo(() => items.reduce((a, b) => a + (b.viewCount || 0), 0), [items]);

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12 }}>YouTube 분석기</h1>

      {/* 검색 바 */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <input
          placeholder="키워드를 입력하세요"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 280, padding: 10, borderRadius: 10, border: "1px solid #333", background: "#111", color: "#eee" }}
        />
        <button onClick={onSearch} disabled={busy} style={btnPrimary}>
          {busy ? "검색 중..." : "검색"}
        </button>
      </div>

      {/* 필터 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {/* 영상종류 */}
        <label style={labelCol}>
          <span>영상종류</span>
          <select value={type} onChange={(e)=>setType(e.target.value as any)} style={sel}>
            <option value="all">전체</option>
            <option value="short">숏폼(≤60s)</option>
            <option value="long">롱폼(≥20m)</option>
          </select>
        </label>

        {/* 업로드 일자 */}
        <label style={labelCol}>
          <span>업로드일자</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <select value={preset} onChange={(e)=>setPreset(e.target.value as any)} style={sel}>
              <option value="1m">최근 1개월</option>
              <option value="2m">최근 2개월</option>
              <option value="3m">최근 3개월</option>
              <option value="6m">최근 6개월</option>
              <option value="12m">최근 1년</option>
              <option value="custom">기간 지정</option>
            </select>
            {preset === "custom" && (
              <>
                <input type="datetime-local" value={after} onChange={e=>setAfter(e.target.value?new Date(e.target.value).toISOString():"")} style={inp}/>
                <input type="datetime-local" value={before} onChange={e=>setBefore(e.target.value?new Date(e.target.value).toISOString():"")} style={inp}/>
              </>
            )}
          </div>
        </label>

        {/* 조회수 */}
        <label style={labelCol}>
          <span>조회수</span>
          <select value={viewBand} onChange={(e)=>setViewBand(e.target.value as any)} style={sel}>
            <option value="all">전체</option>
            <option value="lt100k">~10만</option>
            <option value="100k_1m">10만~100만</option>
            <option value="gte1m">100만~</option>
          </select>
        </label>

        {/* 검색 영상 갯수 */}
        <label style={labelCol}>
          <span>검색 영상 갯수</span>
          <select value={String(max)} onChange={(e)=>setMax(parseInt(e.target.value,10))} style={sel}>
            <option value="0">전체(최대 100)</option>
            <option value="10">10개</option>
            <option value="50">50개</option>
            <option value="100">100개</option>
          </select>
        </label>

        {/* 정렬 */}
        <label style={labelCol}>
          <span>정렬</span>
          <select value={order} onChange={(e)=>setOrder(e.target.value as any)} style={sel}>
            <option value="relevance">관련도</option>
            <option value="date">최신순</option>
            <option value="viewCount">조회수 순</option>
            <option value="subscriberCount">구독자 순(채널)</option>
          </select>
        </label>

        {/* 영상 길이 상한 */}
        <label style={labelCol}>
          <span>영상길이</span>
          <input placeholder="예: 00:30 (분:초) 이내" value={lengthCap} onChange={e=>setLengthCap(e.target.value)} style={inp}/>
        </label>
      </div>

      {/* 통계 요약 */}
      <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
        결과: <b>{items.length}</b>개 · 총 조회수 <b>{fmtNum(totalViews)}</b>
      </div>

      {/* 결과 테이블 */}
      <div style={{ marginTop: 12, borderTop: "1px solid #222" }}>
        {items.map(v => (
          <div key={v.id} style={{ display: "grid", gridTemplateColumns: "160px 1fr 220px", gap: 12, padding: "12px 0", borderBottom: "1px solid #111" }}>
            <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.thumbnail || ""} alt={v.title} style={{ width: 160, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid #222" }}/>
            </a>
            <div>
              <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer" style={{ color: "#fff", textDecoration: "none", fontWeight: 700 }}>
                {v.title}
              </a>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
                <a href={`https://www.youtube.com/channel/${v.channelId}`} target="_blank" rel="noreferrer" style={{ color: "#8ab4ff", textDecoration: "none" }}>
                  {v.channelTitle}
                </a>
                {" · "}업로드 {fmtDate(v.publishedAt)}
                {" · "}길이 {fmtDur(v.durationSec)}
              </div>
            </div>
            <div style={{ textAlign: "right", alignSelf: "center" }}>
              <div>조회수 <b>{fmtNum(v.viewCount)}</b></div>
              {/* 구독자순 정렬 시 보조표시 */}
              {subsMap[v.channelId || ""] !== undefined && (
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  구독자 {fmtNum(subsMap[v.channelId || ""] || 0)}
                </div>
              )}
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div style={{ padding: 24, opacity: 0.7 }}>검색 결과가 없습니다. 조건을 바꿔 다시 시도해 보세요.</div>
        )}
      </div>
    </main>
  );
}

const sel: React.CSSProperties = { padding: 10, borderRadius: 10, border: "1px solid #333", background: "#111", color: "#eee" };
const inp: React.CSSProperties = { padding: 10, borderRadius: 10, border: "1px solid #333", background: "#111", color: "#eee", minWidth: 170 };
const labelCol: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const btnPrimary: React.CSSProperties = {
  background: "#0ea5e9", color: "#000", padding: "10px 14px",
  borderRadius: 10, border: "none", fontWeight: 700
};