"use client";
import { useState, useEffect } from "react";

const ROOMS_F1 = ["A01","A02","A03","A04","A05","A06","A07","A08"];
const ROOMS_F2 = ["B01","B02","B03","B04","B05","B06","B07","B08","B09","B10","B11"];
const ALL = [...ROOMS_F1, ...ROOMS_F2];

// === SAME DATE PARSER AS MAIN PAGE ===
function parseDate(s) {
  if (!s || !s.trim()) return null;
  s = s.trim();
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split(/[-/]/);
    const dt = new Date(+y, +m - 1, +d);
    return isNaN(dt) ? null : dt;
  }
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(s)) {
    const [d, m, y] = s.split(/[-/]/);
    const dt = new Date(+y, +m - 1, +d);
    return isNaN(dt) ? null : dt;
  }
  const dt = new Date(s);
  return isNaN(dt) ? null : dt;
}

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

const fmtD = s => { const d = parseDate(s); if (!d) return "\u2014"; return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }); };
const fmtDD = d => { const dd = String(d.getDate()).padStart(2, "0"), mm = String(d.getMonth() + 1).padStart(2, "0"), yy = d.getFullYear(); return dd + "-" + mm + "-" + yy; };

// ============================================================
// IMPORTANT: Replace this URL with your Apps Script Web App URL
// ============================================================
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwV-kmj0c1sqj-fMesdALQND5Y9jUZHkT5MPBBRfgo1MCESa66MAAp8RHc6FTtiUn13/exec";

