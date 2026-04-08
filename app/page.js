"use client";
import { useState, useEffect, useRef } from "react";

const ROOMS_F1 = ["A01","A02","A03","A04","A05","A06","A07","A08"];
const ROOMS_F2 = ["B01","B02","B03","B04","B05","B06","B07","B08","B09","B10","B11"];
const ALL = [...ROOMS_F1, ...ROOMS_F2];
const COLORS = ["#4A90D9","#E8913A","#5BBD72","#D94A6B","#9B6DD9","#D9C84A","#4AD9C8","#D96A4A","#6A8FD9","#D94ABF","#4AD96A","#D9A84A","#4A6DD9","#D94A4A","#8FD94A","#D96AD9","#4AD9A8","#BDD94A","#6A4AD9","#D9BD4A"];
const gc = id => COLORS[id % COLORS.length];

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/['"]/g, "").replace(/ /g, "_"));
  return lines.slice(1).map((line, idx) => {
    const vals = []; let cur = "", inQ = false;
    for (const c of line) { if (c === '"') inQ = !inQ; else if (c === ',' && !inQ) { vals.push(cur.trim()); cur = ""; } else cur += c; }
    vals.push(cur.trim());
    const o = {}; headers.forEach((h, i) => { o[h] = (vals[i] || "").replace(/^['"]|['"]$/g, ""); });
    return { id: idx + 1, room: (o.room || "").toUpperCase().trim(), name: o.name || "", phone: o.phone || "", dateJoined: o.date_joined || "", dateEnd: o.date_end || "", status: (o.status || "vacant").toLowerCase().trim(), notes: o.notes || "" };
  }).filter(t => t.room && ALL.includes(t.room));
}

const mdays = (y, m) => new Date(y, m + 1, 0).getDate();
const fmtD = s => { if (!s) return "\u2014"; const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }); };
const getDow = (y, m, d) => new Date(y, m, d).getDay();
const inDay = (t, y, m, d) => { if (!t.dateJoined) return false; const c = new Date(y, m, d), j = new Date(t.dateJoined), e = t.dateEnd ? new Date(t.dateEnd) : new Date(2099, 11, 31); return !isNaN(j) && c >= j && c <= e; };

function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
      <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>{icon}</span>
      <div>
        <div style={{ fontSize: "10px", color: "#6B7186", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>{label}</div>
        <div style={{ fontSize: "14px", color: "#E8E9ED", fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const now = new Date();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [vy, setVy] = useState(now.getFullYear());
  const [vm, setVm] = useState(now.getMonth());
  const [sel, setSel] = useState(null);
  const [modal, setModal] = useState(false);
  const [floor, setFloor] = useState("all");

  async function fetchData(showSpinner) {
    if (showSpinner) setIsRefreshing(true);
    try {
      const r = await fetch("/api/sheet");
      if (!r.ok) throw new Error("API returned " + r.status);
      const ct = r.headers.get("content-type") || "";
      const t = await r.text();
      // Check if it's JSON error
      if (ct.includes("json") || t.startsWith("{")) {
        const err = JSON.parse(t);
        throw new Error(err.error || "Unknown API error");
      }
      const d = parseCSV(t);
      if (d.length) { setTenants(d); setLastRefresh(new Date()); setError(""); }
      else { setError("No tenant data found. Add data to Google Sheet."); }
    } catch (e) { setError("Failed: " + e.message); }
    setLoading(false);
    setIsRefreshing(false);
  }

  useEffect(() => { fetchData(false); }, []);
  useEffect(() => { const iv = setInterval(() => fetchData(false), 5 * 60 * 1000); return () => clearInterval(iv); }, []);

  const dim = mdays(vy, vm);
  const mn = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const dn = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
  const rooms = floor === "1" ? ROOMS_F1 : floor === "2" ? ROOMS_F2 : ALL;
  const active = tenants.filter(t => t.status === "active");
  const occSet = new Set(active.map(t => t.room));
  const occRate = ALL.length ? Math.round((occSet.size / ALL.length) * 100) : 0;
  const vacant = ALL.filter(r => !occSet.has(r));
  const cw = 38, rw = 72;

  const rTenants = room => tenants.filter(t => t.room === room).sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (b.status === "active" && a.status !== "active") return 1;
    return new Date(b.dateJoined || 0) - new Date(a.dateJoined || 0);
  });
  const activeIn = room => tenants.find(t => t.room === room && t.status === "active");

  if (loading) return (
    <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", background: "#0F1117", color: "#6B7186", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: "40px", height: "40px", border: "3px solid #23262F", borderTop: "3px solid #4A90D9", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <span>Loading from Google Sheets...</span>
    </div>
  );

  if (error && tenants.length === 0) return (
    <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", background: "#0F1117", color: "#E8E9ED", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ background: "#14161E", border: "1px solid #23262F", borderRadius: "20px", padding: "40px", maxWidth: "420px", width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
        <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>Connection Error</h2>
        <p style={{ color: "#D94A6B", fontSize: "13px", marginBottom: "8px", fontFamily: "'JetBrains Mono',monospace", wordBreak: "break-all" }}>{error}</p>
        <p style={{ color: "#6B7186", fontSize: "13px", marginBottom: "24px" }}>Make sure the Google Sheet is published to web and contains data.</p>
        <button onClick={() => { setLoading(true); setError(""); fetchData(false); }} style={{ background: "linear-gradient(135deg,#4A90D9,#3A7BC8)", color: "#fff", border: "none", borderRadius: "10px", padding: "12px 24px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>Retry</button>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif", background: "#0F1117", color: "#E8E9ED", minHeight: "100vh", padding: 0, overflow: "hidden" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{height:8px;width:8px}
        ::-webkit-scrollbar-track{background:#1A1D27;border-radius:4px}
        ::-webkit-scrollbar-thumb{background:#3A3F4F;border-radius:4px}
        ::-webkit-scrollbar-thumb:hover{background:#4A90D9}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .tb:hover{filter:brightness(1.2);transform:translateY(-1px);box-shadow:0 3px 12px rgba(0,0,0,0.4)}
      `}</style>

      {/* Header */}
      <div style={{ padding: "20px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.5px", color: "#fff" }}>Kostkostan</h1>
          <p style={{ fontSize: "12px", color: "#6B7186", marginTop: "2px", fontFamily: "'JetBrains Mono',monospace" }}>Occupancy Dashboard</p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ background: occRate > 80 ? "rgba(91,189,114,0.12)" : occRate > 50 ? "rgba(232,145,58,0.12)" : "rgba(217,74,107,0.12)", border: "1px solid " + (occRate > 80 ? "rgba(91,189,114,0.25)" : occRate > 50 ? "rgba(232,145,58,0.25)" : "rgba(217,74,107,0.25)"), borderRadius: "20px", padding: "6px 14px", fontSize: "13px", fontWeight: 600 }}>
            <span style={{ color: occRate > 80 ? "#5BBD72" : occRate > 50 ? "#E8913A" : "#D94A6B" }}>{occRate}%</span>
            <span style={{ color: "#6B7186", marginLeft: "6px", fontWeight: 400 }}>occupied</span>
          </div>
          <div style={{ background: "rgba(74,144,217,0.08)", border: "1px solid rgba(74,144,217,0.2)", borderRadius: "20px", padding: "6px 14px", fontSize: "13px" }}>
            <span style={{ fontWeight: 600, color: "#4A90D9" }}>{occSet.size}</span><span style={{ color: "#6B7186" }}>/{ALL.length}</span>
          </div>
          <div style={{ background: "rgba(217,74,107,0.08)", border: "1px solid rgba(217,74,107,0.2)", borderRadius: "20px", padding: "6px 14px", fontSize: "13px" }}>
            <span style={{ fontWeight: 600, color: "#D94A6B" }}>{vacant.length}</span><span style={{ color: "#6B7186", marginLeft: "4px" }}>vacant</span>
          </div>
          <button onClick={() => fetchData(true)} disabled={isRefreshing} title="Refresh" style={{ background: "#1A1D27", border: "1px solid #23262F", borderRadius: "8px", width: "34px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "16px", animation: isRefreshing ? "spin 1s linear infinite" : "none" }}>🔄</button>
        </div>
      </div>
      {lastRefresh && <div style={{ padding: "4px 24px 0", fontSize: "10px", color: "#4A5568", fontFamily: "'JetBrains Mono',monospace" }}>Last synced: {lastRefresh.toLocaleTimeString("id-ID")}</div>}

      {/* Controls */}
      <div style={{ padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button onClick={() => { if (vm === 0) { setVm(11); setVy(y => y - 1); } else setVm(m => m - 1); }} style={{ background: "#1A1D27", color: "#E8E9ED", borderRadius: "8px", width: "34px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", border: "none", cursor: "pointer" }}>◀</button>
          <div style={{ background: "#1A1D27", borderRadius: "8px", padding: "7px 16px", fontWeight: 600, fontSize: "15px", minWidth: "150px", textAlign: "center", fontFamily: "'JetBrains Mono',monospace" }}>{mn[vm]} {vy}</div>
          <button onClick={() => { if (vm === 11) { setVm(0); setVy(y => y + 1); } else setVm(m => m + 1); }} style={{ background: "#1A1D27", color: "#E8E9ED", borderRadius: "8px", width: "34px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", border: "none", cursor: "pointer" }}>▶</button>
          <button onClick={() => { setVy(now.getFullYear()); setVm(now.getMonth()); }} style={{ background: "rgba(74,144,217,0.1)", color: "#4A90D9", borderRadius: "8px", padding: "7px 12px", fontSize: "12px", fontWeight: 600, border: "none", cursor: "pointer" }}>Today</button>
        </div>
        <div style={{ display: "flex", gap: "4px", background: "#1A1D27", borderRadius: "10px", padding: "3px" }}>
          {[{ k: "all", l: "All" }, { k: "1", l: "Lantai 1" }, { k: "2", l: "Lantai 2" }].map(f => (
            <button key={f.k} onClick={() => setFloor(f.k)} style={{ background: floor === f.k ? "#4A90D9" : "transparent", color: floor === f.k ? "#fff" : "#6B7186", border: "none", borderRadius: "8px", padding: "6px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>{f.l}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ padding: "0 24px 24px" }}>
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 220px)", borderRadius: "12px", border: "1px solid #23262F", background: "#14161E" }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "max-content", minWidth: "100%" }}>
            <thead><tr>
              <th style={{ position: "sticky", left: 0, top: 0, zIndex: 20, background: "#1A1D27", width: rw, minWidth: rw, padding: "10px 12px", fontSize: "11px", fontWeight: 600, color: "#6B7186", textAlign: "left", borderBottom: "1px solid #23262F", borderRight: "2px solid #23262F", fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase", letterSpacing: "1px" }}>Room</th>
              {Array.from({ length: dim }, (_, i) => {
                const d = i + 1, dw = getDow(vy, vm, d), isT = vy === now.getFullYear() && vm === now.getMonth() && d === now.getDate(), isW = dw === 0 || dw === 6;
                return <th key={d} style={{ position: "sticky", top: 0, zIndex: 10, background: isT ? "rgba(74,144,217,0.15)" : "#1A1D27", width: cw, minWidth: cw, padding: "6px 2px", textAlign: "center", borderBottom: "1px solid #23262F", borderLeft: "1px solid #1E2029" }}>
                  <div style={{ fontSize: "9px", fontWeight: 500, color: isW ? "#D94A6B55" : "#6B718655", fontFamily: "'JetBrains Mono',monospace" }}>{dn[dw]}</div>
                  <div style={{ fontSize: "13px", fontWeight: isT ? 700 : 500, fontFamily: "'JetBrains Mono',monospace", ...(isT ? { background: "#4A90D9", color: "#fff", borderRadius: "50%", width: "24px", height: "24px", lineHeight: "24px", margin: "2px auto 0" } : { color: isW ? "#D94A6B88" : "#8B8FA3" }) }}>{d}</div>
                </th>;
              })}
            </tr></thead>
            <tbody>
              {rooms.map(room => {
                const fb = room === "B01" && floor === "all";
                const rts = rTenants(room);
                const vac = !activeIn(room);
                return <tr key={room} style={{ borderTop: fb ? "3px solid #4A90D922" : undefined }}>
                  <td style={{ position: "sticky", left: 0, zIndex: 5, background: "#14161E", width: rw, minWidth: rw, padding: "0 10px", borderBottom: "1px solid #1E2029", borderRight: "2px solid #23262F", height: "44px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", fontWeight: 600, color: vac ? "#D94A6B88" : "#E8E9ED" }}>{room}</span>
                      {vac && <span style={{ fontSize: "8px", background: "rgba(217,74,107,0.12)", color: "#D94A6B", padding: "2px 6px", borderRadius: "4px", fontWeight: 600, textTransform: "uppercase" }}>Empty</span>}
                    </div>
                  </td>
                  {Array.from({ length: dim }, (_, i) => {
                    const d = i + 1, isT = vy === now.getFullYear() && vm === now.getMonth() && d === now.getDate();
                    const ct = rts.find(t => inDay(t, vy, vm, d));
                    const pt = d > 1 ? rts.find(t => inDay(t, vy, vm, d - 1)) : null;
                    const isS = ct && (!pt || pt.id !== ct.id);
                    let bl = 0; if (isS && ct) { for (let dd = d; dd <= dim; dd++) { const tt = rts.find(t2 => inDay(t2, vy, vm, dd)); if (tt && tt.id === ct.id) bl++; else break; } }
                    return <td key={d} style={{ position: "relative", padding: 0, width: cw, minWidth: cw, height: "44px", borderBottom: "1px solid #1E2029", borderLeft: "1px solid #1A1C24", background: isT ? "rgba(74,144,217,0.05)" : "transparent" }}>
                      {isS && ct && ct.name && <div className="tb" onClick={() => { setSel(ct); setModal(true); }}
                        style={{ position: "absolute", top: "4px", left: "2px", height: "calc(100% - 8px)", width: (bl * cw - 4) + "px", background: "linear-gradient(135deg," + gc(ct.id) + "," + gc(ct.id) + "CC)", borderRadius: "6px", zIndex: 3, display: "flex", alignItems: "center", padding: "0 8px", overflow: "hidden", cursor: "pointer", boxShadow: "0 2px 8px " + gc(ct.id) + "33", transition: "all 0.15s" }}>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>{ct.name}</span>
                      </div>}
                      {isT && <div style={{ position: "absolute", top: 0, left: "50%", width: "2px", height: "100%", background: "#4A90D9", zIndex: 1, opacity: 0.4 }} />}
                    </td>;
                  })}
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ padding: "0 24px 20px", display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "11px", color: "#6B7186" }}>
        <span>Click tenant blocks for details</span>
        <span style={{ color: "#5BBD72" }}>✓ Connected to Google Sheets</span>
      </div>

      {modal && sel && <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px", animation: "fadeIn 0.2s" }}>
        <div onClick={e => e.stopPropagation()} style={{ background: "#1A1D27", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "380px", border: "1px solid #2A2D37", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", animation: "slideUp 0.25s" }}>
          <div style={{ height: "4px", width: "60px", borderRadius: "2px", background: gc(sel.id), marginBottom: "20px" }} />
          <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", marginBottom: "4px" }}>{sel.name || "Vacant"}</h3>
          <p style={{ fontSize: "13px", fontFamily: "'JetBrains Mono',monospace", color: "#6B7186", marginBottom: "20px" }}>
            Room {sel.room} · {sel.status === "active" ? "🟢 Active" : sel.status === "ended" ? "🔴 Ended" : "⚪ Vacant"}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <InfoRow icon="📱" label="Phone" value={sel.phone || "\u2014"} />
            <InfoRow icon="📅" label="Joined" value={fmtD(sel.dateJoined)} />
            {sel.dateEnd && <InfoRow icon="🚪" label="Ended" value={fmtD(sel.dateEnd)} />}
            {sel.dateJoined && !sel.dateEnd && <InfoRow icon="⏱️" label="Duration" value={(() => { const j = new Date(sel.dateJoined), df = now - j, mo = Math.floor(df / (1000 * 60 * 60 * 24 * 30.44)), dy = Math.floor((df % (1000 * 60 * 60 * 24 * 30.44)) / (1000 * 60 * 60 * 24)); return mo + " bulan, " + dy + " hari"; })()} />}
            {sel.notes && <InfoRow icon="📝" label="Notes" value={sel.notes} />}
          </div>
          <button onClick={() => setModal(false)} style={{ marginTop: "24px", width: "100%", background: "#23262F", border: "none", color: "#8B8FA3", borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Close</button>
        </div>
      </div>}
    </div>
  );
}
