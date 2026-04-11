import { useState, useMemo } from "react";

const fl = document.createElement("link");
fl.rel = "stylesheet";
fl.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&display=swap";
document.head.appendChild(fl);

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const K        = 5000;
const BLUE_AOV = 700,  RED_AOV  = 280;
const BLUE_R   = 0.07, RED_R    = 0.18;
const DC_OWN   = 18,   DC_ADJ   = 42;
const AVG_KMH  = 20,   HANDLE   = 5;
const HS       = 54;
const PX_KM    = HS * 1.75;

function rentCost(pop) {
  const t = Math.max(0, Math.min(1, (pop - 1500) / (5200 - 1500)));
  return Math.round((16000 + t * 32000) / 1000) * 1000;
}

// Segment colour of a hex: blue-heavy → blue, red-heavy → red, mixed → purple
function hexSegColor(bp) {
  if (bp >= 0.65) return "#2563EB";
  if (bp <= 0.35) return "#DC2626";
  return "#7C3AED"; // mixed
}

function convFn(distPx, isOwn) {
  if (isOwn) return 1.0;
  const km = distPx / PX_KM;
  const m  = (km / AVG_KMH) * 60 + HANDLE;
  if (m <= 12) return 0.60;
  if (m <= 20) return 0.45;
  if (m <= 30) return 0.30;
  if (m <= 40) return 0.15;
  return 0;
}

// ── HEX GEOMETRY ──────────────────────────────────────────────────────────────
function hCenter(q, r) {
  return { x: HS*(Math.sqrt(3)*q + (Math.sqrt(3)/2)*r), y: HS*1.5*r };
}
function hPts(cx, cy, s = HS - 2) {
  return Array.from({length:6}, (_,i) => {
    const a = (Math.PI/3)*i + Math.PI/6;
    return `${cx+s*Math.cos(a)},${cy+s*Math.sin(a)}`;
  }).join(" ");
}
function dist(a,b) { return Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2); }
function isAdj(a,b) {
  return [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]]
    .some(([dq,dr]) => a.q+dq===b.q && a.r+dr===b.r);
}

// ── CITY DATA ─────────────────────────────────────────────────────────────────
const HEXES = [
  // Core 4 — mixed (R1+R2)
  { id:0,  q:0,  r:0,  lbl:"A", pop:3400, bp:0.52, rp:0.48 },
  { id:1,  q:1,  r:0,  lbl:"B", pop:2100, bp:0.50, rp:0.50 },
  { id:2,  q:0,  r:1,  lbl:"C", pop:2800, bp:0.10, rp:0.90 },
  { id:3,  q:1,  r:1,  lbl:"D", pop:4200, bp:0.05, rp:0.95 },
  // R3: Blue cluster NW
  { id:4,  q:-1, r:0,  lbl:"E", pop:3100, bp:0.97, rp:0.03 },
  { id:5,  q:-1, r:1,  lbl:"F", pop:2700, bp:0.97, rp:0.03 },
  // R3: Red cluster SE
  { id:6,  q:2,  r:1,  lbl:"G", pop:3700, bp:0.03, rp:0.97 },
  { id:7,  q:1,  r:2,  lbl:"H", pop:2900, bp:0.03, rp:0.97 },
  // R4: fringe Blue
  { id:8,  q:-2, r:0,  lbl:"I", pop:2400, bp:0.97, rp:0.03 },
  { id:9,  q:-2, r:1,  lbl:"J", pop:1800, bp:0.97, rp:0.03 },
  // R4: fringe Red
  { id:10, q:2,  r:2,  lbl:"K", pop:3200, bp:0.03, rp:0.97 },
  { id:11, q:3,  r:1,  lbl:"L", pop:1500, bp:0.03, rp:0.97 },
  // R5 extras
  { id:12, q:0,  r:-1, lbl:"M", pop:2200, bp:0.74, rp:0.26 },
  { id:13, q:1,  r:-1, lbl:"N", pop:4800, bp:0.13, rp:0.87 },
  { id:14, q:2,  r:0,  lbl:"O", pop:3500, bp:0.07, rp:0.93 },
  { id:15, q:-2, r:2,  lbl:"P", pop:2700, bp:0.89, rp:0.11 },
  { id:16, q:0,  r:2,  lbl:"Q", pop:5100, bp:0.10, rp:0.90 },
  { id:17, q:-1, r:2,  lbl:"R", pop:2300, bp:0.83, rp:0.17 },
  { id:18, q:2,  r:-1, lbl:"S", pop:1900, bp:0.45, rp:0.55 },
  { id:19, q:3,  r:0,  lbl:"T", pop:2600, bp:0.08, rp:0.92 },
];

// ── ROUND CONFIG ──────────────────────────────────────────────────────────────
const ROUNDS = {
  1: {
    title:"Where should you place your store?",
    intro:"You're launching a quick-commerce grocery startup. Place one dark store anywhere in the city. Your store automatically delivers to its own neighbourhood (100% conversion) and adjacent hexes (up to 60%). The circle on the map is your operating radius.",
    hexN:4, maxW:1, showSeg:false,
    insight:"A central location minimises average delivery distance and captures partial demand from all adjacent neighbourhoods. A peripheral store serves one area fully but misses the others.",
  },
  2: {
    title:"Who are your customers — and what do you stock?",
    intro:"Two customer segments live in every neighbourhood. The hex colour hints at the dominant segment — blue-tinted hexes skew Blue, red-tinted hexes skew Red. Choose your store's assortment directly on the map by clicking the toggle inside it.",
    hexN:4, maxW:1, showSeg:true,
    insight:"Stocking Both earns from both segments but breaks inventory pooling — you pay ₹5000×√Blue + ₹5000×√Red separately. In a genuinely mixed neighbourhood Both wins. In a skewed one, the minority segment's inventory cost exceeds its revenue.",
  },
  3: {
    title:"One store or two — and for whom?",
    intro:"The city has expanded. The north-west is heavily Blue; the south-east is heavily Red. Should you open a second store, and should each specialise? Toggle assortment directly inside each store hex.",
    hexN:8, maxW:2, showSeg:true,
    insight:"Two specialised stores beat one mixed store when segments are geographically separated. Each pays only one inventory cost, sits closer to its target customers, and avoids the pooling penalty entirely.",
  },
  4: {
    title:"Reaching the city fringe",
    intro:"Four fringe neighbourhoods have appeared. They have no store of their own — they can only be served by an adjacent store's operating radius (at 60% conversion). Look at their segment tint before deciding where to place.",
    hexN:12, maxW:3, showSeg:true,
    insight:"Cross-hex delivery at 60% conversion only pays when the fringe hex is dense AND its dominant segment matches what the adjacent store stocks. A Blue store spilling into a Red-heavy fringe hex earns almost nothing.",
  },
  5: {
    title:"Build your complete network",
    intro:"Full city — 20 neighbourhoods, up to 5 stores. Apply everything: location, segment matching, radius coverage. Build a network that breaks even.",
    hexN:20, maxW:5, showSeg:true,
    insight:"The optimal solution places Blue stores in the NW cluster and Red stores in the SE cluster. Each store's radius naturally covers adjacent fringe hexes. Dense high-rent hexes need more orders to justify their cost.",
  },
};

