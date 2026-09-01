import { useState, useEffect } from "react";
import AdminSection from "./AdminSection.jsx";
import Modal from "../ui/Modal.jsx";

export default function AdminFolders({ config, saveConfig, T, onBack, canonicalizeGrade, canonicalizeBranch, normalizeFolderKey, getFolderKeyCandidates, getSubjectsByGradeBranch, fbGet, fbSet, extractDriveFolderId, cloudflareWorkerBaseUrl, dissolveFolderInTree }) {
  const grades = config.grades || [];
  const branches = config.branches || [];
  const [selectedGrade, setSelectedGrade] = useState(grades[0] || "");
  const [selectedBranch, setSelectedBranch] = useState(branches[0] || "");
  const [selectedSemester, setSelectedSemester] = useState("فصل أول");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [isAddingFile, setIsAddingFile] = useState(false);
  const [targetFolderId, setTargetFolderId] = useState(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFileTitle, setNewFileTitle] = useState("");
  const [newFileUrl, setNewFileUrl] = useState("");
  const [newFileType, setNewFileType] = useState("link");
  const [showDriveFolderModal, setShowDriveFolderModal] = useState(false);
  const [driveFolderName, setDriveFolderName] = useState("");
  const [driveFolderUrl, setDriveFolderUrl] = useState("");
  const [isImportingDriveFolder, setIsImportingDriveFolder] = useState(false);
  const [editItemId, setEditItemId] = useState(null);
  const [editItemForm, setEditItemForm] = useState({ title: "", url: "", type: "link" });
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const sectionsList = config.subjectSections || ["الرزم", "الكتب", "حلول الكتب", "مواد تعليمية", "ملخصات", "أسئلة واختبارات سابقة", "اختبارات إلكترونية", "عروض تقديمية", "الدراسة للامتحانات", "قنوات يوتيوب شارحة"];
  const [selectedSection, setSelectedSection] = useState(sectionsList[0] || "");

  const getSubjectKey = () => {
    if (!selectedGrade || !selectedBranch) return "";
    const canonicalSelectedGrade = canonicalizeGrade(selectedGrade);
    const canonicalSelectedBranch = canonicalizeBranch(selectedBranch);
    const isGrade11 = canonicalSelectedGrade.includes("حادي عشر");
    const semesterKey = isGrade11 ? selectedSemester : "فصل واحد";
    return `${canonicalSelectedGrade}_${canonicalSelectedBranch}_${semesterKey}`;
  };
  const subjectKey = getSubjectKey();
  const [subjectGrade, subjectBranch, subjectSemester] = subjectKey.split("_");
  const storageKey = (selectedSubject && selectedSection) ? normalizeFolderKey({ grade: subjectGrade || selectedGrade, branch: subjectBranch || selectedBranch, semester: subjectSemester || selectedSemester, subject: selectedSubject, section: selectedSection }) : "";

  const getAvailableSubjects = () => {
    const allSubs = new Set();
    const brs = config.branches || branches;
    brs.forEach(br => getSubjectsByGradeBranch(config.subjects, selectedGrade, br, true).forEach(sub => allSubs.add(sub)));
    return Array.from(allSubs);
  };
  const availableSubjects = getAvailableSubjects();

  useEffect(() => {
    const isG11 = canonicalizeGrade(selectedGrade).includes("حادي عشر");
    if (isG11 && !["فصل أول", "فصل ثان"].includes(selectedSemester)) setSelectedSemester("فصل أول");
  }, [selectedGrade]);
  useEffect(() => {
    if (availableSubjects.length > 0) {
      if (!availableSubjects.includes(selectedSubject)) { setSelectedSubject(availableSubjects[0]); setSelectedSection(sectionsList[0] || ""); }
    } else setSelectedSubject("");
  }, [subjectKey, JSON.stringify(availableSubjects)]);

  const [folderData, setFolderData] = useState([]);
  const createItemId = (prefix = "item") => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const normalizeItemTree = (items) => {
    if (!Array.isArray(items)) return [];
    return items.map(item => {
      if (!item || typeof item !== "object") return item;
      if (item.type === "folder") return { ...item, id: item.id || createItemId("folder"), children: normalizeItemTree(item.children || []) };
      return { ...item, id: item.id || createItemId("file") };
    });
  };
  const countNestedItems = (item) => {
    if (!item || item.type !== "folder") return 0;
    return (item.children || []).reduce((sum, child) => { if (!child) return sum; if (child.type === "folder") return sum + 1 + countNestedItems(child); return sum + 1; }, 0);
  };
  const insertItemIntoTree = (items, parentId, newItem) => items.map(item => {
    if (!item || typeof item !== "object") return item;
    if (item.type === "folder" && item.id === parentId) return { ...item, children: [...(item.children || []), newItem] };
    if (item.type === "folder") return { ...item, children: insertItemIntoTree(item.children || [], parentId, newItem) };
    return item;
  });
  const removeItemFromTree = (items, itemId) => items.filter(item => item?.id !== itemId).map(item => {
    if (!item || typeof item !== "object") return item;
    if (item.type === "folder") return { ...item, children: removeItemFromTree(item.children || [], itemId) };
    return item;
  });
  const updateItemInTree = (items, itemId, updater) => items.map(item => {
    if (!item || typeof item !== "object") return item;
    if (item.id === itemId) return updater(item);
    if (item.type === "folder") return { ...item, children: updateItemInTree(item.children || [], itemId, updater) };
    return item;
  });
  const toggleSelectedFile = (fileId) => setSelectedFileIds(prev => prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]);
  const collectSelectedFiles = (items, selectedIds, acc = []) => {
    for (const item of items || []) { if (!item || typeof item !== "object") continue; if (item.type === "folder") { collectSelectedFiles(item.children || [], selectedIds, acc); continue; } if (selectedIds.includes(item.id)) acc.push(item); }
    return acc;
  };
  const removeSelectedFiles = (items, selectedIds) => (items || []).flatMap(item => {
    if (!item || typeof item !== "object") return [item];
    if (item.type === "folder") return [{ ...item, children: removeSelectedFiles(item.children || [], selectedIds) }];
    return selectedIds.includes(item.id) ? [] : [item];
  });
  const appendFilesToFolder = (items, folderId, filesToMove) => {
    if (!filesToMove.length) return items;
    return (items || []).map(item => {
      if (!item || typeof item !== "object") return item;
      if (item.type === "folder" && item.id === folderId) return { ...item, children: [...(item.children || []), ...filesToMove] };
      if (item.type === "folder") return { ...item, children: appendFilesToFolder(item.children || [], folderId, filesToMove) };
      return item;
    });
  };
  const moveSelectedFilesToFolder = async (folderId) => {
    if (!selectedFileIds.length || !folderId) return;
    const selectedFiles = collectSelectedFiles(folderData, selectedFileIds, []);
    const trimmedTree = removeSelectedFiles(folderData, selectedFileIds);
    const nextTree = appendFilesToFolder(trimmedTree, folderId, selectedFiles);
    setFolderData(nextTree); setSelectedFileIds([]); await saveFolderData(nextTree);
  };

  useEffect(() => {
    let cancelled = false;
    const loadFolderData = async () => {
      if (!storageKey) { setFolderData([]); return; }
      try {
        const candidateKeys = getFolderKeyCandidates({ grade: subjectGrade || selectedGrade, branch: subjectBranch || selectedBranch, semester: subjectSemester || selectedSemester, subject: selectedSubject, section: selectedSection, storageKey });
        for (const candidateKey of candidateKeys) { const fbDoc = await fbGet("folder_items", candidateKey); if (fbDoc && Array.isArray(fbDoc.items)) { const normalized = normalizeItemTree(fbDoc.items); if (!cancelled) setFolderData(normalized); return; } }
      } catch (err) { console.warn("Failed to load global folder_items for AdminFolders:", err); }
      const candidateKeys = getFolderKeyCandidates({ grade: subjectGrade || selectedGrade, branch: subjectBranch || selectedBranch, semester: subjectSemester || selectedSemester, subject: selectedSubject, section: selectedSection, storageKey });
      for (const candidateKey of candidateKeys) { const raw = config[candidateKey]; if (raw) { try { const parsed = typeof raw === "string" ? JSON.parse(raw) : raw; if (!cancelled) setFolderData(normalizeItemTree(parsed)); return; } catch { } } }
      if (!cancelled) setFolderData([]);
    };
    loadFolderData(); return () => { cancelled = true; };
  }, [storageKey]);

  const saveFolderData = async (newData) => {
    if (!storageKey) return;
    const normalized = normalizeItemTree(newData);
    const candidateKeys = getFolderKeyCandidates({ grade: subjectGrade || selectedGrade, branch: subjectBranch || selectedBranch, semester: subjectSemester || selectedSemester, subject: selectedSubject, section: selectedSection, storageKey });
    const newConfig = { ...config }; candidateKeys.forEach(key => { newConfig[key] = JSON.stringify(normalized); });
    setFolderData(normalized); await saveConfig(newConfig);
    try { await Promise.all(candidateKeys.map(key => fbSet("folder_items", key, { items: normalized }))); } catch (err) { console.warn("Failed to persist folder_items globally for AdminFolders:", err); }
  };
  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", fontSize: "13px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box", marginBottom: "8px" };
  const selectStyle = { ...inp };
  const addFolder = async () => {
    if (!newFolderName.trim()) { alert("يرجى إدخال اسم المجلد!"); return; }
    setIsAddingFolder(true); const newFolder = { id: createItemId("folder"), type: "folder", name: newFolderName.trim(), children: [] };
    const newData = targetFolderId ? insertItemIntoTree(folderData, targetFolderId, newFolder) : [...folderData, newFolder];
    try { setFolderData(newData); await saveFolderData(newData); setNewFolderName(""); setShowAddFolderModal(false); } catch (error) { console.error("Failed to add folder:", error); throw error; } finally { setIsAddingFolder(false); }
  };
  const resetFileModal = () => { setShowAddFileModal(false); setTargetFolderId(null); setNewFileTitle(""); setNewFileUrl(""); setNewFileType("link"); };
  const addFile = async () => {
    if (!newFileTitle.trim() || !newFileUrl.trim()) return;
    setIsAddingFile(true); const newItem = { id: createItemId("file"), title: newFileTitle.trim(), url: newFileUrl.trim(), type: newFileType, description: "", parentId: targetFolderId || null };
    const newData = targetFolderId ? insertItemIntoTree(folderData, targetFolderId, newItem) : [...folderData, newItem];
    try { setFolderData(newData); await saveFolderData(newData); resetFileModal(); } catch (error) { console.error("Failed to add file:", error); throw error; } finally { setIsAddingFile(false); }
  };
  const resetDriveFolderModal = () => { setShowDriveFolderModal(false); setDriveFolderName(""); setDriveFolderUrl(""); };
  const importDriveFolder = async () => {
    const folderId = extractDriveFolderId(driveFolderUrl); if (!folderId) { alert("رابط أو ID المجلد غير صحيح"); return; }
    setIsImportingDriveFolder(true);
    try {
      const workerBaseUrl = (import.meta.env.VITE_CLOUDFLARE_WORKER_BASE_URL || cloudflareWorkerBaseUrl).trim().replace(/\/+$/, "");
      const response = await fetch(`${workerBaseUrl}/list-folder?folderId=${encodeURIComponent(folderId)}`); let payload = null;
      try { payload = await response.json(); } catch { throw new Error("لم يتمكن الخادم من إرجاع بيانات صحيحة"); }
      if (!response.ok || !payload?.success || !Array.isArray(payload.files)) throw new Error(payload?.error || "تعذر قراءة المجلد");
      const mappedFiles = payload.files.filter(file => file?.id && file?.name).map(file => ({ id: createItemId("file"), type: file.mimeType?.includes("pdf") ? "pdf" : file.mimeType?.includes("image") ? "image" : "link", name: file.name, title: file.name, url: `https://drive.google.com/file/d/${file.id}/view`, description: "", teacher: "", addedAt: Date.now() }));
      if (mappedFiles.length === 0) throw new Error("المجلد لا يحتوي على ملفات قابلة للاستيراد");
      const newFolder = { id: createItemId("folder"), type: "folder", name: driveFolderName.trim(), children: mappedFiles };
      await saveFolderData([...folderData, newFolder]); resetDriveFolderModal(); alert("تم استيراد المجلد بنجاح!");
    } catch (error) { console.error("Failed to import Google Drive folder:", error); alert("تعذر استيراد المجلد. تأكد من أن المجلد مضبوط على Anyone with the link can view وأن الرابط صحيح."); } finally { setIsImportingDriveFolder(false); }
  };
  const deleteItem = async (itemId) => { const newData = removeItemFromTree(folderData, itemId); setFolderData(newData); await saveFolderData(newData); };
  const handleDissolveFolder = async (folderId) => { if (!folderId) return; if (!window.confirm("هل أنت متأكد من حذف المجلد وإبقاء ملفاته داخل المجلد الأب؟")) return; const result = dissolveFolderInTree(folderData, folderId); if (!result.found) return; await saveFolderData(result.items); setExpandedFolders(current => { const next = new Set(current); next.delete(folderId); return next; }); };
  const openEditItem = item => { setEditItemId(item.id); setEditItemForm({ title: item.title || item.name || "", url: item.url || "", type: item.type || "link" }); };
  const saveEditedItem = async () => { const title = editItemForm.title.trim(); if (!title) { alert("يرجى إدخال اسم العنصر!"); return; } const newData = updateItemInTree(folderData, editItemId, item => item.type === "folder" ? { ...item, name: title } : { ...item, title, url: editItemForm.url.trim(), type: editItemForm.type }); await saveFolderData(newData); setEditItemId(null); };
  const reorderAdminTree = (list, itemId, direction) => { const currentIndex = list.findIndex(item => item?.id === itemId); const targetIndex = direction === "UP" ? currentIndex - 1 : currentIndex + 1; if (currentIndex >= 0 && targetIndex >= 0 && targetIndex < list.length) { const reordered = [...list]; const [moved] = reordered.splice(currentIndex, 1); reordered.splice(targetIndex, 0, moved); return reordered.map((item, index) => item && typeof item === "object" ? { ...item, order: index } : item); } for (let index = 0; index < list.length; index += 1) { const item = list[index]; if (item?.type !== "folder") continue; const children = item.children || []; const nextChildren = reorderAdminTree(children, itemId, direction); if (nextChildren !== children) return list.map((entry, entryIndex) => entryIndex === index ? { ...entry, children: nextChildren } : entry); } return list; };
  const moveAdminItem = async (itemId, direction) => { const nextData = reorderAdminTree(folderData, itemId, direction); if (nextData === folderData) return; await saveFolderData(nextData); };

  const renderItems = (items, depth = 0, parentId = null) => <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{items.map((item, index) => {
    if (!item || typeof item !== "object") return null;
    if (item.type === "folder") { const nestedCount = countNestedItems(item); const isExpanded = expandedFolders.has(item.id); const showMoveSelectedButton = selectedFileIds.length > 0; return <div key={item.id} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "12px", padding: "12px", marginRight: `${depth * 12}px` }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}><button onClick={() => setExpandedFolders(current => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} style={{ flex: 1, textAlign: "right", background: "transparent", border: "none", color: T.text, cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>📁 {item.name || item.title} ({nestedCount} عنصر) {isExpanded ? "▾" : "▸"}</button><div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}><button type="button" disabled={index === 0} onClick={() => moveAdminItem(item.id, "UP")} title="تحريك للأعلى" style={{ opacity: index === 0 ? 0.3 : 1, border: "none", background: "transparent", fontSize: "16px", cursor: index === 0 ? "not-allowed" : "pointer" }}>⬆️</button><button type="button" disabled={index === items.length - 1} onClick={() => moveAdminItem(item.id, "DOWN")} title="تحريك لأسفل" style={{ opacity: index === items.length - 1 ? 0.3 : 1, border: "none", background: "transparent", fontSize: "16px", cursor: index === items.length - 1 ? "not-allowed" : "pointer" }}>⬇️</button>{showMoveSelectedButton && <button type="button" onClick={() => moveSelectedFilesToFolder(item.id)} style={{ background: "rgba(59, 130, 246, 0.18)", border: "1px solid #3b82f6", color: "#3b82f6", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontWeight: 700, fontSize: "12px", whiteSpace: "nowrap" }}>⬆️ نقل الملفات المحددة هنا</button>}<button onClick={() => { setTargetFolderId(item.id); setShowAddFileModal(true); }} style={{ background: `${T.accent}22`, border: `1px solid ${T.accent}`, color: T.accent, borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "13px" }}>+ ملف جديد</button><button onClick={() => { setTargetFolderId(item.id); setShowAddFolderModal(true); }} style={{ background: `${T.accent}22`, border: `1px solid ${T.accent}`, color: T.accent, borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "13px" }}>+ مجلد جديد</button><button onClick={() => handleDissolveFolder(item.id)} title="حذف المجلد وإبقاء ملفاته بداخله" style={{ background: "rgba(255, 80, 80, 0.15)", border: "1px solid rgba(255, 80, 80, 0.4)", color: "#ff6b6b", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "13px", whiteSpace: "nowrap" }}>🗑️ حذف وإبقاء الملفات</button><button onClick={() => deleteItem(item.id)} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "13px" }}>🗑️ حذف</button></div></div>{isExpanded && item.children?.length > 0 && <div style={{ marginTop: "8px" }}>{renderItems(item.children, depth + 1, item.id)}</div>}{isExpanded && item.children?.length === 0 && <p style={{ color: T.subtext, fontSize: "12px", margin: "8px 0 0" }}>المجلد فارغ</p>}</div>; }
    const isSelected = selectedFileIds.includes(item.id); return <div key={item.id} style={{ background: isSelected ? "repeating-linear-gradient(45deg, rgba(37, 99, 235, 0.15), rgba(37, 99, 235, 0.15) 10px, rgba(59, 130, 246, 0.25) 10px, rgba(59, 130, 246, 0.25) 20px)" : T.card, border: isSelected ? "2px dashed #3b82f6" : `1px solid ${T.cardBorder}`, borderRadius: "12px", padding: "12px", marginRight: `${depth * 12}px`, marginLeft: "0px", display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box", maxWidth: "100%", minWidth: 0, gap: "8px", transition: "all 0.2s ease-in-out" }}><div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}><input type="checkbox" checked={isSelected} onChange={e => { e.stopPropagation(); toggleSelectedFile(item.id); }} aria-label={`تحديد ${item.title || item.name}`} style={{ accentColor: T.accent, width: "18px", height: "18px", flexShrink: 0 }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📄 {item.title || item.name}</span></div><div style={{ display: "flex", gap: "8px" }}><button type="button" disabled={index === 0} onClick={() => moveAdminItem(item.id, "UP")} title="تحريك للأعلى" style={{ opacity: index === 0 ? 0.3 : 1, border: "none", background: "transparent", fontSize: "16px", cursor: index === 0 ? "not-allowed" : "pointer" }}>⬆️</button><button type="button" disabled={index === items.length - 1} onClick={() => moveAdminItem(item.id, "DOWN")} title="تحريك لأسفل" style={{ opacity: index === items.length - 1 ? 0.3 : 1, border: "none", background: "transparent", fontSize: "16px", cursor: index === items.length - 1 ? "not-allowed" : "pointer" }}>⬇️</button><button onClick={() => openEditItem(item)} style={{ background: `${T.accent}22`, border: "none", borderRadius: "8px", padding: "6px 10px", cursor: "pointer" }}>✏️</button><button onClick={() => deleteItem(item.id)} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "13px" }}>🗑️ حذف</button></div></div>;
  })}</div>;

  return <AdminSection title="إدارة المجلدات" icon="📁" T={T} onBack={onBack} onSave={() => {}}><p style={{ color: T.subtext, fontSize: "13px", margin: "0 0 14px" }}>اختر الصف والفرع والفصل والمادة والقسم لإدارة مجلداتها. (تم إصلاح مشكلة الصف الحادي عشر + إضافة اختيار القسم + زر حذف)</p><select value={selectedGrade} onChange={e => { setSelectedGrade(e.target.value); setSelectedSubject(""); setSelectedSection(sectionsList[0] || ""); }} style={selectStyle}>{grades.map(g => <option key={g} value={g}>{g}</option>)}</select><select value={selectedBranch} onChange={e => { setSelectedBranch(e.target.value); setSelectedSubject(""); setSelectedSection(sectionsList[0] || ""); }} style={selectStyle}>{branches.map(b => <option key={b} value={b}>{b}</option>)}</select>{selectedGrade.includes("حادي عشر") && <select value={selectedSemester} onChange={e => { setSelectedSemester(e.target.value); setSelectedSubject(""); setSelectedSection(sectionsList[0] || ""); }} style={selectStyle}><option value="فصل أول">فصل أول</option><option value="فصل ثان">فصل ثان</option></select>}<select value={selectedSubject} onChange={e => { setSelectedSubject(e.target.value); setSelectedSection(sectionsList[0] || ""); }} style={selectStyle}>{availableSubjects.length > 0 ? availableSubjects.map(s => <option key={s} value={s}>{s}</option>) : <option value="">لا توجد مواد لهذا الاختيار</option>}</select><select value={selectedSection} onChange={e => setSelectedSection(e.target.value)} style={selectStyle} disabled={!selectedSubject}>{sectionsList.map(sec => <option key={sec} value={sec}>{sec}</option>)}</select>{!selectedSubject || !selectedSection ? <div style={{ marginTop: "16px", padding: "16px", background: "rgba(255,193,7,0.15)", border: "1px solid #ffc107", borderRadius: "12px", color: T.text, fontSize: "14px", textAlign: "center" }}>⚠️ الرجاء اختيار المادة والقسم أولاً لتتمكن من إضافة مجلدات وملفات.</div> : <><div style={{ marginTop: "16px", display: "flex", gap: "10px" }}><button onClick={() => { setTargetFolderId(null); setShowAddFolderModal(true); }} style={{ flex: 1, background: T.accent, color: "#fff", border: "none", borderRadius: "12px", padding: "12px", fontWeight: "700", cursor: "pointer" }}>➕ مجلد جديد</button><button onClick={() => setShowDriveFolderModal(true)} style={{ flex: 1, background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "12px", padding: "12px", fontWeight: "700", cursor: "pointer" }}>📁 مجلد من Drive</button><button onClick={() => setShowAddFileModal(true)} style={{ flex: 1, background: T.accent2, color: "#fff", border: "none", borderRadius: "12px", padding: "12px", fontWeight: "700", cursor: "pointer" }}>📄 ملف جديد</button></div><div style={{ marginTop: "20px", background: T.sectionBg, borderRadius: "16px", padding: "16px", minHeight: "200px" }}>{folderData.length === 0 ? <p style={{ color: T.subtext, textAlign: "center", padding: "40px 0" }}>لا توجد مجلدات بعد. أضف مجلدًا أو ملفًا.</p> : <div><p style={{ color: T.subtext, fontSize: "12px", margin: "0 0 8px", textAlign: "center" }}>اسحب ↕ لتغيير الترتيب • ✏️ للتعديل • 🗑️ للحذف • ➕ لإضافة ملف أو مجلد داخل المجلد</p>{renderItems(folderData)}</div>}</div><Modal open={showAddFolderModal} title="إنشاء مجلد جديد" onClose={() => { setShowAddFolderModal(false); setNewFolderName(""); }} footer={<><button onClick={() => { setShowAddFolderModal(false); setNewFolderName(""); }} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: "10px", padding: "10px 16px", cursor: "pointer" }}>إلغاء</button><button onClick={addFolder} disabled={isAddingFolder} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 16px", cursor: isAddingFolder ? "not-allowed" : "pointer" }}>إنشاء</button></> }><input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="اسم المجلد" style={inp} /></Modal><Modal open={Boolean(editItemId)} title="تعديل العنصر" onClose={() => setEditItemId(null)} footer={<><button onClick={() => setEditItemId(null)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: "10px", padding: "10px 16px", cursor: "pointer" }}>إلغاء</button><button onClick={saveEditedItem} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 16px", cursor: "pointer" }}>حفظ</button></> }><input value={editItemForm.title} onChange={e => setEditItemForm(form => ({ ...form, title: e.target.value }))} placeholder="العنوان أو اسم المجلد" style={inp} /><input value={editItemForm.url} onChange={e => setEditItemForm(form => ({ ...form, url: e.target.value }))} placeholder="الرابط" style={inp} /><select value={editItemForm.type} onChange={e => setEditItemForm(form => ({ ...form, type: e.target.value }))} style={inp}><option value="pdf">pdf</option><option value="image">image</option><option value="link">link</option></select></Modal><Modal open={showAddFileModal} title="إضافة ملف جديد" onClose={resetFileModal} footer={<><button onClick={resetFileModal} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: "10px", padding: "10px 16px", cursor: "pointer" }}>إلغاء</button><button onClick={addFile} disabled={isAddingFile} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 16px", cursor: isAddingFile ? "not-allowed" : "pointer" }}>حفظ</button></> }><input value={newFileTitle} onChange={e => setNewFileTitle(e.target.value)} placeholder="اسم الملف" style={inp} /><input value={newFileUrl} onChange={e => setNewFileUrl(e.target.value)} placeholder="رابط Google Drive" style={inp} /><select value={newFileType} onChange={e => setNewFileType(e.target.value)} style={inp}><option value="pdf">pdf</option><option value="image">image</option><option value="link">link</option></select></Modal><Modal open={showDriveFolderModal} title="استيراد مجلد من Google Drive" onClose={resetDriveFolderModal} footer={<><button onClick={resetDriveFolderModal} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: "10px", padding: "10px 16px", cursor: "pointer" }}>إلغاء</button><button onClick={importDriveFolder} disabled={isImportingDriveFolder || !driveFolderName.trim() || !driveFolderUrl.trim()} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 16px", cursor: isImportingDriveFolder ? "not-allowed" : "pointer", opacity: isImportingDriveFolder || !driveFolderName.trim() || !driveFolderUrl.trim() ? 0.6 : 1 }}>{isImportingDriveFolder ? "جاري الاستيراد..." : "استيراد وحفظ"}</button></> }><input value={driveFolderName} onChange={e => setDriveFolderName(e.target.value)} placeholder="اسم المجلد" style={inp} /><input value={driveFolderUrl} onChange={e => setDriveFolderUrl(e.target.value)} placeholder="رابط أو ID مجلد Google Drive" style={inp} /></Modal></>}</AdminSection>;
}