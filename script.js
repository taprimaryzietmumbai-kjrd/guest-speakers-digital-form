
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

  const usesDateRange = [
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

  const usesDateRange = [
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

    ifsc:
      document.getElementById("ifsc").value.trim().toUpperCase(),

    upi:
      document.getElementById("upi").value.trim(),

    pan:
      document.getElementById("pan").value.trim().toUpperCase(),

    role,

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

/* -------------------------------------------------------
   PRINT / SAVE AS PDF
------------------------------------------------------- */

function printForm() {
  window.print();
}