// ── P&L ENGINE ────────────────────────────────────────────────────────────────
function calcPnL(stores, hexes, showSeg) {
  if (!stores.length) return null;
  const sPos   = stores.map(s=>({...s,...hCenter(s.q,s.r)}));
  const sStats = sPos.map(()=>({blueO:0,redO:0,rev:0,del:0}));
  const hStats = {};

  hexes.forEach(h => {
    const hp  = hCenter(h.q, h.r);
    const blB = showSeg ? h.pop*h.bp*BLUE_R : h.pop*0.12;
    const rdB = showSeg ? h.pop*h.rp*RED_R  : 0;

    let bI=-1, bConv=-1, bOwn=false;
    sPos.forEach((s,i) => {
      const own = h.q===s.q && h.r===s.r;
      const adj = !own && isAdj(h,s);
      if (!own && !adj) return;
      const c = convFn(dist(hp,s), own);
      if (c>bConv) { bConv=c; bI=i; bOwn=own; }
    });

    if (bI<0 || bConv===0) {
      hStats[h.id]={conv:0,rev:0,served:-1,unserved:true}; return;
    }
    const dcR = bOwn ? DC_OWN : DC_ADJ;
    let blueO=0,redO=0,rev=0,del=0;
    if (showSeg) {
      const asr=stores[bI].assortment;
      const cB=asr==="blue"||asr==="both";
      const cR=asr==="red" ||asr==="both";
      if (cB){blueO=blB*bConv; rev+=blueO*BLUE_AOV; del+=blueO*dcR;}
      if (cR){redO =rdB*bConv; rev+=redO *RED_AOV;  del+=redO *dcR;}
    } else {
      blueO=blB*bConv; rev=blueO*490; del=blueO*dcR;
    }
    sStats[bI].blueO+=blueO; sStats[bI].redO+=redO;
    sStats[bI].rev+=rev;     sStats[bI].del+=del;
    hStats[h.id]={conv:bConv,rev,served:bI,unserved:false,own:bOwn};
  });

  let tR=0,tD=0,tI=0,tF=0;
  const wS=sStats.map((s,i)=>{
    const asr=stores[i].assortment||"both";
    const hx =HEXES.find(h=>h.q===stores[i].q&&h.r===stores[i].r);
    const fix=rentCost(hx?.pop||3000);
    const inv=!showSeg
      ? K*Math.sqrt(Math.max(0,s.blueO))
      : asr==="blue" ? K*Math.sqrt(Math.max(0,s.blueO))
      : asr==="red"  ? K*Math.sqrt(Math.max(0,s.redO))
      : K*Math.sqrt(Math.max(0,s.blueO))+K*Math.sqrt(Math.max(0,s.redO));
    tR+=s.rev; tD+=s.del; tI+=inv; tF+=fix;
    return {...s,inv,fix};
  });
  return {rev:tR,del:tD,inv:tI,fix:tF,net:tR-tD-tI-tF,wS,hStats};
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function fmt(n) {
  const s=n<0?"−":"",a=Math.abs(n);
  if (a>=100000) return `${s}₹${(a/100000).toFixed(2)}L`;
  if (a>=1000)   return `${s}₹${(a/1000).toFixed(1)}K`;
  return `${s}₹${Math.round(a)}`;
}

// ── PALETTE ───────────────────────────────────────────────────────────────────
const C = {
  bg:"#F7F8FA", white:"#FFFFFF",
  border:"#E2E5EA", borderD:"#C0C6D0",
  text:"#1A1D23", sub:"#6B7280", light:"#9CA3AF",
  blue:"#2563EB",  blueL:"#EFF6FF",  blueM:"#BFDBFE",
  red:"#DC2626",   redL:"#FEF2F2",   redM:"#FECACA",
  green:"#059669", greenL:"#ECFDF5",
  amber:"#D97706", amberL:"#FFFBEB", amberM:"#FDE68A",
  purple:"#7C3AED",purpleL:"#F5F3FF",purpleM:"#DDD6FE",
};

// ── SMALL UI ──────────────────────────────────────────────────────────────────
function Chip({label,color=C.sub,bg="#F3F4F6"}) {
  return <span style={{fontSize:11,fontWeight:600,padding:"2px 9px",borderRadius:20,
    background:bg,color,fontFamily:"Inter,sans-serif"}}>{label}</span>;
}
function SHead({text}) {
  return <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",
    color:C.sub,marginBottom:7,fontFamily:"Inter,sans-serif"}}>{text}</div>;
}
function PRow({label,value,color,bold}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",
      borderBottom:`1px solid ${C.border}`,fontFamily:"Inter,sans-serif"}}>
      <span style={{fontSize:12,color:C.sub}}>{label}</span>
      <span style={{fontSize:13,fontWeight:bold?700:500,
        color:color||(value>=0?C.green:C.red)}}>{fmt(value)}</span>
    </div>
  );
}

