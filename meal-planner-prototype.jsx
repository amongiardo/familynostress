import { useState, useRef, useEffect } from "react";

const DAYS = [
  { id: 0, label: "Oggi", short: "LUN", date: "2" },
  { id: 1, label: "Domani", short: "MAR", date: "3" },
  { id: 2, label: "Mercoledì", short: "MER", date: "4" },
  { id: 3, label: "Giovedì", short: "GIO", date: "5" },
  { id: 4, label: "Venerdì", short: "VEN", date: "6" },
  { id: 5, label: "Sabato", short: "SAB", date: "7" },
  { id: 6, label: "Domenica", short: "DOM", date: "8" },
];

const SAMPLE_MEALS = {
  0: {
    pranzo: { name: "Insalata Greca con Feta", emoji: "🥗", tags: ["leggero", "veloce"], kcal: 320, ingredienti: ["pomodori", "cetriolo", "feta", "olive"] },
    cena: { name: "Risotto ai Funghi Porcini", emoji: "🍚", tags: ["home made"], kcal: 480, ingredienti: ["riso", "funghi", "parmigiano", "burro"] },
  },
  1: {
    pranzo: { name: "Panino Grillato Pollo", emoji: "🥪", tags: ["veloce"], kcal: 410, ingredienti: ["pollo", "lattuga", "pomodoro", "panino"] },
  },
  3: {
    cena: { name: "Spaghetti alla Carbonara", emoji: "🍝", tags: ["classico", "home made"], kcal: 520, ingredienti: ["spaghetti", "guanciale", "tuorli", "pecorino"] },
  },
  5: {
    pranzo: { name: "Pizza Margherita", emoji: "🍕", tags: ["weekend", "famiglia"], kcal: 600, ingredienti: ["impasto", "pomodoro", "mozzarella", "basilico"] },
    cena: { name: "Arrosto di Maiale", emoji: "🥩", tags: ["home made"], kcal: 450, ingredienti: ["maiale", "rosmarino", "patate", "aglio"] },
  },
};

const MEAL_TYPES = ["pranzo", "cena"];

