const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwFLTe2XX9tIkU6T2u0gETwwkOChWQ5bZ1GQfEsvRQGnud7jBcE800w_HahdPtFtIBu/exec";

let canvas, ctx, drawing = false, hasInk = false;
let speakerPhotoData = "";
let presentationFileData = "";
let presentationFileName = "";

window.addEventListener("load", () => {
  canvas = document.getElementById("signature");
  ctx = canvas.getContext("2d");
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  canvas.addEventListener("pointerdown", start);
  canvas.addEventListener("pointermove", draw);
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointerleave", stop);

  document.getElementById("speakerPhoto").addEventListener("change", handleSpeakerPhoto);
  document.getElementById("presentationFile").addEventListener("change", handlePresentationFile);
  updateDateMode();
  toggleOther();
});

function pos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
}
function start(e) {
  drawing = true; hasInk = true; canvas.setPointerCapture(e.pointerId);
  const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
}
function draw(e) {
  if (!drawing) return;
  const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
}
function stop() { drawing = false; }

function clearSignature() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasInk = false;
  document.getElementById("signatureFile").value = "";
}
function loadImage(e) {
  const f = e.target.files[0];
  if (!f) return;
  if (!f.type.startsWith("image/")) { status("Please choose an image file for the signature.", false); return; }
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = Math.min(canvas.width / img.width, canvas.height / img.height);
    const w = img.width * s, h = img.height * s;
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    hasInk = true;
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(f);
}
function toggleOther() {
  const org = document.getElementById("organization");
  document.getElementById("otherWrap").classList.toggle("hidden", org.value !== "Others");
}
function showDay() {
  const v = document.getElementById("presentationDate").value;
  document.getElementById("weekday").textContent = v
    ? new Date(v + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "";
}
function status(msg, ok) {
  const s = document.getElementById("status");
  s.textContent = msg;
  s.className = ok ? "ok" : "err";
}
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the uploaded photograph."));
    reader.readAsDataURL(file);
  });
}
async function handleSpeakerPhoto(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) { clearSpeakerPhoto(); return; }
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    e.target.value = "";
    status("Please upload the face photograph as JPG, PNG or WebP.", false);
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    e.target.value = "";
    status("The photograph must be 3 MB or smaller.", false);
    return;
  }
  try {
    speakerPhotoData = await readFileAsDataURL(file);
    document.getElementById("speakerPhotoPreview").src = speakerPhotoData;
    document.getElementById("speakerPhotoPreviewWrap").classList.remove("hidden");
  } catch (err) {
    status(err.message, false);
  }
}
async function handlePresentationFile(e) {
  const file = e.target.files && e.target.files[0];
  presentationFileData = "";
  presentationFileName = "";
  document.getElementById("presentationFileName").textContent = "";
  if (!file) return;
  const isPptx = file.name.toLowerCase().endsWith(".pptx") &&
    (file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || file.type === "" || file.type === "application/octet-stream");
  if (!isPptx) {
    e.target.value = "";
    status("Please upload a PowerPoint presentation in .pptx format only.", false);
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    e.target.value = "";
    status("The PPTX presentation must be 10 MB or smaller.", false);
    return;
  }
  try {
    presentationFileData = await readFileAsDataURL(file);
    presentationFileName = file.name;
    document.getElementById("presentationFileName").textContent = "Selected presentation: " + file.name;
  } catch (err) {
    e.target.value = "";
    status("Could not read the PPTX presentation.", false);
  }
}
function clearPresentationFile() {
  presentationFileData = "";
  presentationFileName = "";
  const input = document.getElementById("presentationFile");
  if (input) input.value = "";
  const label = document.getElementById("presentationFileName");
  if (label) label.textContent = "";
}

function clearSpeakerPhoto() {
  speakerPhotoData = "";
  const input = document.getElementById("speakerPhoto");
  if (input) input.value = "";
  const preview = document.getElementById("speakerPhotoPreview");
  if (preview) preview.removeAttribute("src");
  const wrap = document.getElementById("speakerPhotoPreviewWrap");
  if (wrap) wrap.classList.add("hidden");
}