// ── EXPLAINERS ────────────────────────────────────────────────────────────────
function RadiusExplainer() {
  return (
    <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,
      padding:"13px 14px",marginBottom:12}}>
      <div style={{fontFamily:"Playfair Display,serif",fontSize:13,fontWeight:700,
        color:C.text,marginBottom:8}}>⏱ Operating radius &amp; delivery</div>
      <div style={{fontSize:12,color:C.sub,lineHeight:1.65,marginBottom:10,
        fontFamily:"Inter,sans-serif"}}>
        Every store has an <strong style={{color:C.text}}>operating radius</strong> shown
        as a circle on the map. Two zones exist inside it:
      </div>
      {[
        {label:"Own neighbourhood",conv:"100% conversion",cost:"₹18/order",color:C.green},
        {label:"Adjacent neighbourhoods",conv:"Up to 60% conversion (partial)",cost:"₹42/order",color:C.amber},
        {label:"Beyond the circle",conv:"0% — not reachable",cost:"—",color:C.red},
      ].map(r=>(
        <div key={r.label} style={{display:"flex",justifyContent:"space-between",
          alignItems:"center",padding:"6px 10px",borderRadius:6,marginBottom:4,
          background:`${r.color}10`,fontFamily:"Inter,sans-serif"}}>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:C.text}}>{r.label}</div>
            <div style={{fontSize:10,color:C.sub}}>{r.conv}</div>
          </div>
          <div style={{fontSize:12,fontWeight:700,color:r.color}}>{r.cost}</div>
        </div>
      ))}
      <div style={{marginTop:8,padding:"9px 11px",borderRadius:7,background:"#F8F9FA",
        border:`1px solid ${C.border}`,fontSize:11,color:C.sub,
        fontFamily:"Inter,sans-serif",lineHeight:1.6}}>
        📌 <strong style={{color:C.text}}>Rent</strong> on each hex scales with population.
        Dense neighbourhoods cost more — you pay for access to more customers.
      </div>
    </div>
  );
}

function SegmentExplainer() {
  return (
    <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,
      padding:"13px 14px",marginBottom:12}}>
      <div style={{fontFamily:"Playfair Display,serif",fontSize:13,fontWeight:700,
        color:C.text,marginBottom:8}}>👥 Customer segments</div>
      <div style={{fontSize:12,color:C.sub,lineHeight:1.6,marginBottom:10,
        fontFamily:"Inter,sans-serif"}}>
        Hex colour shows the dominant segment.
        <strong style={{color:C.blue}}> Blue-tinted</strong> hexes are premium-heavy;
        <strong style={{color:C.red}}> red-tinted</strong> hexes are value-heavy.
        A store only earns from segments it stocks.
      </div>
      <div style={{background:C.blueL,border:`1px solid ${C.blueM}`,borderRadius:8,
        padding:"9px 12px",marginBottom:7}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
          <span style={{fontWeight:700,fontSize:12,color:C.blue,fontFamily:"Inter,sans-serif"}}>
            🔵 Blue — Premium</span>
          <span style={{fontWeight:700,fontSize:12,color:C.blue,fontFamily:"Inter,sans-serif"}}>
            ₹700/order</span>
        </div>
        <div style={{fontSize:11,color:"#1E40AF",lineHeight:1.6,fontFamily:"Inter,sans-serif"}}>
          7% of Blue residents order weekly.
          Inventory: <strong>₹5000 × √(Blue orders/wk)</strong>
        </div>
      </div>
      <div style={{background:C.redL,border:`1px solid ${C.redM}`,borderRadius:8,
        padding:"9px 12px",marginBottom:7}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
          <span style={{fontWeight:700,fontSize:12,color:C.red,fontFamily:"Inter,sans-serif"}}>
            🔴 Red — Value</span>
          <span style={{fontWeight:700,fontSize:12,color:C.red,fontFamily:"Inter,sans-serif"}}>
            ₹280/order</span>
        </div>
        <div style={{fontSize:11,color:"#991B1B",lineHeight:1.6,fontFamily:"Inter,sans-serif"}}>
          18% of Red residents order weekly.
          Inventory: <strong>₹5000 × √(Red orders/wk)</strong>
        </div>
      </div>
      <div style={{background:C.amberL,border:`1px solid ${C.amberM}`,borderRadius:8,
        padding:"9px 12px"}}>
        <div style={{fontWeight:700,fontSize:11,color:C.amber,marginBottom:3,
          fontFamily:"Inter,sans-serif"}}>⚠ Why stocking Both is not always better</div>
        <div style={{fontSize:11,color:"#92400E",lineHeight:1.65,fontFamily:"Inter,sans-serif"}}>
          Blue and Red cannot share shelf space. Both = two separate inventory costs:
          <strong> ₹5000×√Blue + ₹5000×√Red</strong>.
          In a Blue-heavy hex, Red demand is tiny — but you still pay its full √ cost.
          A Blue-only store skips that penalty entirely.
        </div>
      </div>
    </div>
  );
}

