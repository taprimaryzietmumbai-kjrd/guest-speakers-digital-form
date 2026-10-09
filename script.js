
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwFLTe2XX9tIkU6T2u0gETwwkOChWQ5bZ1GQfEsvRQGnud7jBcE800w_HahdPtFtIBu/exec";

let canvas, ctx;
let drawing = false;
let hasInk = false;

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
  const rect = canvas.getBoundingClientRect();

  return {
    x: (e.clientX - rect.left) * canvas.width / rect.width,
    y: (e.clientY - rect.top) * canvas.height / rect.height
  };
}

function start(e) {
  if (!canvas || !ctx) return;

  drawing = true;
  hasInk = true;

  if (canvas.setPointerCapture) {
    canvas.setPointerCapture(e.pointerId);
  }

  const point = pos(e);
  ctx.beginPath();
  ctx.moveTo(point.x, point.y);
}

function draw(e) {
  if (!drawing || !ctx) return;

  const point = pos(e);
  ctx.lineTo(point.x, point.y);
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
  const input = e.target;
  const file = input.files && input.files[0];

  if (!file || !canvas || !ctx) return;

  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    status("Please upload a PNG, JPG or WebP signature image.", false);
    input.value = "";
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

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
    input.value = "";
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
  const dateField = document.getElementById("presentationDate");
  const weekday = document.getElementById("weekday");

  if (!dateField || !weekday) return;

  weekday.textContent = dateField.value
    ? new Date(dateField.value + "T00:00:00").toLocaleDateString(
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

/*
  Resource Person: Presentation From Date and To Date.
  All other roles: one Presentation Date.
  Switching roles preserves entered dates in the background,
  but only the relevant date fields are submitted.
*/
function updateDateMode() {
  const roleField = document.getElementById("role");
  if (!roleField) return;

  const isResourcePerson = roleField.value === "Resource Person";

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

  const presentationDate = document.getElementById("presentationDate");
  const fromDate = document.getElementById("fromDate");
  const toDate = document.getElementById("toDate");

  if (presentationDate) {
    presentationDate.required = !isResourcePerson;
  }

  if (fromDate) {
    fromDate.required = isResourcePerson;
  }

  if (toDate) {
    toDate.required = isResourcePerson;
  }

  showDay();
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

  const fromDate = isResourcePerson ? fieldValue("fromDate") : "";
  const toDate = isResourcePerson ? fieldValue("toDate") : "";

  if (!isResourcePerson && !presentationDate) {
    status("Please select the Presentation Date.", false);
    return;
  }

  if (isResourcePerson && (!fromDate || !toDate)) {
    status("Please select both Presentation From Date and To Date.", false);
    return;
  }

  if (isResourcePerson && fromDate > toDate) {
    status(
      "Presentation From Date cannot be later than Presentation To Date.",
      false
    );
    return;
  }

  const organizationValue = fieldValue("organization");

  if (!organizationValue) {
    status("Please select the Organization.", false);
    return;
  }

  if (organizationValue === "Others" && !fieldValue("otherOrg")) {
    status("Please enter the Organization name.", false);
    return;
  }

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
      ? fieldValue("otherOrg")
      : organizationValue,

    whatsapp: fieldValue("whatsapp"),
    bank: fieldValue("bank"),
    ifsc: fieldValue("ifsc").toUpperCase(),
    upi: fieldValue("upi"),
    pan: fieldValue("pan").toUpperCase(),

    presentationDate,
    fromDate,
    toDate,
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