export default function ReminderPage() {
  const now = new Date();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [extending, setExtending] = useState({}); // { room: "loading" | "success" | "error" }
  const [confirmModal, setConfirmModal] = useState(null); // tenant to confirm
  const [notExtend, setNotExtend] = useState({}); // rooms marked "tidak perpanjang"

  async function fetchData() {
    try {
      const r = await fetch("/api/sheet");
      if (!r.ok) throw new Error("API returned " + r.status);
      const ct = r.headers.get("content-type") || "";
      const t = await r.text();
      if (ct.includes("json") || t.startsWith("{")) { const err = JSON.parse(t); throw new Error(err.error || "Unknown API error"); }
      const d = parseCSV(t);
      if (d.length) { setTenants(d); setError(""); }
      else { setError("No data found."); }
    } catch (e) { setError("Failed: " + e.message); }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  // Find active tenants with dateEnd within next 5 days (or already past)
  const expiring = tenants.filter(t => {
    if (t.status !== "active") return false;
    const end = parseDate(t.dateEnd);
    if (!end) return false;
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return diff <= 5;
  }).sort((a, b) => {
    const ea = parseDate(a.dateEnd) || new Date(0);
    const eb = parseDate(b.dateEnd) || new Date(0);
    return ea - eb;
  });

  const getDaysLeft = (t) => {
    const end = parseDate(t.dateEnd);
    if (!end) return null;
    return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  };

  async function handleExtend(tenant) {
    setExtending(prev => ({ ...prev, [tenant.room]: "loading" }));
    try {
      const endDate = parseDate(tenant.dateEnd);
      const newEnd = new Date(endDate);
      newEnd.setDate(newEnd.getDate() + 30);

      const resp = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          action: "extend",
          room: tenant.room,
          newDateEnd: fmtDD(newEnd),
          newDateJoined: fmtDD(endDate),
        }),
      });

      const result = await resp.json();
      if (result.success) {
        setExtending(prev => ({ ...prev, [tenant.room]: "success" }));
        // Refresh data after 2 seconds to let Google Sheets propagate
        setTimeout(() => fetchData(), 3000);
      } else {
        throw new Error(result.error || "Unknown error");
      }
    } catch (e) {
      console.error("Extend error:", e);
      setExtending(prev => ({ ...prev, [tenant.room]: "error" }));
    }
    setConfirmModal(null);
  }

  const getStatusColor = (days) => {
    if (days < 0) return "#D94A6B"; // overdue - red
    if (days === 0) return "#D94A6B"; // today - red
    if (days <= 2) return "#E8913A"; // 1-2 days - orange
    return "#D9C84A"; // 3-5 days - yellow
  };

  const getStatusLabel = (days) => {
    if (days < 0) return `${Math.abs(days)} hari lewat!`;
    if (days === 0) return "Habis hari ini!";
    if (days === 1) return "Besok habis!";
    return `${days} hari lagi`;
  };

  if (loading) return (
    <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", background: "#0F1117", color: "#6B7186", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: "40px", height: "40px", border: "3px solid #23262F", borderTop: "3px solid #4A90D9", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <span>Loading reminder data...</span>
    </div>
  );

  return (
    <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", background: "#0F1117", color: "#E8E9ED", minHeight: "100vh" }}>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .card:hover{border-color:#4A90D9 !important;transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.3) !important}
        .nav-btn{background:none;border:none;color:#6B7186;font-size:14px;font-weight:600;cursor:pointer;padding:10px 16px;border-bottom:2px solid transparent;font-family:'DM Sans',system-ui,sans-serif;transition:all 0.2s}
        .nav-btn:hover{color:#E8E9ED}
        .nav-btn.active{color:#4A90D9;border-bottom-color:#4A90D9}
        .ext-btn{border:none;border-radius:10px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;transition:all 0.2s;font-family:'DM Sans',system-ui,sans-serif}
        .ext-btn:hover{transform:scale(1.03)}
        .ext-btn:active{transform:scale(0.97)}
      `}</style>

      {/* Header */}
      <div style={{ padding: "20px 24px 0" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "-0.5px" }}>Kostkostan</h1>
        <p style={{ fontSize: "12px", color: "#6B7186", margin: "2px 0 0", fontFamily: "'JetBrains Mono',monospace" }}>Occupancy Dashboard</p>
      </div>

      {/* Navigation Tabs */}
      <div style={{ padding: "12px 24px 0", display: "flex", gap: "0", borderBottom: "1px solid #23262F" }}>
        <a href="/" style={{ textDecoration: "none" }}><button className="nav-btn">📊 Dashboard</button></a>
        <button className="nav-btn active" style={{ color: "#4A90D9", borderBottomColor: "#4A90D9", position: "relative" }}>
          🔔 Reminder
          {expiring.length > 0 && (
            <span style={{ position: "absolute", top: "4px", right: "4px", background: "#D94A6B", color: "#fff", fontSize: "10px", fontWeight: 700, borderRadius: "50%", width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center" }}>{expiring.length}</span>
          )}
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>

        {/* Title section */}
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#E8E9ED", margin: "0 0 6px" }}>
            🔔 Kamar Segera Habis
          </h2>
          <p style={{ fontSize: "13px", color: "#6B7186", margin: 0 }}>
            Kamar dengan kontrak berakhir dalam 5 hari ke depan. Perpanjang atau biarkan berakhir.
          </p>
        </div>

        {error && <div style={{ marginBottom: "16px", padding: "12px 16px", background: "rgba(217,74,107,0.1)", border: "1px solid rgba(217,74,107,0.2)", borderRadius: "8px", color: "#D94A6B", fontSize: "13px" }}>{error}</div>}

        {expiring.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: "60px 20px", background: "#14161E", borderRadius: "16px", border: "1px solid #23262F" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
            <h3 style={{ fontSize: "18px", color: "#5BBD72", margin: "0 0 8px" }}>Semua aman!</h3>
            <p style={{ fontSize: "14px", color: "#6B7186", margin: 0 }}>Tidak ada kamar yang akan habis dalam 5 hari ke depan.</p>
          </div>
        )}

        {/* Expiring cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {expiring.map(t => {
            const days = getDaysLeft(t);
            const color = getStatusColor(days);
            const state = extending[t.room];
            const declined = notExtend[t.room];

            return (
              <div key={t.room} className="card" style={{
                background: "#14161E",
                borderRadius: "14px",
                border: "1px solid #23262F",
                padding: "20px",
                transition: "all 0.2s",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                opacity: state === "success" ? 0.6 : 1,
                animation: "slideUp 0.3s ease-out",
              }}>
                {/* Top: Room + Status badge */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "16px", fontWeight: 700, color: "#E8E9ED" }}>{t.room}</span>
                    <span style={{ fontSize: "15px", fontWeight: 600, color: "#E8E9ED" }}>{t.name}</span>
                  </div>
                  <div style={{
                    background: color + "18",
                    border: "1px solid " + color + "44",
                    borderRadius: "20px",
                    padding: "4px 12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: color,
                    animation: days <= 1 ? "pulse 1.5s infinite" : "none",
                  }}>
                    ⏰ {getStatusLabel(days)}
                  </div>
                </div>

                {/* Info row */}
                <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "16px", fontSize: "13px" }}>
                  <div>
                    <span style={{ color: "#6B7186" }}>Masuk: </span>
                    <span style={{ color: "#8B8FA3", fontFamily: "'JetBrains Mono',monospace" }}>{fmtD(t.dateJoined)}</span>
                  </div>
                  <div>
                    <span style={{ color: "#6B7186" }}>Habis: </span>
                    <span style={{ color: color, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>{fmtD(t.dateEnd)}</span>
                  </div>
                  {t.phone && <div>
                    <span style={{ color: "#6B7186" }}>HP: </span>
                    <span style={{ color: "#8B8FA3" }}>{t.phone}</span>
                  </div>}
                </div>

                {/* Action buttons */}
                {state === "success" ? (
                  <div style={{ background: "rgba(91,189,114,0.1)", border: "1px solid rgba(91,189,114,0.2)", borderRadius: "10px", padding: "12px 16px", textAlign: "center", color: "#5BBD72", fontSize: "14px", fontWeight: 600 }}>
                    ✅ Berhasil diperpanjang +30 hari
                  </div>
                ) : state === "error" ? (
                  <div style={{ background: "rgba(217,74,107,0.1)", border: "1px solid rgba(217,74,107,0.2)", borderRadius: "10px", padding: "12px 16px", textAlign: "center" }}>
                    <span style={{ color: "#D94A6B", fontSize: "13px" }}>❌ Gagal perpanjang. </span>
                    <button onClick={() => setExtending(prev => { const n = {...prev}; delete n[t.room]; return n; })} style={{ background: "none", border: "none", color: "#4A90D9", cursor: "pointer", fontSize: "13px", textDecoration: "underline" }}>Coba lagi</button>
                  </div>
                ) : state === "loading" ? (
                  <div style={{ textAlign: "center", padding: "12px", color: "#6B7186", fontSize: "13px" }}>
                    <span style={{ display: "inline-block", animation: "spin 1s linear infinite", marginRight: "8px" }}>⏳</span>
                    Sedang memproses perpanjangan...
                  </div>
                ) : declined ? (
                  <div style={{ background: "rgba(107,113,134,0.1)", border: "1px solid rgba(107,113,134,0.2)", borderRadius: "10px", padding: "12px 16px", textAlign: "center" }}>
                    <span style={{ color: "#6B7186", fontSize: "13px" }}>Ditandai tidak perpanjang. </span>
                    <button onClick={() => setNotExtend(prev => { const n = {...prev}; delete n[t.room]; return n; })} style={{ background: "none", border: "none", color: "#4A90D9", cursor: "pointer", fontSize: "13px", textDecoration: "underline" }}>Batal</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button className="ext-btn" onClick={() => setConfirmModal(t)} style={{ flex: 1, background: "linear-gradient(135deg, #5BBD72, #4A9D62)", color: "#fff" }}>
                      ✅ Perpanjang 30 Hari
                    </button>
                    <button className="ext-btn" onClick={() => setNotExtend(prev => ({ ...prev, [t.room]: true }))} style={{ flex: 1, background: "#23262F", color: "#8B8FA3" }}>
                      ❌ Tidak Perpanjang
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Info note */}
        <div style={{ marginTop: "24px", padding: "16px", background: "rgba(74,144,217,0.06)", border: "1px solid rgba(74,144,217,0.15)", borderRadius: "12px", fontSize: "12px", color: "#6B7186" }}>
          <strong style={{ color: "#4A90D9" }}>ℹ️ Info:</strong> Halaman ini menampilkan kamar yang akan habis dalam 5 hari ke depan. Tekan "Perpanjang 30 Hari" untuk otomatis update tanggal di Google Sheets. Data diambil dari Google Sheets dan di-refresh setiap 5 menit.
        </div>
      </div>

      {/* Confirm Modal */}
      {confirmModal && (
        <div onClick={() => setConfirmModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px", animation: "fadeIn 0.2s" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1A1D27", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "400px", border: "1px solid #2A2D37", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", animation: "slideUp 0.25s" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>Konfirmasi Perpanjangan</h3>
            <p style={{ fontSize: "14px", color: "#6B7186", margin: "0 0 20px" }}>
              Perpanjang kamar <strong style={{ color: "#E8E9ED" }}>{confirmModal.room}</strong> ({confirmModal.name}) selama 30 hari?
            </p>

            <div style={{ background: "#14161E", borderRadius: "10px", padding: "14px", marginBottom: "20px", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "#6B7186" }}>Tanggal habis lama:</span>
                <span style={{ color: "#D94A6B", fontFamily: "'JetBrains Mono',monospace" }}>{fmtD(confirmModal.dateEnd)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6B7186" }}>Tanggal habis baru:</span>
                <span style={{ color: "#5BBD72", fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>
                  {(() => { const e = parseDate(confirmModal.dateEnd); if (!e) return "\u2014"; const ne = new Date(e); ne.setDate(ne.getDate() + 30); return ne.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }); })()}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setConfirmModal(null)} className="ext-btn" style={{ flex: 1, background: "#23262F", color: "#8B8FA3" }}>Batal</button>
              <button onClick={() => handleExtend(confirmModal)} className="ext-btn" style={{ flex: 1, background: "linear-gradient(135deg, #5BBD72, #4A9D62)", color: "#fff" }}>Ya, Perpanjang</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
