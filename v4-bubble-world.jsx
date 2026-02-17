import { useState, useEffect } from "react";

/* ─── DATA ──────────────────────────────────────────────── */
const DAYS = [
  { id:0, label:"Oggi",       short:"LU", date:"2" },
  { id:1, label:"Domani",     short:"MA", date:"3" },
  { id:2, label:"Mercoledì",  short:"ME", date:"4" },
  { id:3, label:"Giovedì",    short:"GI", date:"5" },
  { id:4, label:"Venerdì",    short:"VE", date:"6" },
  { id:5, label:"Sabato",     short:"SA", date:"7" },
  { id:6, label:"Domenica",   short:"DO", date:"8" },
];

const MEALS = {
  0: {
    pranzo: { name:"Insalata Greca", emoji:"🥗", kcal:320, ingredienti:["pomodori","feta","olive"] },
    cena:   { name:"Risotto Funghi", emoji:"🍚", kcal:480, ingredienti:["riso","funghi","parmigiano"] },
  },
  1: { pranzo: { name:"Panino Grillato", emoji:"🥪", kcal:410, ingredienti:["pollo","lattuga"] } },
  3: { cena:   { name:"Carbonara",       emoji:"🍝", kcal:520, ingredienti:["spaghetti","guanciale"] } },
  5: {
    pranzo: { name:"Pizza Margherita",   emoji:"🍕", kcal:600, ingredienti:["impasto","mozzarella"] },
    cena:   { name:"Arrosto Maiale",     emoji:"🥩", kcal:450, ingredienti:["maiale","rosmarino"] },
  },
};

const BUBBLE_COLORS = {
  pranzo: { bg:"#FFF176", shadow:"#F9A825", accent:"#FF8F00", text:"#4E342E" },
  cena:   { bg:"#CE93D8", shadow:"#7B1FA2", accent:"#AB47BC", text:"#fff" },
};

/* ─── ANIMATED BG BLOBS ─────────────────────────────────── */
function BgBlobs() {
  const blobs = [
    { top:"-60px", left:"-40px", size:200, color:"rgba(255,183,77,0.18)", dur:8 },
    { top:"30%",  right:"-60px", size:160, color:"rgba(186,104,200,0.2)", dur:10 },
    { top:"60%",  left:"20%",    size:120, color:"rgba(129,199,132,0.18)", dur:7 },
    { top:"10%",  left:"50%",    size:90,  color:"rgba(100,181,246,0.2)", dur:9 },
    { top:"75%",  left:"-30px",  size:140, color:"rgba(239,154,154,0.18)", dur:11 },
  ];
  return (
    <>
      {blobs.map((b, i) => (
        <div key={i} style={{
          position:"absolute", borderRadius:"50%", background:b.color,
          width:b.size, height:b.size, top:b.top, left:b.left, right:b.right,
          filter:"blur(30px)", pointerEvents:"none",
          animation:`float${i} ${b.dur}s ease-in-out infinite alternate`,
        }} />
      ))}
      <style>{`
        @keyframes float0 { from { transform: translate(0,0) scale(1); } to { transform: translate(30px,20px) scale(1.1); } }
        @keyframes float1 { from { transform: translate(0,0) scale(1); } to { transform: translate(-25px,15px) scale(1.05); } }
        @keyframes float2 { from { transform: translate(0,0) scale(1); } to { transform: translate(20px,-20px) scale(1.08); } }
        @keyframes float3 { from { transform: translate(0,0) scale(1); } to { transform: translate(-15px,25px) scale(1.1); } }
        @keyframes float4 { from { transform: translate(0,0) scale(1); } to { transform: translate(25px,-10px) scale(1.05); } }
        @keyframes popIn { 0% { transform:scale(0) translateY(20px); opacity:0; } 60% { transform:scale(1.08); } 100% { transform:scale(1) translateY(0); opacity:1; } }
        @keyframes wiggle { 0%,100% { transform:rotate(0deg); } 25% { transform:rotate(-2deg); } 75% { transform:rotate(2deg); } }
      `}</style>
    </>
  );
}

