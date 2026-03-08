import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// 🔧 ใส่ค่าจาก Supabase ตรงนี้
// Supabase Dashboard → Settings → API
// ============================================================
const SUPABASE_URL = "https://fjpcuycgymkpvuguywtf.supabase.co";        // เช่น https://xxxx.supabase.co
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqcGN1eWNneW1rcHZ1Z3V5d3RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NTUyMDAsImV4cCI6MjA4ODUzMTIwMH0.WD0aM_O6nK_XYZht-Gf2JqqO_uY4sPpzG3CVxFtB3xo";   // anon public key

// ── Supabase REST API helper ──────────────────────────────────
const sbHeaders = { "Content-Type":"application/json", "apikey":SUPABASE_KEY, "Authorization":`Bearer ${SUPABASE_KEY}` };
const sbUrl = (table, query="") => `${SUPABASE_URL}/rest/v1/${table}${query}`;

async function sbGetAll(table) {
  const res = await fetch(sbUrl(table, "?order=created_at.asc"), { headers: sbHeaders });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function sbInsert(table, data) {
  const res = await fetch(sbUrl(table), { method:"POST", headers:{...sbHeaders,"Prefer":"return=representation"}, body:JSON.stringify(data) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function sbUpdate(table, id, data) {
  const res = await fetch(sbUrl(table, `?id=eq.${id}`), { method:"PATCH", headers:{...sbHeaders,"Prefer":"return=representation"}, body:JSON.stringify(data) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function sbDelete(table, id) {
  const res = await fetch(sbUrl(table, `?id=eq.${id}`), { method:"DELETE", headers:sbHeaders });
  if (!res.ok) throw new Error(await res.text());
}

// ── Map camelCase ↔ snake_case ────────────────────────────────
const toDb = (item) => ({
  id: item.id, name: item.name, phone: item.phone, email: item.email,
  topic: item.topic, level: item.level, category: item.category,
  status: item.status, date: item.date,
  real_code: item.realCode, fake_code: item.fakeCode,
  checked_in: item.checkedIn||false, check_in_time: item.checkInTime||null,
  photo: item.photo||null, work: item.work||null,
});
const fromDb = (row) => ({
  id: row.id, name: row.name, phone: row.phone, email: row.email,
  topic: row.topic, level: row.level, category: row.category,
  status: row.status, date: row.date,
  realCode: row.real_code, fakeCode: row.fake_code,
  checkedIn: row.checked_in, checkInTime: row.check_in_time,
  photo: row.photo, work: row.work,
});

// ── Constants ─────────────────────────────────────────────────
const genRealCode = (idx) => `LASH-${new Date().getFullYear()}-${String(idx).padStart(4,"0")}`;
const genFakeCode = () => "AX" + Math.random().toString(36).substring(2,8).toUpperCase();
const seminarTopics = ["เทคนิคการต่อขนตาพื้นฐาน","ต่อขนตาแบบ Volume","ต่อขนตาแบบ Mega Volume","การดูแลรักษาขนตา","เทคนิค Hybrid Lash"];
const competitionLevels = ["ระดับเริ่มต้น","ระดับกลาง","ระดับมืออาชีพ"];
const competitionCategories = ["Classic Lash","Volume Lash","Mega Volume","Hybrid Lash","Wispy Lash"];
const statusOptions = { seminar:["รอการยืนยัน","ยืนยันแล้ว","ยกเลิก"], competition:["รอการตรวจสอบ","ผ่านการคัดเลือก","ไม่ผ่าน"] };
const statusColors = { "ยืนยันแล้ว":"#10b981","รอการยืนยัน":"#f59e0b","ยกเลิก":"#ef4444","ผ่านการคัดเลือก":"#10b981","รอการตรวจสอบ":"#f59e0b","ไม่ผ่าน":"#ef4444","เช็คอินแล้ว":"#06b6d4" };
const makeQRPayload = (item,type) => JSON.stringify({ type, id:item.id, realCode:item.realCode, fakeCode:item.fakeCode, name:item.name });
const qrUrl = (text,size=200) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=0a0a14&color=c084fc&qzone=2`;

// ── UI Components ──────────────────────────────────────────────
function Badge({ status }) {
  const c = statusColors[status]||"#9ca3af";
  return <span style={{background:c+"22",color:c,border:`1px solid ${c}44`,borderRadius:"20px",padding:"3px 12px",fontSize:"12px",fontWeight:"600",whiteSpace:"nowrap"}}>{status}</span>;
}
function Spinner({ size=16 }) {
  return <span style={{display:"inline-block",width:size,height:size,border:"2px solid #c084fc44",borderTop:"2px solid #c084fc",borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0}} />;
}
function Modal({ show, onClose, title, children, maxWidth="560px" }) {
  if (!show) return null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#1a1a2e",border:"1px solid #c084fc33",borderRadius:"20px",width:"100%",maxWidth,maxHeight:"92vh",overflow:"auto",boxShadow:"0 25px 60px rgba(192,132,252,0.25)"}}>
        <div style={{padding:"22px 22px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h3 style={{margin:0,color:"#e2d4f0",fontSize:"18px",fontFamily:"'Playfair Display',serif"}}>{title}</h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:"24px",lineHeight:1}}>×</button>
        </div>
        <div style={{padding:"18px 22px 22px"}}>{children}</div>
      </div>
    </div>
  );
}
function FormField({ label, children }) {
  return (
    <div style={{marginBottom:"13px"}}>
      <label style={{display:"block",marginBottom:"5px",color:"#c084fc",fontSize:"11px",fontWeight:"700",letterSpacing:"0.5px",textTransform:"uppercase"}}>{label}</label>
      {children}
    </div>
  );
}
const iS = {width:"100%",padding:"10px 13px",background:"#0f0f1a",border:"1px solid #c084fc33",borderRadius:"10px",color:"#e2d4f0",fontSize:"14px",outline:"none",boxSizing:"border-box",fontFamily:"inherit"};
const sS = {...iS,cursor:"pointer"};

function QRScanner({ onScan }) {
  const videoRef=useRef(null),canvasRef=useRef(null),animRef=useRef(null),streamRef=useRef(null);
  const [err,setErr]=useState(""),[ready,setReady]=useState(false);
  useEffect(()=>{
    const start=()=>{
      navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}})
        .then(stream=>{streamRef.current=stream;if(videoRef.current){videoRef.current.srcObject=stream;videoRef.current.play();setReady(true);tick();}})
        .catch(()=>setErr("ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้งานกล้อง"));
    };
    if(!window.jsQR){const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";s.onload=start;document.head.appendChild(s);}else start();
    return()=>{streamRef.current?.getTracks().forEach(t=>t.stop());if(animRef.current)cancelAnimationFrame(animRef.current);};
  },[]);
  const tick=()=>{
    const v=videoRef.current,c=canvasRef.current;
    if(!v||!c||!window.jsQR){animRef.current=requestAnimationFrame(tick);return;}
    if(v.readyState===v.HAVE_ENOUGH_DATA){c.width=v.videoWidth;c.height=v.videoHeight;const ctx=c.getContext("2d");ctx.drawImage(v,0,0,c.width,c.height);const img=ctx.getImageData(0,0,c.width,c.height);const code=window.jsQR(img.data,img.width,img.height);if(code){streamRef.current?.getTracks().forEach(t=>t.stop());cancelAnimationFrame(animRef.current);onScan(code.data);return;}}
    animRef.current=requestAnimationFrame(tick);
  };
  if(err) return <div style={{padding:"24px",textAlign:"center",color:"#ef4444"}}><div style={{fontSize:"36px",marginBottom:"8px"}}>📷</div><p style={{fontSize:"13px"}}>{err}</p></div>;
  return(
    <div style={{textAlign:"center"}}>
      <div style={{position:"relative",display:"inline-block",borderRadius:"14px",overflow:"hidden",border:"2px solid #c084fc44"}}>
        <video ref={videoRef} style={{display:"block",width:"100%",maxWidth:"320px",height:"240px",objectFit:"cover",background:"#000"}} playsInline muted/>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
          <div style={{width:"160px",height:"160px",border:"2px solid #c084fc",borderRadius:"10px",boxShadow:"0 0 0 9999px rgba(0,0,0,0.4)"}}/>
        </div>
      </div>
      <canvas ref={canvasRef} style={{display:"none"}}/>
      <p style={{color:"#9ca3af",fontSize:"12px",marginTop:"9px"}}>{ready?"🔍 กำลังสแกน...":"⏳ กำลังเปิดกล้อง..."}</p>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [module,setModule]=useState("seminar");
  const [tab,setTab]=useState("list");
  const [seminars,setSeminars]=useState([]);
  const [competitors,setCompetitors]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [search,setSearch]=useState("");
  const [filterStatus,setFilterStatus]=useState("ทั้งหมด");
  const [showModal,setShowModal]=useState(false);
  const [editItem,setEditItem]=useState(null);
  const [form,setForm]=useState({});
  const [deleteConfirm,setDeleteConfirm]=useState(null);
  const [viewItem,setViewItem]=useState(null);
  const [qrItem,setQrItem]=useState(null);
  const [scanResult,setScanResult]=useState(null);
  const [scanError,setScanError]=useState("");
  const [manualCode,setManualCode]=useState("");
  const [scanMode,setScanMode]=useState("camera");
  const [toast,setToast]=useState(null);
  const [codeIdx,setCodeIdx]=useState({seminar:103,competition:3});

  const isConfigured = true;
  const isSeminar=module==="seminar";
  const dbTable=isSeminar?"seminars":"competitors";
  const data=isSeminar?seminars:competitors;
  const setData=isSeminar?setSeminars:setCompetitors;
  const statuses=isSeminar?statusOptions.seminar:statusOptions.competition;
  const checkedIn=data.filter(d=>d.checkedIn).length;

  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3200);};

  const loadData=useCallback(async()=>{
    if(!isConfigured){setLoading(false);return;}
    setLoading(true);
    try{
      const [s,c]=await Promise.all([sbGetAll("seminars"),sbGetAll("competitors")]);
      setSeminars(s.map(fromDb)); setCompetitors(c.map(fromDb));
      // sync code index
      const maxS=s.length?Math.max(...s.map(r=>parseInt(r.real_code?.split("-")[2]||0)))+1:103;
      const maxC=c.length?Math.max(...c.map(r=>parseInt(r.real_code?.split("-")[2]||0)))+1:3;
      setCodeIdx({seminar:maxS,competition:maxC});
    }catch(e){showToast("โหลดข้อมูลไม่สำเร็จ: "+e.message,"error");}
    setLoading(false);
  },[isConfigured]);

  useEffect(()=>{loadData();},[loadData]);

  const filtered=data.filter(item=>{
    const q=search.toLowerCase();
    const ms=item.name?.includes(search)||item.email?.toLowerCase().includes(q)||item.phone?.includes(q)||item.realCode?.toLowerCase().includes(q)||item.fakeCode?.toLowerCase().includes(q);
    const mf=filterStatus==="ทั้งหมด"||(filterStatus==="เช็คอินแล้ว"&&item.checkedIn)||item.status===filterStatus;
    return ms&&mf;
  });

  const nextIdx=()=>{const k=isSeminar?"seminar":"competition";const n=codeIdx[k];setCodeIdx(p=>({...p,[k]:n+1}));return n;};

  const openAdd=()=>{
    const idx=nextIdx();
    setEditItem(null);
    setForm({status:statuses[0],date:new Date().toISOString().split("T")[0],realCode:genRealCode(idx),fakeCode:genFakeCode(),checkedIn:false,checkInTime:""});
    setShowModal(true);
  };
  const openEdit=(item)=>{setEditItem(item);setForm({...item});setShowModal(true);};

  const handleSave=async()=>{
    if(!form.name||!form.phone||!form.email)return alert("กรุณากรอกชื่อ, เบอร์โทร, และอีเมล");
    setSaving(true);
    try{
      if(isConfigured){
        if(editItem){await sbUpdate(dbTable,editItem.id,toDb(form));}
        else{form.id=Date.now().toString();await sbInsert(dbTable,toDb(form));}
        await loadData();
      }else{
        if(editItem)setData(p=>p.map(d=>d.id===editItem.id?{...form,id:editItem.id}:d));
        else setData(p=>[...p,{...form,id:Date.now().toString()}]);
      }
      showToast(editItem?"แก้ไขข้อมูลสำเร็จ ✅":"เพิ่มข้อมูลสำเร็จ ✅");
      setShowModal(false);
    }catch(e){showToast("บันทึกไม่สำเร็จ: "+e.message,"error");}
    setSaving(false);
  };

  const handleDelete=async(id)=>{
    setSaving(true);
    try{
      if(isConfigured){await sbDelete(dbTable,id);await loadData();}
      else setData(p=>p.filter(d=>d.id!==id));
      showToast("ลบข้อมูลสำเร็จ"); setDeleteConfirm(null);
    }catch(e){showToast("ลบไม่สำเร็จ: "+e.message,"error");}
    setSaving(false);
  };

  const uploadPhoto=(e,field)=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>setForm(f=>({...f,[field]:r.result}));r.readAsDataURL(f);};

  const handleScan=useCallback((raw)=>{
    setScanError("");
    const all=[...seminars.map(s=>({...s,_t:"seminar"})),...competitors.map(c=>({...c,_t:"competition"}))];
    try{const p=JSON.parse(raw);const found=all.find(d=>d.realCode===p.realCode||d.fakeCode===p.fakeCode);if(!found){setScanError("ไม่พบข้อมูลที่ตรงกับ QR Code");return;}setScanResult({...found});}
    catch{const found=all.find(d=>d.realCode===raw.trim()||d.fakeCode===raw.trim());if(!found){setScanError(`ไม่พบรหัส "${raw.trim()}"`);return;}setScanResult({...found});}
  },[seminars,competitors]);

  const doCheckIn=async(item)=>{
    setSaving(true);
    const now=new Date().toLocaleString("th-TH");
    try{
      if(isConfigured){await sbUpdate(item._t==="seminar"?"seminars":"competitors",item.id,{checked_in:true,check_in_time:now});await loadData();}
      else{const upd=p=>p.map(d=>d.id===item.id?{...d,checkedIn:true,checkInTime:now}:d);if(item._t==="seminar")setSeminars(upd);else setCompetitors(upd);}
      setScanResult(p=>({...p,checkedIn:true,checkInTime:now}));
      showToast("เช็คอินสำเร็จ! ✅");
    }catch(e){showToast("เช็คอินไม่สำเร็จ: "+e.message,"error");}
    setSaving(false);
  };

  const switchModule=(m)=>{setModule(m);setSearch("");setFilterStatus("ทั้งหมด");setTab("list");setScanResult(null);setScanError("");};

  return (
    <div style={{minHeight:"100vh",background:"#0a0a14",fontFamily:"'Noto Sans Thai','Sarabun',sans-serif",color:"#e2d4f0"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#0a0a14}::-webkit-scrollbar-thumb{background:#c084fc44;border-radius:3px}
        input::placeholder{color:#4b5563}input:focus,select:focus{border-color:#c084fc88!important}
        .rh:hover{background:#ffffff06!important}
        .btn-primary{background:linear-gradient(135deg,#c084fc,#a855f7);color:white;border:none;border-radius:12px;padding:10px 20px;cursor:pointer;font-weight:600;font-size:14px;font-family:inherit;transition:opacity 0.2s}
        .btn-primary:hover{opacity:0.85}
        .bti{background:none;border:none;cursor:pointer;border-radius:8px;padding:5px 7px;font-size:14px;transition:background 0.15s}
        .bti:hover{background:#ffffff11}
      `}</style>

      {toast&&<div style={{position:"fixed",top:"20px",left:"50%",transform:"translateX(-50%)",zIndex:9999,background:toast.type==="error"?"#ef444422":"#10b98122",border:`1px solid ${toast.type==="error"?"#ef4444":"#10b981"}55`,borderRadius:"12px",padding:"11px 22px",color:toast.type==="error"?"#ef4444":"#10b981",fontWeight:"600",fontSize:"13px",animation:"fadeIn 0.3s ease",whiteSpace:"nowrap",boxShadow:"0 8px 24px rgba(0,0,0,0.3)"}}>{toast.msg}</div>}

      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#1a0a2e,#0f0a1e,#0a1020)",borderBottom:"1px solid #c084fc22",padding:"14px 18px"}}>
        <div style={{maxWidth:"1100px",margin:"0 auto",display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
          <div style={{width:"40px",height:"40px",background:"linear-gradient(135deg,#c084fc,#7c3aed)",borderRadius:"11px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"19px",flexShrink:0}}>💎</div>
          <div style={{flex:1}}>
            <h1 style={{margin:0,fontSize:"19px",fontFamily:"'Playfair Display',serif",background:"linear-gradient(135deg,#e9d5ff,#c084fc)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Lash Management System</h1>
            <p style={{margin:0,fontSize:"11px",color:"#9ca3af"}}>ระบบจัดการสัมมนาและการแข่งขันต่อขนตา</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"7px",background:isConfigured?"#10b98122":"#f59e0b22",border:`1px solid ${isConfigured?"#10b981":"#f59e0b"}44`,borderRadius:"10px",padding:"6px 12px"}}>
            <div style={{width:"7px",height:"7px",borderRadius:"50%",background:isConfigured?"#10b981":"#f59e0b",boxShadow:`0 0 6px ${isConfigured?"#10b981":"#f59e0b"}`}}/>
            <span style={{fontSize:"11px",fontWeight:"600",color:isConfigured?"#10b981":"#f59e0b"}}>{isConfigured?"🗄️ Supabase Connected":"⚠️ ยังไม่ได้เชื่อม DB"}</span>
          </div>
          {isConfigured&&<button onClick={loadData} style={{background:"#ffffff11",border:"1px solid #ffffff22",borderRadius:"9px",padding:"7px 12px",cursor:"pointer",color:"#9ca3af",fontFamily:"inherit",fontSize:"12px",display:"flex",alignItems:"center",gap:"5px"}}>{loading?<Spinner size={12}/>:"🔄"} รีเฟรช</button>}
        </div>
      </div>

      <div style={{maxWidth:"1100px",margin:"0 auto",padding:"18px 14px"}}>

        {/* Setup banner */}
        {!isConfigured&&(
          <div style={{background:"#f59e0b11",border:"1px solid #f59e0b33",borderRadius:"14px",padding:"16px 20px",marginBottom:"18px"}}>
            <div style={{fontWeight:"700",color:"#f59e0b",marginBottom:"4px"}}>⚙️ ยังไม่ได้เชื่อมต่อ Supabase</div>
            <div style={{fontSize:"12px",color:"#9ca3af"}}>แก้ไข SUPABASE_URL และ SUPABASE_KEY ในโค้ดด้านบน แล้ว deploy ใหม่ค่ะ</div>
          </div>
        )}

        {/* Module Tabs */}
        <div style={{display:"flex",background:"#12121e",border:"1px solid #c084fc22",borderRadius:"15px",padding:"5px",marginBottom:"16px",gap:"5px"}}>
          {[{k:"seminar",i:"🎓",l:"ระบบสัมมนา"},{k:"competition",i:"🏆",l:"การแข่งขันต่อขนตา"}].map(t=>(
            <button key={t.k} onClick={()=>switchModule(t.k)}
              style={{flex:1,padding:"10px",border:module===t.k?"1px solid #c084fc33":"1px solid transparent",cursor:"pointer",fontWeight:"700",fontSize:"14px",fontFamily:"inherit",transition:"all 0.2s",borderRadius:"11px",
                background:module===t.k?"linear-gradient(135deg,#c084fc22,#7c3aed22)":"transparent",color:module===t.k?"#c084fc":"#6b7280"}}>
              {t.i} {t.l}
            </button>
          ))}
        </div>

        {/* Sub Nav */}
        <div style={{display:"flex",gap:"7px",marginBottom:"16px",flexWrap:"wrap"}}>
          {[{k:"list",i:"📋",l:"รายชื่อ"},{k:"scan",i:"📷",l:"สแกน QR เช็คอิน"},{k:"checkin",i:"✅",l:`เช็คอินแล้ว (${checkedIn})`}].map(t=>(
            <button key={t.k} onClick={()=>{setTab(t.k);setScanResult(null);setScanError("");setManualCode("");}}
              style={{padding:"8px 15px",border:tab===t.k?"none":"1px solid #c084fc22",borderRadius:"10px",cursor:"pointer",fontWeight:"600",fontSize:"13px",fontFamily:"inherit",transition:"all 0.2s",
                background:tab===t.k?"linear-gradient(135deg,#c084fc,#a855f7)":"#12121e",color:tab===t.k?"white":"#9ca3af"}}>
              {t.i} {t.l}
            </button>
          ))}
        </div>

        {loading&&<div style={{textAlign:"center",padding:"60px",color:"#9ca3af",display:"flex",alignItems:"center",justifyContent:"center",gap:"12px"}}><Spinner size={24}/> กำลังโหลดข้อมูลจาก Supabase...</div>}

        {/* LIST */}
        {!loading&&tab==="list"&&(<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"12px",marginBottom:"16px"}}>
            {[{l:"ทั้งหมด",v:data.length,i:"👥",c:"#c084fc"},{l:isSeminar?"ยืนยันแล้ว":"ผ่านการคัดเลือก",v:data.filter(d=>d.status===(isSeminar?"ยืนยันแล้ว":"ผ่านการคัดเลือก")).length,i:"✅",c:"#10b981"},{l:"เช็คอินแล้ว",v:checkedIn,i:"📍",c:"#06b6d4"}].map((s,i)=>(
              <div key={i} style={{background:"#12121e",border:`1px solid ${s.c}22`,borderRadius:"13px",padding:"14px",textAlign:"center"}}>
                <div style={{fontSize:"22px",marginBottom:"3px"}}>{s.i}</div>
                <div style={{fontSize:"26px",fontWeight:"700",color:s.c,fontFamily:"'Playfair Display',serif"}}>{s.v}</div>
                <div style={{fontSize:"11px",color:"#9ca3af",marginTop:"2px"}}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:"9px",marginBottom:"13px",flexWrap:"wrap",alignItems:"center"}}>
            <div style={{flex:1,minWidth:"170px",position:"relative"}}>
              <span style={{position:"absolute",left:"11px",top:"50%",transform:"translateY(-50%)",color:"#6b7280",fontSize:"14px"}}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหาชื่อ, รหัส, อีเมล..." style={{...iS,paddingLeft:"34px"}}/>
            </div>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{...sS,width:"auto",minWidth:"140px"}}>
              <option>ทั้งหมด</option><option>เช็คอินแล้ว</option>
              {statuses.map(s=><option key={s}>{s}</option>)}
            </select>
            <button className="btn-primary" onClick={openAdd}>+ เพิ่มข้อมูล</button>
          </div>
          <div style={{background:"#12121e",border:"1px solid #c084fc22",borderRadius:"16px",overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:"800px"}}>
                <thead>
                  <tr style={{background:"#0f0f1a",borderBottom:"1px solid #c084fc22"}}>
                    {["#","ชื่อ","รหัสจริง 🔑","รหัสหลอก 🎭",isSeminar?"หัวข้อ":"ระดับ/ประเภท","สถานะ","เช็คอิน","จัดการ"].map(h=>(
                      <th key={h} style={{padding:"11px 13px",textAlign:"left",color:"#c084fc",fontSize:"11px",fontWeight:"700",letterSpacing:"0.5px",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length===0
                    ?<tr><td colSpan="8" style={{padding:"44px",textAlign:"center",color:"#4b5563"}}>ไม่พบข้อมูล</td></tr>
                    :filtered.map((item,i)=>(
                      <tr key={item.id} className="rh" style={{borderBottom:"1px solid #ffffff08"}}>
                        <td style={{padding:"11px 13px",color:"#6b7280",fontSize:"12px"}}>{i+1}</td>
                        <td style={{padding:"11px 13px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                            {item.photo&&item.photo.startsWith("data:")
                              ?<img src={item.photo} alt="" style={{width:"30px",height:"30px",borderRadius:"50%",objectFit:"cover",border:"2px solid #c084fc44",flexShrink:0}}/>
                              :<div style={{width:"30px",height:"30px",borderRadius:"50%",background:"linear-gradient(135deg,#c084fc33,#7c3aed33)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",border:"2px solid #c084fc22",flexShrink:0}}>{item.name?.charAt(0)}</div>}
                            <span style={{fontWeight:"600",fontSize:"13px"}}>{item.name}</span>
                          </div>
                        </td>
                        <td style={{padding:"11px 13px"}}><span style={{background:"#c084fc15",color:"#c084fc",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",fontWeight:"700",fontFamily:"monospace"}}>{item.realCode}</span></td>
                        <td style={{padding:"11px 13px"}}><span style={{background:"#7c3aed15",color:"#a78bfa",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",fontWeight:"700",fontFamily:"monospace"}}>{item.fakeCode}</span></td>
                        <td style={{padding:"11px 13px",color:"#d1d5db",fontSize:"12px"}}>{isSeminar?item.topic:<span>{item.level}<br/><span style={{color:"#9ca3af",fontSize:"11px"}}>{item.category}</span></span>}</td>
                        <td style={{padding:"11px 13px"}}><Badge status={item.status}/></td>
                        <td style={{padding:"11px 13px"}}>{item.checkedIn?<span style={{color:"#06b6d4",fontSize:"11px",fontWeight:"600"}}>✅ แล้ว</span>:<span style={{color:"#374151"}}>—</span>}</td>
                        <td style={{padding:"11px 13px"}}>
                          <div style={{display:"flex",gap:"1px"}}>
                            <button className="bti" onClick={()=>setViewItem(item)} style={{color:"#60a5fa"}}>👁</button>
                            <button className="bti" onClick={()=>setQrItem(item)} style={{color:"#10b981"}}>📱</button>
                            <button className="bti" onClick={()=>openEdit(item)} style={{color:"#c084fc"}}>✏️</button>
                            <button className="bti" onClick={()=>setDeleteConfirm(item)} style={{color:"#ef4444"}}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div style={{padding:"9px 16px",color:"#6b7280",fontSize:"12px",borderTop:"1px solid #ffffff08"}}>{isConfigured?"🗄️ ข้อมูลเชื่อมต่อ Supabase ":""}แสดง {filtered.length} จาก {data.length} รายการ</div>
          </div>
        </>)}

        {/* SCAN */}
        {!loading&&tab==="scan"&&(
          <div style={{maxWidth:"480px",margin:"0 auto"}}>
            <div style={{background:"#12121e",border:"1px solid #c084fc22",borderRadius:"18px",padding:"20px"}}>
              <h2 style={{margin:"0 0 14px",fontFamily:"'Playfair Display',serif",fontSize:"17px",textAlign:"center"}}>📷 สแกน QR Code เช็คอิน</h2>
              <div style={{display:"flex",background:"#0f0f1a",borderRadius:"11px",padding:"4px",marginBottom:"16px",gap:"4px"}}>
                {[{k:"camera",l:"📷 ใช้กล้อง"},{k:"manual",l:"⌨️ กรอกรหัส"}].map(m=>(
                  <button key={m.k} onClick={()=>{setScanMode(m.k);setScanResult(null);setScanError("");}}
                    style={{flex:1,padding:"9px",border:"none",borderRadius:"8px",cursor:"pointer",fontFamily:"inherit",fontWeight:"600",fontSize:"13px",
                      background:scanMode===m.k?"linear-gradient(135deg,#c084fc,#a855f7)":"transparent",color:scanMode===m.k?"white":"#6b7280"}}>{m.l}</button>
                ))}
              </div>
              {!scanResult?(<>
                {scanMode==="camera"?<QRScanner onScan={handleScan}/>:
                  <div>
                    <p style={{color:"#9ca3af",fontSize:"13px",textAlign:"center",marginBottom:"12px"}}>กรอกรหัสจริง (LASH-...) หรือรหัสหลอก (AX...)</p>
                    <div style={{display:"flex",gap:"8px"}}>
                      <input value={manualCode} onChange={e=>setManualCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleScan(manualCode)}
                        placeholder="LASH-2025-0001" style={{...iS,flex:1,fontFamily:"monospace",fontSize:"13px",letterSpacing:"1px"}}/>
                      <button className="btn-primary" onClick={()=>handleScan(manualCode)}>ค้นหา</button>
                    </div>
                  </div>}
                {scanError&&<div style={{marginTop:"12px",background:"#ef444420",border:"1px solid #ef444433",borderRadius:"10px",padding:"11px",color:"#ef4444",fontSize:"13px",textAlign:"center"}}>❌ {scanError}</div>}
              </>):(
                <div>
                  <div style={{background:"#0f0f1a",borderRadius:"14px",padding:"16px",textAlign:"center",marginBottom:"12px"}}>
                    {scanResult.photo&&scanResult.photo.startsWith("data:")
                      ?<img src={scanResult.photo} alt="" style={{width:"60px",height:"60px",borderRadius:"50%",objectFit:"cover",border:"3px solid #c084fc44",display:"block",margin:"0 auto 9px"}}/>
                      :<div style={{width:"60px",height:"60px",borderRadius:"50%",background:"linear-gradient(135deg,#c084fc44,#7c3aed44)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"24px",margin:"0 auto 9px",border:"3px solid #c084fc44"}}>{scanResult.name?.charAt(0)}</div>}
                    <div style={{fontFamily:"'Playfair Display',serif",fontSize:"18px",marginBottom:"4px"}}>{scanResult.name}</div>
                    <div style={{color:"#9ca3af",fontSize:"11px",marginBottom:"8px"}}>{scanResult._t==="seminar"?"👩‍🏫 สัมมนา":"🏆 แข่งขัน"}</div>
                    <div style={{display:"flex",gap:"6px",justifyContent:"center",flexWrap:"wrap",marginBottom:"10px"}}>
                      <span style={{background:"#c084fc22",color:"#c084fc",borderRadius:"7px",padding:"3px 10px",fontSize:"11px",fontFamily:"monospace",fontWeight:"700"}}>🔑 {scanResult.realCode}</span>
                      <span style={{background:"#7c3aed22",color:"#a78bfa",borderRadius:"7px",padding:"3px 10px",fontSize:"11px",fontFamily:"monospace",fontWeight:"700"}}>🎭 {scanResult.fakeCode}</span>
                    </div>
                    <Badge status={scanResult.checkedIn?"เช็คอินแล้ว":scanResult.status}/>
                    {scanResult.checkedIn&&<p style={{color:"#06b6d4",fontSize:"11px",marginTop:"6px"}}>✅ {scanResult.checkInTime}</p>}
                  </div>
                  <div style={{display:"flex",gap:"8px"}}>
                    {!scanResult.checkedIn
                      ?<button className="btn-primary" onClick={()=>doCheckIn(scanResult)} style={{flex:2,display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}}>{saving&&<Spinner size={14}/>}✅ เช็คอินเข้างาน</button>
                      :<div style={{flex:2,textAlign:"center",padding:"10px",color:"#06b6d4",fontWeight:"700"}}>✅ เช็คอินแล้ว</div>}
                    <button onClick={()=>{setScanResult(null);setScanError("");setManualCode("");}}
                      style={{flex:1,background:"#ffffff11",border:"1px solid #ffffff22",borderRadius:"11px",padding:"10px",cursor:"pointer",color:"#9ca3af",fontFamily:"inherit",fontWeight:"600"}}>สแกนใหม่</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CHECKIN LIST */}
        {!loading&&tab==="checkin"&&(
          <div style={{background:"#12121e",border:"1px solid #06b6d422",borderRadius:"16px",overflow:"hidden"}}>
            <div style={{padding:"13px 18px",borderBottom:"1px solid #ffffff08"}}>
              <h3 style={{margin:0,color:"#06b6d4",fontSize:"15px"}}>✅ รายชื่อเช็คอินแล้ว ({checkedIn} คน)</h3>
            </div>
            {data.filter(d=>d.checkedIn).length===0
              ?<div style={{padding:"44px",textAlign:"center",color:"#4b5563"}}>ยังไม่มีการเช็คอิน</div>
              :data.filter(d=>d.checkedIn).map((item,i)=>(
                <div key={item.id} className="rh" style={{display:"flex",alignItems:"center",gap:"11px",padding:"12px 18px",borderBottom:"1px solid #ffffff06"}}>
                  <div style={{width:"24px",height:"24px",borderRadius:"50%",background:"#06b6d422",display:"flex",alignItems:"center",justifyContent:"center",color:"#06b6d4",fontWeight:"700",fontSize:"11px",flexShrink:0}}>{i+1}</div>
                  <div style={{width:"36px",height:"36px",borderRadius:"50%",background:"linear-gradient(135deg,#06b6d433,#0891b233)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",border:"2px solid #06b6d422",flexShrink:0}}>{item.name?.charAt(0)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:"600",fontSize:"13px"}}>{item.name}</div>
                    <div style={{color:"#9ca3af",fontSize:"11px",fontFamily:"monospace"}}>{item.realCode} · {item.fakeCode}</div>
                  </div>
                  <div style={{color:"#06b6d4",fontSize:"11px",fontWeight:"600",textAlign:"right"}}>{item.checkInTime}</div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal show={showModal} onClose={()=>setShowModal(false)} title={editItem?"✏️ แก้ไขข้อมูล":`➕ เพิ่ม${isSeminar?"ผู้ลงทะเบียน":"ผู้แข่งขัน"}`}>
        <FormField label="ชื่อ-นามสกุล *"><input style={iS} value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="กรอกชื่อ-นามสกุล"/></FormField>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"11px"}}>
          <FormField label="เบอร์โทร *"><input style={iS} value={form.phone||""} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="0xx-xxx-xxxx"/></FormField>
          <FormField label="อีเมล *"><input style={iS} value={form.email||""} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="example@email.com"/></FormField>
        </div>
        <div style={{background:"#0f0f1a",border:"1px solid #c084fc22",borderRadius:"11px",padding:"13px",marginBottom:"13px"}}>
          <div style={{fontSize:"11px",color:"#c084fc",fontWeight:"700",letterSpacing:"0.5px",marginBottom:"9px",textTransform:"uppercase"}}>🔑 รหัสผู้เข้าร่วม</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"9px"}}>
            <div>
              <div style={{fontSize:"11px",color:"#9ca3af",marginBottom:"5px"}}>รหัสจริง (Official)</div>
              <input style={{...iS,fontFamily:"monospace",fontSize:"12px",letterSpacing:"1px",color:"#c084fc"}} value={form.realCode||""} onChange={e=>setForm(f=>({...f,realCode:e.target.value}))}/>
            </div>
            <div>
              <div style={{fontSize:"11px",color:"#9ca3af",marginBottom:"5px"}}>รหัสหลอก (Anonymous)</div>
              <div style={{display:"flex",gap:"5px"}}>
                <input style={{...iS,fontFamily:"monospace",fontSize:"12px",letterSpacing:"1px",color:"#a78bfa",flex:1}} value={form.fakeCode||""} onChange={e=>setForm(f=>({...f,fakeCode:e.target.value}))}/>
                <button onClick={()=>setForm(f=>({...f,fakeCode:genFakeCode()}))} style={{background:"#7c3aed33",border:"1px solid #7c3aed44",borderRadius:"8px",padding:"6px 9px",cursor:"pointer",color:"#a78bfa",fontSize:"13px"}}>🔄</button>
              </div>
            </div>
          </div>
        </div>
        {isSeminar?(
          <FormField label="หัวข้อสัมมนา"><select style={sS} value={form.topic||""} onChange={e=>setForm(f=>({...f,topic:e.target.value}))}><option value="">-- เลือกหัวข้อ --</option>{seminarTopics.map(t=><option key={t}>{t}</option>)}</select></FormField>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"11px"}}>
            <FormField label="ระดับ"><select style={sS} value={form.level||""} onChange={e=>setForm(f=>({...f,level:e.target.value}))}><option value="">-- เลือก --</option>{competitionLevels.map(l=><option key={l}>{l}</option>)}</select></FormField>
            <FormField label="ประเภท"><select style={sS} value={form.category||""} onChange={e=>setForm(f=>({...f,category:e.target.value}))}><option value="">-- เลือก --</option>{competitionCategories.map(c=><option key={c}>{c}</option>)}</select></FormField>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"11px"}}>
          <FormField label="สถานะ"><select style={sS} value={form.status||""} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>{statuses.map(s=><option key={s}>{s}</option>)}</select></FormField>
          <FormField label="วันที่ลงทะเบียน"><input type="date" style={iS} value={form.date||""} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></FormField>
        </div>
        <FormField label="รูปถ่าย">
          <input type="file" accept="image/*" onChange={e=>uploadPhoto(e,"photo")} style={{...iS,padding:"8px"}}/>
          {form.photo&&form.photo.startsWith("data:")&&<img src={form.photo} alt="" style={{marginTop:"7px",width:"60px",height:"60px",borderRadius:"50%",objectFit:"cover",border:"2px solid #c084fc44"}}/>}
        </FormField>
        {!isSeminar&&(
          <FormField label="รูปผลงาน">
            <input type="file" accept="image/*" onChange={e=>uploadPhoto(e,"work")} style={{...iS,padding:"8px"}}/>
            {form.work&&form.work.startsWith("data:")&&<img src={form.work} alt="" style={{marginTop:"7px",width:"100%",maxHeight:"120px",objectFit:"cover",borderRadius:"9px",border:"1px solid #c084fc22"}}/>}
          </FormField>
        )}
        <div style={{display:"flex",gap:"9px",marginTop:"8px"}}>
          <button className="btn-primary" onClick={handleSave} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:"7px"}}>{saving&&<Spinner size={14}/>}{editItem?"บันทึกการแก้ไข":"เพิ่มข้อมูล"}</button>
          <button onClick={()=>setShowModal(false)} style={{flex:1,background:"#ffffff11",border:"1px solid #ffffff22",borderRadius:"11px",padding:"10px",cursor:"pointer",color:"#9ca3af",fontFamily:"inherit",fontWeight:"600"}}>ยกเลิก</button>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal show={!!viewItem} onClose={()=>setViewItem(null)} title="👁 รายละเอียด">
        {viewItem&&(<div>
          <div style={{textAlign:"center",marginBottom:"16px"}}>
            {viewItem.photo&&viewItem.photo.startsWith("data:")?<img src={viewItem.photo} alt="" style={{width:"66px",height:"66px",borderRadius:"50%",objectFit:"cover",border:"3px solid #c084fc44"}}/>
              :<div style={{width:"66px",height:"66px",borderRadius:"50%",background:"linear-gradient(135deg,#c084fc44,#7c3aed44)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"26px",margin:"0 auto",border:"3px solid #c084fc44"}}>{viewItem.name?.charAt(0)}</div>}
            <h3 style={{margin:"9px 0 6px",fontFamily:"'Playfair Display',serif"}}>{viewItem.name}</h3>
            <Badge status={viewItem.checkedIn?"เช็คอินแล้ว":viewItem.status}/>
            <div style={{display:"flex",gap:"7px",justifyContent:"center",marginTop:"9px",flexWrap:"wrap"}}>
              <span style={{background:"#c084fc22",color:"#c084fc",borderRadius:"7px",padding:"3px 10px",fontSize:"11px",fontWeight:"700",fontFamily:"monospace"}}>🔑 {viewItem.realCode}</span>
              <span style={{background:"#7c3aed22",color:"#a78bfa",borderRadius:"7px",padding:"3px 10px",fontSize:"11px",fontWeight:"700",fontFamily:"monospace"}}>🎭 {viewItem.fakeCode}</span>
            </div>
          </div>
          {[["📱 เบอร์โทร",viewItem.phone],["📧 อีเมล",viewItem.email],[isSeminar?"📚 หัวข้อ":"🏆 ระดับ",isSeminar?viewItem.topic:viewItem.level],...(!isSeminar?[["🎯 ประเภท",viewItem.category]]:[]),["📅 วันที่",viewItem.date],...(viewItem.checkedIn?[["⏰ เช็คอินเมื่อ",viewItem.checkInTime]]:[])].map(([l,v])=>v&&(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #ffffff0a"}}>
              <span style={{color:"#9ca3af",fontSize:"12px"}}>{l}</span>
              <span style={{color:"#e2d4f0",fontSize:"12px",fontWeight:"500",textAlign:"right",maxWidth:"60%"}}>{v}</span>
            </div>
          ))}
          <button className="btn-primary" onClick={()=>{setQrItem(viewItem);setViewItem(null);}} style={{width:"100%",marginTop:"14px"}}>📱 ดู QR Code</button>
        </div>)}
      </Modal>

      {/* QR Modal */}
      <Modal show={!!qrItem} onClose={()=>setQrItem(null)} title="📱 QR Code">
        {qrItem&&(<div>
          <div style={{background:"#0f0f1a",border:"1px solid #c084fc22",borderRadius:"14px",padding:"18px",textAlign:"center",marginBottom:"12px"}}>
            <img src={qrUrl(makeQRPayload(qrItem,isSeminar?"seminar":"competition"),200)} alt="QR" style={{width:"200px",height:"200px",borderRadius:"10px",display:"block",margin:"0 auto 12px"}}/>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:"17px",marginBottom:"9px"}}>{qrItem.name}</div>
            <div style={{display:"flex",gap:"7px",justifyContent:"center",flexWrap:"wrap",marginBottom:"9px"}}>
              <span style={{background:"#c084fc22",color:"#c084fc",borderRadius:"8px",padding:"4px 12px",fontSize:"12px",fontWeight:"700",fontFamily:"monospace"}}>🔑 {qrItem.realCode}</span>
              <span style={{background:"#7c3aed22",color:"#a78bfa",borderRadius:"8px",padding:"4px 12px",fontSize:"12px",fontWeight:"700",fontFamily:"monospace"}}>🎭 {qrItem.fakeCode}</span>
            </div>
            <Badge status={qrItem.checkedIn?"เช็คอินแล้ว":qrItem.status}/>
          </div>
          <button onClick={()=>window.print()} className="btn-primary" style={{width:"100%"}}>🖨️ พิมพ์ QR Card</button>
        </div>)}
      </Modal>

      {/* Delete Modal */}
      <Modal show={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} title="🗑 ยืนยันการลบ">
        {deleteConfirm&&(<div style={{textAlign:"center"}}>
          <p style={{color:"#d1d5db",marginBottom:"20px"}}>ต้องการลบข้อมูลของ <strong style={{color:"#e2d4f0"}}>{deleteConfirm.name}</strong> ใช่หรือไม่?</p>
          <div style={{display:"flex",gap:"9px"}}>
            <button onClick={()=>handleDelete(deleteConfirm.id)} style={{flex:1,background:"linear-gradient(135deg,#ef4444,#dc2626)",color:"white",border:"none",borderRadius:"11px",padding:"11px",cursor:"pointer",fontWeight:"700",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}}>{saving&&<Spinner size={14}/>}ลบข้อมูล</button>
            <button onClick={()=>setDeleteConfirm(null)} style={{flex:1,background:"#ffffff11",border:"1px solid #ffffff22",borderRadius:"11px",padding:"11px",cursor:"pointer",color:"#9ca3af",fontFamily:"inherit"}}>ยกเลิก</button>
          </div>
        </div>)}
      </Modal>
    </div>
  );
}
