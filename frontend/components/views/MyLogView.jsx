"use client";
import { useState, useEffect } from "react";
import { FS, INK, PAPER, GRAY, LINE, GREEN } from "../lib/theme";
import { BEANS } from "../data/beans";
import { ROASTERS } from "../data/roasters";
import { getUser, setUser, logout, getTastings, removeTasting, upsertTasting, mergeTastings, getDiagHistory, removeDiagResult, getAnalysisHistory, removeAnalysis, exportBackup, importBackup } from "../lib/store";
import { usePlan, refreshPlan } from "../lib/usePlan";
import { isCloud, isSignedIn, getSession, signInWithEmail, signInWithCode, lastEmail, captureSessionFromUrl, signOut, cloudPullTastings, cloudPushTastings } from "../lib/account";
import { analyzeTastings, recommendRoasters, GROUP_LABEL } from "../lib/analysis";
import { beanHref } from "../lib/utils";
import { Portfolio } from "../ui/Portfolio";
import { PhotoPicker } from "../ui/PhotoPicker";
import { PrintSheet } from "../ui/PrintSheet";
import { savePhotoDataUrl, deletePhoto, getPhotos } from "../lib/photos";

const stars = (n) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
const validEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || "").trim());
const rowToTasting = (r) => ({ beanId: r.bean_id, r: r.r, name: r.name, roaster: r.roaster, origin: r.origin, rating: r.rating, notes: r.notes, at: Number(r.at) || Date.now() });

