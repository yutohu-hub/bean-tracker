"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { FS, INK, PAPER, GRAY, LINE, GREEN, AMBER, STATUS } from "../lib/theme";
import { nextCupFor } from "../lib/recommend";
import { flavorOf, FLAVORS } from "../data/flavors";
import { fmtPrice, fmtJPY, per100JPY, perGrams, fmtLocal } from "../lib/currency";
import { beanHref, beanLinkKind } from "../lib/utils";
import { getTasting, upsertTasting, removeTasting, isRestock, toggleRestock, getRestocks } from "../lib/store";
import { usePlan } from "../lib/usePlan";
import { getPhoto, savePhotoDataUrl, deletePhoto } from "../lib/photos";
import { PhotoPicker } from "./PhotoPicker";
import { ROASTERS } from "../data/roasters";
import { Package } from "./Package";
import { shareUrl } from "../lib/urlState";

export function DetailSheet({ bean, onClose, onRoaster, onFlavor, onOpen, cur }) {
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState("");   // 端末に保存できなかったとき
  const [watching, setWatching] = useState(false);
  const [watchCount, setWatchCount] = useState(0);
  const [watchMsg, setWatchMsg] = useState("");
  const [photo, setPhoto] = useState(null);
  const [copied, setCopied] = useState("");
  const sheetRef = useRef(null);
  const { premium, limits } = usePlan();
  // 次の一杯の候補。6,000件を毎描画で走査しないよう、豆が変わったときだけ出す
  const nextCup = useMemo(() => nextCupFor(bean), [bean]);
  // 上限判定は「いま登録済みの件数」で見る。この豆が未登録のときだけ追加を止める。
  const watchFull = watchCount >= limits.watchlist;
  useEffect(() => {
    if (!bean) return;
    const t = getTasting(bean.id);
    setRating(t ? t.rating : 0); setNotes(t ? t.notes : ""); setSaved(!!t);
    setWatching(isRestock(bean.id));
    setWatchCount(getRestocks().length);
    setWatchMsg("");
    setPhoto(null);
    setCopied("");
    // おすすめから移ってきたときは下の方を見ているので、先頭に戻す。
    // そのままだと、新しい豆の名前も値段も見えないまま次のおすすめが目に入る。
    if (sheetRef.current) sheetRef.current.scrollTop = 0;
    getPhoto(bean.id).then((p) => setPhoto(p));   // 写真は IndexedDB から後追いで読む
    // 見ている豆が変わったときだけ読み直す。bean そのものを依存にすると
    // 親が作り直すたびに走り、写真の読み込みが何度も走る
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bean ? bean.id : null]);
  // Esc で閉じる。背景タップしか閉じる手段が無いと、開いたあと戻れなくなる
  useEffect(() => {
    if (!bean) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bean, onClose]);
  if (!bean) return null;
  const s = STATUS[bean.status];
  const roaster = ROASTERS[bean.r];
  const saveTasting = async () => {
    if (!rating) return;
    /* 端末に保存できなかったときは「記録しました」と出さない。
       黙って成功したことにすると、書いた記録がそのまま消える。 */
    try {
      setSaveErr("");
      upsertTasting({ beanId: bean.id, r: bean.r, name: bean.name, roaster: roaster.name, origin: bean.origin, rating, notes, hasPhoto: !!photo });
    } catch (e) { setSaveErr(e.message || "保存できませんでした"); return; }
    // 写真は記録を押したときだけ確定する（開いて閉じただけで残らないように）
    if (photo) await savePhotoDataUrl(bean.id, photo); else await deletePhoto(bean.id);
    setSaved(true);
  };
  /* この豆のリンクをコピーする。開いている豆はURLに載っているので、
     受け取った人は同じカードが開いた状態で着地する。
     clipboard API は安全なコンテキスト（https/localhost）でしか使えないので、
     使えない環境では選択してコピーする昔ながらの方法に落とす。 */
  const copyLink = async () => {
    const url = shareUrl({ bean: bean.id });
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch { setCopied("コピーできませんでした"); return; }
    }
    setCopied("リンクをコピーしました");
    setTimeout(() => setCopied(""), 2000);
  };
  const delTasting = () => {
    try { setSaveErr(""); removeTasting(bean.id); } catch (e) { setSaveErr(e.message || "削除できませんでした"); return; }
    deletePhoto(bean.id); setRating(0); setNotes(""); setPhoto(null); setSaved(false);
  };
  const rows = [
    ["産地", bean.origin],
    ["精製", bean.process],
    // ECに記載のフレーバーノートがある豆だけ表示する
    ...(bean.notes ? [["風味", bean.notes]] : []),
    ["現地価格", `${fmtLocal(bean)} / ${bean.per}`],
    [cur === "JPY" ? "円換算" : "ドル換算", `${fmtPrice(bean, cur)} / ${perGrams(bean)}g`],
    ["100gあたり", fmtJPY(per100JPY(bean), cur)],
    ["初出", bean.year],
  ];
  return (
    <div onClick={onClose} className="bt-overlay" style={{ position: "fixed", inset: 0, background: "rgba(23,21,15,0.45)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div className="bt-sheet" ref={sheetRef} onClick={(e) => e.stopPropagation()} style={{ background: PAPER, width: "100%", maxWidth: 480, borderRadius: "14px 14px 0 0", padding: "18px 20px 26px", maxHeight: "82vh", overflowY: "auto" }}>
        <div style={{ position: "relative" }}>
          <div style={{ width: 34, height: 4, borderRadius: 999, background: LINE, margin: "0 auto 16px" }} />
          <button onClick={onClose} aria-label="閉じる"
            style={{ position: "absolute", top: -4, right: -4, width: 30, height: 30, borderRadius: 999, border: "none", background: "#F2F0E9", color: GRAY, fontSize: FS.lead, lineHeight: 1, cursor: "pointer" }}>✕</button>
          <button onClick={copyLink} aria-label="この豆のリンクをコピー" title="この豆のリンクをコピー"
            style={{ position: "absolute", top: -4, right: 30, height: 30, padding: "0 10px", borderRadius: 999, border: "none", background: "#F2F0E9", color: GRAY, fontSize: FS.meta, lineHeight: 1, cursor: "pointer" }}>🔗</button>
        </div>
        {copied && <div style={{ textAlign: "center", fontSize: FS.meta, color: GREEN, marginTop: -8, marginBottom: 6 }}>{copied}</div>}
        <div style={{ display: "flex", gap: 16 }}>
          <div className="bt-detail-pkg" style={{ width: 120, flexShrink: 0 }}><Package bean={bean} /></div>
          <div className="bt-detail-info" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: s.dot }} />
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.meta, color: s.dot === GRAY ? GRAY : s.dot }}>{s.label} — {s.jp}</span>
            </div>
            <div style={{ fontSize: FS.head, fontWeight: 700, color: INK, marginTop: 6, lineHeight: 1.25 }}>{bean.name}</div>
            <button onClick={() => { onClose(); onRoaster(bean.r); }} style={{ fontSize: FS.body, color: GRAY, marginTop: 3, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
              {roaster.name} — {roaster.city}
            </button>
            <table style={{ marginTop: 12, fontSize: FS.body, color: INK, borderCollapse: "collapse", width: "100%" }}>
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k} style={{ borderTop: `1px solid ${LINE}` }}>
                    <td style={{ padding: "6px 0", color: GRAY, fontSize: FS.meta, width: 62 }}>{k}</td>
                    <td style={{ padding: "6px 0", fontFamily: "ui-monospace, monospace", fontSize: FS.meta }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          {bean.status === "now" && (
            roaster.url ? (
              <a href={beanHref(roaster, bean)} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none", width: "100%", padding: "13px 14px", boxSizing: "border-box", background: INK, color: PAPER, borderRadius: 8, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: FS.lead, fontWeight: 800 }}>この豆を買う ↗</span>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.body, opacity: 0.9 }}>{fmtPrice(bean, cur)} / {perGrams(bean)}g</span>
                </div>
                <div style={{ fontSize: FS.meta, opacity: 0.75, marginTop: 3 }}>{roaster.name} の公式ECへ</div>
              </a>
            ) : (
              <div style={{ width: "100%", padding: "13px 0", background: "#EDEAE1", color: GRAY, borderRadius: 8, fontSize: FS.body, fontWeight: 700, textAlign: "center" }}>ECサイト準備中</div>
            )
          )}
          {bean.status === "sold" && (
            <>
              <button onClick={() => {
                  // 上限に達していたら追加はできない。外すのはいつでもできる。
                  if (!watching && watchFull) { setWatchMsg(`無料プランのウォッチは ${limits.watchlist} 銘柄までです。プレミアムで上限がなくなります。`); return; }
                  toggleRestock({ beanId: bean.id, r: bean.r, name: bean.name, roaster: roaster.name });
                  setWatching(isRestock(bean.id));
                  setWatchCount(getRestocks().length);
                  setWatchMsg("");
                }}
                style={{ width: "100%", padding: "13px 0", background: watching ? INK : PAPER, color: watching ? PAPER : INK, border: `1.5px solid ${INK}`, borderRadius: 8, fontSize: FS.lead, fontWeight: 700, cursor: watching || !watchFull ? "pointer" : "not-allowed", opacity: !watching && watchFull ? 0.55 : 1 }}>
                {watching ? "✓ 再入荷ウォッチ中" : "🔔 再入荷を待つ"}
              </button>
              <div style={{ textAlign: "center", fontSize: FS.meta, color: watchMsg ? AMBER : GRAY, marginTop: 8, lineHeight: 1.6 }}>
                {watchMsg
                  ? watchMsg
                  : watching
                    ? "再入荷を見つけたら、マイページのウォッチリストに「買う」が出ます。"
                    : premium
                      ? "ウォッチリストに追加します（上限なし）。"
                      : `ウォッチリストに追加します（無料プランは ${limits.watchlist} 銘柄まで・現在 ${watchCount} 件）。`}
              </div>
            </>
          )}
          {bean.status === "archive" && (
            <div style={{ textAlign: "center", fontSize: FS.meta, color: GRAY, padding: "10px 0", borderTop: `1px solid ${LINE}` }}>
              この豆は販売を終了しています。図鑑の記録として保存されています。
            </div>
          )}
          {bean.status === "now" && roaster.url && (
            // 連動レベルを隠さず出す。直リンクなのか店内検索なのかで、押したあとの体験が変わるため。
            <div style={{ textAlign: "center", fontSize: FS.meta, color: GRAY, marginTop: 8, lineHeight: 1.6 }}>
              {beanLinkKind(roaster, bean) === "direct"
                ? <>この豆の商品ページへ直接ひらきます</>
                : beanLinkKind(roaster, bean) === "search"
                  ? <>{roaster.url} 内でこの豆を検索した結果をひらきます</>
                  : <>{roaster.url} のトップページをひらきます</>}
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.meta, marginTop: 2 }}>↗ {roaster.url}</div>
            </div>
          )}
          {bean.status === "now" && onFlavor && (
            <button onClick={() => { onClose(); onFlavor(bean); }}
              style={{ width: "100%", marginTop: 10, padding: "11px 0", background: "none", color: INK, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: FS.body, fontWeight: 700, cursor: "pointer" }}>
              🗺 味わいマップでこの豆を見る →
            </button>
          )}
        </div>

        {/* 飲んだ味を記録（ローカル保存） */}
        <div style={{ marginTop: 18, borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
          <div style={{ fontSize: FS.body, fontWeight: 700 }}>
            ☕ 飲んだ味を記録{saved && <span style={{ fontSize: FS.meta, color: GREEN, marginLeft: 8 }}>保存済み</span>}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} aria-label={`${n}点`}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: FS.title, lineHeight: 1, padding: 0, color: n <= rating ? "#E4A11B" : LINE }}>★</button>
            ))}
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="香り・酸味・甘み・余韻など、感じた味をメモ"
            style={{ width: "100%", boxSizing: "border-box", marginTop: 8, minHeight: 60, padding: "8px 10px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: FS.body, resize: "vertical", background: PAPER, color: INK, fontFamily: "inherit" }} />
          <PhotoPicker value={photo} onChange={setPhoto} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={saveTasting} disabled={!rating}
              style={{ flex: 1, padding: "10px 0", background: rating ? INK : "#EDEAE1", color: rating ? PAPER : GRAY, border: "none", borderRadius: 8, fontSize: FS.body, fontWeight: 700, cursor: rating ? "pointer" : "default" }}>
              {saved ? "記録を更新" : "記録する"}
            </button>
            {saved && <button onClick={delTasting} style={{ padding: "10px 14px", background: "none", color: GRAY, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: FS.body, cursor: "pointer" }}>削除</button>}
          </div>
          {saveErr && <div style={{ fontSize: FS.meta, color: "#B8433A", marginTop: 7, lineHeight: 1.7 }}>{saveErr}</div>}
          <div style={{ fontSize: FS.meta, color: GRAY, marginTop: 6 }}>記録はこの端末に保存されます（「記録」タブで一覧）。</div>
        </div>

        {/* 次の一杯。記録を書いた直後は、次に何を買うか決めるのに都合がいい */}
        {onOpen && (nextCup.sameOrigin || nextCup.similar) && (
          <div style={{ marginTop: 18, borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
            <div style={{ fontSize: FS.body, fontWeight: 700 }}>次の一杯に</div>
            <div style={{ fontSize: FS.meta, color: GRAY, marginTop: 3, lineHeight: 1.6 }}>
              いま買えるものから選んでいます。
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {nextCup.sameOrigin && (
                <RecoCard label={`同じ産地から — ${bean.origin}`} bean={nextCup.sameOrigin} cur={cur} onOpen={onOpen} />
              )}
              {nextCup.similar && (
                <RecoCard label="似た味わいで、別の産地" bean={nextCup.similar} cur={cur} onOpen={onOpen} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* おすすめの1件。押すとその豆の詳細に移る（URLも切り替わるので共有できる）。
   買う導線をここに並べると、記録を書き終えた人が押す先が3つになって迷う。
   ここは「見に行く」だけにして、買うかどうかは移った先で決めてもらう。 */
function RecoCard({ label, bean, cur, onOpen }) {
  const roaster = ROASTERS[bean.r];
  const f = flavorOf(bean);
  return (
    <button onClick={() => onOpen(bean)}
      style={{ display: "block", width: "100%", textAlign: "left", cursor: "pointer",
        background: "#F7F5EF", border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: FS.meta, color: GRAY, letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginTop: 4 }}>
        <span style={{ fontSize: FS.body, fontWeight: 700, color: INK }}>{bean.name}</span>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.meta, color: INK, flexShrink: 0 }}>
          {fmtJPY(per100JPY(bean), cur)}/100g
        </span>
      </div>
      <div style={{ fontSize: FS.meta, color: GRAY, marginTop: 2 }}>
        {roaster.name} ・ {roaster.city} ・ {bean.process}
        {f && f.fam && FLAVORS[f.fam] ? ` ・ ${FLAVORS[f.fam].label}` : ""}
      </div>
    </button>
  );
}