/* ─── MEAL BUBBLE ───────────────────────────────────────── */
function MealBubble({ type, meal, onDelete, animDelay=0 }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(false); const t = setTimeout(()=>setVisible(true), animDelay+80); return ()=>clearTimeout(t); }, [meal, animDelay]);

  const c = BUBBLE_COLORS[type];
  const isLunch = type === "pranzo";

  return (
    <div style={{
      opacity: visible?1:0, transform: visible?"scale(1)":"scale(0)",
      animation: visible ? "popIn 0.5s cubic-bezier(.34,1.56,.64,1) forwards" : "none",
      animationDelay: `${animDelay}ms`,
    }}>
      <div style={{
        position:"relative", background:c.bg, borderRadius:32,
        boxShadow:`0 6px 0 ${c.shadow}, 0 10px 30px rgba(0,0,0,0.15)`,
        padding:"18px 20px 16px", overflow:"hidden",
      }}>
        {/* highlight shine */}
        <div style={{ position:"absolute", top:-20, left:-20, width:100, height:100, borderRadius:"50%", background:"rgba(255,255,255,0.25)", pointerEvents:"none" }} />

        {/* header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(255,255,255,0.35)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>
              {isLunch ? "☀️" : "🌙"}
            </div>
            <span style={{ fontSize:12, fontWeight:900, color:c.text, textTransform:"uppercase", letterSpacing:1.2 }}>{isLunch?"Pranzo":"Cena"}</span>
          </div>
          <button onClick={onDelete} style={{
            width:28, height:28, borderRadius:"50%", background:"rgba(255,255,255,0.3)", border:"none",
            color:c.text, fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 2px 0 rgba(0,0,0,0.1)", transition:"transform 0.1s",
          }}
            onMouseDown={e=>e.currentTarget.style.transform="translateY(2px)"}
            onMouseUp={e=>e.currentTarget.style.transform="translateY(0)"}
          >✕</button>
        </div>

        {/* emoji + name */}
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{
            width:72, height:72, borderRadius:24, background:"rgba(255,255,255,0.4)",
            boxShadow:"inset 0 3px 8px rgba(0,0,0,0.08), 0 3px 0 rgba(0,0,0,0.08)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:38, flexShrink:0,
            animation:"wiggle 3s ease-in-out infinite",
          }}>{meal.emoji}</div>
          <div>
            <h3 style={{ margin:0, fontSize:20, fontWeight:900, color:c.text, letterSpacing:-0.3 }}>{meal.name}</h3>
            <p style={{ margin:"3px 0 0", fontSize:13, color:`${c.text}99`, fontWeight:700 }}>{meal.kcal} kcal</p>
          </div>
        </div>

        {/* ingredient pills */}
        {meal.ingredienti.length > 0 && (
          <div style={{ display:"flex", gap:6, marginTop:12, flexWrap:"wrap" }}>
            {meal.ingredienti.map(ing => (
              <span key={ing} style={{
                fontSize:11, fontWeight:800, padding:"4px 10px", borderRadius:20,
                background:"rgba(255,255,255,0.4)", color:c.text, border:"1.5px solid rgba(255,255,255,0.5)",
                boxShadow:"0 2px 0 rgba(0,0,0,0.08)",
              }}>{ing}</span>
            ))}
          </div>
        )}

        {/* kcal bar */}
        <div style={{ marginTop:14 }}>
          <div style={{ height:10, borderRadius:5, background:"rgba(255,255,255,0.3)", overflow:"hidden", boxShadow:"inset 0 2px 4px rgba(0,0,0,0.1)" }}>
            <div style={{
              height:"100%", width:`${Math.min((meal.kcal/700)*100,100)}%`, borderRadius:5,
              background:`linear-gradient(90deg, ${c.accent}, rgba(255,255,255,0.6))`,
              boxShadow:"0 2px 0 rgba(0,0,0,0.1)", transition:"width 0.7s cubic-bezier(.4,0,.2,1)",
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── ADD BUBBLE BUTTON ─────────────────────────────────── */
function AddBubble({ type, onAdd }) {
  const isLunch = type === "pranzo";
  const c = BUBBLE_COLORS[type];
  return (
    <button onClick={() => onAdd(type)} style={{
      width:"100%", background:"rgba(255,255,255,0.22)", border:`3px dashed ${c.bg}`,
      borderRadius:28, padding:"28px 20px", cursor:"pointer",
      display:"flex", alignItems:"center", justifyContent:"center", gap:12,
      transition:"all 0.2s", backdropFilter:"blur(4px)",
    }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.32)"; e.currentTarget.style.transform = "scale(1.02)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.22)"; e.currentTarget.style.transform = "scale(1)"; }}
    >
      <div style={{ width:48, height:48, borderRadius:"50%", background:c.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, boxShadow:`0 4px 0 ${c.shadow}` }}>
        +
      </div>
      <span style={{ fontSize:16, fontWeight:900, color:"#fff", textShadow:"0 1px 3px rgba(0,0,0,0.2)" }}>
        Aggiungi {isLunch?"Pranzo":"Cena"}
      </span>
    </button>
  );
}

/* ─── MODAL ─────────────────────────────────────────────── */
function Modal({ open, type, onClose, onSave }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🍽️");
  const emojis = ["🍝","🍚","🥗","🍕","🥪","🍲","🥩","🍳","🍱","🥘"];
  if (!open) return null;
  const c = BUBBLE_COLORS[type];

  const submit = () => {
    if (!name.trim()) return;
    onSave({ name:name.trim(), emoji, kcal:300+Math.floor(Math.random()*250), ingredienti:[] });
    setName(""); setEmoji("🍽️");
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:100, display:"flex", alignItems:"flex-end", backdropFilter:"blur(6px)" }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:"32px 32px 0 0", width:"100%", maxWidth:440, margin:"0 auto", padding:"12px 24px 44px" }} onClick={e=>e.stopPropagation()}>
        <div style={{ width:48, height:5, borderRadius:3, background:c.bg, margin:"0 auto 20px", boxShadow:`0 2px 0 ${c.shadow}` }} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <h3 style={{ margin:0, fontSize:22, fontWeight:900, color:"#333" }}>Nuovo {type==="pranzo"?"Pranzo":"Cena"} 🎉</h3>
          <button onClick={onClose} style={{ background:"#f0f0f0", border:"none", borderRadius:"50%", width:32, height:32, fontSize:17, cursor:"pointer", color:"#888", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>
        <p style={{ margin:"0 0 8px", fontSize:10, fontWeight:900, color:c.accent, textTransform:"uppercase", letterSpacing:1.5 }}>Scegli emoji</p>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
          {emojis.map(e => (
            <button key={e} onClick={()=>setEmoji(e)} style={{
              width:44, height:44, borderRadius:16, border: emoji===e ? `3px solid ${c.accent}` : "2px solid #eee",
              background: emoji===e ? `${c.bg}66` : "#fafafa", cursor:"pointer", fontSize:22, display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow: emoji===e ? `0 3px 0 ${c.shadow}` : "0 2px 0 #ddd", transition:"all 0.15s",
            }}>{e}</button>
          ))}
        </div>
        <input autoFocus type="text" placeholder="Nome del piatto..." value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")submit();}}
          style={{ width:"100%", padding:"14px 18px", borderRadius:18, border:"2.5px solid #eee", background:"#fafafa", fontSize:16, fontWeight:700, color:"#333", outline:"none", boxSizing:"border-box", boxShadow:"0 3px 0 #ddd" }}
        />
        {/* preview bubble */}
        <div style={{ marginTop:14, background:c.bg, borderRadius:20, padding:"12px 16px", display:"flex", alignItems:"center", gap:12, boxShadow:`0 4px 0 ${c.shadow}` }}>
          <span style={{ fontSize:30 }}>{emoji}</span>
          <span style={{ fontSize:16, fontWeight:900, color:c.text }}>{name||"Anteprima..."}</span>
        </div>
        <button onClick={submit} style={{
          marginTop:18, width:"100%", padding:"16px", borderRadius:20, border:"none",
          background:c.bg, color:c.text, fontSize:16, fontWeight:900, cursor:"pointer",
          boxShadow:`0 5px 0 ${c.shadow}, 0 8px 24px rgba(0,0,0,0.12)`, transition:"transform 0.1s, box-shadow 0.1s",
        }}
          onMouseDown={e=>{ e.currentTarget.style.transform="translateY(3px)"; e.currentTarget.style.boxShadow=`0 2px 0 ${c.shadow}`; }}
          onMouseUp={e=>{ e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow=`0 5px 0 ${c.shadow}, 0 8px 24px rgba(0,0,0,0.12)`; }}
        >Aggiungi al Piano 🎉</button>
      </div>
    </div>
  );
}

