export default function ListEditor({ items, setItems, newItem, setNewItem, T, inp, placeholder }) {
  return (
    <div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
        <input
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          placeholder={placeholder}
          style={inp}
          onKeyDown={e => {
            if (e.key === "Enter" && newItem.trim()) {
              setItems(i => [...i, newItem.trim()]);
              setNewItem("");
            }
          }}
        />
        <button
          onClick={() => {
            if (!newItem.trim()) return;
            setItems(i => [...i, newItem.trim()]);
            setNewItem("");
          }}
          style={{
            background: `linear-gradient(135deg,${T.accent},${T.accent2})`,
            color: "#fff",
            border: "none",
            borderRadius: "12px",
            padding: "10px 16px",
            cursor: "pointer",
            fontSize: "18px",
            flexShrink: 0,
          }}
        >
          +
        </button>
      </div>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: T.card,
            border: `1px solid ${T.cardBorder}`,
            borderRadius: "10px",
            padding: "10px 12px",
            marginBottom: "6px",
          }}
        >
          <span style={{ flex: 1, color: T.text, fontSize: "14px" }}>{item}</span>
          <button
            onClick={() => setItems(it => it.filter((_, j) => j !== i))}
            style={{
              background: "transparent",
              border: "none",
              color: "#e55",
              cursor: "pointer",
              fontSize: "18px",
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