// ── Wheel Day Selector ─────────────────────────────────────
function DayWheel({ selectedDay, onSelect }) {
  const wheelRef = useRef(null);
  const touchStart = useRef(null);

  const handleTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0 && selectedDay < 6) onSelect(selectedDay + 1);
      if (diff < 0 && selectedDay > 0) onSelect(selectedDay - 1);
    }
    touchStart.current = null;
  };

  return (
    <div
      ref={wheelRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, padding: "12px 0", userSelect: "none", overflow: "hidden", position: "relative" }}
    >
      {/* left fade */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 48, background: "linear-gradient(to right, #0f1117, transparent)", zIndex: 2, pointerEvents: "none" }} />
      {/* right fade */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 48, background: "linear-gradient(to left, #0f1117, transparent)", zIndex: 2, pointerEvents: "none" }} />

      <div style={{ display: "flex", gap: 6, transition: "transform 0.35s cubic-bezier(.4,0,.2,1)", transform: `translateX(${(3 - selectedDay) * 62}px)` }}>
        {DAYS.map((d) => {
          const isActive = d.id === selectedDay;
          const dist = Math.abs(d.id - selectedDay);
          const opacity = dist === 0 ? 1 : dist === 1 ? 0.55 : 0.25;
          const scale = isActive ? 1 : 0.88;
          return (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              style={{
                flexShrink: 0, width: 56, height: 72, borderRadius: 18,
                background: isActive ? "linear-gradient(145deg, #e8614d, #d94f3a)" : "rgba(255,255,255,0.06)",
                border: isActive ? "none" : "1px solid rgba(255,255,255,0.08)",
                color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 2, cursor: "pointer", opacity, transform: `scale(${scale})`,
                transition: "all 0.35s cubic-bezier(.4,0,.2,1)", boxShadow: isActive ? "0 4px 24px rgba(233,97,77,0.4)" : "none",
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, opacity: isActive ? 1 : 0.7, fontFamily: "'SF Pro Display', sans-serif" }}>{d.short}</span>
              <span style={{ fontSize: 20, fontWeight: 700, fontFamily: "'SF Pro Display', sans-serif" }}>{d.date}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Timeline Meal Card ──────────────────────────────────────
function MealBubble({ type, meal, onDelete, animDelay = 0 }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), animDelay);
    return () => clearTimeout(t);
  }, [animDelay]);

  const label = type === "pranzo" ? "☀️  Pranzo" : "🌙  Cena";
  const accentColor = type === "pranzo" ? "#f0a745" : "#7c6ff7";

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 14,
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(18px)",
      transition: "opacity 0.5s cubic-bezier(.4,0,.2,1), transform 0.5s cubic-bezier(.4,0,.2,1)",
    }}>
      {/* Timeline line + dot */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0, paddingTop: 6 }}>
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: accentColor, boxShadow: `0 0 10px ${accentColor}55`, border: "2px solid #0f1117", flexShrink: 0 }} />
        <div style={{ width: 2, flex: 1, background: `linear-gradient(to bottom, ${accentColor}44, transparent)`, minHeight: 40 }} />
      </div>

      {/* Card */}
      <div style={{
        flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.08)", padding: "14px 16px", marginBottom: 8,
        backdropFilter: "blur(12px)", position: "relative", overflow: "hidden",
      }}>
        {/* Subtle glow top */}
        <div style={{ position: "absolute", top: -20, left: "30%", width: "40%", height: 40, background: `${accentColor}18`, filter: "blur(16px)", pointerEvents: "none" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: accentColor, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</span>
          <button onClick={onDelete} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 34 }}>{meal.emoji}</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "'SF Pro Display', sans-serif" }}>{meal.name}</p>
            <p style={{ margin: "3px 0 0", color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{meal.kcal} kcal</p>
          </div>
        </div>

        {/* Tags */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {meal.tags.map((t) => (
            <span key={t} style={{
              fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 20,
              background: `${accentColor}18`, color: accentColor, border: `1px solid ${accentColor}33`,
              textTransform: "capitalize", letterSpacing: 0.3,
            }}>{t}</span>
          ))}
        </div>

        {/* Ingredienti pills */}
        <div style={{ display: "flex", gap: 5, marginTop: 10, flexWrap: "wrap" }}>
          {meal.ingredienti.map((ing) => (
            <span key={ing} style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 12,
              background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}>{ing}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Empty Meal Slot ─────────────────────────────────────────
function EmptySlot({ type, onAdd }) {
  const label = type === "pranzo" ? "☀️  Pranzo" : "🌙  Cena";
  const accentColor = type === "pranzo" ? "#f0a745" : "#7c6ff7";

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0, paddingTop: 6 }}>
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: "transparent", border: `2px dashed ${accentColor}55`, flexShrink: 0 }} />
        <div style={{ width: 2, flex: 1, background: "rgba(255,255,255,0.07)", minHeight: 32 }} />
      </div>
      <button onClick={() => onAdd(type)} style={{
        flex: 1, background: "rgba(255,255,255,0.025)", borderRadius: 16,
        border: `1.5px dashed rgba(255,255,255,0.12)`, padding: "14px 16px", marginBottom: 8,
        cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
        transition: "background 0.2s", color: "rgba(255,255,255,0.35)",
      }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.025)"}
      >
        <span style={{ fontSize: 20, opacity: 0.5 }}>+</span>
        <span style={{ fontSize: 13, fontWeight: 500 }}>Aggiungi {label.split("  ")[1]}</span>
      </button>
    </div>
  );
}

