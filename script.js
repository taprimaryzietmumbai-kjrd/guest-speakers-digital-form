
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxU2FvNxHsnun7ZXmWQiNc7UAYe-zArH9mYojLOQXnyhTG1R-IBkKIn0pJhoSlm-bBy/exec";

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
  canvas.addEventListener("pointercancel", stop);

  document.getElementById("speakerPhoto")
    .addEventListener("change", handleSpeakerPhoto);

  document.getElementById("presentationFile")
    .addEventListener("change", handlePresentationFile);

  updateDateMode();
  toggleOther();
});

function pos(e) {
  const r = canvas.getBoundingClientRect();

  return {
    x: (e.clientX - r.left) * canvas.width / r.width,
    y: (e.clientY - r.top) * canvas.height / r.height
  };
}

function start(e) {
  drawing = true;
  hasInk = true;

  canvas.setPointerCapture(e.pointerId);

  const p = pos(e);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
}

function draw(e) {
  if (!drawing) return;

  const p = pos(e);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

function stop() {
  drawing = false;
}

function clearSignature() {
  if (!ctx || !canvas) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasInk = false;

  const input = document.getElementById("signatureFile");
  if (input) input.value = "";
}

function loadImage(e) {
  const file = e.target.files && e.target.files[0];

  if (!file) return;

  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {
    e.target.value = "";
    status("Please choose a PNG, JPG or WebP image for the signature.", false);
    return;
  }

  const img = new Image();

  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = Math.min(
      canvas.width / img.width,
      canvas.height / img.height
    );

    const width = img.width * scale;
    const height = img.height * scale;

    ctx.drawImage(
      img,
      (canvas.width - width) / 2,
      (canvas.height - height) / 2,
      width,
      height
    );

    hasInk = true;
    URL.revokeObjectURL(img.src);
  };

  img.onerror = () => {
    e.target.value = "";
    status("Unable to load the signature image.", false);
    URL.revokeObjectURL(img.src);
  };

  img.src = URL.createObjectURL(file);
}

function toggleOther() {
  const org = document.getElementById("organization");
  const otherWrap = document.getElementById("otherWrap");

  if (!org || !otherWrap) return;

  otherWrap.classList.toggle("hidden", org.value !== "Others");

  const otherInput = document.getElementById("otherOrg");
  if (otherInput) {
    otherInput.required = org.value === "Others";
  }
}

function showDay() {
  const input = document.getElementById("presentationDate");
  const weekday = document.getElementById("weekday");

  if (!input || !weekday) return;

  const value = input.value;

  weekday.textContent = value
    ? new Date(value + "T00:00:00").toLocaleDateString(
        undefined,
        {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric"
        }
      )
    : "";
}

function status(message, ok) {
  const element = document.getElementById("status");

  if (!element) return;

  element.textContent = message;
  element.className = ok ? "ok" : "err";
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));

    reader.onerror = () => {
      reject(new Error("Could not read the selected file."));
    };

    reader.readAsDataURL(file);
  });
}

/* -------------------------------------------------------
   SPEAKER PHOTOGRAPH
   Accepted: JPG, PNG and WebP
   Maximum size: 3 MB
------------------------------------------------------- */

