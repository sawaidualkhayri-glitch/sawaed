import { useState, useEffect } from "react";
import AdminSection from "./AdminSection.jsx";
import ResourceList from "./ResourceList.jsx";
import AddFolderModal from "../modals/AddFolderModal.jsx";
import AddFileModal from "../modals/AddFileModal.jsx";
import DriveImportModal from "../modals/DriveImportModal.jsx";

export default function AdminFoundation({ config, saveConfig, T, onBack, normalizeFoundKey, validateRequiredFields, normalizeDriveFolderInput, extractDriveFolderId, cloudflareWorkerBaseUrl, addFolderToTree, dissolveFolderInTree }) {
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [selSub, setSelSub] = useState(config.foundationSubjects?.[0] || "");
  const [selBranch, setSelBranch] = useState((config.foundationBranches?.[config.foundationSubjects?.[0]] || [])[0] || "");
  const [selType, setSelType] = useState("electronic");
  const [selArea, setSelArea] = useState((config.foundationTypes?.electronic || [])[0] || "");
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth < 640 : false);
  const [form, setForm] = useState({ title: "", url: "", description: "", teacher: "", type: "link" });
  const [showDriveFolderModal, setShowDriveFolderModal] = useState(false);
  const [driveFolderName, setDriveFolderName] = useState("");
  const [driveFolderUrl, setDriveFolderUrl] = useState("");
  const [isImportingDriveFolder, setIsImportingDriveFolder] = useState(false);
  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [targetFolderId, setTargetFolderId] = useState(null);

  const foundKey = normalizeFoundKey({ subject: selSub, branch: selBranch, type: selType, sub: selArea });
  const [items, setItems] = useState([]);
  const requiredFormCheck = validateRequiredFields(form, ["title", "url"]);
  const validDriveFolder = Boolean(driveFolderName.trim()) && Boolean(normalizeDriveFolderInput(driveFolderUrl));

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => { const raw = config[foundKey]; setItems(raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : []); }, [foundKey]);

  const save = async (newItems) => {
    await saveConfig({ ...config, [foundKey]: JSON.stringify(newItems) });
    setItems(newItems);
  };

  const resetFileModal = () => {
    setShowAddFileModal(false);
    setTargetFolderId(null);
    setForm({ title: "", url: "", description: "", teacher: "", type: "link" });
  };

  const resetDriveFolderModal = () => {
    setShowDriveFolderModal(false);
    setDriveFolderName("");
    setDriveFolderUrl("");
  };

  const appendFileToFolderById = (list, folderId, newFile) => {
    if (!Array.isArray(list)) return list;
    return list.map((item) => {
      if (!item || typeof item !== "object") return item;
      if (item.id === folderId) {
        const currentFolderItems = Array.isArray(item.items) ? item.items : Array.isArray(item.children) ? item.children : [];
        const nextFolderItems = [...currentFolderItems, newFile];
        return { ...item, items: nextFolderItems, children: nextFolderItems };
      }
      if (item.type === "folder" || item.isFolder) {
        const childItems = Array.isArray(item.items) ? item.items : Array.isArray(item.children) ? item.children : [];
        const updatedChildren = appendFileToFolderById(childItems, folderId, newFile);
        if (updatedChildren !== childItems) {
          return { ...item, items: updatedChildren, children: updatedChildren };
        }
      }
      return item;
    });
  };

  const addFoundationFile = async () => {
    const validation = validateRequiredFields(form, ["title", "url"]);
    if (!validation.isValid) {
      alert("يرجى كتابة العنوان ورابط الملف أولاً!");
      return;
    }

    const newItem = {
      ...form,
      id: `foundation_item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: (form.title || "").trim(),
      url: (form.url || "").trim(),
      description: (form.description || "").trim(),
      teacher: (form.teacher || "").trim(),
      type: form.type || "link",
      addedAt: Date.now()
    };

    let nextItems = [...items];
    if (targetFolderId) {
      nextItems = appendFileToFolderById(nextItems, targetFolderId, newItem);
    } else {
      nextItems.push(newItem);
    }

    await save(nextItems);
    resetFileModal();
    alert(targetFolderId ? "تمت إضافة الملف إلى المجلد بنجاح!" : "تمت إضافة العنصر بنجاح!");
  };

  const importDriveFolder = async () => {
    const folderId = extractDriveFolderId(driveFolderUrl);
    if (!folderId) {
      alert("رابط أو ID المجلد غير صحيح");
      return;
    }

    setIsImportingDriveFolder(true);
    try {
      const workerBaseUrl = (import.meta.env.VITE_CLOUDFLARE_WORKER_BASE_URL || cloudflareWorkerBaseUrl || "https://sawaed.hamodemsg.workers.dev")
        .trim()
        .replace(/\/+$/, "");

      const response = await fetch(`${workerBaseUrl}/list-folder?folderId=${encodeURIComponent(folderId)}`);
      let payload = null;

      try {
        payload = await response.json();
      } catch {
        throw new Error("لم يتمكن الخادم من إرجاع بيانات صحيحة");
      }

      if (!response.ok || !payload?.success || !Array.isArray(payload.files)) {
        throw new Error(payload?.error || "تعذر قراءة المجلد");
      }

      const mappedFiles = payload.files
        .filter(file => file && file.id && file.name)
        .map(file => ({
          id: `foundation_item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          title: file.name,
          name: file.name,
          url: `https://drive.google.com/file/d/${file.id}/view`,
          type: file.mimeType?.includes("pdf") ? "pdf" : "link",
          description: "",
          teacher: "",
          addedAt: Date.now()
        }));

      if (mappedFiles.length === 0) {
        throw new Error("المجلد لا يحتوي على ملفات قابلة للاستيراد");
      }

      const importedFolder = {
        id: `foundation_folder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: driveFolderName.trim() || "مجلد جديد",
        name: driveFolderName.trim() || "مجلد جديد",
        isFolder: true,
        items: mappedFiles,
        children: mappedFiles,
        addedAt: Date.now()
      };

      await save([...items, importedFolder]);
      resetDriveFolderModal();
      alert("تم استيراد مجلد التأسيس بنجاح!");
    } catch (error) {
      console.error("Failed to import foundation Google Drive folder:", error);
      alert("تعذر استيراد المجلد. تأكد من أن المجلد عام أو أنه يسمح بالوصول عبر الرابط، ثم حاول مرة أخرى.");
    } finally {
      setIsImportingDriveFolder(false);
    }
  };

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", fontSize: "13px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box", marginBottom: "8px" };
  const sel = { ...inp };

  const addFoundationFolder = async () => {
    const name = (newFolderName || "").trim();
    if (!name) {
      alert("يرجى إدخال اسم المجلد!");
      return;
    }

    setIsAddingFolder(true);
    try {
      const newFolderObj = {
        id: `foundation_folder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: name,
        name,
        isFolder: true,
        items: [],
        children: [],
        addedAt: Date.now()
      };

      let updatedItems = [...items];
      if (targetFolderId) {
        updatedItems = addFolderToTree(updatedItems, targetFolderId, newFolderObj);
      } else {
        updatedItems = [...items, newFolderObj];
      }

      await save(updatedItems);
      setItems(updatedItems);
      setNewFolderName("");
      setShowAddFolderModal(false);
      setTargetFolderId(null);
      alert("تم إنشاء المجلد بنجاح!");
    } catch (err) {
      console.error("Error adding foundation folder:", err);
      alert("حدث خطأ أثناء إنشاء المجلد");
    } finally {
      setIsAddingFolder(false);
    }
  };

  return (
    <AdminSection title="محتوى التأسيس" icon="🏗️" T={T} onBack={onBack} onSave={() => {}}>
      <select value={selSub} onChange={e => setSelSub(e.target.value)} style={sel}>{config.foundationSubjects?.map(s => <option key={s} value={s}>{s}</option>)}</select>
      <select value={selBranch} onChange={e => setSelBranch(e.target.value)} style={sel}>
        {(config.foundationBranches?.[selSub] || []).map(b => <option key={b} value={b}>{b}</option>)}
      </select>
      <select value={selType} onChange={e => { setSelType(e.target.value); setSelArea((config.foundationTypes?.[e.target.value] || [])[0] || ""); }} style={sel}>
        <option value="electronic">إلكتروني</option>
        <option value="inPerson">وجاهي</option>
      </select>
      <select value={selArea} onChange={e => setSelArea(e.target.value)} style={sel}>
        {(config.foundationTypes?.[selType] || []).map(a => <option key={a} value={a}>{a}</option>)}
      </select>
      <div style={{ background: T.sectionBg, borderRadius: "14px", padding: "12px", marginBottom: "12px", border: `1px solid ${T.cardBorder}` }}>
        <input value={form.teacher} onChange={e => setForm(f => ({ ...f, teacher: e.target.value }))} placeholder="اسم المدرس (اختياري)" style={inp} />
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="العنوان *" style={inp} />
        <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="رابط الملف" style={inp} />
        <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="وصف (اختياري)" style={inp} />
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => setShowAddFolderModal(true)}
            style={{
              flex: 1,
              background: T.accent,
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              padding: "10px 18px",
              cursor: "pointer",
              fontFamily: "'Cairo',sans-serif",
              fontWeight: "700"
            }}
          >
            ➕ مجلد جديد
          </button>
          <button
            onClick={async () => {
              const validation = validateRequiredFields(form, ["title", "url"]);
              if (!validation.isValid) {
                alert("يرجى كتابة العنوان ورابط الملف أولاً!");
                return;
              }

              const title = (form.title || "").trim();
              const url = (form.url || "").trim();

              const newItem = {
                ...form,
                id: `foundation_item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                title,
                url,
                description: (form.description || "").trim(),
                teacher: (form.teacher || "").trim(),
                type: form.type || "link",
                addedAt: Date.now()
              };

              await save([...items, newItem]);
              setForm({ title: "", url: "", description: "", teacher: "", type: "link" });
              alert("تمت إضافة العنصر بنجاح!");
            }}
            disabled={!requiredFormCheck.isValid}
            style={{
              flex: 1,
              background: `linear-gradient(135deg,${T.accent},${T.accent2})`,
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              padding: "10px 18px",
              cursor: requiredFormCheck.isValid ? "pointer" : "not-allowed",
              opacity: requiredFormCheck.isValid ? 1 : 0.6,
              fontFamily: "'Cairo',sans-serif",
              fontWeight: "700"
            }}
          >
            + إضافة
          </button>
          <button onClick={() => setShowDriveFolderModal(true)} style={{ flex: 1, background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", cursor: "pointer", fontFamily: "'Cairo',sans-serif", fontWeight: "700" }}>📁 مجلد من Drive</button>
        </div>
      </div>
      {items.length > 0 && (
        <div>
          <p style={{ color: T.subtext, fontSize: "12px", margin: "0 0 8px", textAlign: "center" }}>⬆️⬇️ لتغيير الترتيب • ✏️ للتعديل • 🗑️ للحذف</p>
          <ResourceList
            resources={items}
            setResources={setItems}
            T={T}
            onSave={save}
            enableBulkMove={true}
            dissolveFolderInTree={dissolveFolderInTree}
            onAddFileToFolder={(folderId) => {
              setTargetFolderId(folderId);
              setShowAddFileModal(true);
            }}
            onAddSubfolderToFolder={(folderId) => {
              setTargetFolderId(folderId);
              setShowAddFolderModal(true);
            }}
          />
        </div>
      )}

      <AddFolderModal
        isOpen={showAddFolderModal}
        title={targetFolderId ? "إنشاء مجلد فرعي" : "إنشاء مجلد جديد"}
        onClose={() => { setShowAddFolderModal(false); setTargetFolderId(null); setNewFolderName(""); }}
        value={newFolderName}
        onChange={setNewFolderName}
        onSubmit={addFoundationFolder}
        isSubmitting={isAddingFolder}
        submitLabel="إنشاء"
        inputStyle={inp}
      />

      <AddFileModal
        isOpen={showAddFileModal}
        title={targetFolderId ? "إضافة ملف إلى المجلد" : "إضافة ملف جديد"}
        onClose={resetFileModal}
        onSubmit={addFoundationFile}
        onChange={(field, value) => setForm(f => ({ ...f, [field]: value }))}
        form={form}
        isValid={requiredFormCheck.isValid}
        disableBackdropClose={true}
        inputStyle={inp}
      />

      <DriveImportModal
        isOpen={showDriveFolderModal}
        title="استيراد مجلد من Google Drive"
        onClose={resetDriveFolderModal}
        folderName={driveFolderName}
        onFolderNameChange={setDriveFolderName}
        folderUrl={driveFolderUrl}
        onFolderUrlChange={setDriveFolderUrl}
        onSubmit={importDriveFolder}
        isSubmitting={isImportingDriveFolder}
        disableBackdropClose={true}
        valid={validDriveFolder}
        inputStyle={inp}
      />
    </AdminSection>
  );
}
