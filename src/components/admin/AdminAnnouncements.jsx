import React, { useState, useEffect, useCallback } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";
import {
  getCollection,
  getDocument,
  addDocument,
  deleteDocument,
} from "../../firestoreService";

function AdminSection({ title, icon, T, onBack, onSave, children }) {
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await onSave();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="app-shell" style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: "80px" }}>
      <div style={{ background: T.card, backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.cardBorder}`, padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={onBack} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "12px", padding: "8px 18px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>← رجوع</button>
        <h2 style={{ margin: 0, color: T.text, fontSize: "18px", fontWeight: "800" }}>{icon} {title}</h2>
      </div>
      <div style={{ padding: "16px" }}>{children}</div>
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: "1200px", margin: "0 auto", background: T.navBg, backdropFilter: "blur(16px)", borderTop: `1px solid ${T.cardBorder}`, padding: "12px 16px" }}>
        <button onClick={save} style={{ width: "100%", background: saved ? "#238636" : `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "15px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
          {saved ? "✅ تم الحفظ!" : "💾 حفظ التغييرات"}
        </button>
      </div>
    </div>
  );
}

export default function AdminAnnouncements({ config, saveConfig, T, onBack, fbGet, fbAdd, fbDelete, sendLocalNotification }) {
  const [items, setItems] = useState([]);
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationBody, setNotificationBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const safeFbGet = useCallback(async (collectionName, docId) => {
    if (typeof fbGet === "function") return fbGet(collectionName, docId);
    if (docId) return getDocument(collectionName, docId);
    return getCollection(collectionName);
  }, [fbGet]);

  const safeFbAdd = useCallback(async (collectionName, data) => {
    if (typeof fbAdd === "function") return fbAdd(collectionName, data);
    return addDocument(collectionName, data);
  }, [fbAdd]);

  const safeFbDelete = useCallback(async (collectionName, id) => {
    if (typeof fbDelete === "function") return fbDelete(collectionName, id);
    return deleteDocument(collectionName, id);
  }, [fbDelete]);

  useEffect(() => {
    safeFbGet("announcements").then(d => { if (d) setItems(d.sort((a, b) => b.createdAt - a.createdAt)); });
  }, [safeFbGet]);

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", fontSize: "13px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box", marginBottom: "8px" };

  const sendAnnouncement = async () => {
    const title = notificationTitle.trim();
    if (!title) return;
    setSending(true);

    try {
      const body = notificationBody.trim();
      const payload = { title, body, createdAt: Date.now() };
      const id = await safeFbAdd("announcements", payload);

      let tokens = [];
      try {
        const tokenDocs = await safeFbGet("fcm_tokens");
        tokens = (Array.isArray(tokenDocs) ? tokenDocs : [])
          .map(doc => {
            const raw = typeof doc?.token === "string" ? doc.token : typeof doc?.id === "string" ? doc.id : "";
            return String(raw ?? "").trim();
          })
          .filter(token => typeof token === "string" && token.length > 0 && token !== "undefined");

        const uniqueTokens = Array.from(new Set(tokens));
        tokens = uniqueTokens;
      } catch (err) {
        console.warn("[FCM Dispatch] Failed to load FCM tokens for broadcast; continuing without push recipients.", err);
        tokens = [];
      }

      if (db) {
        const sentBy = auth?.currentUser?.email || auth?.currentUser?.uid || "admin";
        addDoc(collection(db, "broadcast_notifications"), {
          title,
          body,
          createdAt: serverTimestamp(),
          sentBy,
        }).then(() => {
          console.log("[FCM Dispatch] saved broadcast_notifications log entry");
        }).catch((err) => {
          console.warn("[FCM Dispatch] broadcast_notifications write failed. Continuing with worker dispatch.", err);
        });
      }

      if (tokens.length > 0) {
        const uniqueTokens = Array.from(new Set(tokens.filter(t => typeof t === "string" && t.trim() !== "")));
        const workerPayload = {
          title: title.trim(),
          body: body.trim(),
          tokens: uniqueTokens,
        };

        try {
          const workerRes = await fetch("https://sawaed.hamodemsg.workers.dev/send-notification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(workerPayload),
          });

          if (!workerRes.ok) {
            const workerText = await workerRes.text().catch(() => "");
            console.warn("[FCM Dispatch] Cloudflare Worker push delivery failed:", workerRes.status, workerText);
          }
        } catch (err) {
          console.warn("[FCM Dispatch] Cloudflare Worker push request failed:", err);
        }
      }

      if (id) {
        setItems(list => [{ id, ...payload }, ...list]);
        if (typeof sendLocalNotification === "function") sendLocalNotification(`📢 ${payload.title}`, payload.body);
      }

      setNotificationTitle("");
      setNotificationBody("");
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    } catch (err) {
      console.error("sendAnnouncement failed:", err);
      alert("⚠️ تعذّر إرسال الإشعار. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.");
    } finally {
      setSending(false);
    }
  };

  const deleteAnnouncement = async (id) => {
    await safeFbDelete("announcements", id);
    setItems(list => list.filter(x => x.id !== id));
  };

  return (
    <AdminSection title="إشعارات وإعلانات فورية" icon="📢" T={T} onBack={onBack} onSave={() => {}}>
      <p style={{ color: T.subtext, fontSize: "12px", margin: "0 0 12px" }}>
        أرسل إشعاراً فورياً لكل الطلاب مباشرة — مستقل تماماً عن قسم الأخبار.
      </p>
      <div style={{ background: T.sectionBg, borderRadius: "14px", padding: "12px", marginBottom: "14px" }}>
        <input value={notificationTitle} onChange={e => setNotificationTitle(e.target.value)} placeholder="عنوان الإشعار *" style={inp} />
        <textarea value={notificationBody} onChange={e => setNotificationBody(e.target.value)} placeholder="نص الإشعار (اختياري)..." style={{ ...inp, height: "70px", resize: "vertical" }} />
        <button onClick={sendAnnouncement} disabled={sending || !notificationTitle.trim()} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", cursor: sending || !notificationTitle.trim() ? "not-allowed" : "pointer", opacity: sending || !notificationTitle.trim() ? 0.7 : 1, fontFamily: "'Cairo',sans-serif", fontWeight: "700" }}>
          {sending ? "⏳ جاري الإرسال..." : sent ? "✅ تم الإرسال!" : "📢 إرسال الآن"}
        </button>
      </div>
      {items.map(a => (
        <div key={a.id} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", marginBottom: "8px", display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 2px", fontWeight: "700", color: T.text, fontSize: "13px" }}>{a.title}</p>
            {a.body && <p style={{ margin: 0, color: T.subtext, fontSize: "11px" }}>{a.body}</p>}
          </div>
          <button onClick={() => deleteAnnouncement(a.id)} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer" }}>🗑️</button>
        </div>
      ))}
    </AdminSection>
  );
}