// ── STORE INFO CARD (side panel — no assortment toggle here) ─────────────────
function StoreInfoCard({store, wi, showSeg}) {
  const hex  = HEXES.find(h=>h.id===store.id);
  const fc   = rentCost(hex?.pop||3000);
  const segC = hexSegColor(hex?.bp??0.5);
  const blueEst = hex ? Math.round(hex.pop*hex.bp*BLUE_R) : 0;
  const redEst  = hex ? Math.round(hex.pop*hex.rp*RED_R)  : 0;

  const asr = store.assortment;
  const invCost = !showSeg
    ? K*Math.sqrt(blueEst)
    : asr==="blue" ? K*Math.sqrt(blueEst)
    : asr==="red"  ? K*Math.sqrt(redEst)
    : K*Math.sqrt(blueEst)+K*Math.sqrt(redEst);

  return (
    <div style={{borderRadius:10,border:`1.5px solid ${segC}33`,
      background:`${segC}08`,padding:"10px 12px",marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{fontSize:12,fontWeight:700,color:segC,
            fontFamily:"Inter,sans-serif",marginBottom:1}}>
            Store {wi+1} — Neighbourhood {store.label}
          </div>
          <div style={{fontSize:11,color:C.sub,fontFamily:"Inter,sans-serif"}}>
            {hex?.pop.toLocaleString()} residents ·{" "}
            <strong style={{color:C.text}}>Rent {fmt(fc)}/wk</strong>
          </div>
        </div>
        <div style={{
          padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700,
          fontFamily:"Inter,sans-serif",
          background: asr==="blue"?C.blueL:asr==="red"?C.redL:C.amberL,
          color: asr==="blue"?C.blue:asr==="red"?C.red:C.amber,
          border:`1px solid ${asr==="blue"?C.blueM:asr==="red"?C.redM:C.amberM}`,
          marginLeft:8, flexShrink:0,
        }}>
          {asr==="blue"?"🔵 Blue":asr==="red"?"🔴 Red":"⚡ Both"}
        </div>
      </div>
      {showSeg && (
        <div style={{marginTop:7,paddingTop:7,borderTop:`1px solid ${segC}22`,
          fontSize:10,color:C.sub,fontFamily:"Inter,sans-serif",lineHeight:1.6}}>
          <div style={{display:"flex",gap:10}}>
            <span>🔵 {Math.round(hex.bp*100)}% · ~{blueEst} orders/wk @ ₹700</span>
          </div>
          <div><span>🔴 {Math.round(hex.rp*100)}% · ~{redEst} orders/wk @ ₹280</span></div>
          <div style={{marginTop:4,color:
            asr==="both"?C.amber:asr==="blue"?C.blue:C.red}}>
            Inventory: {fmt(invCost)}/wk
            {asr==="both"&&" (pooling broken — 2 separate costs)"}
          </div>
          <div style={{marginTop:3,fontSize:10,color:C.light,fontStyle:"italic"}}>
            ← Toggle assortment inside the hex on the map
          </div>
        </div>
      )}
    </div>
  );
}

// ── RESULT REVEAL ─────────────────────────────────────────────────────────────
function ResultReveal({pnl,stores,roundN,onAdvance}) {
  return (
    <div style={{background:C.white,border:`2px solid ${pnl.net>=0?C.green:C.red}`,
      borderRadius:12,padding:"16px"}}>
      <div style={{fontFamily:"Playfair Display,serif",fontSize:15,fontWeight:700,
        color:pnl.net>=0?C.green:C.red,marginBottom:12}}>
        {pnl.net>=0?"✓ Profitable Round":"✗ Loss-Making Round"}
      </div>
      <SHead text="Weekly P&L"/>
      <PRow label="Total Revenue"       value={pnl.rev}  color={C.green}/>
      <PRow label="− Delivery Costs"    value={-pnl.del}/>
      <PRow label="− Inventory Holding" value={-pnl.inv}/>
      <PRow label="− Store Rent"        value={-pnl.fix}/>
      <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",
        fontFamily:"Inter,sans-serif"}}>
        <span style={{fontSize:14,fontWeight:700,color:C.text}}>Weekly Net</span>
        <span style={{fontFamily:"Playfair Display,serif",fontSize:22,fontWeight:700,
          color:pnl.net>=0?C.green:C.red}}>{fmt(pnl.net)}</span>
      </div>
      {stores.length>1 && (
        <>
          <SHead text="Per Store"/>
          {pnl.wS.map((s,i)=>{
            const net=s.rev-s.del-s.inv-s.fix;
            const asr=stores[i].assortment;
            return (
              <div key={i} style={{padding:"7px 10px",borderRadius:7,marginBottom:5,
                background:`${hexSegColor(HEXES.find(h=>h.q===stores[i].q&&h.r===stores[i].r)?.bp??0.5)}0d`,
                border:`1px solid ${hexSegColor(HEXES.find(h=>h.q===stores[i].q&&h.r===stores[i].r)?.bp??0.5)}33`,
                fontFamily:"Inter,sans-serif"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                  <span style={{fontSize:11,fontWeight:700,
                    color:hexSegColor(HEXES.find(h=>h.q===stores[i].q&&h.r===stores[i].r)?.bp??0.5)}}>
                    Store {i+1} — {stores[i].label}&nbsp;
                    {asr==="blue"?"🔵":asr==="red"?"🔴":"⚡"}
                  </span>
                  <span style={{fontSize:12,fontWeight:700,
                    color:net>=0?C.green:C.red}}>{fmt(net)}</span>
                </div>
                <div style={{fontSize:10,color:C.sub}}>
                  {Math.round(s.blueO+s.redO)} orders/wk · Rev {fmt(s.rev)} · Del {fmt(-s.del)} · Inv {fmt(-s.inv)} · Rent {fmt(-s.fix)}
                </div>
              </div>
            );
          })}
        </>
      )}
      <div style={{marginTop:10,padding:"11px 13px",borderRadius:8,background:"#F8F9FA",
        border:`1px solid ${C.border}`}}>
        <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:4,
          fontFamily:"Inter,sans-serif"}}>💡 Key takeaway</div>
        <div style={{fontSize:12,color:C.sub,lineHeight:1.65,fontFamily:"Inter,sans-serif"}}>
          {ROUNDS[roundN].insight}
        </div>
      </div>
      <button onClick={onAdvance} style={{marginTop:12,width:"100%",padding:"11px 0",
        borderRadius:8,border:"none",cursor:"pointer",background:C.text,color:C.white,
        fontWeight:600,fontSize:13,fontFamily:"Inter,sans-serif"}}>
        {roundN<5?`Continue to Round ${roundN+1} →`:"Complete Simulation →"}
      </button>
    </div>
  );
}

