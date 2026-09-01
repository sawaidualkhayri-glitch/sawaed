import { useState } from "react";
import AdminSection from "./AdminSection.jsx";
import ListEditor from "../ui/ListEditor.jsx";

export default function AdminGrades({ config, saveConfig, T, onBack }) {
  const [grades, setGrades] = useState([...config.grades]);
  const [branches, setBranches] = useState([...config.branches]);
  const [selSemester, setSelSemester] = useState("فصل أول");
  const [nb, setNb] = useState("");
  const [ng, setNg] = useState("");

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "10px 12px", fontSize: "14px", color: T.text, flex: 1, outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl" };

  return (
    <AdminSection title="الصفوف والفروع" icon="🏫" T={T} onBack={onBack} onSave={() => saveConfig({ ...config, grades, branches })}>
      <p style={{ color: T.text, fontWeight: "700", marginBottom: "10px" }}>الصفوف:</p>
      <ListEditor items={grades} setItems={setGrades} newItem={ng} setNewItem={setNg} T={T} inp={inp} placeholder="صف جديد..." />
      <p style={{ color: T.text, fontWeight: "700", margin: "16px 0 10px" }}>الفروع:</p>
      <ListEditor items={branches} setItems={setBranches} newItem={nb} setNewItem={setNb} T={T} inp={inp} placeholder="فرع جديد..." />
    </AdminSection>
  );
}
