"use client";
import { useRef, useState } from "react";
import { FS, INK, GRAY, LINE } from "../lib/theme";
import { shrinkToDataUrl } from "../lib/photos";

/* 味の記録に添える写真の選択・プレビュー。
   保存は呼び出し側（記録ボタンを押したとき）に任せ、ここでは縮小済みの
   dataURL を onChange で渡すだけにしている。記録せずシートを閉じた場合に
   写真だけ残ってしまうのを防ぐため。 */
export function PhotoPicker({ value, onChange, label = "写真を追加" }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const pick = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";                    // 同じ写真を選び直せるように
    if (!f) return;
    setErr(""); setBusy(true);
    try { onChange(await shrinkToDataUrl(f)); }
    catch { setErr("この画像は読み込めませんでした"); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <input ref={ref} type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />
      {value ? (
        <div style={{ position: "relative" }}>
          <img src={value} alt="記録した写真"
            style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 10, display: "block", background: "#F0EDE4" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button onClick={() => ref.current && ref.current.click()}
              style={{ flex: 1, padding: "8px 0", background: "none", color: INK, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: FS.meta, fontWeight: 700, cursor: "pointer" }}>
              撮り直す
            </button>
            <button onClick={() => onChange(null)}
              style={{ padding: "8px 14px", background: "none", color: GRAY, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: FS.meta, cursor: "pointer" }}>
              削除
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => ref.current && ref.current.click()} disabled={busy}
          style={{ width: "100%", padding: "11px 0", background: "none", color: busy ? GRAY : INK, border: `1px dashed ${LINE}`, borderRadius: 8, fontSize: FS.body, fontWeight: 700, cursor: busy ? "default" : "pointer" }}>
          {busy ? "読み込み中…" : `📷 ${label}`}
        </button>
      )}
      {err && <div style={{ fontSize: FS.meta, color: "#B8433A", marginTop: 5 }}>{err}</div>}
    </div>
  );
}
