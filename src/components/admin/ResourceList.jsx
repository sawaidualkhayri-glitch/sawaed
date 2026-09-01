import { useState } from "react";

export default function ResourceList({ resources, setResources, T, onSave, onAddFileToFolder = null, onAddSubfolderToFolder = null, enableBulkMove = false, dissolveFolderInTree }) {
  const [editIdx, setEditIdx] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [expandedFolderIds, setExpandedFolderIds] = useState(new Set());
  const [selectedFileIds, setSelectedFileIds] = useState([]);

  const getFolderItems = (item) => {
    if (!item || typeof item !== "object") return [];
    if (Array.isArray(item.items)) return item.items;
    if (Array.isArray(item.children)) return item.children;
    return [];
  };

  const isFolderLike = (item) => !!item && typeof item === "object" && (item.type === "folder" || item.isFolder || Array.isArray(item.items) || Array.isArray(item.children));

  const getDisplayName = (item) => {
    if (!item || typeof item !== "object") return "عنصر";
    if (typeof item.title === "string" && item.title.trim()) return item.title.trim();
    if (typeof item.name === "string" && item.name.trim()) return item.name.trim();
    return "عنصر";
  };

  const getIcon = (item) => {
    if (!item || typeof item !== "object") return "🔗";
    if (item.type === "folder" || item.isFolder) return "📁";
    if (item.type === "pdf") return "📄";
    if (item.type === "image") return "🖼️";
    return "🔗";
  };

  const startEdit = (i) => {
    setEditIdx(i);
    const item = resources[i] || {};
    setEditForm({
      ...item,
      title: item.title ?? item.name ?? "",
      name: item.name ?? item.title ?? "",
      url: item.url ?? "",
      description: item.description ?? "",
    });
  };

  const saveEdit = () => {
    const copy = [...resources];
    const item = { ...copy[editIdx], ...editForm };
    if (item.type === "folder" || item.isFolder) {
      const folderName = (editForm.name || editForm.title || "").trim();
      item.name = folderName || item.name || "مجلد";
      item.title = item.name;
    } else {
      item.title = (editForm.title || "").trim() || item.name || "عنصر";
      item.url = (editForm.url || "").trim();
      item.description = (editForm.description || "").trim();
    }
    copy[editIdx] = item;
    setResources(copy);
    onSave(copy);
    setEditIdx(null);
  };

  const deleteRes = (i) => {
    const copy = resources.filter((_, j) => j !== i);
    setResources(copy);
    onSave(copy);
  };

  const dissolveRes = (folderId) => {
    if (!folderId) return;
    if (!window.confirm("هل أنت متأكد من حذف المجلد وإبقاء ملفاته داخل المجلد الأب؟")) return;
    const result = dissolveFolderInTree(resources, folderId);
    if (!result.found) return;
    setResources(result.items);
    onSave(result.items);
  };

  const reorderResourceTree = (list, itemId, direction) => {
    const currentIndex = list.findIndex(item => item?.id === itemId);
    const targetIndex = direction === "UP" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex >= 0 && targetIndex >= 0 && targetIndex < list.length) {
      const reordered = [...list];
      const [moved] = reordered.splice(currentIndex, 1);
      reordered.splice(targetIndex, 0, moved);
      return reordered.map((item, index) => item && typeof item === "object" ? { ...item, order: index } : item);
    }
    for (let index = 0; index < list.length; index += 1) {
      const item = list[index];
      if (!isFolderLike(item)) continue;
      const children = getFolderItems(item);
      const nextChildren = reorderResourceTree(children, itemId, direction);
      if (nextChildren !== children) {
        return list.map((entry, entryIndex) => entryIndex === index ? { ...entry, items: nextChildren, children: nextChildren } : entry);
      }
    }
    return list;
  };

  const moveResourceItem = (itemId, direction) => {
    const next = reorderResourceTree(resources, itemId, direction);
    if (next !== resources) {
      setResources(next);
      onSave(next);
    }
  };

  const toggleSelectedFile = (fileId) => {
    setSelectedFileIds(previous => previous.includes(fileId)
      ? previous.filter(id => id !== fileId)
      : [...previous, fileId]
    );
  };

  const collectSelectedFiles = (list, selectedIds, collected = []) => {
    for (const item of list || []) {
      if (!item || typeof item !== "object") continue;
      if (isFolderLike(item)) collectSelectedFiles(getFolderItems(item), selectedIds, collected);
      else if (selectedIds.includes(item.id)) collected.push(item);
    }
    return collected;
  };

  const removeSelectedFiles = (list, selectedIds) => (list || []).flatMap(item => {
    if (!item || typeof item !== "object") return [item];
    if (isFolderLike(item)) {
      const children = removeSelectedFiles(getFolderItems(item), selectedIds);
      return [{ ...item, items: children, children }];
    }
    return selectedIds.includes(item.id) ? [] : [item];
  });

  const appendFilesToFolder = (list, folderId, files) => (list || []).map(item => {
    if (!item || typeof item !== "object" || !isFolderLike(item)) return item;
    const children = getFolderItems(item);
    if (item.id === folderId) return { ...item, items: [...children, ...files], children: [...children, ...files] };
    const nextChildren = appendFilesToFolder(children, folderId, files);
    return { ...item, items: nextChildren, children: nextChildren };
  });

  const moveSelectedFilesToFolder = (folderId) => {
    if (!enableBulkMove || !selectedFileIds.length) return;
    const files = collectSelectedFiles(resources, selectedFileIds);
    const next = appendFilesToFolder(removeSelectedFiles(resources, selectedFileIds), folderId, files);
    setResources(next);
    setSelectedFileIds([]);
    onSave(next);
  };

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "10px", padding: "8px 10px", fontSize: "13px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box", marginBottom: "6px" };

  const toggleFolderExpanded = (folderId) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const renderList = (list, depth = 0, parentFolderId = null) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginRight: depth ? `${depth * 12}px` : 0 }}>
      {list.map((r, i) => {
        if (!r || typeof r !== "object") return null;
        const isFolder = isFolderLike(r);
        const itemId = r.id || `${parentFolderId || "root"}-${i}`;
        const folderItems = isFolder ? getFolderItems(r) : [];
        const isExpanded = isFolder && expandedFolderIds.has(itemId);

        return (
          <div
            key={itemId}
            style={{ background: enableBulkMove && !isFolder && selectedFileIds.includes(r.id) ? "repeating-linear-gradient(45deg, rgba(37, 99, 235, 0.15), rgba(37, 99, 235, 0.15) 10px, rgba(59, 130, 246, 0.25) 10px, rgba(59, 130, 246, 0.25) 20px)" : T.card, border: enableBulkMove && !isFolder && selectedFileIds.includes(r.id) ? "2px dashed #3b82f6" : `1px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", userSelect: "none", position: "relative", transition: "all 0.2s ease-in-out" }}
          >
            {editIdx === i ? (
              <div>
                {isFolder ? (
                  <input value={editForm.name ?? editForm.title ?? ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value, title: e.target.value }))} placeholder="اسم المجلد" style={inp} />
                ) : (
                  <>
                    <input value={editForm.title || ""} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} placeholder="العنوان" style={inp} />
                    <input value={editForm.url || ""} onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))} placeholder="الرابط" style={inp} />
                    <input value={editForm.description || ""} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="الوصف" style={inp} />
                  </>
                )}
                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                  <button onClick={saveEdit} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "8px", padding: "7px 14px", cursor: "pointer", fontFamily: "'Cairo',sans-serif", fontSize: "13px" }}>✅ حفظ</button>
                  <button onClick={() => setEditIdx(null)} style={{ background: "transparent", border: `1px solid ${T.cardBorder}`, borderRadius: "8px", padding: "7px 14px", cursor: "pointer", color: T.subtext, fontFamily: "'Cairo',sans-serif", fontSize: "13px" }}>إلغاء</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative", zIndex: 2 }}>
                {enableBulkMove && !isFolder && (
                  <input type="checkbox" checked={selectedFileIds.includes(r.id)} onChange={(event) => { event.stopPropagation(); toggleSelectedFile(r.id); }} aria-label={`تحديد ${getDisplayName(r)}`} style={{ accentColor: T.accent, width: "18px", height: "18px", flexShrink: 0 }} />
                )}
                <button
                  type="button"
                  onClick={() => isFolder && toggleFolderExpanded(itemId)}
                  style={{ background: "transparent", border: "none", color: T.text, fontSize: "20px", cursor: isFolder ? "pointer" : "default", padding: 0, flexShrink: 0 }}
                  aria-label={isFolder ? (isExpanded ? "إغلاق المجلد" : "فتح المجلد") : "عنصر"}
                >
                  {isFolder ? (isExpanded ? "📂" : "📁") : getIcon(r)}
                </button>
                <button type="button" onClick={() => isFolder && toggleFolderExpanded(itemId)} style={{ background: "transparent", border: "none", color: T.accent, fontSize: "14px", cursor: isFolder ? "pointer" : "default", padding: 0, flexShrink: 0 }}>
                  {isFolder ? (isExpanded ? "▼" : "▶") : ""}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: "700", color: T.text, fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getDisplayName(r)}</p>
                  {r.description && <p style={{ margin: "2px 0 0", fontSize: "11px", color: T.subtext, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</p>}
                </div>
                {enableBulkMove && isFolder && selectedFileIds.length > 0 && (
                  <button type="button" onClick={(event) => { event.stopPropagation(); moveSelectedFilesToFolder(itemId); }} style={{ background: "rgba(59, 130, 246, 0.18)", border: "1px solid #3b82f6", color: "#3b82f6", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontWeight: 700, fontSize: "12px", whiteSpace: "nowrap", flexShrink: 0 }}>⬆️ نقل الملفات المحددة هنا</button>
                )}
                <button type="button" disabled={i === 0} onClick={(event) => { event.stopPropagation(); moveResourceItem(itemId, "UP"); }} title="تحريك للأعلى" style={{ opacity: i === 0 ? 0.3 : 1, cursor: i === 0 ? "not-allowed" : "pointer", border: "none", background: "transparent", fontSize: "16px", flexShrink: 0 }}>⬆️</button>
                <button type="button" disabled={i === list.length - 1} onClick={(event) => { event.stopPropagation(); moveResourceItem(itemId, "DOWN"); }} title="تحريك لأسفل" style={{ opacity: i === list.length - 1 ? 0.3 : 1, cursor: i === list.length - 1 ? "not-allowed" : "pointer", border: "none", background: "transparent", fontSize: "16px", flexShrink: 0 }}>⬇️</button>
                {isFolder ? (
                  <>
                    <button onClick={() => onAddFileToFolder?.(r.id)} style={{ background: `${T.accent}22`, border: `1px solid ${T.accent}`, color: T.accent, borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "12px", whiteSpace: "nowrap" }}>➕ إضافة ملف إلى المجلد</button>
                    <button onClick={() => onAddSubfolderToFolder?.(r.id)} style={{ background: `${T.accent}22`, border: `1px solid ${T.accent}`, color: T.accent, borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "12px", whiteSpace: "nowrap" }}>➕ مجلد جديد</button>
                    <button onClick={() => dissolveRes(r.id)} title="حذف المجلد وإبقاء ملفاته بداخله" style={{ background: `${T.accent}22`, border: `1px solid ${T.accent}66`, color: T.accent, borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "12px", flexShrink: 0, whiteSpace: "nowrap" }}>🗑️ حذف وإبقاء الملفات</button>
                  </>
                ) : (
                  <button onClick={() => startEdit(i)} title="تعديل" style={{ background: `${T.accent}22`, border: "none", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "14px", flexShrink: 0 }}>✏️</button>
                )}
                <button onClick={() => deleteRes(i)} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "13px", flexShrink: 0 }}>🗑️</button>
              </div>
            )}
            {isFolder && isExpanded && folderItems.length > 0 && (
              <div style={{ marginTop: "8px" }}>
                {renderList(folderItems, depth + 1, itemId)}
              </div>
            )}
            {isFolder && isExpanded && folderItems.length === 0 && (
              <div style={{ marginTop: "8px", background: T.sectionBg, borderRadius: "12px", padding: "10px 12px", color: T.subtext, fontSize: "12px", textAlign: "center" }}>
                المجلد فارغ
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{renderList(resources)}</div>;
}