async function handleSpeakerPhoto(e) {
  const file = e.target.files && e.target.files[0];

  if (!file) {
    clearSpeakerPhoto();
    return;
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {
    e.target.value = "";
    clearSpeakerPhoto();
    status("Please upload the photograph as JPG, PNG or WebP.", false);
    return;
  }

  if (file.size > 3 * 1024 * 1024) {
    e.target.value = "";
    clearSpeakerPhoto();
    status("The photograph must be 3 MB or smaller.", false);
    return;
  }

  try {
    speakerPhotoData = await readFileAsDataURL(file);

    const preview = document.getElementById("speakerPhotoPreview");
    const previewWrap = document.getElementById("speakerPhotoPreviewWrap");

    preview.src = speakerPhotoData;
    previewWrap.classList.remove("hidden");

    status("Photograph selected successfully.", true);
  } catch (error) {
    e.target.value = "";
    clearSpeakerPhoto();
    status(error.message, false);
  }
}

function clearSpeakerPhoto() {
  speakerPhotoData = "";

  const input = document.getElementById("speakerPhoto");
  if (input) input.value = "";

  const preview = document.getElementById("speakerPhotoPreview");

  if (preview) {
    preview.removeAttribute("src");
  }

  const wrap = document.getElementById("speakerPhotoPreviewWrap");

  if (wrap) {
    wrap.classList.add("hidden");
  }
}

/* -------------------------------------------------------
   OPTIONAL ADVANCE PPTX PRESENTATION
   Accepted: .pptx
   Maximum size: 10 MB
------------------------------------------------------- */

async function handlePresentationFile(e) {
  const file = e.target.files && e.target.files[0];

  presentationFileData = "";
  presentationFileName = "";

  const label = document.getElementById("presentationFileName");

  if (label) label.textContent = "";

  if (!file) return;

  const isPptx = file.name.toLowerCase().endsWith(".pptx");

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

    if (label) {
      label.textContent = "Selected presentation: " + file.name;
    }

    status("PPTX presentation selected successfully.", true);
  } catch (error) {
    e.target.value = "";
    clearPresentationFile();
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

/* -------------------------------------------------------
   ROLE-BASED DATE AND SESSION VALIDATION
   Date range:
   - Resource Person
   - Course Director
   - Assistant Course Director

   Other roles:
   - One presentation date
   - Session start and end times
------------------------------------------------------- */

function updateDateMode() {
  const roleElement = document.getElementById("role");

  if (!roleElement) return;

  const role = roleElement.value;

  const dateField = document.getElementById("presentationDate");
  const adminFixedSchedule = Boolean(dateField && dateField.dataset.fixedByAdmin === "true");
  const usesDateRange = !adminFixedSchedule && [
    "Resource Person",
    "Course Director",
    "Assistant Course Director"
  ].includes(role);

  document.getElementById("presentationDateWrap")
    .classList.toggle("hidden", usesDateRange);

  document.getElementById("sessionTimingWrap")
    .classList.toggle("hidden", usesDateRange);

  document.getElementById("fromDateWrap")
    .classList.toggle("hidden", !usesDateRange);

  document.getElementById("toDateWrap")
    .classList.toggle("hidden", !usesDateRange);

  document.getElementById("presentationDate").required = !usesDateRange;
  document.getElementById("sessionStartTime").required = !usesDateRange;
  document.getElementById("sessionEndTime").required = !usesDateRange;
  document.getElementById("fromDate").required = usesDateRange;
  document.getElementById("toDate").required = usesDateRange;

  if (usesDateRange) {
    document.getElementById("presentationDate").value = "";
    document.getElementById("sessionStartTime").value = "";
    document.getElementById("sessionEndTime").value = "";
    document.getElementById("weekday").textContent = "";
  } else {
    document.getElementById("fromDate").value = "";
    document.getElementById("toDate").value = "";
  }
}

/* -------------------------------------------------------
   FORM SUBMISSION
------------------------------------------------------- */

document.getElementById("speakerForm").addEventListener("submit", async e => {
  e.preventDefault();

  const role = document.getElementById("role").value;

  // Match updateDateMode(): a coordinator-fixed date uses the single-date
  // workflow even when the selected role normally uses a date range.
  const adminFixedSchedule = Boolean(
    document.getElementById("presentationDate") &&
    document.getElementById("presentationDate").dataset.fixedByAdmin === "true"
  );

  const usesDateRange = !adminFixedSchedule && [
    "Resource Person",
    "Course Director",
    "Assistant Course Director"
  ].includes(role);

  const fromDate = document.getElementById("fromDate").value;
  const toDate = document.getElementById("toDate").value;

  const presentationDate =
    document.getElementById("presentationDate").value;

  const sessionStartTime =
    document.getElementById("sessionStartTime").value;

  const sessionEndTime =
    document.getElementById("sessionEndTime").value;

  /* Date-range validation */

  if (usesDateRange && (!fromDate || !toDate)) {
    status(
      "For Course Director, Assistant Course Director and Resource Person, please enter both the From Date and To Date.",
      false
    );
    return;
  }

  if (usesDateRange && fromDate > toDate) {
    status(
      "Presentation From Date cannot be later than Presentation To Date.",
      false
    );
    return;
  }

  /* Single date and session-time validation */

  if (
    !usesDateRange &&
    (!presentationDate || !sessionStartTime || !sessionEndTime)
  ) {
    status(
      "Please select the presentation date and session start/end timings.",
      false
    );
    return;
  }

  if (
    !usesDateRange &&
    sessionStartTime >= sessionEndTime
  ) {
    status(
      "Session end time must be later than session start time.",
      false
    );
    return;
  }

  /* Organization validation */

  const orgValue = document.getElementById("organization").value;

  const otherOrg = document.getElementById("otherOrg").value.trim();

  if (orgValue === "Others" && !otherOrg) {
    status("Please enter the name of the other organization.", false);
    return;
  }

  /* Collect reflection and skill fields */

  const attitudinalChanges = [1, 2, 3, 4, 5].map(i =>
    document.getElementById("attitudinalChange" + i).value.trim()
  );

  const skills = [1, 2, 3, 4, 5].map(i =>
    document.getElementById("skill" + i).value.trim()
  );

  /* Build submission payload */

  const data = {
    workshopTitle:
      document.getElementById("workshopTitle").value.trim(),

    targetGroup:
      document.getElementById("targetGroup").value,
    sessionTitle:
      (document.getElementById("sessionTitle")?.value || "").trim(),

    name:
      document.getElementById("name").value.trim(),

    rank:
      document.getElementById("rank")
        ? document.getElementById("rank").value.trim()
        : "",

    organization:
      orgValue === "Others" ? otherOrg : orgValue,

    whatsapp:
      document.getElementById("whatsapp").value.trim(),

    bank:
      document.getElementById("bank").value.trim(),
    bankName:
      document.getElementById("bankName").value.trim(),
    branchName:
      document.getElementById("branchName").value.trim(),
    branchCode:
      document.getElementById("branchCode").value.trim(),
    honorariumAmount: ({"Guest Speaker":3000,"Resource Person":1000,"Internal Speaker":1000,"Assistant Course Director":1500}[role] || ""),
    honorariumUndertaking: "I hereby acknowledge the receipt of ₹ " +
      ({"Guest Speaker":"3,000","Resource Person":"1,000","Internal Speaker":"1,000","Assistant Course Director":"1,500"}[role] || "________") +
      " (Rupees " +
      ({"Guest Speaker":"Three Thousand","Resource Person":"One Thousand","Internal Speaker":"One Thousand","Assistant Course Director":"One Thousand Five Hundred"}[role] || "__________________________________________") +
      " only) as honorarium for my presentation.",

    ifsc:
      document.getElementById("ifsc").value.trim().toUpperCase(),

    upi:
      document.getElementById("upi").value.trim(),

    pan:
      document.getElementById("pan").value.trim().toUpperCase(),

    role,

    adminFixedSchedule,

    presentationDate:
      usesDateRange ? "" : presentationDate,

    sessionStartTime:
      usesDateRange ? "" : sessionStartTime,

    sessionEndTime:
      usesDateRange ? "" : sessionEndTime,

    fromDate:
      usesDateRange ? fromDate : "",

    toDate:
      usesDateRange ? toDate : "",

    speakerPhotoData,

    presentationFileData,

    presentationFileName,

    briefProfile:
      document.getElementById("briefProfile").value.trim(),

    signatureData:
      hasInk ? canvas.toDataURL("image/png") : "",

    attitudinalChanges,

    skills
  };

  const button = document.getElementById("saveBtn");

  button.disabled = true;
  button.textContent = "Saving…";

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!result.ok) {
      throw new Error(
        result.error || "Unable to save the speaker record."
      );
    }

    let message =
      "Speaker record saved successfully. Record ID: " +
      (result.recordId || "Created");

    if (result.pdfUrl) {
      message += " | PDF: " + result.pdfUrl;
    }

    if (result.presentationFileUrl) {
      message += " | PPTX: " + result.presentationFileUrl;
    }

    if (!result.emailSent && result.emailError) {
      message +=
        " | Record saved; email notification failed: " +
        result.emailError;
    }

    status(message, true);

    // Optional official pre-receipt PDF; existing PDF workflow is untouched.
    addOfficialPreReceiptOption(data);

    resetForm(false);

  } catch (error) {
    status(
      "Submission failed: " +
      (error.message || "Please try again."),
      false
    );

  } finally {
    button.disabled = false;
    button.textContent = "💾 Save Speaker Record";
  }
});