// ── CITY BG ───────────────────────────────────────────────────────────────────
function CityBg({vb}) {
  return (
    <g>
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="#ECEEF2"/>
      {Array.from({length:18},(_,i)=>(
        <line key={`v${i}`} x1={vb.x+(i/17)*vb.w} y1={vb.y}
          x2={vb.x+(i/17)*vb.w} y2={vb.y+vb.h} stroke="#D8DCE5" strokeWidth={0.8}/>
      ))}
      {Array.from({length:14},(_,i)=>(
        <line key={`h${i}`} x1={vb.x} y1={vb.y+(i/13)*vb.h}
          x2={vb.x+vb.w} y2={vb.y+(i/13)*vb.h} stroke="#D8DCE5" strokeWidth={0.8}/>
      ))}
      {[[0.08,0,0.08,1],[0.28,0,0.32,1],[0.58,0,0.56,1],[0.80,0,0.83,1],
        [0,0.18,1,0.16],[0,0.44,1,0.46],[0,0.72,1,0.70],
        [0,0.3,0.5,0.85],[0.5,0.15,1,0.9]
      ].map(([x1,y1,x2,y2],i)=>(
        <line key={`st${i}`} x1={vb.x+x1*vb.w} y1={vb.y+y1*vb.h}
          x2={vb.x+x2*vb.w} y2={vb.y+y2*vb.h}
          stroke="#BEC5D3" strokeWidth={i<4?3:i<7?2:1.2} opacity={0.55}/>
      ))}
    </g>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [round,    setRound]    = useState(1);
  const [stores,   setStores]   = useState([]);
  const [locked,   setLocked]   = useState(false);
  const [cumPnL,   setCumPnL]   = useState(0);
  const [history,  setHistory]  = useState({});
  const [hov,      setHov]      = useState(null);
  const [gameOver, setGameOver] = useState(false);

  const cfg      = ROUNDS[round];
  const actHexes = HEXES.slice(0, cfg.hexN);
  const hexPos   = useMemo(()=>HEXES.map(h=>({...h,...hCenter(h.q,h.r)})),[]);
  const actPos   = hexPos.slice(0, cfg.hexN);

  const vb = useMemo(()=>{
    const xs=actPos.map(h=>h.x), ys=actPos.map(h=>h.y);
    const pad=HS*2.6;
    const x=Math.min(...xs)-pad, y=Math.min(...ys)-pad;
    return {x,y,w:Math.max(...xs)+pad-x,h:Math.max(...ys)+pad-y};
  },[actPos.length]);

  const pnl = useMemo(()=>
    locked ? calcPnL(stores,actHexes,cfg.showSeg) : null,
  [locked,stores,round]);

  const canCommit = !locked && stores.length>=1;
  const canPlace  = !locked && stores.length<cfg.maxW;

  // Convert SVG coords to screen coords for overlay positioning

  function toggleStore(hex) {
    if (locked) return;
    if (stores.find(s=>s.id===hex.id)) {
      setStores(p=>p.filter(s=>s.id!==hex.id));
    } else {
      if (stores.length>=cfg.maxW) return;
      setStores(p=>[...p,{id:hex.id,q:hex.q,r:hex.r,label:hex.lbl,assortment:"both"}]);
    }
  }
  function setAssortment(id,val) {
    setStores(p=>p.map(s=>s.id===id?{...s,assortment:val}:s));
  }
  function commit() { if (canCommit) setLocked(true); }
  function advance() {
    if (!pnl) return;
    const nc=cumPnL+pnl.net;
    setCumPnL(nc);
    setHistory(p=>({...p,[round]:pnl.net}));
    if (round===5){setGameOver(true);return;}
    setRound(round+1); setStores([]); setLocked(false);
  }

  if (gameOver) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",
      alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif"}}>
      <div style={{maxWidth:520,width:"100%",padding:40}}>
        <div style={{fontSize:11,letterSpacing:"0.15em",color:C.sub,
          textTransform:"uppercase",marginBottom:8,fontWeight:600}}>Simulation Complete</div>
        <div style={{fontFamily:"Playfair Display,serif",fontSize:48,fontWeight:700,
          color:cumPnL>=0?C.green:C.red,marginBottom:4}}>{fmt(cumPnL)}</div>
        <div style={{fontSize:16,color:C.sub,marginBottom:36}}>
          {cumPnL>=0?"Breakeven achieved.":"Below breakeven — review your decisions."}
        </div>
        {[1,2,3,4,5].map(r=>history[r]!=null&&(
          <div key={r} style={{display:"flex",justifyContent:"space-between",
            padding:"12px 16px",background:C.white,borderRadius:8,
            border:`1px solid ${C.border}`,marginBottom:6}}>
            <span style={{fontSize:13,color:C.sub,fontFamily:"Inter,sans-serif"}}>
              Round {r} — {ROUNDS[r].title}
            </span>
            <span style={{fontSize:14,fontWeight:700,fontFamily:"Inter,sans-serif",
              color:history[r]>=0?C.green:C.red}}>{fmt(history[r])}</span>
          </div>
        ))}
        <button onClick={()=>{setRound(1);setStores([]);setCumPnL(0);
          setHistory({});setLocked(false);setGameOver(false);}}
          style={{marginTop:24,padding:"12px 32px",borderRadius:8,border:"none",
          background:C.text,color:C.white,fontWeight:600,fontSize:14,
          cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Play Again</button>
      </div>
    </div>
  );

  return (
    <div style={{height:"100vh",background:C.bg,display:"flex",flexDirection:"column",
      fontFamily:"Inter,sans-serif",color:C.text,overflow:"hidden"}}>

      {/* TOP BAR */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 24px",height:54,borderBottom:`1px solid ${C.border}`,
        background:C.white,flexShrink:0,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontFamily:"Playfair Display,serif",fontWeight:700,
            fontSize:19,color:C.text}}>QuickCommerce</span>
          <div style={{width:1,height:18,background:C.border}}/>
          <span style={{fontSize:11,color:C.sub,fontWeight:500,
            letterSpacing:"0.08em",textTransform:"uppercase"}}>Supply Chain Simulator</span>
        </div>
        <div style={{display:"flex",gap:5}}>
          {[1,2,3,4,5].map(r=>{
            const done=history[r]!=null, act=r===round;
            return <div key={r} style={{padding:"4px 14px",borderRadius:20,fontSize:11,
              fontWeight:600,border:`1px solid ${act?C.text:done?C.green:C.border}`,
              background:act?C.text:done?C.greenL:C.white,
              color:act?C.white:done?C.green:C.sub,transition:"all 0.2s"}}>
              {done?"✓":r}</div>;
          })}
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:10,color:C.sub,letterSpacing:"0.1em",
            textTransform:"uppercase",marginBottom:1,fontWeight:500}}>Cumulative P&L</div>
          <div style={{fontFamily:"Playfair Display,serif",fontSize:19,fontWeight:700,
            color:cumPnL>=0?C.green:C.red}}>{fmt(cumPnL)}</div>
        </div>
      </div>

      {/* BODY */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* LEFT PANEL */}
        <div style={{width:320,borderRight:`1px solid ${C.border}`,background:C.bg,
          display:"flex",flexDirection:"column",overflow:"hidden",flexShrink:0}}>

          <div style={{padding:"15px 18px",borderBottom:`1px solid ${C.border}`,
            background:C.white}}>
            <div style={{fontSize:10,color:C.sub,letterSpacing:"0.15em",
              textTransform:"uppercase",marginBottom:4,fontWeight:600}}>Round {round} of 5</div>
            <div style={{fontFamily:"Playfair Display,serif",fontSize:15,fontWeight:700,
              lineHeight:1.25,marginBottom:6,color:C.text}}>{cfg.title}</div>
            <div style={{fontSize:12,color:C.sub,lineHeight:1.65,marginBottom:8}}>
              {cfg.intro}</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              <Chip label={`${cfg.hexN} neighbourhoods`}/>
              <Chip label={`Up to ${cfg.maxW} store${cfg.maxW>1?"s":""}`}/>
              {cfg.showSeg&&<Chip label="Segments visible" color={C.blue} bg={C.blueL}/>}
            </div>
          </div>

          <div style={{flex:1,overflowY:"auto",padding:"14px 16px"}}>
            {round===1&&!locked&&<RadiusExplainer/>}
            {cfg.showSeg&&!locked&&<SegmentExplainer/>}

            {!locked&&(
              <div style={{background:C.white,border:`1px solid ${C.border}`,
                borderRadius:10,padding:"12px 14px",marginBottom:12}}>
                <div style={{fontFamily:"Playfair Display,serif",fontSize:13,fontWeight:700,
                  color:C.text,marginBottom:8}}>
                  🏪 Your store{cfg.maxW>1?"s":""}
                </div>

                <div style={{padding:"9px 12px",borderRadius:7,marginBottom:10,
                  background:stores.length>0?"#F0FDF4":C.amberL,
                  border:`1px solid ${stores.length>0?"#BBF7D0":C.amberM}`,
                  fontSize:12,fontFamily:"Inter,sans-serif",
                  color:stores.length>0?C.green:C.amber}}>
                  {stores.length===0
                    ?"👆 Click a neighbourhood on the map to place a store"
                    :stores.length<cfg.maxW
                      ?`✓ ${stores.length} store${stores.length>1?"s":""} placed — click another to add (up to ${cfg.maxW})`
                      :`✓ ${stores.length} store${stores.length>1?"s":""} placed`}
                </div>

                {stores.length>0&&(
                  <div style={{fontSize:11,color:C.sub,lineHeight:1.55,
                    marginBottom:10,fontFamily:"Inter,sans-serif"}}>
                    Click a store on the map to remove it.
                    {cfg.showSeg&&" Toggle assortment (B / R / ⚡) inside the store hex."}
                  </div>
                )}

                {stores.map((s,wi)=>(
                  <StoreInfoCard key={s.id} store={s} wi={wi} showSeg={cfg.showSeg}/>
                ))}

                <button onClick={commit} disabled={!canCommit} style={{
                  width:"100%",padding:"11px 0",borderRadius:8,
                  border:`1.5px solid ${canCommit?C.text:C.border}`,
                  background:canCommit?C.text:"#F3F4F6",
                  color:canCommit?C.white:C.light,
                  fontWeight:600,fontSize:13,fontFamily:"Inter,sans-serif",
                  cursor:canCommit?"pointer":"not-allowed",transition:"all 0.15s"}}>
                  {canCommit?"Commit decisions & reveal results →"
                    :"Place at least one store to continue"}
                </button>
              </div>
            )}

            {locked&&pnl&&(
              <ResultReveal pnl={pnl} stores={stores} roundN={round} onAdvance={advance}/>
            )}
          </div>
        </div>

        {/* MAP AREA */}
        <div style={{flex:1,position:"relative",overflow:"hidden",background:C.bg}}>

          {/* Hint banner */}
          {!locked&&(
            <div style={{position:"absolute",top:14,left:"50%",
              transform:"translateX(-50%)",zIndex:10,
              background:C.white,border:`1px solid ${C.border}`,
              borderRadius:24,padding:"7px 20px",fontSize:12,color:C.text,fontWeight:500,
              boxShadow:"0 2px 10px rgba(0,0,0,0.08)",pointerEvents:"none",
              whiteSpace:"nowrap"}}>
              {stores.length===0
                ?"👆 Click a neighbourhood to place your store"
                :cfg.showSeg
                  ?"Toggle B / R / ⚡ inside a store hex to set assortment · Click to remove"
                  :"Click a store hex to remove it"}
            </div>
          )}

          {/* SVG MAP */}
          <svg width="100%" height="100%"
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            style={{display:"block"}}>

            <CityBg vb={vb}/>

            {/* Operating radius circles — colour = hex segment colour */}
            {stores.map((s)=>{
              const sp    = hCenter(s.q,s.r);
              const hex   = HEXES.find(h=>h.q===s.q&&h.r===s.r);
              const segC  = hexSegColor(hex?.bp??0.5);
              const adjR  = HS*Math.sqrt(3)*1.18;
              return (
                <g key={`radius-${s.id}`}>
                  <circle cx={sp.x} cy={sp.y} r={adjR}
                    fill={`${segC}0a`} stroke={segC} strokeWidth={2.5} opacity={0.7}/>
                  <circle cx={sp.x} cy={sp.y} r={HS*0.88}
                    fill="none" stroke={segC} strokeWidth={1}
                    strokeDasharray="4,3" opacity={0.4}/>
                </g>
              );
            })}

            {/* Hexes */}
            {actPos.map(hex=>{
              const hs       = pnl?.hStats?.[hex.id];
              const wi       = stores.findIndex(s=>s.id===hex.id);
              const isW      = wi>=0;
              const isHov    = hov?.id===hex.id;
              const conv     = hs?.conv??null;
              const unserved = hs?.unserved??false;
              const segC     = hexSegColor(hex.bp);

              // Fill: always segment-tinted in seg rounds, density-blue in R1
              let fill;
              if (!cfg.showSeg) {
                const t=Math.min(hex.pop/5200,1);
                fill=`rgba(37,99,235,${0.04+t*0.16})`;
              } else {
                // Interpolate between blue and red based on bp
                const b=hex.bp;
                fill=`rgba(${Math.round(220+(37-220)*b)},${Math.round(38+(99-38)*b)},${Math.round(38+(235-38)*b)},0.20)`;
              }

              const strokeC = isW ? segC : isHov&&!locked ? C.text : "#B0BAC8";
              const cursor  = locked?"default":(canPlace&&!isW)||isW?"pointer":"default";

              return (
                <g key={hex.id}
                  onClick={()=>!locked&&toggleStore(hex)}
                  onMouseEnter={()=>setHov(hex)}
                  onMouseLeave={()=>setHov(null)}
                  style={{cursor}}>

                  <polygon points={hPts(hex.x,hex.y)} fill={fill} stroke={strokeC}
                    strokeWidth={isW?2.5:isHov&&!locked?1.8:1.2}/>

                  {/* Conversion tint after commit */}
                  {conv!=null&&!isW&&conv>0&&(
                    <polygon points={hPts(hex.x,hex.y,HS-4)}
                      fill={`rgba(5,150,105,${conv*0.10})`} stroke="none"/>
                  )}
                  {locked&&unserved&&(
                    <polygon points={hPts(hex.x,hex.y)}
                      fill="rgba(255,255,255,0.42)" stroke="none"/>
                  )}
                  {isHov&&!locked&&!isW&&canPlace&&(
                    <polygon points={hPts(hex.x,hex.y,HS-2)}
                      fill="rgba(0,0,0,0.03)" stroke="none"/>
                  )}

                  {/* Store hex content */}
                  {isW ? (
                    <>
                      {/* Store badge */}
                      <circle cx={hex.x} cy={hex.y-14} r={12} fill={segC}/>
                      <text x={hex.x} y={hex.y-10} textAnchor="middle"
                        fill="#FFF" fontSize={8} fontWeight="700"
                        fontFamily="Inter,sans-serif">W{wi+1}</text>
                      {/* Assortment toggle — foreignObject renders HTML buttons inside SVG */}
                      {cfg.showSeg && !locked && (()=>{
                        const asr = stores[wi].assortment;
                        const btnW = 22, gap = 3, total = 3*btnW + 2*gap;
                        const startX = hex.x - total/2;
                        const startY = hex.y + 4;
                        const opts = [
                          {id:"blue", label:"B", ac:C.blue,  ab:C.blueL},
                          {id:"red",  label:"R", ac:C.red,   ab:C.redL},
                          {id:"both", label:"⚡", ac:C.amber, ab:C.amberL},
                        ];
                        return (
                          <foreignObject x={startX} y={startY} width={total} height={22}
                            style={{overflow:"visible"}}>
                            <div xmlns="http://www.w3.org/1999/xhtml"
                              style={{display:"flex",gap:`${gap}px`}}>
                              {opts.map(o=>(
                                <button key={o.id}
                                  onClick={e=>{e.stopPropagation();setAssortment(stores[wi].id,o.id);}}
                                  style={{
                                    width:btnW, height:20, borderRadius:4, cursor:"pointer",
                                    border:`1.5px solid ${asr===o.id ? o.ac : "#CBD5E1"}`,
                                    background: asr===o.id ? o.ab : "rgba(255,255,255,0.92)",
                                    color: asr===o.id ? o.ac : "#9CA3AF",
                                    fontSize:10, fontWeight:700,
                                    fontFamily:"Inter,sans-serif",
                                    padding:0, lineHeight:"1",
                                    boxShadow:"0 1px 4px rgba(0,0,0,0.18)",
                                    display:"flex", alignItems:"center",
                                    justifyContent:"center",
                                  }}>
                                  {o.label}
                                </button>
                              ))}
                            </div>
                          </foreignObject>
                        );
                      })()}
                      {/* Assortment label when locked */}
                      {(!cfg.showSeg || locked) && (
                        <text x={hex.x} y={hex.y+14}
                          textAnchor="middle" fill={segC} fontSize={8} fontWeight="700"
                          fontFamily="Inter,sans-serif">
                          {stores[wi].assortment==="blue"?"🔵 Blue"
                           :stores[wi].assortment==="red"?"🔴 Red":"⚡ Both"}
                        </text>
                      )}
                    </>
                  ) : (
                    <>
                      <text x={hex.x} y={hex.y-(cfg.showSeg?18:12)}
                        textAnchor="middle" fill={C.text} fontSize={12} fontWeight="600"
                        fontFamily="Playfair Display,serif">{hex.lbl}</text>
                      <text x={hex.x} y={hex.y-(cfg.showSeg?6:0)}
                        textAnchor="middle" fill={C.sub} fontSize={8}
                        fontFamily="Inter,sans-serif">
                        {hex.pop.toLocaleString()} residents</text>
                      {cfg.showSeg&&(
                        <text x={hex.x} y={hex.y+8}
                          textAnchor="middle" fill={C.sub} fontSize={8}
                          fontFamily="Inter,sans-serif">
                          🔵{Math.round(hex.bp*100)}% 🔴{Math.round(hex.rp*100)}%</text>
                      )}
                      <text x={hex.x} y={hex.y+(cfg.showSeg?21:13)}
                        textAnchor="middle" fill={C.light} fontSize={7.5}
                        fontFamily="Inter,sans-serif">
                        Rent {fmt(rentCost(hex.pop))}/wk</text>
                      {conv!=null&&(
                        <text x={hex.x} y={hex.y+(cfg.showSeg?32:24)}
                          textAnchor="middle" fontSize={7.5} fontWeight="600"
                          fontFamily="Inter,sans-serif"
                          fill={unserved?"#ccc":conv>=0.75?C.green:conv>=0.45?C.amber:C.red}>
                          {unserved?"unserved":Math.round(conv*100)+"% conv"}</text>
                      )}
                    </>
                  )}
                </g>
              );
            })}
          </svg>



          {/* Hover tooltip */}
          {hov&&(
            <div style={{position:"absolute",bottom:16,left:16,background:C.white,
              border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 16px",
              minWidth:240,boxShadow:"0 4px 16px rgba(0,0,0,0.09)",pointerEvents:"none"}}>
              <div style={{fontFamily:"Playfair Display,serif",fontWeight:700,
                fontSize:15,marginBottom:5}}>Neighbourhood {hov.lbl}</div>
              <div style={{fontSize:12,color:C.sub,marginBottom:2,fontFamily:"Inter,sans-serif"}}>
                <strong style={{color:C.text}}>{hov.pop.toLocaleString()} residents</strong>
              </div>
              <div style={{fontSize:11,color:C.sub,marginBottom:4,fontFamily:"Inter,sans-serif"}}>
                Rent if placed here: <strong style={{color:C.text}}>{fmt(rentCost(hov.pop))}/wk</strong>
              </div>
              {cfg.showSeg&&(
                <div style={{paddingTop:6,borderTop:`1px solid ${C.border}`,
                  fontSize:11,color:C.sub,fontFamily:"Inter,sans-serif",lineHeight:1.7}}>
                  🔵 Blue {Math.round(hov.bp*100)}% · ~{Math.round(hov.pop*hov.bp*BLUE_R)} orders/wk @ ₹700<br/>
                  🔴 Red {Math.round(hov.rp*100)}% · ~{Math.round(hov.pop*hov.rp*RED_R)} orders/wk @ ₹280
                </div>
              )}
              {pnl?.hStats?.[hov.id]&&(
                <div style={{marginTop:6,paddingTop:6,borderTop:`1px solid ${C.border}`,
                  fontFamily:"Inter,sans-serif"}}>
                  <div style={{fontSize:12,fontWeight:600,
                    color:pnl.hStats[hov.id].unserved?C.red:C.green}}>
                    {pnl.hStats[hov.id].unserved
                      ?"⚠ Outside all operating radii — unserved"
                      :`Revenue: ${fmt(pnl.hStats[hov.id].rev)}`}
                  </div>
                  {!pnl.hStats[hov.id].unserved&&(
                    <div style={{fontSize:11,color:C.sub}}>
                      {Math.round((pnl.hStats[hov.id].conv||0)*100)}% conversion
                      {pnl.hStats[hov.id].own?"":" (partial — adjacent hex)"}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Post-commit result chips */}
          {locked&&pnl&&(
            <div style={{position:"absolute",top:14,right:14,
              display:"flex",flexDirection:"column",gap:6}}>
              {stores.map((s,si)=>{
                const ws=pnl.wS[si]; if (!ws) return null;
                const net=ws.rev-ws.del-ws.inv-ws.fix;
                const hex=HEXES.find(h=>h.q===s.q&&h.r===s.r);
                const segC=hexSegColor(hex?.bp??0.5);
                return (
                  <div key={s.id} style={{background:C.white,
                    border:`1.5px solid ${segC}44`,borderRadius:10,
                    padding:"9px 13px",minWidth:175,
                    boxShadow:"0 2px 8px rgba(0,0,0,0.07)"}}>
                    <div style={{fontSize:11,fontWeight:700,color:segC,
                      marginBottom:2,fontFamily:"Inter,sans-serif"}}>
                      Store {si+1} — {s.label} {s.assortment==="blue"?"🔵":s.assortment==="red"?"🔴":"⚡"}
                    </div>
                    <div style={{fontSize:11,color:C.sub,fontFamily:"Inter,sans-serif"}}>
                      {Math.round(ws.blueO+ws.redO)} orders/wk</div>
                    <div style={{fontSize:14,fontWeight:700,
                      fontFamily:"Playfair Display,serif",
                      color:net>=0?C.green:C.red}}>{fmt(net)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT RAIL */}
        <div style={{width:196,borderLeft:`1px solid ${C.border}`,background:C.white,
          display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"13px 14px",borderBottom:`1px solid ${C.border}`,
            fontSize:10,color:C.sub,fontWeight:700,letterSpacing:"0.12em",
            textTransform:"uppercase",fontFamily:"Inter,sans-serif"}}>Round History</div>
          <div style={{flex:1,padding:"10px 12px",overflowY:"auto"}}>
            {[1,2,3,4,5].map(r=>{
              const h=history[r], act=r===round;
              return (
                <div key={r} style={{padding:"10px 12px",borderRadius:8,marginBottom:6,
                  background:act?"#F8F9FA":C.white,
                  border:`1px solid ${act?C.borderD:C.border}`,
                  opacity:r>round?0.35:1}}>
                  <div style={{fontSize:10,color:C.sub,fontWeight:500,marginBottom:1,
                    fontFamily:"Inter,sans-serif"}}>Round {r}</div>
                  <div style={{fontSize:11,color:C.sub,marginBottom:4,lineHeight:1.3,
                    fontFamily:"Inter,sans-serif"}}>{ROUNDS[r].title}</div>
                  <div style={{fontWeight:700,fontSize:15,fontFamily:"Playfair Display,serif",
                    color:h!=null?(h>=0?C.green:C.red):act?"#D97706":C.sub}}>
                    {h!=null?fmt(h):act?"In progress…":"—"}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{borderTop:`1px solid ${C.border}`,padding:"13px 14px"}}>
            <div style={{fontSize:10,color:C.sub,fontWeight:700,letterSpacing:"0.1em",
              textTransform:"uppercase",marginBottom:4,fontFamily:"Inter,sans-serif"}}>
              Cumulative P&L</div>
            <div style={{fontFamily:"Playfair Display,serif",fontSize:24,fontWeight:700,
              color:cumPnL>=0?C.green:C.red}}>{fmt(cumPnL)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
