import { useState, useMemo, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://fddvfmvammontpbpdlcw.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZHZmbXZhbW1vbnRwYnBkbGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODU5MDEsImV4cCI6MjA4ODY2MTkwMX0.hCvqo1fATPOskjo_eJcwBwpX8fpo-Wu41YyYUZ-WMG4"
);

const STAGES = ["New / Incoming", "Qualified", "Proposal Sent", "Negotiation", "Won / Closed", "Lost"];

const STAGE_CONFIG = {
  "New / Incoming": { color: "#60A5FA", bg: "#60A5FA18" },
  "Qualified":      { color: "#A78BFA", bg: "#A78BFA18" },
  "Proposal Sent":  { color: "#FCD34D", bg: "#FCD34D18" },
  "Negotiation":    { color: "#F97316", bg: "#F9731618" },
  "Won / Closed":   { color: "#4ADE80", bg: "#4ADE8018" },
  "Lost":           { color: "#F87171", bg: "#F8717118" },
};

const fmt = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v || 0);
const EMPTY_FORM = { name: "", contact: "", value: "", stage: "New / Incoming", date: new Date().toISOString().split("T")[0], notes: "" };

export default function App() {
  const [opps, setOpps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("dashboard");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterStage, setFilterStage] = useState("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchDeals(); }, []);

  const fetchDeals = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("deals").select("*").order("created_at", { ascending: false });
    if (!error) setOpps(data || []);
    setLoading(false);
  };

  const saveOpp = async () => {
    if (!form.name.trim() || !form.value) return;
    setSaving(true);
    const entry = { name: form.name, contact: form.contact, value: Number(form.value), stage: form.stage, date: form.date, notes: form.notes };
    if (editId !== null) {
      await supabase.from("deals").update(entry).eq("id", editId);
    } else {
      await supabase.from("deals").insert([entry]);
    }
    await fetchDeals();
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setSaving(false);
  };

  const deleteOpp = async (id) => {
    await supabase.from("deals").delete().eq("id", id);
    setOpps(opps.filter(o => o.id !== id));
  };

  const moveStage = async (id, dir) => {
    const opp = opps.find(o => o.id === id);
    const newStage = STAGES[Math.max(0, Math.min(STAGES.length - 1, STAGES.indexOf(opp.stage) + dir))];
    await supabase.from("deals").update({ stage: newStage }).eq("id", id);
    setOpps(opps.map(o => o.id === id ? { ...o, stage: newStage } : o));
  };

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (o) => { setEditId(o.id); setForm({ ...o, value: String(o.value) }); setShowForm(true); };
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const stats = useMemo(() => {
    const active = opps.filter(o => !["Won / Closed", "Lost"].includes(o.stage));
    const won = opps.filter(o => o.stage === "Won / Closed");
    const closed = opps.filter(o => ["Won / Closed", "Lost"].includes(o.stage));
    return {
      pipeline: active.reduce((s, o) => s + o.value, 0),
      won: won.reduce((s, o) => s + o.value, 0),
      avgDeal: won.length ? Math.round(won.reduce((s, o) => s + o.value, 0) / won.length) : 0,
      winRate: closed.length ? Math.round((won.length / closed.length) * 100) : 0,
      activeCount: active.length,
      wonCount: won.length,
      totalCount: opps.length,
    };
  }, [opps]);

  const stageBreakdown = useMemo(() =>
    STAGES.map(s => ({
      stage: s,
      count: opps.filter(o => o.stage === s).length,
      value: opps.filter(o => o.stage === s).reduce((a, o) => a + o.value, 0),
    })), [opps]);

  const maxVal = Math.max(...stageBreakdown.map(s => s.value), 1);

  const filtered = useMemo(() => {
    let list = opps.filter(o =>
      (filterStage === "All" || o.stage === filterStage) &&
      (o.name.toLowerCase().includes(search.toLowerCase()) || (o.contact || "").toLowerCase().includes(search.toLowerCase()))
    );
    if (sortBy === "value") list = [...list].sort((a, b) => b.value - a.value);
    if (sortBy === "date") list = [...list].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (sortBy === "stage") list = [...list].sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage));
    return list;
  }, [opps, filterStage, search, sortBy]);

  return (
    <div style={{ minHeight: "100vh", background: "#080B12", color: "#D4DAE8", fontFamily: "'IBM Plex Mono', 'Courier New', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500&family=Instrument+Serif:ital@0;1&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-track{background:#080B12}
        ::-webkit-scrollbar-thumb{background:#1E2535;border-radius:2px}
        .tab{background:none;border:none;cursor:pointer;padding:7px 16px;font-family:inherit;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#3A4560;transition:all .2s;border-bottom:2px solid transparent}
        .tab.on{color:#60A5FA;border-bottom-color:#60A5FA}
        .tab:hover:not(.on){color:#6B7A99}
        .card{background:#0E1220;border:1px solid #1A2035;border-radius:10px;padding:22px}
        .btn-primary{background:#60A5FA;color:#080B12;border:none;cursor:pointer;padding:9px 18px;border-radius:6px;font-family:inherit;font-size:11px;font-weight:500;letter-spacing:.08em;transition:all .2s}
        .btn-primary:hover{background:#93C5FD}
        .btn-primary:disabled{opacity:.5;cursor:not-allowed}
        .btn-ghost{background:none;border:1px solid #1A2035;color:#3A4560;cursor:pointer;padding:5px 10px;border-radius:5px;font-family:inherit;font-size:11px;transition:all .2s}
        .btn-ghost:hover{border-color:#2A3550;color:#6B7A99}
        .fi{background:#0A0D16;border:1px solid #1A2035;border-radius:6px;color:#D4DAE8;padding:9px 12px;font-family:inherit;font-size:12px;width:100%;outline:none;transition:border .2s}
        .fi:focus{border-color:#60A5FA}
        select.fi option{background:#0E1220}
        .lbl{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#3A4560;margin-bottom:5px;display:block}
        .opp-card{background:#0E1220;border:1px solid #1A2035;border-radius:8px;padding:14px 16px;transition:all .15s}
        .opp-card:hover{border-color:#2A3550;background:#101525}
        .pill{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:10px;letter-spacing:.05em;white-space:nowrap}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(4px)}
        .modal{background:#0E1220;border:1px solid #2A3550;border-radius:12px;padding:28px;width:500px;max-height:90vh;overflow-y:auto}
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        .row-div{border:none;border-top:1px solid #1A2035;margin:4px 0}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{animation:fadeUp .25s ease both}
        .spinner{width:20px;height:20px;border:2px solid #1A2035;border-top-color:#60A5FA;border-radius:50%;animation:spin .7s linear infinite;margin:80px auto}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* Topbar */}
      <div style={{ borderBottom: "1px solid #1A2035", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 54, position: "sticky", top: 0, background: "#080B12", zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="1" y="1" width="7" height="7" rx="2" fill="#60A5FA" />
            <rect x="10" y="1" width="7" height="7" rx="2" fill="#60A5FA" opacity=".4" />
            <rect x="1" y="10" width="7" height="7" rx="2" fill="#60A5FA" opacity=".4" />
            <rect x="10" y="10" width="7" height="7" rx="2" fill="#60A5FA" opacity=".2" />
          </svg>
          <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 17, color: "#E8EDF8" }}>DealFlow</span>
          <span style={{ color: "#1A2035", marginLeft: 4 }}>|</span>
          <span style={{ fontSize: 10, color: "#2A3550", letterSpacing: ".1em", textTransform: "uppercase" }}>Sales Pipeline</span>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {["dashboard", "pipeline", "deals"].map(v => (
            <button key={v} className={`tab ${view === v ? "on" : ""}`} onClick={() => setView(v)}>{v}</button>
          ))}
        </div>
        <button className="btn-primary" onClick={openAdd}>+ New Deal</button>
      </div>

      <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }}>
        {loading ? <div className="spinner" /> : (
          <>
            {/* DASHBOARD */}
            {view === "dashboard" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 22 }} className="fade-up">
                <div>
                  <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 26, color: "#E8EDF8", fontStyle: "italic" }}>Good morning</div>
                  <div style={{ fontSize: 11, color: "#2A3550", marginTop: 3, letterSpacing: ".08em" }}>
                    {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase()} · {stats.totalCount} DEALS TRACKED
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                  {[
                    { label: "Active Pipeline", value: fmt(stats.pipeline), sub: `${stats.activeCount} open deals`, color: "#60A5FA" },
                    { label: "Revenue Won", value: fmt(stats.won), sub: `${stats.wonCount} deals closed`, color: "#4ADE80" },
                    { label: "Avg Deal Size", value: fmt(stats.avgDeal), sub: "closed deals only", color: "#FCD34D" },
                    { label: "Win Rate", value: `${stats.winRate}%`, sub: "won vs. lost", color: "#F97316" },
                  ].map(s => (
                    <div key={s.label} className="card" style={{ position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: s.color, opacity: .6 }} />
                      <div style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "#3A4560", marginBottom: 10 }}>{s.label}</div>
                      <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: "#2A3550", marginTop: 5 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="card">
                    <div style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "#3A4560", marginBottom: 18 }}>Stage Breakdown</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                      {stageBreakdown.map(({ stage, count, value }) => {
                        const c = STAGE_CONFIG[stage];
                        return (
                          <div key={stage}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <div style={{ width: 7, height: 7, borderRadius: 2, background: c.color }} />
                                <span style={{ fontSize: 11, color: "#8892AA" }}>{stage}</span>
                                <span style={{ fontSize: 10, color: "#2A3550" }}>({count})</span>
                              </div>
                              <span style={{ fontSize: 11, color: c.color, fontWeight: 500 }}>{fmt(value)}</span>
                            </div>
                            <div style={{ background: "#1A2035", borderRadius: 3, height: 5 }}>
                              <div style={{ height: 5, borderRadius: 3, background: c.color, width: `${(value / maxVal) * 100}%`, transition: "width .6s ease", opacity: value > 0 ? 1 : 0.15 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="card">
                    <div style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "#3A4560", marginBottom: 16 }}>Recent Deals</div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {[...opps].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 6).map((o, i) => {
                        const c = STAGE_CONFIG[o.stage];
                        return (
                          <div key={o.id}>
                            {i > 0 && <hr className="row-div" />}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: "#C0CAE0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</span>
                              </div>
                              <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                                <span className="pill" style={{ background: c.bg, color: c.color }}>{o.stage}</span>
                                <span style={{ fontSize: 12, color: "#E8EDF8", fontWeight: 500, minWidth: 70, textAlign: "right" }}>{fmt(o.value)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {opps.length === 0 && <div style={{ fontSize: 12, color: "#2A3550", textAlign: "center", padding: "24px 0" }}>No deals yet — add your first one!</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PIPELINE */}
            {view === "pipeline" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="fade-up">
                <div>
                  <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 26, color: "#E8EDF8", fontStyle: "italic" }}>Pipeline</div>
                  <div style={{ fontSize: 11, color: "#2A3550", marginTop: 3, letterSpacing: ".08em" }}>MOVE DEALS THROUGH STAGES</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
                  {STAGES.map(stage => {
                    const c = STAGE_CONFIG[stage];
                    const list = opps.filter(o => o.stage === stage);
                    const total = list.reduce((s, o) => s + o.value, 0);
                    return (
                      <div key={stage} style={{ minWidth: 158 }}>
                        <div style={{ background: c.bg, border: `1px solid ${c.color}30`, borderRadius: 7, padding: "8px 10px", marginBottom: 10 }}>
                          <div style={{ fontSize: 10, letterSpacing: ".07em", textTransform: "uppercase", color: c.color, marginBottom: 2 }}>{stage}</div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 10, color: "#3A4560" }}>{list.length} deal{list.length !== 1 ? "s" : ""}</span>
                            <span style={{ fontSize: 11, color: c.color, fontWeight: 500 }}>{fmt(total)}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {list.map(o => (
                            <div key={o.id} style={{ background: "#0E1220", border: `1px solid ${c.color}25`, borderRadius: 7, padding: 12 }}>
                              <div style={{ fontSize: 12, color: "#C0CAE0", fontWeight: 500, lineHeight: 1.35, marginBottom: 5 }}>{o.name}</div>
                              <div style={{ fontSize: 10, color: "#3A4560", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.contact}</div>
                              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 16, color: c.color, marginBottom: 8 }}>{fmt(o.value)}</div>
                              <div style={{ display: "flex", gap: 5 }}>
                                <button className="btn-ghost" style={{ flex: 1, fontSize: 12 }} onClick={() => moveStage(o.id, -1)}>←</button>
                                <button className="btn-ghost" style={{ flex: 1, fontSize: 12 }} onClick={() => moveStage(o.id, 1)}>→</button>
                                <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => openEdit(o)}>✎</button>
                              </div>
                            </div>
                          ))}
                          {list.length === 0 && (
                            <div style={{ border: `1px dashed ${c.color}20`, borderRadius: 7, padding: "20px 8px", textAlign: "center", fontSize: 10, color: "#1E2840" }}>EMPTY</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DEALS */}
            {view === "deals" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="fade-up">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 26, color: "#E8EDF8", fontStyle: "italic" }}>All Deals</div>
                    <div style={{ fontSize: 11, color: "#2A3550", marginTop: 3, letterSpacing: ".08em" }}>{filtered.length} RESULTS</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="fi" style={{ width: 190 }} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
                    <select className="fi" style={{ width: 145 }} value={filterStage} onChange={e => setFilterStage(e.target.value)}>
                      <option value="All">All Stages</option>
                      {STAGES.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <select className="fi" style={{ width: 120 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
                      <option value="date">Sort: Date</option>
                      <option value="value">Sort: Value</option>
                      <option value="stage">Sort: Stage</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr auto", gap: 12, padding: "6px 16px", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "#2A3550" }}>
                  <span>Deal</span><span>Contact</span><span>Stage</span><span style={{ textAlign: "right" }}>Value</span><span>Date</span><span />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {filtered.map(o => {
                    const c = STAGE_CONFIG[o.stage];
                    return (
                      <div key={o.id} className="opp-card" style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr auto", gap: 12, alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 13, color: "#C0CAE0", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.name}</div>
                          {o.notes && <div style={{ fontSize: 10, color: "#3A4560", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.notes}</div>}
                        </div>
                        <div style={{ fontSize: 11, color: "#3A4560", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.contact}</div>
                        <span className="pill" style={{ background: c.bg, color: c.color, justifySelf: "start" }}>{o.stage}</span>
                        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 15, color: "#E8EDF8", textAlign: "right" }}>{fmt(o.value)}</div>
                        <div style={{ fontSize: 11, color: "#3A4560" }}>{o.date}</div>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button className="btn-ghost" onClick={() => openEdit(o)}>✎</button>
                          <button className="btn-ghost" style={{ color: "#F87171", borderColor: "#F8717120" }} onClick={() => deleteOpp(o.id)}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                  {filtered.length === 0 && <div style={{ textAlign: "center", padding: "48px", color: "#2A3550", fontSize: 12 }}>No deals match your filters</div>}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* FORM MODAL */}
      {showForm && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal fade-up">
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: "#E8EDF8", marginBottom: 22, fontStyle: "italic" }}>
              {editId !== null ? "Edit Deal" : "Add New Deal"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="lbl">Deal Name *</label>
                <input className="fi" value={form.name} onChange={f("name")} placeholder="e.g. Acme Corp Enterprise License" />
              </div>
              <div className="g2">
                <div>
                  <label className="lbl">Contact Email</label>
                  <input className="fi" value={form.contact} onChange={f("contact")} placeholder="contact@company.com" />
                </div>
                <div>
                  <label className="lbl">Deal Value *</label>
                  <input className="fi" type="number" value={form.value} onChange={f("value")} placeholder="0" />
                </div>
              </div>
              <div className="g2">
                <div>
                  <label className="lbl">Stage</label>
                  <select className="fi" value={form.stage} onChange={f("stage")}>
                    {STAGES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl">Date</label>
                  <input className="fi" type="date" value={form.date} onChange={f("date")} />
                </div>
              </div>
              <div>
                <label className="lbl">Notes</label>
                <textarea className="fi" rows={3} value={form.notes} onChange={f("notes")} placeholder="Key context from the email…" style={{ resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
                <button className="btn-ghost" style={{ padding: "8px 16px" }} onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn-primary" disabled={saving} onClick={saveOpp}>{saving ? "Saving…" : editId !== null ? "Save Changes" : "Add Deal"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
