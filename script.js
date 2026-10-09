
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwFLTe2XX9tIkU6T2u0gETwwkOChWQ5bZ1GQfEsvRQGnud7jBcE800w_HahdPtFtIBu/exec";

let canvas, ctx, drawing = false, hasInk = false;

window.addEventListener("load", () => {
  canvas = document.getElementById("signature");

  if (canvas) {
    ctx = canvas.getContext("2d");
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", draw);
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointercancel", stop);
    canvas.addEventListener("pointerleave", stop);
  }

  const form = document.getElementById("speakerForm");
  if (form) {
    form.addEventListener("submit", submitSpeakerRecord);
  }

  updateDateMode();
});

function pos(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * canvas.width / r.width,
    y: (e.clientY - r.top) * canvas.height / r.height
  };
}

function start(e) {
  if (!canvas || !ctx) return;
  drawing = true;
  hasInk = true;

  if (canvas.setPointerCapture) {
    canvas.setPointerCapture(e.pointerId);
  }

  const p = pos(e);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
}

function draw(e) {
  if (!drawing || !ctx) return;
  const p = pos(e);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

function stop() {
  drawing = false;
}

function clearSignature() {
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  hasInk = false;

  const input = document.getElementById("signatureFile");
  if (input) input.value = "";
}

function loadImage(e) {
  const file = e.target.files && e.target.files[0];
  if (!file || !canvas || !ctx) return;

  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    status("Please upload a PNG, JPG or WebP signature image.", false);
    e.target.value = "";
    return;
  }

  const image = new Image();
  const objectUrl = URL.createObjectURL(file);

  image.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = Math.min(
      canvas.width / image.width,
      canvas.height / image.height
    );

    const width = image.width * scale;
    const height = image.height * scale;

    ctx.drawImage(
      image,
      (canvas.width - width) / 2,
      (canvas.height - height) / 2,
      width,
      height
    );

    hasInk = true;
    URL.revokeObjectURL(objectUrl);
  };

  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    status("Unable to load the signature image.", false);
  };

  image.src = objectUrl;
}

function toggleOther() {
  const organization = document.getElementById("organization");
  const otherWrap = document.getElementById("otherWrap");

  if (organization && otherWrap) {
    otherWrap.classList.toggle(
      "hidden",
      organization.value !== "Others"
    );
  }
}

function showDay() {
  const field = document.getElementById("presentationDate");
  const weekday = document.getElementById("weekday");

  if (!field || !weekday) return;

  weekday.textContent = field.value
    ? new Date(field.value + "T00:00:00").toLocaleDateString(
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

/* Resource Person uses a date range.
   Every other role uses a single presentation date. */
function updateDateMode() {
  const role = document.getElementById("role");
  if (!role) return;

  const isResourcePerson = role.value === "Resource Person";

  const singleWrap = document.getElementById("presentationDateWrap");
  const fromWrap = document.getElementById("fromDateWrap");
  const toWrap = document.getElementById("toDateWrap");

  if (singleWrap) {
    singleWrap.classList.toggle("hidden", isResourcePerson);
  }

  if (fromWrap) {
    fromWrap.classList.toggle("hidden", !isResourcePerson);
  }

  if (toWrap) {
    toWrap.classList.toggle("hidden", !isResourcePerson);
  }

  if (isResourcePerson) {
    document.getElementById("presentationDate").value = "";
    document.getElementById("weekday").textContent = "";
  } else {
    document.getElementById("fromDate").value = "";
    document.getElementById("toDate").value = "";
  }
}

function status(message, ok) {
  const element = document.getElementById("status");
  if (!element) return;

  element.textContent = message;
  element.className = ok ? "ok" : "err";
}

function printForm() {
  window.print();
}

function fieldValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

async function submitSpeakerRecord(e) {
  e.preventDefault();

  const role = fieldValue("role");
  const isResourcePerson = role === "Resource Person";

  const workshopTitle = fieldValue("workshopTitle");
  const targetGroup = fieldValue("targetGroup");
  const name = fieldValue("name");

  if (!workshopTitle) {
    status("Workshop Title is required.", false);
    return;
  }

  if (!targetGroup) {
    status("Target Group is required.", false);
    return;
  }

  if (!name) {
    status("Name of the Speaker is required.", false);
    return;
  }

  const presentationDate = isResourcePerson
    ? ""
    : fieldValue("presentationDate");

  const from = isResourcePerson ? fieldValue("fromDate") : "";
  const to = isResourcePerson ? fieldValue("toDate") : "";

  if (isResourcePerson && from && to && from > to) {
    status(
      "Presentation From Date cannot be later than Presentation To Date.",
      false
    );
    return;
  }

  const organizationValue = fieldValue("organization");

  const attitudinalChanges = [
    fieldValue("attitudinalChange1"),
    fieldValue("attitudinalChange2"),
    fieldValue("attitudinalChange3"),
    fieldValue("attitudinalChange4"),
    fieldValue("attitudinalChange5")
  ];

  const skills = [
    fieldValue("skill1"),
    fieldValue("skill2"),
    fieldValue("skill3"),
    fieldValue("skill4"),
    fieldValue("skill5")
  ];

  const data = {
    workshopTitle,
    targetGroup,
    name,
    rank: "",
    organization: organizationValue === "Others"
      ? (fieldValue("otherOrg") || "Others")
      : organizationValue,

    whatsapp: fieldValue("whatsapp"),
    bank: fieldValue("bank"),
    ifsc: fieldValue("ifsc").toUpperCase(),
    upi: fieldValue("upi"),
    pan: fieldValue("pan").toUpperCase(),

    presentationDate,
    fromDate: from,
    toDate: to,
    role,

    attitudinalChanges,
    skills,

    signatureData: hasInk && canvas
      ? canvas.toDataURL("image/png")
      : ""
  };

  const button = document.getElementById("saveBtn");
  const originalText = button
    ? button.textContent
    : "💾 Save Speaker Record";

  if (button) {
    button.disabled = true;
    button.textContent = "Saving…";
  }

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error("Server returned HTTP " + response.status);
    }

    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.error || "Unable to save speaker record.");
    }

    const statusElement = document.getElementById("status");

    if (result.pdfUrl && statusElement) {
      statusElement.className = "ok";
      statusElement.replaceChildren();

      const message = document.createElement("div");
      message.textContent = "✅ Speaker record saved successfully.";
      statusElement.appendChild(message);

      const record = document.createElement("div");
      record.textContent = "Record ID: " + (result.recordId || "");
      statusElement.appendChild(record);

      const link = document.createElement("a");
      link.href = result.pdfUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.className = "pdfLink";
      link.textContent = "📄 View / Download Speaker PDF";

      statusElement.appendChild(link);
    } else {
      status(
        "✅ Speaker record saved successfully. Record ID: " +
          (result.recordId || ""),
        true
      );
    }
  } catch (error) {
    status("❌ " + error.message, false);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

function resetForm(show = true) {
  const form = document.getElementById("speakerForm");
  if (form) form.reset();

  const otherWrap = document.getElementById("otherWrap");
  if (otherWrap) otherWrap.classList.add("hidden");

  const weekday = document.getElementById("weekday");
  if (weekday) weekday.textContent = "";

  clearSignature();
  updateDateMode();

  if (show) status("Form cleared.", true);
}
