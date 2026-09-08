const APPS_SCRIPT_URL="https://script.google.com/macros/s/AKfycbwFLTe2XX9tIkU6T2u0gETwwkOChWQ5bZ1GQfEsvRQGnud7jBcE800w_HahdPtFtIBu/exec";

let canvas,ctx,drawing=false,hasInk=false;
window.addEventListener("load",()=>{canvas=document.getElementById("signature");ctx=canvas.getContext("2d");ctx.lineWidth=4;ctx.lineCap="round";ctx.lineJoin="round";canvas.addEventListener("pointerdown",start);canvas.addEventListener("pointermove",draw);canvas.addEventListener("pointerup",stop);canvas.addEventListener("pointerleave",stop)});
function pos(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}}
function start(e){drawing=true;hasInk=true;canvas.setPointerCapture(e.pointerId);let p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y)}
function draw(e){if(!drawing)return;let p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke()}
function stop(){drawing=false}
function clearSignature(){ctx.clearRect(0,0,canvas.width,canvas.height);hasInk=false;document.getElementById("signatureFile").value=""}
function loadImage(e){const f=e.target.files[0];if(!f)return;const img=new Image();img.onload=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);const s=Math.min(canvas.width/img.width,canvas.height/img.height);const w=img.width*s,h=img.height*s;ctx.drawImage(img,(canvas.width-w)/2,(canvas.height-h)/2,w,h);hasInk=true};img.src=URL.createObjectURL(f)}
function toggleOther(){document.getElementById("otherWrap").classList.toggle("hidden",document.getElementById("organization").value!=="Others")}
function showDay(){const v=document.getElementById("presentationDate").value;document.getElementById("weekday").textContent=v?new Date(v+"T00:00:00").toLocaleDateString(undefined,{weekday:"long",year:"numeric",month:"long",day:"numeric"}):""}
function status(msg,ok){const s=document.getElementById("status");s.textContent=msg;s.className=ok?"ok":"err"}

function printForm(){
  window.print();
}

document.getElementById("speakerForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const from=document.getElementById("fromDate").value,to=document.getElementById("toDate").value;
 if(from&&to&&from>to){status("Presentation From Date cannot be later than Presentation To Date.",false);return}
 const org=document.getElementById("organization").value;
 const data={name:document.getElementById("name").value.trim(),rank:document.getElementById("rank").value.trim(),organization:org==="Others"?(document.getElementById("otherOrg").value.trim()||"Others"):org,whatsapp:document.getElementById("whatsapp").value.trim(),bank:document.getElementById("bank").value.trim(),ifsc:document.getElementById("ifsc").value.trim().toUpperCase(),upi:document.getElementById("upi").value.trim(),pan:document.getElementById("pan").value.trim().toUpperCase(),presentationDate:document.getElementById("presentationDate").value,fromDate:from,toDate:to,role:document.getElementById("role").value,signatureData:hasInk?canvas.toDataURL("image/png"):""};
 const btn=document.getElementById("saveBtn");btn.disabled=true;btn.textContent="Saving…";
 try{const r=await fetch(APPS_SCRIPT_URL,{method:"POST",body:JSON.stringify(data)});const j=await r.json();if(!j.ok)throw new Error(j.error||"Unable to save");status("✅ Speaker record saved successfully. Record ID: "+j.recordId,true)}
 catch(err){status("❌ "+err.message,false)}
 finally{btn.disabled=false;btn.textContent="💾 Save Speaker Record"}
});

function resetForm(show=true){document.getElementById("speakerForm").reset();document.getElementById("otherWrap").classList.add("hidden");document.getElementById("weekday").textContent="";clearSignature();if(show)status("Form cleared.",true)}