document.getElementById("speakerForm").addEventListener("submit", async e => {
  e.preventDefault();

  const role = document.getElementById("role").value;
  const usesDateRange = ["Resource Person", "Course Director", "Assistant Course Director"].includes(role);
  const from = document.getElementById("fromDate").value;
  const to = document.getElementById("toDate").value;
  const presentationDate = document.getElementById("presentationDate").value;
  const sessionStartTime = document.getElementById("sessionStartTime").value;
  const sessionEndTime = document.getElementById("sessionEndTime").value;

  if (usesDateRange && (!from || !to)) {
    status("For Course Director, Assistant Course Director and Resource Person, please enter both the From Date and To Date.", false); return;
  }
  if (usesDateRange && from > to) {
    status("Presentation From Date cannot be later than Presentation To Date.", false); return;
  }
  if (!usesDateRange && (!presentationDate || !sessionStartTime || !sessionEndTime)) {
    status("Please select the presentation date and session start/end timings.", false); return;
  }
  if (!usesDateRange && sessionStartTime >= sessionEndTime) {
    status("Session end time must be later than session start time.", false); return;
  }

  const orgValue = document.getElementById("organization").value;
  const otherOrg = document.getElementById("otherOrg").value.trim();
  if (orgValue === "Others" && !otherOrg) {
    status("Please enter the name of the other organization.", false); return;
  }

  const attitudinalChanges = [1,2,3,4,5].map(i => document.getElementById("attitudinalChange" + i).value.trim());
  const skills = [1,2,3,4,5].map(i => document.getElementById("skill" + i).value.trim());

  const data = {
    workshopTitle: document.getElementById("workshopTitle").value.trim(),
    targetGroup: document.getElementById("targetGroup").value,
    name: document.getElementById("name").value.trim(),
    rank: document.getElementById("rank") ? document.getElementById("rank").value.trim() : "",
    organization: orgValue === "Others" ? otherOrg : orgValue,
    whatsapp: document.getElementById("whatsapp").value.trim(),
    bank: document.getElementById("bank").value.trim(),
    ifsc: document.getElementById("ifsc").value.trim().toUpperCase(),
    upi: document.getElementById("upi").value.trim(),
    pan: document.getElementById("pan").value.trim().toUpperCase(),
    role,
    presentationDate: usesDateRange ? "" : presentationDate,
    sessionStartTime: usesDateRange ? "" : sessionStartTime,
    sessionEndTime: usesDateRange ? "" : sessionEndTime,
    fromDate: usesDateRange ? from : "",
    toDate: usesDateRange ? to : "",
    speakerPhotoData,
    presentationFileData,
    presentationFileName,
    briefProfile: document.getElementById("briefProfile").value.trim(),
    signatureData: hasInk ? canvas.toDataURL("image/png") : "",
    attitudinalChanges,
    skills
  };

  const btn = document.getElementById("saveBtn");
  btn.disabled = true;
  btn.textContent = "Saving…";
  try {
    const r = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify(data) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "Unable to save the speaker record.");
    let message = "✅ Speaker record saved successfully. Record ID: " + j.recordId;
    if (j.pdfUrl) message += " | PDF: " + j.pdfUrl;
    if (j.presentationFileUrl) message += " | PPTX: " + j.presentationFileUrl;
    if (!j.emailSent && j.emailError) message += " | Record saved; email notification failed: " + j.emailError;
    status(message, true);
    resetForm(false);
  } catch (err) {
    status("❌ " + err.message, false);
  } finally {
    btn.disabled = false;
    btn.textContent = "💾 Save Speaker Record";
  }
});

function resetForm(show = true) {
  document.getElementById("speakerForm").reset();
  document.getElementById("otherWrap").classList.add("hidden");
  document.getElementById("weekday").textContent = "";
  clearSignature();
  clearSpeakerPhoto();
  clearPresentationFile();
  updateDateMode();
  if (show) status("Form cleared.", true);
}