/* -------------------------------------------------------
   RESET FORM
------------------------------------------------------- */

function resetForm(showMessage = true) {
  const form = document.getElementById("speakerForm");

  form.reset();

  document.getElementById("otherWrap").classList.add("hidden");
  document.getElementById("weekday").textContent = "";

  clearSignature();
  clearSpeakerPhoto();
  clearPresentationFile();

  updateDateMode();
  toggleOther();

  if (showMessage) {
    status("Form cleared.", true);
  }
}

/* ADDITIONAL OPTIONAL OFFICIAL HONORARIUM PRE-RECEIPT PDF */
function addOfficialPreReceiptOption(data) {
  const form = document.getElementById('speakerForm');
  if (!form) return;
  const oldPanel = document.getElementById('officialPreReceiptOption');
  if (oldPanel) oldPanel.remove();
  const panel = document.createElement('section');
  panel.id = 'officialPreReceiptOption';
  panel.className = 'card';
  panel.style.cssText = 'margin-top:14px;border:2px solid #0891b2;background:#f0fdff;display:block;position:relative;z-index:2';
  const heading = document.createElement('h3');
  heading.textContent = 'Additional Download Option';
  heading.style.marginTop = '0';
  panel.appendChild(heading);
  const note = document.createElement('p');
  note.textContent = 'Download the official bilingual Hindi–English Honorarium Pre-Receipt as a separate PDF. Your existing form PDF option remains unchanged.';
  panel.appendChild(note);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'primary';
  button.textContent = 'Download Official Pre-Receipt (PDF)';
  button.addEventListener('click', () => printOfficialPreReceipt(data));
  panel.appendChild(button);
  form.insertAdjacentElement('afterend', panel);
  panel.scrollIntoView({behavior:'smooth', block:'nearest'});
}
function receiptEscape(value) { return String(value == null ? '' : value).replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch])); }
function receiptDate(value) { if (!value) return '________________'; const p = String(value).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : value; }
function printOfficialPreReceipt(data) {
  const role = receiptEscape(data.role || '________________'); const amount = Number(data.honorariumAmount || 0);
  const words = ({1000:'One Thousand',1500:'One Thousand Five Hundred',3000:'Three Thousand'})[amount] || '________________';
  const amountText = amount ? amount.toLocaleString('en-IN') : '________'; const theme = receiptEscape(data.workshopTitle || ''); const speaker = receiptEscape(data.name || '');
  const dates = data.fromDate && data.toDate ? receiptDate(data.fromDate) + ' से ' + receiptDate(data.toDate) : receiptDate(data.presentationDate);
  const bankName = receiptEscape(data.bankName || ''); const account = receiptEscape(data.bank || '');
  const branch = receiptEscape([data.branchName, data.branchCode].filter(Boolean).join(' / ')); const ifsc = receiptEscape(data.ifsc || '');
  const popup = window.open('', '_blank'); if (!popup) { status('Please allow pop-ups, then select the official pre-receipt option again.', false); return; }
  const html = [
    '<!doctype html><html lang="hi"><head><meta charset="utf-8"><title>ZIET Mumbai — Pre-Receipt</title>',
    '<style>@page{size:A4 portrait;margin:18mm}body{font-family:Arial,"Noto Sans Devanagari","Mangal",sans-serif;color:#111;font-size:14px;line-height:1.8}.page{min-height:255mm}h1,h2{text-align:center}h1{font-size:22px;margin-bottom:28px}h2{font-size:18px;margin:25px 0}.line{display:inline-block;min-width:180px;border-bottom:1px solid #111;min-height:22px}.long{min-width:95%}.bankrow{margin:20px 0}.value{display:inline-block;min-width:55%;min-height:22px;border-bottom:1px solid #333}.signrow{display:flex;justify-content:space-between;margin-top:35px}.rule{border:0;border-top:1px solid #333;margin:28px 0}.printbar{text-align:center;margin:15px}@media print{.printbar{display:none}}</style></head><body>',
    '<div class="printbar"><button onclick="window.print()">Print / Save as PDF</button></div><section class="page">',
    '<h1>पूर्व पावती / Pre-Receipt</h1>',
    '<p>निदेशक आंचलिक शिक्षा एवं प्रशिक्षण संस्थान मुम्बई में <span class="line">' + theme + '</span> हेतु</p>',
    '<p>थीम “<span class="line long">' + theme + '</span>” पर दिनांक <span class="line">' + receiptEscape(dates) + '</span> से/तक आयोजित</p>',
    '<p>04 दिवसीय मुखाभिमुख कार्यशाला में <span class="line">' + role + '</span> के रूप में कार्य करने के मानदेय हेतु ₹ <span class="line">' + amountText + '/-</span> (₹ <span class="line">' + words + ' मात्र /-</span>) प्राप्त किए।</p>',
    '<div class="signrow"><span>दिनांक : ' + receiptDate(new Date().toISOString().slice(0,10)) + '</span><span>हस्ताक्षर __________________</span></div>',
    '<hr class="rule"><h2>बैंक खाते का विवरण / Details of Bank Account</h2>',
    '<div class="bankrow">खाताधारक का नाम / Name of the Account Holder<br><span class="value">' + speaker + '</span></div>',
    '<div class="bankrow">बैंक का नाम / Name of Bank : <span class="value">' + bankName + '</span></div>',
    '<div class="bankrow">खाता संख्या / Savings Account Number : <span class="value">' + account + '</span></div>',
    '<div class="bankrow">शाखा का नाम एवं पता / Bank Branch and Branch Code: <span class="value">' + branch + '</span></div>',
    '<div class="bankrow">आइ.एफ.एस.सी. कोड / IFSC Code : <span class="value">' + ifsc + '</span></div>',
    '<p>Speaker: ' + speaker + '</p></section></body></html>'
  ].join(''); popup.document.open(); popup.document.write(html); popup.document.close(); popup.focus();
}

/* Original print option retained unchanged. */
function printForm() { window.print(); }
