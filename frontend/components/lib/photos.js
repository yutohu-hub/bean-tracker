/* 味の記録に添える写真。
   localStorage は原点あたり約5MBしかなく、スマホの写真は1枚2〜5MBあるため
   そこに入れると数枚で他の記録ごと保存できなくなる。写真だけ IndexedDB に置き、
   保存前に端末側で縮小して1枚あたり数百KBに収める。 */

const DB = "bean-tracker";
const STORE = "photos";
const MAX_EDGE = 1280;     // 長辺。豆の袋やカップが判別できる程度で足りる
const QUALITY = 0.72;

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no-indexeddb"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(req ? req.result : undefined); };
    t.onerror = () => { db.close(); reject(t.error); };
  }));
}

/* 撮った写真をそのまま持たず、長辺 MAX_EDGE に縮めて JPEG にする。
   EXIF の向きは createImageBitmap の imageOrientation に任せる（iPhoneの横倒れ対策）。 */
export async function shrinkToDataUrl(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bmp) throw new Error("画像を読み込めませんでした");
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return canvas.toDataURL("image/jpeg", QUALITY);
}

// 縮小済みの dataURL を保存する（画面側で先にプレビューを作るため、こちらを使う）
export async function savePhotoDataUrl(beanId, dataUrl) {
  if (!dataUrl) return null;
  await tx("readwrite", (s) => s.put(dataUrl, String(beanId)));
  return dataUrl;
}

export async function savePhoto(beanId, file) {
  return savePhotoDataUrl(beanId, await shrinkToDataUrl(file));
}

export async function getPhoto(beanId) {
  try { return (await tx("readonly", (s) => s.get(String(beanId)))) || null; } catch { return null; }
}

/* 一覧用にまとめて読む（1件ずつ開くとトランザクションが積み上がるため） */
export async function getPhotos(beanIds) {
  const out = {};
  try {
    await tx("readonly", (s) => {
      for (const id of beanIds) {
        const r = s.get(String(id));
        r.onsuccess = () => { if (r.result) out[id] = r.result; };
      }
      return null;
    });
  } catch {}
  return out;
}

export async function deletePhoto(beanId) {
  try { await tx("readwrite", (s) => s.delete(String(beanId))); } catch {}
}