// ── Add Meal Modal ──────────────────────────────────────────
function AddModal({ open, mealType, onClose, onSave }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🍽️");
  const emojis = ["🍝", "🍚", "🥗", "🍕", "🥪", "🍲", "🥩", "🍳", "🍱", "🥘"];

  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div style={{ background: "#1a1c23", borderRadius: "24px 24px 0 0", padding: 24, width: "100%", maxWidth: 440, margin: "0 auto" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: "#fff", fontSize: 18, fontFamily: "'SF Pro Display', sans-serif" }}>Nuovo {mealType === "pranzo" ? "Pranzo" : "Cena"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {/* Emoji picker row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {emojis.map(e => (
            <button key={e} onClick={() => setEmoji(e)} style={{
              width: 40, height: 40, borderRadius: 12, border: emoji === e ? "2px solid #e8614d" : "1px solid rgba(255,255,255,0.1)",
              background: emoji === e ? "rgba(232,97,77,0.15)" : "rgba(255,255,255,0.05)", cursor: "pointer", fontSize: 20,
              display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
            }}>{e}</button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Nome del piatto..."
          value={name}
          onChange={e => setName(e.target.value)}
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 15, outline: "none", boxSizing: "border-box",
            fontFamily: "'SF Pro Display', sans-serif",
          }}
        />
        <button
          onClick={() => { if (name.trim()) onSave({ name: name.trim(), emoji, tags: ["nuovo"], kcal: 350, ingredienti: [] }); setName(""); setEmoji("🍽️"); }}
          style={{
            marginTop: 14, width: "100%", padding: "13px", borderRadius: 14, border: "none",
            background: "linear-gradient(145deg, #e8614d, #d94f3a)", color: "#fff", fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: "'SF Pro Display', sans-serif", boxShadow: "0 4px 20px rgba(233,97,77,0.35)",
          }}
        >Aggiungi</button>
      </div>
    </div>
  );
}

// ── Weekly Summary Bar ──────────────────────────────────────
function WeeklySummary({ meals }) {
  const totalMeals = Object.values(meals).reduce((acc, day) => acc + Object.keys(day).length, 0);
  const totalKcal = Object.values(meals).reduce((acc, day) => acc + Object.values(day).reduce((a, m) => a + (m.kcal || 0), 0), 0);
  const pct = Math.min((totalMeals / 14) * 100, 100);

  return (
    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 18, padding: "14px 18px", marginBottom: 18, border: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>Settimana</span>
        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>{totalMeals}/14 pasti · {totalKcal} kcal</span>
      </div>
      {/* Progress dots */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {DAYS.map((d, i) => {
          const dayMeals = meals[d.id] || {};
          const hasPranzo = !!dayMeals.pranzo;
          const hasCena = !!dayMeals.cena;
          return (
            <div key={d.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: 1 }}>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>{d.short}</span>
              <div style={{ display: "flex", gap: 3 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: hasPranzo ? "#f0a745" : "rgba(255,255,255,0.1)" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: hasCena ? "#7c6ff7" : "rgba(255,255,255,0.1)" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── MAIN APP ────────────────────────────────────────────────
export default function FamilyMealPlanner() {
  const [selectedDay, setSelectedDay] = useState(0);
  const [meals, setMeals] = useState(SAMPLE_MEALS);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("pranzo");

  const dayMeals = meals[selectedDay] || {};
  const dayLabel = DAYS[selectedDay];

  const handleAdd = (type) => {
    setModalType(type);
    setModalOpen(true);
  };

  const handleSave = (meal) => {
    setMeals(prev => ({
      ...prev,
      [selectedDay]: { ...(prev[selectedDay] || {}), [modalType]: meal },
    }));
    setModalOpen(false);
  };

  const handleDelete = (type) => {
    setMeals(prev => {
      const updated = { ...prev };
      const dayData = { ...(updated[selectedDay] || {}) };
      delete dayData[type];
      if (Object.keys(dayData).length === 0) {
        delete updated[selectedDay];
      } else {
        updated[selectedDay] = dayData;
      }
      return updated;
    });
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0f1117", color: "#fff",
      fontFamily: "'SF Pro Display', system-ui, sans-serif", maxWidth: 440, margin: "0 auto",
      position: "relative", overflow: "hidden",
    }}>
      {/* Background ambient blobs */}
      <div style={{ position: "fixed", top: -120, left: -80, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(232,97,77,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -100, right: -60, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,111,247,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ padding: "52px 20px 8px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>🍽️ Family Planner</h1>
            <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>Famiglia · Feb 2026</p>
          </div>
          <div style={{
            width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(145deg, #e8614d, #d94f3a)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer",
            boxShadow: "0 4px 18px rgba(233,97,77,0.4)",
          }}>👤</div>
        </div>
      </div>

      {/* Day Wheel */}
      <div style={{ position: "relative", zIndex: 1, padding: "10px 0" }}>
        <DayWheel selectedDay={selectedDay} onSelect={setSelectedDay} />
      </div>

      {/* Weekly summary */}
      <div style={{ padding: "0 20px", position: "relative", zIndex: 1 }}>
        <WeeklySummary meals={meals} />
      </div>

      {/* Day label */}
      <div style={{ padding: "0 20px 10px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{dayLabel.label}</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>— {Object.keys(dayMeals).length} pasto{Object.keys(dayMeals).length !== 1 ? "i" : ""}</span>
        </div>
      </div>

      {/* Timeline meals */}
      <div style={{ padding: "0 20px 100px", position: "relative", zIndex: 1 }}>
        {MEAL_TYPES.map((type, i) => (
          dayMeals[type]
            ? <MealBubble key={type} type={type} meal={dayMeals[type]} onDelete={() => handleDelete(type)} animDelay={i * 120} />
            : <EmptySlot key={type} type={type} onAdd={handleAdd} />
        ))}
      </div>

      {/* Bottom nav bar */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 440,
        background: "rgba(15,17,23,0.85)", borderTop: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(20px)", padding: "12px 0 28px", display: "flex", justifyContent: "space-around", zIndex: 10,
      }}>
        {[
          { icon: "📅", label: "Piano" },
          { icon: "🛒", label: "Spesa" },
          { icon: "📊", label: "Info" },
          { icon: "⚙️", label: "Settings" },
        ].map((item, i) => (
          <button key={i} style={{
            background: "none", border: "none", color: i === 0 ? "#e8614d" : "rgba(255,255,255,0.35)",
            cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 16px",
          }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.3 }}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Modal */}
      <AddModal open={modalOpen} mealType={modalType} onClose={() => setModalOpen(false)} onSave={handleSave} />
    </div>
  );
}