/* ─── APP ───────────────────────────────────────────────── */
export default function BubbleMealPlanner() {
  const [day, setDay]     = useState(0);
  const [meals, setMeals] = useState(MEALS);
  const [modal, setModal] = useState(null);

  const dayMeals = meals[day] || {};

  const addMeal = (meal) => {
    setMeals(p => ({ ...p, [day]: { ...(p[day]||{}), [modal]: meal } }));
    setModal(null);
  };
  const delMeal = (type) => {
    setMeals(p => {
      const u = { ...p, [day]: { ...(p[day]||{}) } };
      delete u[day][type];
      if (!Object.keys(u[day]).length) delete u[day];
      return u;
    });
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg, #667eea 0%, #764ba2 40%, #f093fb 70%, #f5576c 100%)", maxWidth:440, margin:"0 auto", position:"relative", overflow:"hidden", fontFamily:"'Segoe UI','Helvetica Neue',sans-serif" }}>
      <BgBlobs />

      {/* ── HEADER ── */}
      <div style={{ padding:"50px 22px 0", position:"relative", zIndex:1 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <p style={{ margin:0, fontSize:12, color:"rgba(255,255,255,0.7)", fontWeight:800 }}>👋 Benvenuto!</p>
            <h1 style={{ margin:"4px 0 0", fontSize:28, fontWeight:900, color:"#fff", letterSpacing:-0.8, lineHeight:1.1, textShadow:"0 2px 12px rgba(0,0,0,0.15)" }}>
              Meal<br/>Planner 🍽️
            </h1>
          </div>
          <div style={{ width:50, height:50, borderRadius:"50%", background:"rgba(255,255,255,0.25)", backdropFilter:"blur(10px)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, border:"2.5px solid rgba(255,255,255,0.4)", boxShadow:"0 4px 0 rgba(0,0,0,0.1)" }}>
            👨‍👩‍👧
          </div>
        </div>
      </div>

      {/* ── DAY SELECTOR — bubble pills ── */}
      <div style={{ padding:"18px 22px 0", position:"relative", zIndex:1 }}>
        <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4 }}>
          {DAYS.map(d => {
            const isActive = d.id === day;
            const m = meals[d.id] || {};
            return (
              <button key={d.id} onClick={() => setDay(d.id)} style={{
                flexShrink:0, width:58, background: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.18)",
                border: isActive ? "none" : "1.5px solid rgba(255,255,255,0.3)",
                borderRadius:18, padding:"8px 4px", cursor:"pointer",
                backdropFilter:"blur(8px)", boxShadow: isActive ? "0 4px 0 rgba(0,0,0,0.12)" : "0 2px 0 rgba(0,0,0,0.08)",
                transition:"all 0.25s cubic-bezier(.4,0,.2,1)",
              }}>
                <p style={{ margin:0, fontSize:9, fontWeight:900, color: isActive ? "#764ba2" : "rgba(255,255,255,0.8)", textTransform:"uppercase", letterSpacing:0.8 }}>{d.short}</p>
                <p style={{ margin:"2px 0", fontSize:18, fontWeight:900, color: isActive ? "#333" : "#fff", lineHeight:1 }}>{d.date}</p>
                <div style={{ display:"flex", justifyContent:"center", gap:3, marginTop:4 }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background: m.pranzo ? "#FFF176" : "rgba(255,255,255,0.25)" }} />
                  <div style={{ width:6, height:6, borderRadius:"50%", background: m.cena ? "#CE93D8" : "rgba(255,255,255,0.25)" }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MEAL BUBBLES ── */}
      <div style={{ padding:"22px 22px 110px", display:"flex", flexDirection:"column", gap:16, position:"relative", zIndex:1 }}>
        {["pranzo","cena"].map((type,i) =>
          dayMeals[type]
            ? <MealBubble key={type} type={type} meal={dayMeals[type]} onDelete={()=>delMeal(type)} animDelay={i*140} />
            : <AddBubble  key={type} type={type} onAdd={()=>setModal(type)} />
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{
        position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:440,
        background:"rgba(80,50,120,0.6)", backdropFilter:"blur(20px)", borderTop:"1px solid rgba(255,255,255,0.15)",
        padding:"12px 0 30px", display:"flex", justifyContent:"space-around", zIndex:10,
      }}>
        {[
          { icon:"📅", label:"Piano", active:true },
          { icon:"🛒", label:"Spesa" },
          { icon:"🎯", label:"Obiettivi" },
          { icon:"⚙️", label:"Settings" },
        ].map((item,i) => (
          <button key={i} style={{
            background:"none", border:"none", cursor:"pointer",
            display:"flex", flexDirection:"column", alignItems:"center", gap:3,
            color: item.active ? "#FFF176" : "rgba(255,255,255,0.5)",
          }}>
            <span style={{ fontSize:20 }}>{item.icon}</span>
            <span style={{ fontSize:10, fontWeight:800, letterSpacing:0.4 }}>{item.label}</span>
          </button>
        ))}
      </div>

      <Modal open={!!modal} type={modal} onClose={()=>setModal(null)} onSave={addMeal} />
    </div>
  );
}