export function MyLogView({ onOpen, onRoaster, authNotice, onDismissNotice }) {
  const [user, setU] = useState(null);
  const { premium } = usePlan();
  const [session, setSession] = useState(null);
  const [list, setList] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ready, setReady] = useState(false);
  const [loginMsg, setLoginMsg] = useState("");
  const [syncMsg, setSyncMsg] = useState("");
  const [loginErr, setLoginErr] = useState(false);   // 送信結果が失敗かどうか（色分け用）
  const [syncErr, setSyncErr] = useState(false);
  const [diags, setDiags] = useState([]);
  const [anas, setAnas] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [switching, setSwitching] = useState(false);   // 別のアカウントに切り替える欄
  const [code, setCode] = useState("");                // メールに届く6桁のコード
  const [codeEmail, setCodeEmail] = useState("");
  const [codeMsg, setCodeMsg] = useState("");
  const [codeErr, setCodeErr] = useState(false);
  const [backupMsg, setBackupMsg] = useState("");
  const [folds, setFolds] = useState({});          // 普段は畳んでおく節
  const [showAll, setShowAll] = useState(false);   // 記録一覧を全部出すか
  const [form, setForm] = useState({ name: "", roaster: "", origin: "", rating: 0, notes: "", photo: null });
  const [photos, setPhotos] = useState({});   // beanId -> dataURL（一覧のサムネイル）

  const saveManual = async () => {
    if (!form.name.trim() || !form.rating) return;
    const id = -Date.now();
    upsertTasting({ beanId: id, r: null, name: form.name.trim(), roaster: form.roaster.trim(), origin: form.origin.trim(), rating: form.rating, notes: form.notes.trim(), hasPhoto: !!form.photo });
    if (form.photo) await savePhotoDataUrl(id, form.photo);
    setForm({ name: "", roaster: "", origin: "", rating: 0, notes: "", photo: null });
    setShowAdd(false);
    refresh();
  };

  const refresh = () => {
    setU(getUser()); const l = getTastings(); setList(l);
    setSession(getSession()); setDiags(getDiagHistory()); setAnas(getAnalysisHistory());
    getPhotos(l.map((t) => t.beanId)).then(setPhotos);   // 写真は IndexedDB から後追いで
  };

  const syncNow = async () => {
    if (!isCloud() || !isSignedIn()) return;
    try {
      setSyncMsg("同期中…");
      const cloud = await cloudPullTastings();
      mergeTastings(cloud.map(rowToTasting));
      await cloudPushTastings(getTastings());
      await refreshPlan();                 // 支払いの記録からプレミアムを確定させる
      refresh();
      setSyncMsg("同期しました");
      // 失敗の理由は account.js が日本語で返す。握りつぶすと直しようがない
    } catch (e) { setSyncMsg(e.message || "同期に失敗しました（ネットワークを確認）"); }
  };

  useEffect(() => {
    (async () => {
      // セッションの確立は BeanTracker 起動時に済んでいる。
      // ここは直接マイページから読み込まれた場合の保険（既に処理済みなら null が返る）。
      await captureSessionFromUrl();
      refresh();
      setReady(true);
      if (isCloud() && isSignedIn()) syncNow();
    })();
    // 起動時に1回だけ。syncNow は毎描画で作り直されるので依存に入れない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // メールリンクでログインが成立した直後は、その場で同期して結果を見せる
  useEffect(() => {
    if (authNotice && authNotice.ok) { refresh(); syncNow(); }
    // 同上
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authNotice]);

  if (!ready) return null;

  const cloud = isCloud();
  const signed = cloud && isSignedIn();
  // メール認証済み、またはこの端末でメール/ニックネームを入れた人。
  // 認証の往復を待たずにポートフォリオを開けるよう、クラウド設定時もローカルの user を認める
  const authed = signed || !!user;

  /* 普段は使わない節を畳む。マイページは「記録を見る場所」なので、
     控えの持ち出しや過去の診断まで常時開いていると、本題が下に押し出される。 */
  const foldBlock = (id, title, sub, body) => {
    const open = !!folds[id];
    return (
      <div style={{ marginTop: 10, border: `1px solid ${LINE}`, borderRadius: 10, overflow: "hidden" }}>
        <button onClick={() => setFolds({ ...folds, [id]: !open })}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%",
            padding: "10px 13px", background: PAPER, border: "none", cursor: "pointer", textAlign: "left" }}>
          <span style={{ fontSize: FS.body, fontWeight: 700, color: INK }}>{title}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {sub && <span style={{ fontSize: FS.meta, color: GRAY }}>{sub}</span>}
            <span style={{ fontSize: FS.body, color: GRAY, transform: open ? "rotate(180deg)" : "none" }}>⌄</span>
          </span>
        </button>
        {open && <div style={{ padding: "0 13px 13px" }}>{body()}</div>}
      </div>
    );
  };

  const accountEmailGuess = (user && user.email)
    || (session && session.user && session.user.email) || "";

  // メールリンクの結果を出す帯（成功・失敗どちらも黙って消さない）
  const noticeBlock = () => !authNotice ? null : (
    <div style={{ marginBottom: 12, padding: "11px 14px", borderRadius: 10,
      background: authNotice.ok ? "#EEF4E9" : "#FBEDEC", border: `1px solid ${authNotice.ok ? "#CBDDBC" : "#EDC9C6"}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: FS.body, lineHeight: 1.7, color: authNotice.ok ? "#3C5C2A" : "#8A3B2E", flex: 1 }}>{authNotice.text}</span>
        <button onClick={onDismissNotice} aria-label="閉じる"
          style={{ background: "none", border: "none", fontSize: FS.body, color: GRAY, cursor: "pointer", lineHeight: 1, padding: 0 }}>✕</button>
      </div>
      {/* リンクが駄目だったときは、ここから立て直せるようにする。
          「エラーが出た → マイページを探して → アドレスを打ち直す」を無くす。 */}
      {authNotice.recoverable && codeLoginBlock(true)}
    </div>
  );

  /* 6桁のコードでログインする欄。
     リンク方式は、戻り先URLの許可・メール側の安全確認による使い切り・有効期限・
     メールアプリ内ブラウザへの着地、と失敗の道が多い。いま入りたい端末に
     コードを打ち込む方式なら、そのどれも起きない。 */
  const codeLoginBlock = (compact) => {
    const target = (codeEmail || lastEmail() || accountEmailGuess || "").trim();
    return (
      <div style={{ marginTop: compact ? 10 : 12, padding: compact ? "10px 12px" : "13px 14px",
        border: `1px solid ${LINE}`, borderRadius: 10, background: PAPER }}>
        <div style={{ fontSize: FS.body, fontWeight: 700 }}>6桁のコードでログイン</div>
        <div style={{ fontSize: FS.meta, color: GRAY, marginTop: 4, lineHeight: 1.7 }}>
          メールに書かれた6桁の数字を、いまお使いのこの端末で入力してください。
          リンクを開けなかったときでも、こちらなら確実に入れます。
        </div>
        <input type="email" value={target} onChange={(e) => setCodeEmail(e.target.value)} placeholder="you@example.com"
          style={{ width: "100%", boxSizing: "border-box", marginTop: 9, padding: "9px 11px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: FS.body, background: PAPER, color: INK }} />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" placeholder="123456"
            style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: FS.lead, letterSpacing: "0.2em", fontFamily: "ui-monospace, monospace", background: PAPER, color: INK }} />
          <button onClick={async () => {
              setCodeErr(false); setCodeMsg("確認中…");
              try {
                await signInWithCode(target, code);
                setCodeMsg("ログインしました");
                setCode("");
                refresh();
                await refreshPlan();
                syncNow();
              } catch (e) { setCodeErr(true); setCodeMsg(e.message || "ログインできませんでした"); }
            }}
            disabled={code.length < 6 || !validEmail(target)}
            style={{ padding: "9px 16px", background: (code.length >= 6 && validEmail(target)) ? INK : "#EDEAE1", color: (code.length >= 6 && validEmail(target)) ? PAPER : GRAY, border: "none", borderRadius: 8, fontSize: FS.body, fontWeight: 700, cursor: (code.length >= 6 && validEmail(target)) ? "pointer" : "default", whiteSpace: "nowrap" }}>
            ログイン
          </button>
        </div>
        <button onClick={async () => {
            if (!validEmail(target)) return;
            setCodeErr(false); setCodeMsg("送信中…");
            try { await signInWithEmail(target); setCodeMsg("送り直しました。届いたメールのコードを入力してください。"); }
            catch (e) { setCodeErr(true); setCodeMsg(e.message || "送信できませんでした"); }
          }}
          disabled={!validEmail(target)}
          style={{ marginTop: 8, background: "none", border: "none", padding: 0, fontSize: FS.meta, color: GRAY, cursor: validEmail(target) ? "pointer" : "default", textDecoration: "underline", textUnderlineOffset: 2 }}>
          メールを送り直す
        </button>
        {codeMsg && <div style={{ fontSize: FS.meta, color: codeErr ? "#B8433A" : GREEN, marginTop: 7, lineHeight: 1.7 }}>{codeMsg}</div>}
      </div>
    );
  };

  // ---- 未ログイン ----
  if (!authed) {
    return (
      <div className="bt-card">
        {noticeBlock()}
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.meta, letterSpacing: "0.15em", color: GRAY }}>MY ACCOUNT</div>
        <div style={{ fontSize: FS.head, fontWeight: 800, marginTop: 6 }}>ログインして味を記録</div>

        {cloud ? (
          <>
            <div style={{ fontSize: FS.body, color: GRAY, marginTop: 6, lineHeight: 1.7 }}>
              メールアドレスを入れると、この端末のポートフォリオがすぐ開きます。
            </div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              onKeyDown={(e) => { if (e.key === "Enter" && validEmail(email)) { setUser(email.trim().split("@")[0], email.trim()); refresh(); } }}
              style={{ width: "100%", boxSizing: "border-box", marginTop: 12, padding: "10px 12px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: FS.lead, background: PAPER, color: INK }} />
            {/* メール認証の往復を待たずにポートフォリオへ入れる。
                認証リンクは「複数端末で同期したいとき」の任意手段として下に置く */}
            <button onClick={() => { if (validEmail(email)) { setUser(email.trim().split("@")[0], email.trim()); refresh(); } }}
              disabled={!validEmail(email)}
              style={{ width: "100%", marginTop: 10, padding: "12px 0", background: validEmail(email) ? INK : "#EDEAE1", color: validEmail(email) ? PAPER : GRAY, border: "none", borderRadius: 8, fontSize: FS.body, fontWeight: 700, cursor: validEmail(email) ? "pointer" : "default" }}>
              ポートフォリオを見る
            </button>
            <button onClick={async () => {
                if (!validEmail(email)) return;
                setLoginErr(false); setLoginMsg("送信中…");
                try { await signInWithEmail(email.trim()); setLoginMsg("メールを送信しました。届いたリンクを開くと、他の端末とも記録が同期されます。"); }
                catch (e) { setLoginErr(true); setLoginMsg(e.message || "送信できませんでした"); }
              }}
              disabled={!validEmail(email)}
              style={{ width: "100%", marginTop: 8, padding: "11px 0", background: "none", color: validEmail(email) ? INK : GRAY, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: FS.body, fontWeight: 700, cursor: validEmail(email) ? "pointer" : "default" }}>
              ☁ 他の端末とも同期する（メール認証）
            </button>
            {loginMsg && <div style={{ fontSize: FS.meta, color: loginErr ? "#B8433A" : GREEN, marginTop: 8, lineHeight: 1.7 }}>{loginMsg}</div>}
            {/* 2台目の端末で入るときの本命。メールを別の端末で開いても、
                コードならこの端末に打ち込めるので、リンクの往復に依存しない */}
            {codeLoginBlock(false)}
            <div style={{ fontSize: FS.meta, color: GRAY, marginTop: 10, lineHeight: 1.7 }}>
              メールアドレスはこの端末の中だけに保存されます。認証するまでサーバーには送られません。
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: FS.body, color: GRAY, marginTop: 6, lineHeight: 1.7 }}>
              飲んだコーヒーの味を記録できます。まずはお名前（ニックネーム）を入れてください。
            </div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ニックネーム"
              style={{ width: "100%", boxSizing: "border-box", marginTop: 12, padding: "10px 12px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: FS.lead, background: PAPER, color: INK }} />
            <button onClick={() => { if (name.trim()) { setUser(name); refresh(); } }}
              style={{ width: "100%", marginTop: 10, padding: "12px 0", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: FS.body, fontWeight: 700, cursor: "pointer" }}>
              ログイン（この端末に保存）
            </button>
            <div style={{ fontSize: FS.meta, color: GRAY, marginTop: 10, lineHeight: 1.7 }}>
              ※ 現在この端末はクラウド未設定のため端末内保存のみ。メール同期は Supabase 設定後に有効化されます（documents/account-sync.md）。
            </div>
          </>
        )}
      </div>
    );
  }

  const openBean = (id) => { const b = BEANS.find((x) => x.id === id); if (b) onOpen(b); };
  const hasCard = (id) => BEANS.some((x) => x.id === id);   // 手入力の記録には図鑑のカードが無い
  const accountEmail = signed ? (session && session.user ? session.user.email : null) : (user ? user.email || null : null);
  const accountName = signed ? (session && session.user ? session.user.email : "アカウント") : (user ? user.name : "");
  /* ログアウトしたらプランも取り直す。これが無いと、共有の権限状態が
     プレミアムのまま画面に残り、次に開いた人にプレミアム画面が見えてしまう
     （読み直しは resolvePlan が未ログインを見て無料に戻し、端末の写しも消す）。 */
  const doLogout = async () => {
    if (signed) { await signOut(); } else { logout(); }
    await refreshPlan();
    refresh();
  };

  // 記録のライブAI分析（保存不要・記録から即時算出）＋相性の良いロースター3件
  const tan = analyzeTastings(list);
  const liveTags = [];
  if (tan.topGroup) liveTags.push(GROUP_LABEL[tan.topGroup] || tan.topGroup);
  if (tan.topProc) liveTags.push(tan.topProc);
  if (tan.topFam) liveTags.push(tan.topFam);
  const recs = recommendRoasters(tan, 3).filter((k) => ROASTERS[k]);

  return (
    <div>
      {noticeBlock()}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.meta, letterSpacing: "0.15em", color: GRAY }}>MY LOG</div>
          <div style={{ fontSize: FS.head, fontWeight: 800, marginTop: 4, wordBreak: "break-all" }}>{accountName}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: FS.meta, color: signed ? GREEN : GRAY }}>{signed ? "☁ クラウド同期中" : "端末内保存"}</span>
            {premium && <span style={{ fontSize: FS.meta, color: "#A87B2E", fontWeight: 700 }}>PREMIUM</span>}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <button onClick={doLogout} style={{ background: "none", border: "none", fontSize: FS.meta, color: GRAY, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>ログアウト</button>
          {cloud && (
            <button onClick={() => { setSwitching((v) => !v); setLoginMsg(""); setLoginErr(false); }}
              style={{ background: "none", border: "none", fontSize: FS.meta, color: GRAY, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
              {switching ? "やめる" : "別のアカウント"}
            </button>
          )}
        </div>
      </div>

      {/* 別のアカウントに切り替える。ログアウトしてから入り直さなくても、
          ここで認証メールを送れば、リンクを開いた時点でそのアカウントに変わる。
          記録はアカウントごとに分けて保存しているので、混ざらない。 */}
      {switching && cloud && (
        <div style={{ marginTop: 10, padding: "13px 14px", border: `1px solid ${LINE}`, borderRadius: 10, background: "#F7F5EF" }}>
          <div style={{ fontSize: FS.body, fontWeight: 700 }}>別のアカウントでログイン</div>
          <div style={{ fontSize: FS.meta, color: GRAY, marginTop: 4, lineHeight: 1.7 }}>
            メールを送ります。届いたリンクを開くと、そのアカウントに切り替わります。
            いまの記録はこのアカウントのものとして残ります。
          </div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="other@example.com"
            style={{ width: "100%", boxSizing: "border-box", marginTop: 9, padding: "9px 11px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: FS.body, background: PAPER, color: INK }} />
          <button onClick={async () => {
              if (!validEmail(email)) return;
              setLoginErr(false); setLoginMsg("送信中…");
              try { await signInWithEmail(email.trim()); setLoginMsg("メールを送りました。リンクを開くと切り替わります。"); }
              catch (e) { setLoginErr(true); setLoginMsg(e.message || "送信できませんでした"); }
            }}
            disabled={!validEmail(email)}
            style={{ width: "100%", marginTop: 8, padding: "10px 0", background: validEmail(email) ? INK : "#EDEAE1", color: validEmail(email) ? PAPER : GRAY, border: "none", borderRadius: 8, fontSize: FS.body, fontWeight: 700, cursor: validEmail(email) ? "pointer" : "default" }}>
            ✉ 認証メールを送る
          </button>
          {loginMsg && <div style={{ fontSize: FS.meta, color: loginErr ? "#B8433A" : GREEN, marginTop: 7, lineHeight: 1.7 }}>{loginMsg}</div>}
          {codeLoginBlock(true)}
        </div>
      )}

      {signed && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <button onClick={syncNow} style={{ padding: "8px 14px", background: PAPER, color: INK, border: `1.5px solid ${INK}`, borderRadius: 8, fontSize: FS.body, fontWeight: 700, cursor: "pointer" }}>☁ 今すぐ同期</button>
          {syncMsg && <span style={{ fontSize: FS.meta, color: GRAY }}>{syncMsg}</span>}
        </div>
      )}

      {/* メールで入っただけの状態からでも、あとから同期を始められるようにする */}
      {!signed && cloud && accountEmail && (
        <div style={{ marginTop: 10 }}>
          <button onClick={async () => {
              setSyncErr(false); setSyncMsg("送信中…");
              try { await signInWithEmail(accountEmail); setSyncMsg("認証メールを送りました。リンクを開くと他の端末とも同期されます。"); }
              catch (e) { setSyncErr(true); setSyncMsg(e.message || "送信できませんでした"); }
            }}
            style={{ padding: "8px 14px", background: "none", color: INK, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: FS.meta, fontWeight: 700, cursor: "pointer" }}>
            ☁ 他の端末とも同期する
          </button>
          {syncMsg && <div style={{ fontSize: FS.meta, color: syncErr ? "#B8433A" : GREEN, marginTop: 6, lineHeight: 1.7 }}>{syncMsg}</div>}
        </div>
      )}

      {/* ポートフォリオ（記録から集計。件数・平均評価もここに含まれる） */}
      <Portfolio list={list} email={accountEmail} onOpen={onOpen} onRoaster={onRoaster} />

      {/* 記録の持ち出し。クラウド同期は設定に依存するが、これはファイル1つで完結する。
          端末を変えても、ブラウザのデータを消しても、これがあれば戻せる。
          ただし毎回使うものではないので畳んでおく。 */}
      {foldBlock("backup", "書き出す・戻す", `${list.length}件`, () => (
        <div>
          {/* PDF と JSON は用途が違う。片方だけにすると、読めるが戻せない／
              戻せるが読めない、のどちらかになる。両方置いて、名前で分ける。 */}
          <div style={{ fontSize: FS.meta, color: GRAY, lineHeight: 1.7, marginBottom: 4 }}>
            <b style={{ color: INK }}>PDF</b> は読むため、<b style={{ color: INK }}>控え</b>は戻すためのものです。
          </div>

          <button onClick={() => { setBackupMsg(""); window.print(); }}
            disabled={list.length === 0}
            style={{ width: "100%", marginTop: 8, padding: "11px 0", background: list.length ? INK : "#EDEAE1",
              color: list.length ? PAPER : GRAY, border: "none", borderRadius: 8, fontSize: FS.body, fontWeight: 700,
              cursor: list.length ? "pointer" : "default" }}>
            PDFで書き出す
          </button>
          <div style={{ fontSize: FS.meta, color: GRAY, lineHeight: 1.7, marginTop: 5 }}>
            産地・精製方法・焙煎所・評価ごとにまとめて、全記録の一覧を付けます。
            印刷の画面が開くので、送信先で「PDFとして保存」を選んでください。
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => {
                const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `bean-tracker-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(a.href);
                setBackupMsg("控えを保存しました");
              }}
              style={{ flex: 1, padding: "9px 10px", background: PAPER, color: INK, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: FS.meta, fontWeight: 700, cursor: "pointer" }}>
              ⤓ 控えを保存
            </button>
            <label style={{ flex: 1, textAlign: "center", padding: "9px 10px", background: PAPER, color: INK, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: FS.meta, fontWeight: 700, cursor: "pointer" }}>
              ⤒ 控えから戻す
              <input type="file" accept="application/json,.json" style={{ display: "none" }}
                onChange={async (e) => {
                  const f = e.target.files && e.target.files[0];
                  e.target.value = "";
                  if (!f) return;
                  try {
                    const r = importBackup(JSON.parse(await f.text()));
                    refresh();
                    setBackupMsg(`${r.added}件を追加しました（合計${r.total}件）`);
                  } catch (err) { setBackupMsg(err.message || "読み込めませんでした"); }
                }} />
            </label>
          </div>
          <div style={{ fontSize: FS.meta, color: GRAY, lineHeight: 1.7, marginTop: 5 }}>
            控えは <code>.json</code> のファイルです。ここで保存したものを「控えから戻す」で読みます。
            端末を変えても、ブラウザのデータを消しても戻せます。
            戻すときは<b style={{ color: INK }}>足すだけ</b>で、いまの記録は消しません。
          </div>
          {backupMsg && <div style={{ fontSize: FS.meta, color: GREEN, marginTop: 7 }}>{backupMsg}</div>}
        </div>
      ))}

      {/* 印刷のときだけ現れる。画面には出ない */}
      <PrintSheet list={list} email={accountEmail} />

      {/* 過去に飲んだ豆を手動で記録（図鑑に無い豆もカード化） */}
      <div style={{ marginTop: 12 }}>
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)}
            style={{ width: "100%", padding: "12px 0", background: INK, color: PAPER, border: "none", borderRadius: 10, fontSize: FS.body, fontWeight: 700, cursor: "pointer" }}>
            ＋ 過去に飲んだ豆を記録
          </button>
        ) : (
          <div style={{ padding: "14px 16px", border: `1px solid ${LINE}`, borderRadius: 12, background: "#F7F5EF" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: FS.body, fontWeight: 800 }}>☕ 飲んだ豆を記録</div>
              <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", fontSize: FS.meta, color: GRAY, cursor: "pointer" }}>閉じる</button>
            </div>
            <div style={{ fontSize: FS.meta, color: GRAY, marginTop: 3, lineHeight: 1.6 }}>図鑑に無い豆でもOK。銘柄名と評価だけで記録できます。</div>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="銘柄名（必須）例：Ethiopia Guji"
              style={{ width: "100%", boxSizing: "border-box", marginTop: 10, padding: "9px 11px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: FS.body, background: PAPER, color: INK }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input value={form.roaster} onChange={(e) => setForm({ ...form, roaster: e.target.value })} placeholder="ロースター（任意）"
                style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: FS.body, background: PAPER, color: INK }} />
              <input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} placeholder="産地（任意）"
                style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: FS.body, background: PAPER, color: INK }} />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center" }}>
              <span style={{ fontSize: FS.meta, color: GRAY, marginRight: 2 }}>評価</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setForm({ ...form, rating: n })} aria-label={`${n}点`}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: FS.title, lineHeight: 1, padding: 0, color: n <= form.rating ? "#E4A11B" : LINE }}>★</button>
              ))}
            </div>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="香り・酸味・甘み・余韻など、感じた味をメモ（任意）"
              style={{ width: "100%", boxSizing: "border-box", marginTop: 8, minHeight: 54, padding: "8px 10px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: FS.body, resize: "vertical", background: PAPER, color: INK, fontFamily: "inherit" }} />
            <PhotoPicker value={form.photo} onChange={(p) => setForm({ ...form, photo: p })} />
            <button onClick={saveManual} disabled={!form.name.trim() || !form.rating}
              style={{ width: "100%", marginTop: 8, padding: "11px 0", background: (form.name.trim() && form.rating) ? INK : "#EDEAE1", color: (form.name.trim() && form.rating) ? PAPER : GRAY, border: "none", borderRadius: 8, fontSize: FS.body, fontWeight: 700, cursor: (form.name.trim() && form.rating) ? "pointer" : "default" }}>
              記録する
            </button>
          </div>
        )}
      </div>

      {/* 記録のライブAI分析（トップ）＋おすすめロースター3件 */}
      {tan.rated > 0 && (
        <div style={{ marginTop: 18, padding: "16px 16px 14px", background: "#141210", color: PAPER, borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.meta, letterSpacing: "0.15em", color: "#B8AE9E" }}>🧠 記録のAI分析</div>
            <div style={{ fontSize: FS.meta, color: "#B8AE9E" }}>{tan.rated}件を分析</div>
          </div>
          <div style={{ fontSize: FS.lead, fontWeight: 800, marginTop: 8, lineHeight: 1.5 }}>
            あなたの好みは{liveTags.length ? `「${liveTags[0]}」` : "分析中"}
          </div>
          {liveTags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {liveTags.map((t) => (
                <span key={t} style={{ fontSize: FS.meta, fontWeight: 700, color: "#141210", background: "#E4B84A", borderRadius: 999, padding: "3px 11px" }}>高評価: {t}</span>
              ))}
            </div>
          )}
          {recs.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: FS.meta, color: "#B8AE9E", letterSpacing: "0.06em" }}>あなたにおすすめのロースター</div>
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {recs.map((k, i) => {
                  const r = ROASTERS[k];
                  return (
                    <button key={k} onClick={() => onRoaster(k)}
                      style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", background: "#211E1A", border: "1px solid #3A352E", borderRadius: 10, padding: "10px 12px", cursor: "pointer", color: PAPER }}>
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.body, fontWeight: 800, color: "#E4B84A", width: 16, flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: FS.body, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                        <span style={{ display: "block", fontSize: FS.meta, color: "#B8AE9E", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[r.city, r.style].filter(Boolean).join(" ・ ")}</span>
                      </span>
                      <span style={{ color: "#B8AE9E", fontSize: FS.lead, flexShrink: 0 }}>›</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: FS.meta, color: "#7C7365", marginTop: 8, lineHeight: 1.6 }}>※ 高評価の記録の傾向から、いま買える豆のあるロースターを相性順に表示しています。</div>
            </div>
          )}
        </div>
      )}

      {/* 保存した分析（過去の控え。畳んでおく） */}
      {anas.length > 0 && foldBlock("anas", "保存した分析", `${anas.length}件`, () => (
        <div>
          {anas.map((a) => (
            <div key={a.at} style={{ borderBottom: `1px solid ${LINE}`, padding: "10px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: FS.body, fontWeight: 700, color: INK }}>{a.rated}件の記録を分析</span>
                <button onClick={() => { removeAnalysis(a.at); refresh(); }} style={{ background: "none", border: "none", fontSize: FS.meta, color: GRAY, cursor: "pointer" }}>削除</button>
              </div>
              {a.tags && a.tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
                  {a.tags.map((t) => <span key={t} style={{ fontSize: FS.meta, fontWeight: 700, color: INK, background: "#F2F0E9", borderRadius: 999, padding: "2px 9px" }}>高評価: {t}</span>)}
                </div>
              )}
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.meta, color: GRAY, marginTop: 6 }}>{new Date(a.at).toLocaleDateString("ja-JP")}</div>
            </div>
          ))}
        </div>
      ))}

      {/* 診断の記録（過去の控え。畳んでおく） */}
      {diags.length > 0 && foldBlock("diags", "診断の記録", `${diags.length}件`, () => (
        <div>
          {diags.map((d) => (
            <div key={d.at} style={{ borderBottom: `1px solid ${LINE}`, padding: "10px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: FS.body, fontWeight: 700, color: INK }}>{d.type}</span>
                <button onClick={() => { removeDiagResult(d.at); refresh(); }} style={{ background: "none", border: "none", fontSize: FS.meta, color: GRAY, cursor: "pointer" }}>削除</button>
              </div>
              {d.tags && d.tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
                  {d.tags.map((t) => <span key={t} style={{ fontSize: FS.meta, color: GRAY, border: `1px solid ${LINE}`, borderRadius: 999, padding: "2px 8px" }}>{t}</span>)}
                </div>
              )}
              {d.top && d.top.filter((k) => ROASTERS[k]).length > 0 && (
                <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {d.top.filter((k) => ROASTERS[k]).map((k) => (
                    <button key={k} onClick={() => onRoaster(k)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: FS.meta, color: INK, textDecoration: "underline", textUnderlineOffset: 2 }}>{ROASTERS[k].name}</button>
                  ))}
                </div>
              )}
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.meta, color: GRAY, marginTop: 6 }}>{new Date(d.at).toLocaleDateString("ja-JP")}</div>
            </div>
          ))}
        </div>
      ))}

      {/* 記録が無いときの案内はポートフォリオ側で出しているので、ここでは繰り返さない。
          一覧は新しい順に8件まで。全部並べると、下にあるものほど二度と見られない。 */}
      {list.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, borderBottom: `1px solid ${LINE}`, paddingBottom: 6 }}>
            <span style={{ fontSize: FS.body, fontWeight: 800 }}>記録</span>
            <span style={{ fontSize: FS.meta, color: GRAY }}>{list.length}件</span>
          </div>
          {(showAll ? list : list.slice(0, 8)).map((t) => (
            <div key={t.beanId} style={{ borderBottom: `1px solid ${LINE}`, padding: "12px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <button onClick={() => openBean(t.beanId)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                  <span style={{ fontSize: FS.body, fontWeight: 700, color: INK }}>{t.name}</span>
                </button>
                <span style={{ color: "#E4A11B", fontSize: FS.body, letterSpacing: 1, flexShrink: 0 }}>{stars(t.rating)}</span>
              </div>
              <button onClick={() => t.r && onRoaster(t.r)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: FS.meta, color: GRAY, marginTop: 2, textDecoration: "underline", textUnderlineOffset: 2 }}>
                {t.roaster}{t.origin ? ` ・ ${t.origin}` : ""}
              </button>
              {photos[t.beanId] && (
                // 写真からも豆のカードを開けるようにする（銘柄名だけが入口だと押しづらい）。
                // 手入力の記録は図鑑に対応する豆が無いので、押せる見た目にしない。
                hasCard(t.beanId) ? (
                  <button onClick={() => openBean(t.beanId)} aria-label={`${t.name} の詳細を開く`}
                    style={{ display: "block", width: "100%", padding: 0, marginTop: 8, background: "none", border: "none", cursor: "pointer" }}>
                    <img src={photos[t.beanId]} alt=""
                      style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10, display: "block", background: "#F0EDE4" }} />
                  </button>
                ) : (
                  <img src={photos[t.beanId]} alt=""
                    style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10, marginTop: 8, display: "block", background: "#F0EDE4" }} />
                )
              )}
              {t.notes && <div style={{ fontSize: FS.body, color: INK, marginTop: 5, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{t.notes}</div>}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 }}>
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.meta, color: GRAY }}>{new Date(t.at).toLocaleDateString("ja-JP")}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* 気に入った豆をここから買い直せるようにする（記録タブから図鑑に戻らせない） */}
                  {(() => {
                    const b = BEANS.find((x) => x.id === t.beanId);
                    const r = b && ROASTERS[b.r];
                    if (!b || b.status !== "now" || !r || !r.url) return null;
                    return (
                      <a href={beanHref(r, b)} target="_blank" rel="noopener noreferrer"
                        style={{ textDecoration: "none", padding: "6px 12px", background: INK, color: PAPER, borderRadius: 6, fontSize: FS.meta, fontWeight: 700, whiteSpace: "nowrap" }}>
                        また買う ↗
                      </a>
                    );
                  })()}
                  <button onClick={() => { removeTasting(t.beanId); deletePhoto(t.beanId); refresh(); }} style={{ background: "none", border: "none", fontSize: FS.meta, color: GRAY, cursor: "pointer" }}>削除</button>
                </div>
              </div>
            </div>
          ))}
          {list.length > 8 && (
            <button onClick={() => setShowAll(!showAll)}
              style={{ width: "100%", marginTop: 10, padding: "10px 0", background: "none", color: INK, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: FS.body, fontWeight: 700, cursor: "pointer" }}>
              {showAll ? "たたむ" : `のこり${list.length - 8}件を見る`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
