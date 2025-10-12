"use client";

import { useEffect, useMemo, useState } from "react";

/** HTML 이스케이프 */
function esc(x: string) {
  return x
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function nl2br(x: string) {
  return esc(x).replace(/\n/g, "<br/>");
}

type Tab = "simple" | "advanced";
type Template = "banner" | "card" | "strip";

export default function HospitalNoticeForm() {
  const [tab, setTab] = useState<Tab>("simple");
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "ok" | "err">("idle");

  // 서버 저장되어 있는 HTML(고급 탭에서 직접 편집)
  const [rawHtml, setRawHtml] = useState("");

  // 간편 작성 값
  const [template, setTemplate] = useState<Template>("banner");
  const [title, setTitle] = useState("공지");
  const [subtitle, setSubtitle] = useState("");
  const [body, setBody] = useState("");
  const [list, setList] = useState("");
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerText, setBannerText] = useState("");
  const [showBorder, setShowBorder] = useState(true);

  // 색상(예약자 페이지 톤)
  const [bg, setBg] = useState("#EEF4FF");
  const [fg, setFg] = useState("#0F172A");
  const [accent, setAccent] = useState("#3B82F6");

  useEffect(() => {
    setMounted(true);
    (async () => {
      try {
        const r = await fetch("/api/org/notice", { cache: "no-store" });
        const j = await r.json();
        setRawHtml(j?.noticeHtml ?? "");
      } catch {}
    })();
  }, []);

  // 템플릿 렌더러
  function renderTemplate() {
    const paragraphs =
      body
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p style="margin:6px 0; line-height:1.6">${esc(p)}</p>`)
        .join("") || "";

    const listHtml =
      list
        .split(/\n+/)
        .map((x) => x.trim())
        .filter(Boolean).length > 0
        ? `<ul style="margin:8px 0 0 20px; padding-left:18px; list-style:disc">
            ${list
              .split(/\n+/)
              .map((x) => x.trim())
              .filter(Boolean)
              .map((li) => `<li style="margin:4px 0; line-height:1.6">${esc(li)}</li>`)
              .join("")}
          </ul>`
        : "";

    const bannerHtml =
      bannerTitle || bannerText
        ? `<div style="margin-top:12px; padding:12px 14px; border-radius:12px; background:${accent}20; ${
            showBorder ? `border-left:6px solid ${accent};` : ""
          }">
            ${bannerTitle ? `<div style="font-weight:700; margin-bottom:4px; color:${accent}">${esc(bannerTitle)}</div>` : ""}
            ${bannerText ? `<div style="line-height:1.6">${nl2br(bannerText)}</div>` : ""}
          </div>`
        : "";

    if (template === "banner") {
      return `
<div style="border-radius:16px; padding:18px; background:${bg}; color:${fg}; border:1px solid rgba(0,0,0,0.06)">
  ${title ? `<div style="font-weight:800; font-size:18px; color:${accent}; margin-bottom:6px">${esc(title)}</div>` : ""}
  ${subtitle ? `<div style="opacity:.85; font-size:13px; margin-bottom:10px">${esc(subtitle)}</div>` : ""}
  <div style="line-height:1.5; font-size:14px">${paragraphs}${listHtml}${bannerHtml}</div>
</div>`.trim();
    }

    if (template === "card") {
      return `
<div style="border-radius:16px; overflow:hidden; border:1px solid rgba(0,0,0,0.06)">
  <div style="background:${bg}; color:${fg}; padding:14px 16px">
    ${title ? `<div style="font-weight:800; font-size:16px">${esc(title)}</div>` : ""}
    ${subtitle ? `<div style="opacity:.9; font-size:12px; margin-top:4px">${esc(subtitle)}</div>` : ""}
  </div>
  <div style="padding:14px 16px; font-size:14px; line-height:1.6">
    ${paragraphs}${listHtml}${bannerHtml}
  </div>
</div>`.trim();
    }

    // strip
    return `
<div style="border-radius:12px; padding:12px 14px; background:#fff; border:1px solid rgba(0,0,0,0.06)">
  <span style="display:inline-block; width:8px; height:8px; border-radius:999px; background:${accent}; margin-right:8px; vertical-align:middle"></span>
  <span style="vertical-align:middle; color:#111; font-weight:800">${esc(title)}</span>
  ${subtitle ? `<div style="margin-top:6px; color:#444; font-size:12px">${esc(subtitle)}</div>` : ""}
  <div style="margin-top:10px; color:#222; font-size:14px; line-height:1.6">${paragraphs}${listHtml}${bannerHtml}</div>
</div>`.trim();
  }

  const simpleHtml = useMemo(() => renderTemplate(), [template, title, subtitle, body, list, bannerTitle, bannerText, showBorder, bg, fg, accent]);

  async function saveHtml(html: string) {
    setSaving("saving");
    try {
      const r = await fetch("/api/org/notice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noticeHtml: html }),
      });
      if (!r.ok) throw new Error();
      setSaving("ok");
      setTimeout(() => setSaving("idle"), 900);
    } catch {
      setSaving("err");
      setTimeout(() => setSaving("idle"), 1200);
    }
  }

  async function handleSaveSimple() {
    await saveHtml(simpleHtml);
    setRawHtml(simpleHtml);
  }
  async function handleSaveAdvanced() {
    await saveHtml(rawHtml);
  }

  if (!mounted) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
      {/* 헤더 */}
      <div className="border-b border-gray-100 px-6 py-4 flex items-center gap-2">
        <div className="text-base font-semibold">병원 공지사항</div>
        <div className="ml-auto inline-flex rounded-lg p-1 bg-gray-100">
          <button
            onClick={() => setTab("simple")}
            className={"px-3 py-1.5 text-sm font-semibold rounded-md " + (tab === "simple" ? "bg-white shadow" : "text-gray-600")}
          >
            간편 작성
          </button>
          <button
            onClick={() => setTab("advanced")}
            className={"px-3 py-1.5 text-sm font-semibold rounded-md " + (tab === "advanced" ? "bg-white shadow" : "text-gray-600")}
          >
            HTML 직접 편집
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div className="px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 좌측: 폼 */}
        <div className="space-y-5">
          {tab === "simple" ? (
            <>
              {/* 템플릿 */}
              <div>
                <div className="block text-sm font-semibold text-gray-700 mb-2">템플릿</div>
                <div className="grid grid-cols-3 gap-3">
                  {(["banner", "card", "strip"] as Template[]).map((t) => (
                    <label key={t} className={`cursor-pointer border rounded-xl p-3 text-center ${template === t ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-200"}`}>
                      <input type="radio" className="hidden" checked={template === t} onChange={() => setTemplate(t)} />
                      <div className="text-sm">{t === "banner" ? "배너" : t === "card" ? "카드" : "스트립"}</div>
                    </label>
                  ))}
                </div>
              </div>

              {/* 색상 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-gray-600 mb-1">배경(bg)</div>
                  <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="w-full h-10 rounded border border-gray-300" />
                  <input type="text" value={bg} onChange={(e) => setBg(e.target.value)} className="mt-1 w-full border rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">글자(fg)</div>
                  <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="w-full h-10 rounded border border-gray-300" />
                  <input type="text" value={fg} onChange={(e) => setFg(e.target.value)} className="mt-1 w-full border rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">포인트(accent)</div>
                  <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="w-full h-10 rounded border border-gray-300" />
                  <input type="text" value={accent} onChange={(e) => setAccent(e.target.value)} className="mt-1 w-full border rounded px-2 py-1 text-sm" />
                </div>
              </div>

              {/* 내용 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">제목</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="예) 10월 운영 안내" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">부제(선택)</label>
                <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="예) 국가검진 접수 마감 D-3" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">본문(줄바꿈 = 문단)</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} className="w-full min-h-[120px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={"예)\n금식 8시간 필요\n당뇨약 복용 중단"} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">안내 리스트(선택, 줄바꿈 = 항목)</label>
                <textarea value={list} onChange={(e) => setList(e.target.value)} className="w-full min-h-[90px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={"예)\n검진 전날 과음 금지\n검진일 아침 금연"} />
              </div>

              {/* 강조 박스 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">강조 박스 제목(선택)</label>
                  <input value={bannerTitle} onChange={(e) => setBannerTitle(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="예) 꼭 확인" />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={showBorder} onChange={(e) => setShowBorder(e.target.checked)} className="h-4 w-4" />
                    <span className="text-sm text-gray-700">강조박스 왼쪽 보더</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">강조 박스 내용(선택)</label>
                <textarea value={bannerText} onChange={(e) => setBannerText(e.target.value)} className="w-full min-h-[80px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="예) 대장내시경 예약자는 전날 준비약 복용 필요" />
              </div>

              {/* 저장 */}
              <div className="pt-2 flex items-center gap-3">
                <button onClick={handleSaveSimple} className="rounded-lg px-4 py-2 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" disabled={saving === "saving"}>
                  {saving === "saving" ? "저장 중..." : "저장"}
                </button>
                {saving === "ok" && <span className="text-green-600 text-sm">저장됨</span>}
                {saving === "err" && <span className="text-red-600 text-sm">실패</span>}
                <button
                  type="button"
                  onClick={() => {
                    setTab("advanced");
                    setRawHtml(simpleHtml);
                  }}
                  className="ml-auto rounded-lg px-3 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
                  title="현재 내용을 HTML로 전환"
                >
                  HTML로 보기
                </button>
              </div>
            </>
          ) : (
            // 고급 모드
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">HTML 직접 편집</label>
                <textarea value={rawHtml} onChange={(e) => setRawHtml(e.target.value)} className="w-full min-h-[300px] rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" placeholder="<section>...</section>" />
              </div>
              <div className="pt-2 flex items-center gap-3">
                <button onClick={handleSaveAdvanced} className="rounded-lg px-4 py-2 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" disabled={saving === "saving"}>
                  {saving === "saving" ? "저장 중..." : "저장"}
                </button>
                {saving === "ok" && <span className="text-green-600 text-sm">저장됨</span>}
                {saving === "err" && <span className="text-red-600 text-sm">실패</span>}
                <button type="button" onClick={() => setTab("simple")} className="ml-auto rounded-lg px-3 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50">
                  간편 작성으로 돌아가기
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">예약자 페이지는 저장된 HTML을 그대로 렌더링한다.</p>
            </>
          )}
        </div>

        {/* 우측: 모바일 미리보기 */}
        <div>
          <div className="mb-2 text-sm font-semibold text-gray-700">모바일 미리보기</div>
          <div className="mx-auto w-[380px] border border-gray-200 rounded-[24px] shadow-lg bg-white overflow-hidden">
            <div className="h-6 bg-gray-100" />
            <div className="p-4">
              <div dangerouslySetInnerHTML={{ __html: tab === "simple" ? simpleHtml : rawHtml }} />
            </div>
            <div className="h-6 bg-gray-100" />
          </div>
          <p className="text-xs text-gray-500 mt-3">예약자 페이지와 거의 동일하게 표시된다.</p>
        </div>
      </div>
    </div>
  );
}



