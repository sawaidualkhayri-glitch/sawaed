import { useState, useEffect } from "react";
import AdminSection from "./AdminSection.jsx";
import ListEditor from "../ui/ListEditor.jsx";

export default function AdminLessons({ config, saveConfig, T, onBack, getSubjectsByGradeBranch }) {
  const keys = (config.grades || []).flatMap(g => (config.branches || []).map(b => `${g}_${b}`));
  const [selGB, setSelGB] = useState(keys[0] || "");
  const [selSemester, setSelSemester] = useState("فصل أول"); // إضافة حالة اختيار الفصل
  
  const [selSub, setSelSub] = useState("");
  const [color, setColor] = useState(config.progressBarColor || "#6C63FF");
  
  // تعديل مفتاح حفظ الدروس ليشمل الفصل الدراسي لمنع تداخل الدروس نهائياً
  const lKey = `lessons_${selGB}_sem${selSemester}_${selSub}`;
  
  const [lessons, setLessons] = useState([]);
  const [newL, setNewL] = useState("");

  const [selectedGrade, selectedBranch] = selGB.split("_");
  const currentAvailableSubjects = getSubjectsByGradeBranch(config.subjects, selectedGrade, selectedBranch, true);

  useEffect(() => {
    setSelSub(currentAvailableSubjects[0] || "");
  }, [selGB, config.subjects, currentAvailableSubjects.length]);

  useEffect(() => {
    const raw = config[lKey];
    setLessons(raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : []);
  }, [lKey]);

  const inp = { 
    background: T.inputBg, 
    border: `1.5px solid ${T.cardBorder}`, 
    borderRadius: "12px", 
    padding: "10px 12px", 
    fontSize: "13px", 
    color: T.text, 
    flex: 1, 
    outline: "none", 
    fontFamily: "'Cairo',sans-serif", 
    direction: "rtl" 
  };
  
  const sel = { ...inp, flex: "unset", width: "100%", marginBottom: "8px", padding: "10px 12px" };

  return ( 
    <AdminSection title="الدروس والإنجاز" icon="✅" T={T} onBack={onBack} onSave={() => saveConfig({ ...config, [lKey]: JSON.stringify(lessons), progressBarColor: color })}> 
      
      <p style={{ color: T.text, fontWeight: "700", marginBottom: "8px" }}>لون شريط الإنجاز:</p> 
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}> 
        <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: "50px", height: "40px", border: "none", borderRadius: "10px", cursor: "pointer" }} /> 
        <div style={{ flex: 1, height: "10px", borderRadius: "6px", background: color }} /> 
      </div> 

      {/* 1. اختيار الصف والفرع */}
      <label style={{ fontSize: "12px", color: T.subtext, display: "block", marginBottom: "2px" }}>اختر الصف والفرع:</label>
      <select value={selGB} onChange={e => setSelGB(e.target.value)} style={sel}> 
        {keys.map(k => <option key={k} value={k}>{k.replace("_", " --- ")}</option>)} 
      </select> 

      {/* 2. إضافة قائمة تحديد الفصل الدراسي للدروس */}
      <label style={{ fontSize: "12px", color: T.subtext, display: "block", marginBottom: "2px" }}>اختر الفصل الدراسي:</label>
      <select value={selSemester} onChange={e => setSelSemester(e.target.value)} style={sel}>
          <option value="فصل أول">الفصل الدراسي الأول</option>
          <option value="فصل ثان">الفصل الدراسي الثاني</option>
      </select>

      {/* 3. اختيار المادة (تظهر هنا المواد التابعة للفصل المختار فقط) */}
      <label style={{ fontSize: "12px", color: T.subtext, display: "block", marginBottom: "2px" }}>اختر المادة:</label>
      <select value={selSub} onChange={e => setSelSub(e.target.value)} style={sel}> 
        {currentAvailableSubjects.map(s => <option key={s} value={s}>{s}</option>)} 
      </select> 

      <hr style={{ border: `0.5px solid ${T.cardBorder}`, margin: "15px 0" }} />

      <ListEditor items={lessons} setItems={setLessons} newItem={newL} setNewItem={setNewL} T={T} inp={inp} placeholder="اسم الدرس الجديد..." /> 
    </AdminSection> 
  ); 
}
