import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import AdminSection from "./AdminSection.jsx";

const TYPES = [
  { value: "privacy", label: "سياسة الخصوصية" },
  { value: "terms", label: "شروط الخدمة" },
];
const LEGAL_COLLECTION = "legal_documents";

const inputStyle = (T) => ({
  background: T.inputBg,
  border: `1.5px solid ${T.cardBorder}`,
  borderRadius: "12px",
  padding: "12px 14px",
  fontSize: "14px",
  color: T.text,
  width: "100%",
  outline: "none",
  fontFamily: "'Cairo',sans-serif",
  direction: "rtl",
  boxSizing: "border-box",
});

export default function AdminLegal({ T, onBack, role }) {
  const [clauses, setClauses] = useState([]);
  const [selectedType, setSelectedType] = useState("privacy");
  const [form, setForm] = useState({ title: "", content: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", content: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (role !== "super_admin") return undefined;

    const legalCollection = collection(db, LEGAL_COLLECTION);
    const unsubscribe = onSnapshot(legalCollection, (snapshot) => {
      const nextClauses = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((item) => item.type === "privacy" || item.type === "terms")
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      setClauses(nextClauses);
      setError("");
      setPermissionDenied(false);
      setLoading(false);
    }, (snapshotError) => {
      const denied = snapshotError?.code === "permission-denied";
      if (!denied) console.warn("Failed to load legal clauses", snapshotError);
      setPermissionDenied(denied);
      setError(denied ? "لا تملك صلاحية قراءة البنود حالياً. يمكنك طلب تفعيل صلاحية legal_documents من مسؤول Firebase." : "تعذر تحميل البنود حالياً. حاول تحديث الصفحة.");
      setLoading(false);
    });

    return unsubscribe;
  }, [role]);

  if (role !== "super_admin") return null;

  const visibleClauses = clauses.filter((clause) => clause.type === selectedType);
  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateEditForm = (key, value) => setEditForm((current) => ({ ...current, [key]: value }));

  const addClause = async () => {
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title || !content) return;

    setSaving(true);
    setError("");
    try {
      await addDoc(collection(db, LEGAL_COLLECTION), {
        type: selectedType,
        title,
        content,
        order: visibleClauses.reduce((highest, clause) => Math.max(highest, Number(clause.order || 0)), -1) + 1,
        updatedAt: serverTimestamp(),
      });
      setForm({ title: "", content: "" });
    } catch (saveError) {
      const denied = saveError?.code === "permission-denied";
      if (!denied) console.warn("Failed to add legal clause", saveError);
      setPermissionDenied(denied);
      setError(denied ? "لا تملك صلاحية إضافة البنود في legal_documents." : "تعذر إضافة البند. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (clauseId) => {
    const title = editForm.title.trim();
    const content = editForm.content.trim();
    if (!title || !content) return;

    setSaving(true);
    setError("");
    try {
      await updateDoc(doc(db, LEGAL_COLLECTION, clauseId), { title, content, updatedAt: serverTimestamp() });
      setEditingId(null);
    } catch (saveError) {
      const denied = saveError?.code === "permission-denied";
      if (!denied) console.warn("Failed to update legal clause", saveError);
      setPermissionDenied(denied);
      setError(denied ? "لا تملك صلاحية تعديل البنود في legal_documents." : "تعذر تحديث البند. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  };

  const removeClause = async (clause) => {
    if (!window.confirm(`هل أنت متأكد من حذف بند «${clause.title}»؟`)) return;

    setSaving(true);
    setError("");
    try {
      await deleteDoc(doc(db, LEGAL_COLLECTION, clause.id));
      await Promise.all(
        visibleClauses
          .filter((item) => item.id !== clause.id)
          .map((item, index) => updateDoc(doc(db, LEGAL_COLLECTION, item.id), { order: index, updatedAt: serverTimestamp() })),
      );
    } catch (deleteError) {
      const denied = deleteError?.code === "permission-denied";
      if (!denied) console.warn("Failed to delete legal clause", deleteError);
      setPermissionDenied(denied);
      setError(denied ? "لا تملك صلاحية حذف البنود في legal_documents." : "تعذر حذف البند. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  };

  const moveClause = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= visibleClauses.length || saving) return;

    const current = visibleClauses[index];
    const target = visibleClauses[targetIndex];
    setSaving(true);
    setError("");
    try {
      await Promise.all([
        updateDoc(doc(db, LEGAL_COLLECTION, current.id), { order: targetIndex, updatedAt: serverTimestamp() }),
        updateDoc(doc(db, LEGAL_COLLECTION, target.id), { order: index, updatedAt: serverTimestamp() }),
      ]);
    } catch (moveError) {
      const denied = moveError?.code === "permission-denied";
      if (!denied) console.warn("Failed to reorder legal clauses", moveError);
      setPermissionDenied(denied);
      setError(denied ? "لا تملك صلاحية إعادة ترتيب البنود في legal_documents." : "تعذر إعادة ترتيب البنود. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = inputStyle(T);
  const canAdd = form.title.trim() && form.content.trim();

  return (
    <AdminSection title="الخصوصية وشروط الخدمة" icon="⚖️" T={T} onBack={onBack} onSave={() => {}}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setSelectedType(type.value)}
              style={{ flex: "1 1 180px", background: selectedType === type.value ? T.accent : T.inputBg, border: `1px solid ${selectedType === type.value ? T.accent : T.cardBorder}`, borderRadius: "12px", padding: "11px", color: "#fff", fontFamily: "'Cairo',sans-serif", fontWeight: "700", cursor: "pointer" }}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <h3 style={{ margin: 0, color: T.text, fontSize: "16px" }}>إضافة بند جديد</h3>
          <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)} style={fieldStyle}>
            {TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          <input value={form.title} onChange={(event) => updateForm("title", event.target.value)} placeholder="عنوان البند" style={fieldStyle} />
          <textarea value={form.content} onChange={(event) => updateForm("content", event.target.value)} placeholder="وصف ومحتوى البند" rows={4} style={{ ...fieldStyle, resize: "vertical" }} />
          <button type="button" onClick={addClause} disabled={!canAdd || saving} style={{ background: canAdd && !saving ? `linear-gradient(135deg,${T.accent},${T.accent2})` : "#555", color: "#fff", border: "none", borderRadius: "12px", padding: "12px", fontFamily: "'Cairo',sans-serif", fontWeight: "700", cursor: canAdd && !saving ? "pointer" : "not-allowed", opacity: canAdd ? 1 : 0.65 }}>
            {saving ? "⏳ جارٍ الحفظ..." : "➕ إضافة البند"}
          </button>
        </div>

        {error ? <div role="status" style={{ color: permissionDenied ? T.subtext : T.danger, background: permissionDenied ? `${T.cardBorder}44` : `${T.danger}15`, border: `1px solid ${permissionDenied ? T.cardBorder : `${T.danger}44`}`, borderRadius: "10px", padding: "10px 12px", fontSize: "13px" }}>{error}</div> : null}
        {loading ? <p style={{ color: T.subtext, margin: 0 }}>⏳ جارٍ تحميل البنود...</p> : null}
        {!loading && visibleClauses.length === 0 ? <p style={{ color: T.subtext, margin: 0 }}>لا توجد بنود مضافة لهذا القسم بعد.</p> : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {visibleClauses.map((clause, index) => (
            <div key={clause.id} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {editingId === clause.id ? (
                <>
                  <input value={editForm.title} onChange={(event) => updateEditForm("title", event.target.value)} style={fieldStyle} />
                  <textarea value={editForm.content} onChange={(event) => updateEditForm("content", event.target.value)} rows={4} style={{ ...fieldStyle, resize: "vertical" }} />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button type="button" onClick={() => saveEdit(clause.id)} disabled={!editForm.title.trim() || !editForm.content.trim() || saving} style={{ ...actionStyle(T), background: T.accent }}>حفظ</button>
                    <button type="button" onClick={() => setEditingId(null)} style={actionStyle(T)}>إلغاء</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
                    <h3 style={{ margin: 0, color: T.text, fontSize: "16px" }}>{clause.title}</h3>
                    <span style={{ color: T.accent, fontSize: "12px", fontWeight: "700" }}>#{index + 1}</span>
                  </div>
                  <p style={{ margin: 0, color: T.subtext, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{clause.content}</p>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button type="button" onClick={() => moveClause(index, -1)} disabled={index === 0 || saving} style={actionStyle(T, index === 0)}>↑ أعلى</button>
                    <button type="button" onClick={() => moveClause(index, 1)} disabled={index === visibleClauses.length - 1 || saving} style={actionStyle(T, index === visibleClauses.length - 1)}>↓ أسفل</button>
                    <button type="button" onClick={() => { setEditingId(clause.id); setEditForm({ title: clause.title, content: clause.content }); }} style={actionStyle(T)}>✏️ تعديل</button>
                    <button type="button" onClick={() => removeClause(clause)} disabled={saving} style={{ ...actionStyle(T), color: T.danger, borderColor: `${T.danger}66` }}>🗑️ حذف</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </AdminSection>
  );
}

function actionStyle(T, disabled = false) {
  return {
    background: "transparent",
    border: `1px solid ${disabled ? T.cardBorder : T.accent}`,
    borderRadius: "9px",
    color: disabled ? T.subtext : T.accent,
    padding: "7px 10px",
    fontFamily: "'Cairo',sans-serif",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}
