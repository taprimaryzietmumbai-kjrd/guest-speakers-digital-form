/***************************************************************
 * GUEST SPEAKERS DIGITAL FORM
 * Google Apps Script backend for the GitHub Pages frontend.
 *
 * Spreadsheet: 1vdfpDuFDi2eyetU6-4DkUGI0_R2e8U9Cdc0HdvT6PT0
 * Sheet tab: Guest Speakers
 ***************************************************************/

const CONFIG = {
  SPREADSHEET_ID: '1vdfpDuFDi2eyetU6-4DkUGI0_R2e8U9Cdc0HdvT6PT0',
  SHEET_NAME: 'Guest Speakers',
  DRIVE_FOLDER_NAME: 'Guest Speakers Signatures',
  PDF_FOLDER_NAME: 'Guest Speakers PDFs',
  EMAIL_TO: 'taprimaryzietmumbai@gmail.com,zietmumbai@gmail.com,zietmumstaff@gmail.com',
  // Used only by doGet() for the existing workshop-title endpoint.
  TITLE_SPREADSHEET_ID: '1Uuqoz2KFpTcw9d2HI02fLmFPopTaLnKWwZ9aR-uYCeY'
};

const HEADERS = [
  'Timestamp',
  'Workshop Title',
  'Target Group',
  'Name of the Speaker',
  'Rank / Post of the Speaker',
  'Department / Organization',
  'WhatsApp No.',
  'Bank Account of the Speaker',
  'IFSC Code',
  'UPI ID',
  'PAN No.',
  'Presentation Day & Date',
  'Presentation From Date',
  'Presentation To Date',
  'Role of the Speaker',
  'Signature File URL',
  'Signature Preview',
  'Record ID',
  'Speaker PDF URL',
  'Attitudinal Change 1',
  'Attitudinal Change 2',
  'Attitudinal Change 3',
  'Attitudinal Change 4',
  'Attitudinal Change 5',
  'Skill 1',
  'Skill 2',
  'Skill 3',
  'Skill 4',
  'Skill 5',
  'Session Start Time',
  'Session End Time',
  'Speaker Photograph URL',
  'Brief Professional Profile',
  'PPTX Presentation URL',
  'Bank Name',
  'Branch Name',
  'Branch Code',
  'Honorarium Amount',
  'Honorarium Undertaking',
  'Speaker Photograph Preview'
];

const ALLOWED_ROLES = [
  'Course Director',
  'Assistant Course Director',
  'Resource Person',
  'Internal Speaker',
  'Guest Speaker'
];

const ORGANIZATION_OPTIONS = [
  'IIT', 'IIM', 'BTTC', 'MU', 'HBCSE', 'SNDTU', 'KVS', 'TISS', 'TIFR', 'CETE', 'Others'
];

/**
 * Existing title endpoint. It returns the name of the first tab in the
 * separate workshop-title spreadsheet, as in the previous backend.
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.TITLE_SPREADSHEET_ID);
    const sheet = ss.getSheets()[0];
    return jsonResponse_({
      ok: true,
      title: sheet.getName(),
      message: 'Workshop title loaded from Google Sheets.'
    });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: error.message || String(error)
    });
  }
}

/** Receives JSON submissions from the GitHub Pages frontend. */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse_({ ok: false, error: 'No submission data received.' });
    }

    const data = JSON.parse(e.postData.contents);

    // Coordinator-triggered invitation email. Keep this action separate from
    // the existing speaker-record submission workflow below.
    if (data.action === 'sendInvitation') {
      return sendInvitationEmail_(data);
    }

    const workshopTitle = clean_(data.workshopTitle);
    const targetGroup = clean_(data.targetGroup);
    const speakerName = clean_(data.name);
    const role = clean_(data.role);
    const organization = clean_(data.organization);

    if (!workshopTitle) throw new Error('Workshop Title is required.');
    if (!targetGroup) throw new Error('Target Group is required.');
    if (!speakerName) throw new Error('Name of the Speaker is required.');
    if (!role) throw new Error('Role of the Speaker is required.');
    if (!ALLOWED_ROLES.includes(role)) throw new Error('Invalid Role of the Speaker.');
    if (organization.length > 150) throw new Error('Department / Organization name is too long.');

    const presentationDate = clean_(data.presentationDate);
    const fromDate = clean_(data.fromDate);
    const toDate = clean_(data.toDate);
    const sessionStartTime = clean_(data.sessionStartTime);
    const sessionEndTime = clean_(data.sessionEndTime);
    const briefProfile = clean_(data.briefProfile);
    const usesDateRange = !data.adminFixedSchedule && ['Resource Person', 'Course Director', 'Assistant Course Director'].includes(role);

    // Course Directors, Assistant Course Directors and Resource Persons use a date range.
    if (usesDateRange) {
      if (!fromDate || !toDate) {
        throw new Error('For Course Director, Assistant Course Director and Resource Person, enter both Presentation From Date and Presentation To Date.');
      }
      if (presentationDate || sessionStartTime || sessionEndTime) {
        throw new Error('These roles should use Presentation From Date and Presentation To Date only.');
      }
      if (fromDate > toDate) {
        throw new Error('Presentation From Date cannot be later than Presentation To Date.');
      }
    } else {
      if (!presentationDate) throw new Error('Please select the Presentation Day & Date.');
      if (!sessionStartTime || !sessionEndTime) throw new Error('Please enter the session start and end times.');
      if (sessionStartTime >= sessionEndTime) throw new Error('Session end time must be later than session start time.');
      if (fromDate || toDate) throw new Error('For this speaker role, use the single Presentation Day & Date field only.');
    }

    const attitudinalChanges = normalizeFive_(data.attitudinalChanges);
    const skills = normalizeFive_(data.skills);

    const sheet = getOrCreateSheet_();
    const recordId = Utilities.getUuid();
    const timestamp = new Date();

    let signatureUrl = '';
    let signatureFormula = '';
    let speakerPhotoUrl = '';
    let speakerPhotoPreviewUrl = '';
    if (data.speakerPhotoData) {
      const savedPhoto = saveSpeakerPhoto_(data.speakerPhotoData, speakerName, recordId);
      speakerPhotoUrl = savedPhoto.url;
      speakerPhotoPreviewUrl = savedPhoto.previewUrl;
    }
    let presentationFileUrl = '';
    if (data.presentationFileData) {
      const savedPresentation = savePresentationFile_(data.presentationFileData, data.presentationFileName, speakerName, recordId);
      presentationFileUrl = savedPresentation.url;
    }
    if (data.signatureData) {
      const saved = saveSignature_(data.signatureData, speakerName, recordId);
      signatureUrl = saved.url;
      signatureFormula = '=IMAGE("' + signatureUrl.replace(/"/g, '""') + '")';
    }

    const pdf = createSpeakerPdf_(
      {
        ...data,
        workshopTitle,
        targetGroup,
        name: speakerName,
        role,
        organization,
        presentationDate: usesDateRange ? '' : presentationDate,
        fromDate: usesDateRange ? fromDate : '',
        toDate: usesDateRange ? toDate : '',
        sessionStartTime: usesDateRange ? '' : sessionStartTime,
        sessionEndTime: usesDateRange ? '' : sessionEndTime,
        speakerPhotoUrl,
        presentationFileUrl,
        presentationFileName: clean_(data.presentationFileName),
        briefProfile,
        attitudinalChanges,
        skills
      },
      organization,
      recordId,
      signatureUrl
    );

    const row = [
      timestamp,
      workshopTitle,
      targetGroup,
      speakerName,
      clean_(data.rank),
      organization,
      clean_(data.whatsapp),
      clean_(data.bank),
      clean_(data.ifsc).toUpperCase(),
      clean_(data.upi),
      clean_(data.pan).toUpperCase(),
      usesDateRange ? '' : presentationDate,
      usesDateRange ? fromDate : '',
      usesDateRange ? toDate : '',
      role,
      signatureUrl,
      '',
      recordId,
      pdf.url,
      ...attitudinalChanges,
      ...skills,
      usesDateRange ? '' : sessionStartTime,
      usesDateRange ? '' : sessionEndTime,
      speakerPhotoUrl,
      briefProfile,
      presentationFileUrl,
      clean_(data.bankName),
      clean_(data.branchName),
      clean_(data.branchCode),
      clean_(data.honorariumAmount),
      clean_(data.honorariumUndertaking),
      '' // Speaker Photograph Preview is populated with an IMAGE() formula below.
    ];

    if (row.length !== HEADERS.length) {
      throw new Error('Internal column mismatch: row has ' + row.length + ' values but headers have ' + HEADERS.length + '.');
    }

    sheet.appendRow(row);
    const rowNumber = sheet.getLastRow();

    // Keep contact and financial identifiers as text, preserving leading zeroes.
    sheet.getRange(rowNumber, 7, 1, 5).setNumberFormat('@');

    if (signatureFormula) {
      sheet.getRange(rowNumber, 17).setFormula(signatureFormula);
      sheet.setRowHeight(rowNumber, 90);
    }
    if (speakerPhotoPreviewUrl) {
      sheet.getRange(rowNumber, 40).setFormula('=IMAGE("' + speakerPhotoPreviewUrl.replace(/"/g, '""') + '")');
      sheet.setRowHeight(rowNumber, Math.max(sheet.getRowHeight(rowNumber), 110));
    }

    let emailSent = false;
    let emailError = '';
    try {
      sendSpeakerNotification_(data, recordId, rowNumber, pdf.url, speakerPhotoUrl, presentationFileUrl);
      emailSent = true;
    } catch (mailError) {
      emailError = mailError.message || String(mailError);
      console.error('Speaker record saved, but notification email failed: ' + emailError);
    }

    return jsonResponse_({
      ok: true,
      message: 'Speaker record saved successfully.',
      recordId,
      row: rowNumber,
      signatureUrl,
      speakerPhotoUrl,
      presentationFileUrl,
      pdfUrl: pdf.url,
      emailSent,
      emailError
    });
  } catch (error) {
    console.error(error);
    return jsonResponse_({
      ok: false,
      error: error.message || String(error)
    });
  }
}


/** Sends a personalised invitation when the coordinator generates a speaker link. */
function sendInvitationEmail_(data) {
  const speakerName = clean_(data.speakerName || data.name);
  const speakerEmail = clean_(data.speakerEmail || data.email);
  const workshopTitle = clean_(data.workshopTitle);
  const targetGroup = clean_(data.targetGroup);
  const role = clean_(data.role || data.speakerRole);
  const speakerLink = clean_(data.speakerLink || data.shareUrl);
  const whatsapp = clean_(data.speakerWhatsapp || data.whatsapp);
  const sessionTitle = clean_(data.sessionTitle);
  const agreedDate = clean_(data.agreedDate);
  const agreedTimeSlot = clean_(data.agreedTimeSlot);

  if (!speakerName) throw new Error('Speaker name is required for the invitation.');
  if (!speakerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(speakerEmail)) {
    throw new Error('Enter a valid speaker email address to send the invitation automatically.');
  }
  if (!workshopTitle) throw new Error('Workshop Title is required for the invitation.');
  if (!targetGroup) throw new Error('Target Group is required for the invitation.');
  if (!ALLOWED_ROLES.includes(role)) throw new Error('Select a valid Role of the Speaker in the coordinator app.');
  if (!/^https:\/\//i.test(speakerLink) || speakerLink.indexOf('/speaker.html') === -1) {
    throw new Error('The personalised speaker form link is invalid.');
  }

  // Fixed short subject prevents submitted values from causing subject-size errors.
  const subject = 'ZIET Mumbai — Guest Speaker Invitation';
  const body = [
    'Dear ' + speakerName + ',',
    '',
    'Please complete the ZIET Mumbai Guest Speaker Digital Form for the workshop:',
    workshopTitle,
    '',
    'Target Group: ' + targetGroup,
    'Role of the Speaker: ' + role,
    'Session Title for the Speaker: ' + sessionTitle,
    'Mutually Agreed Presentation Date: ' + agreedDate,
    'Mutually Agreed Presentation Time Slot: ' + agreedTimeSlot,
    whatsapp ? 'WhatsApp: ' + whatsapp : '',
    '',
    'Open your personalised form here:',
    speakerLink,
    '',
    'Please use this personalised link to complete your speaker details and submit the form.',
    '',
    'Regards,',
    'ZIET Mumbai'
  ].join('\n');

  // Send the invitation to the speaker and copy the coordinator for delivery confirmation.
  const coordinatorCopy = 'tarpimaryzietmumbai@gmail.com';
  MailApp.sendEmail({
    to: speakerEmail,
    cc: coordinatorCopy,
    subject: subject,
    body: body,
    name: 'ZIET Mumbai — Guest Speakers Digital Form'
  });

  return jsonResponse_({
    ok: true,
    emailSent: true,
    recipient: speakerEmail,
    copiedTo: coordinatorCopy,
    message: 'Invitation email sent to ' + speakerEmail + '; copy sent to ' + coordinatorCopy + '.'
  });
}

/** Sends a notification email after the record has been saved. */
function sendSpeakerNotification_(data, recordId, rowNumber, pdfUrl, photoUrl, presentationUrl) {
  const recipients = CONFIG.EMAIL_TO.split(',').map(email => email.trim()).filter(Boolean);
  if (!recipients.length) return;
  const name = clean_(data.name);
  const role = clean_(data.role);
  // The observed post-save error is in this notification path. Use a fixed
  // short subject so no submitted field can make the subject oversized.
  const subject = 'ZIET Mumbai — New Guest Speaker Record';
  const dateLine = data.fromDate && data.toDate
    ? 'Presentation dates: ' + data.fromDate + ' to ' + data.toDate
    : 'Presentation date: ' + clean_(data.presentationDate) + '\nSession timing: ' + clean_(data.sessionStartTime) + ' – ' + clean_(data.sessionEndTime);
  const body = [
    'A new Guest Speakers Digital Form record has been submitted.',
    '',
    'Workshop: ' + clean_(data.workshopTitle),
    'Target Group: ' + clean_(data.targetGroup),
    'Speaker: ' + name,
    'Role: ' + role,
    'Organization: ' + clean_(data.organization),
    dateLine,
    'Record ID: ' + recordId,
    'Google Sheet row: ' + rowNumber,
    'Speaker PDF: ' + pdfUrl,
    'Speaker photograph: ' + (photoUrl || 'Not uploaded'),
    'PPTX presentation: ' + (presentationUrl || 'Not uploaded'),
    '',
    'This is an automated notification from the ZIET Mumbai Guest Speakers Digital Form.'
  ].join('\n');
  // Attach the final generated PDF to the notification sent to the coordinator team.
  // pdfUrl is the Drive file URL returned by createSpeakerPdf_().
  const pdfIdMatch = String(pdfUrl || '').match(/\/d\/([a-zA-Z0-9_-]+)/);
  const attachments = [];
  if (pdfIdMatch && pdfIdMatch[1]) {
    const pdfFile = DriveApp.getFileById(pdfIdMatch[1]);
    attachments.push(pdfFile.getBlob().setName(pdfFile.getName()));
  } else {
    throw new Error('The speaker PDF was generated, but its file ID could not be extracted for email attachment.');
  }

  MailApp.sendEmail({
    to: recipients.join(','),
    subject,
    body,
    attachments
  });
}

/** Run manually to trigger/verify MailApp authorization before deployment. */
function authorizeAndTestEmail() {
  const recipients = CONFIG.EMAIL_TO.split(',').map(email => email.trim()).filter(Boolean);
  MailApp.sendEmail({
    to: recipients.join(','),
    subject: 'ZIET Mumbai Guest Speakers Form — Email Authorization Test',
    body: 'Email authorization test completed successfully for the Guest Speakers Digital Form.'
  });
  return 'Test email sent to: ' + recipients.join(', ');
}

/**
 * Creates/gets the Guest Speakers sheet and applies formatting.
 * Recognises the earlier 16-column layout, migrates it without moving
 * existing records out of alignment, and safely appends the 10 new fields.
 */
function getOrCreateSheet_() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);

  const oldHeaders = [
    'Timestamp',
    'Name of the Speaker',
    'Rank / Post of the Speaker',
    'Department / Organization',
    'WhatsApp No.',
    'Bank Account of the Speaker',
    'IFSC Code',
    'UPI ID',
    'PAN No.',
    'Presentation Day & Date',
    'Presentation From Date',
    'Presentation To Date',
    'Role of the Speaker',
    'Signature File URL',
    'Signature Preview',
    'Record ID'
  ];

  let migratedOldLayout = false;
  if (sheet.getLastRow() > 0 && sheet.getLastColumn() >= oldHeaders.length) {
    const existingOldHeaders = sheet.getRange(1, 1, 1, oldHeaders.length).getValues()[0];
    const isOldLayout = oldHeaders.every((header, index) => existingOldHeaders[index] === header);
    if (isOldLayout) {
      sheet.insertColumnsAfter(1, 2);
      migratedOldLayout = true;
    }
  }

  // Ensure the grid physically has enough columns before writing headers.
  const maxColumns = sheet.getMaxColumns();
  if (maxColumns < HEADERS.length) {
    sheet.insertColumnsAfter(maxColumns, HEADERS.length - maxColumns);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  } else if (migratedOldLayout) {
    // Only the header row is rewritten after a recognised, explicit migration.
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  } else {
    const existingColumnCount = Math.min(Math.max(sheet.getLastColumn(), 1), HEADERS.length);
    const existingHeaders = sheet.getRange(1, 1, 1, existingColumnCount).getValues()[0];
    const prefixMatches = existingHeaders.every((header, index) => header === HEADERS[index]);

    if (!prefixMatches) {
      throw new Error(
        'The existing Guest Speakers sheet has an unrecognised header layout. ' +
        'No headers were overwritten. Please back up the sheet and review row 1 before continuing.'
      );
    }

    if (existingColumnCount < HEADERS.length) {
      sheet.getRange(
        1,
        existingColumnCount + 1,
        1,
        HEADERS.length - existingColumnCount
      ).setValues([HEADERS.slice(existingColumnCount)]);
    }
  }

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight('bold')
    .setWrap(true)
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 42);

  const widths = {
    1: 150, 2: 300, 3: 220, 4: 220, 5: 190,
    6: 190, 7: 160, 8: 190, 9: 130, 10: 150,
    11: 130, 12: 170, 13: 160, 14: 160, 15: 190,
    16: 240, 17: 180, 18: 230, 19: 240,
    20: 220, 21: 220, 22: 220, 23: 220, 24: 220,
    25: 200, 26: 200, 27: 200, 28: 200, 29: 200,
    30: 150, 31: 150, 32: 260, 33: 300, 34: 300,
    35: 180, 36: 180, 37: 150, 38: 160, 39: 420, 40: 180
  };
  Object.keys(widths).forEach(column => sheet.setColumnWidth(Number(column), widths[column]));

  const organizationRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(ORGANIZATION_OPTIONS, true)
    .setAllowInvalid(true)
    .build();
  const roleRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(ALLOWED_ROLES, true)
    .setAllowInvalid(false)
    .build();

  const maxRows = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(2, 6, maxRows, 1).setDataValidation(organizationRule);
  sheet.getRange(2, 15, maxRows, 1).setDataValidation(roleRule);

  // Contact/financial identifiers are stored as text.
  sheet.getRange(2, 7, maxRows, 5).setNumberFormat('@');

  return sheet;
}

/** Creates/gets the Drive folder for signatures. */
function getSignatureFolder_() {
  const folders = DriveApp.getFoldersByName(CONFIG.DRIVE_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(CONFIG.DRIVE_FOLDER_NAME);
}

/** Saves a drawn/uploaded PNG signature to Drive. */
function saveSignature_(dataUrl, speakerName, recordId) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid signature image.');

  const mimeType = match[1] || 'image/png';
  const bytes = Utilities.base64Decode(match[2]);
  const safeName = String(speakerName || 'Speaker')
    .replace(/[\\/:*?"<>|#%{}\[\]]/g, '_')
    .substring(0, 80);
  const fileName = safeName + '_' + recordId + '_signature.png';
  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const file = getSignatureFolder_().createFile(blob);

  // Needed for the existing =IMAGE() preview formula in Google Sheets.
  // Review your organisation's data-sharing policy before using link sharing.
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    fileId: file.getId(),
    url: 'https://drive.google.com/uc?export=view&id=' + file.getId()
  };
}


/** Saves a speaker's flyer photograph to Drive and returns its link. */
function saveSpeakerPhoto_(dataUrl, speakerName, recordId) {
  const match = String(dataUrl).match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new Error('Invalid speaker photograph. Upload a JPG, PNG or WebP image.');
  const mimeType = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const extension = mimeType === 'image/jpeg' ? 'jpg' : (mimeType === 'image/webp' ? 'webp' : 'png');
  const safeName = String(speakerName || 'Speaker')
    .replace(/[\\/:*?"<>|#%{}\[\]]/g, '_')
    .substring(0, 80);
  const file = getSpeakerPhotoFolder_().createFile(
    Utilities.newBlob(bytes, mimeType, safeName + '_' + recordId + '_photo.' + extension)
  );
  // Link sharing lets flyer designers retrieve the photograph; review privacy policy.
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    fileId: file.getId(),
    url: 'https://drive.google.com/file/d/' + file.getId() + '/view',
    previewUrl: 'https://drive.google.com/uc?export=view&id=' + file.getId()
  };
}

function getSpeakerPhotoFolder_() {
  const folderName = 'Guest Speakers Photographs';
  const folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
}

/** Saves an optional advance PowerPoint presentation (.pptx) to Drive. */
function savePresentationFile_(dataUrl, originalName, speakerName, recordId) {
  const match = String(dataUrl).match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid PPTX presentation upload.');
  const mimeType = match[1];
  const pptxMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (mimeType !== pptxMime && mimeType !== 'application/octet-stream') {
    throw new Error('Please upload the presentation in .pptx format only.');
  }
  const name = clean_(originalName) || 'Presentation.pptx';
  if (!/\.pptx$/i.test(name)) throw new Error('Please upload the presentation in .pptx format only.');
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 10 * 1024 * 1024) throw new Error('The PPTX presentation must be 10 MB or smaller.');
  const safeSpeaker = String(speakerName || 'Speaker').replace(/[\\/:*?"<>|#%{}\[\]]/g, '_').substring(0, 60);
  const safeOriginal = name.replace(/[\\/:*?"<>|#%{}\[\]]/g, '_').substring(0, 100);
  const folderName = 'Guest Speakers Presentations';
  const folders = DriveApp.getFoldersByName(folderName);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  const blob = Utilities.newBlob(bytes, pptxMime, safeSpeaker + '_' + recordId + '_' + safeOriginal);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { fileId: file.getId(), url: 'https://drive.google.com/file/d/' + file.getId() + '/view' };
}

/** Creates/gets the Drive folder for generated speaker PDFs. */
function getPdfFolder_() {
  const folders = DriveApp.getFoldersByName(CONFIG.PDF_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(CONFIG.PDF_FOLDER_NAME);
}

/** Generates a speaker PDF including all ten planning fields and signature. */
function createSpeakerPdf_(data, organization, recordId, signatureUrl) {
  const safeName = String(data.name || 'Speaker')
    .replace(/[\\/:*?"<>|#%{}\[\]]/g, '_')
    .substring(0, 80);
  const fileName = safeName + '_' + recordId + '_Speaker_Record';
  const folder = getPdfFolder_();

  const doc = DocumentApp.create(fileName);
  const body = doc.getBody();
  body.clear();
  body.setMarginTop(36);
  body.setMarginBottom(36);
  body.setMarginLeft(42);
  body.setMarginRight(42);

  const title = body.appendParagraph('ZIET MUMBAI');
  title.setHeading(DocumentApp.ParagraphHeading.TITLE);
  title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  const subtitle = body.appendParagraph('GUEST SPEAKER — DIGITAL RECORD');
  subtitle.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  subtitle.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('');

  const rows = [
    ['Workshop Title', clean_(data.workshopTitle)],
    ['Target Group', clean_(data.targetGroup)],
    ['Name of the Speaker', clean_(data.name)],
    ['Rank / Post', clean_(data.rank)],
    ['Department / Organization', clean_(organization)],
    ['WhatsApp No.', clean_(data.whatsapp)],
    ['Bank Account', clean_(data.bank)],
    ['Bank Name', clean_(data.bankName)],
    ['Branch Name', clean_(data.branchName)],
    ['Branch Code', clean_(data.branchCode)],
    ['Honorarium Amount', data.honorariumAmount ? '₹ ' + Number(data.honorariumAmount).toLocaleString('en-IN') + '/-' : 'To be confirmed by the coordinator'],
    ['Honorarium Undertaking', clean_(data.honorariumUndertaking)],
    ['IFSC Code', clean_(data.ifsc).toUpperCase()],
    ['UPI ID', clean_(data.upi)],
    ['PAN No.', clean_(data.pan).toUpperCase()],
    ['Presentation Day & Date', formatDateForPdf_(data.presentationDate)],
    ['Presentation From Date', formatDateForPdf_(data.fromDate)],
    ['Presentation To Date', formatDateForPdf_(data.toDate)],
    ['Session Timing', clean_(data.sessionStartTime) && clean_(data.sessionEndTime) ? clean_(data.sessionStartTime) + ' – ' + clean_(data.sessionEndTime) : ''],
    ['Speaker Photograph URL', clean_(data.speakerPhotoUrl)],
    ['Brief Professional Profile', clean_(data.briefProfile)],
    ['PPTX Presentation', clean_(data.presentationFileUrl)],
    ['Role of the Speaker', clean_(data.role)]
  ];

  rows.push(['Expected Attitudinal Changes', '']);
  normalizeFive_(data.attitudinalChanges).forEach((value, index) => {
    rows.push(['Attitudinal Change ' + (index + 1), value]);
  });
  rows.push(['Skills to Be Enhanced / Sharpened / Developed', '']);
  normalizeFive_(data.skills).forEach((value, index) => {
    rows.push(['Skill ' + (index + 1), value]);
  });

  const table = body.appendTable(rows);
  table.setBorderWidth(0.75);
  for (let r = 0; r < table.getNumRows(); r++) {
    const labelCell = table.getCell(r, 0);
    labelCell.setBackgroundColor('#EAF2F8');
    labelCell.getChild(0).asParagraph().setBold(true);
    table.getCell(r, 0).setWidth(190);
    table.getCell(r, 1).setWidth(300);
  }

  body.appendParagraph('');
  const signatureHeading = body.appendParagraph('Speaker Signature');
  signatureHeading.setBold(true);
  if (data.signatureData) {
    const match = String(data.signatureData).match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const bytes = Utilities.base64Decode(match[2]);
      const signatureBlob = Utilities.newBlob(bytes, match[1] || 'image/png', 'signature.png');
      body.appendParagraph('').appendInlineImage(signatureBlob).setWidth(220);
    } else {
      body.appendParagraph('Signature image could not be read.');
    }
  } else {
    body.appendParagraph('No signature supplied.');
  }

  body.appendParagraph('');
  const idParagraph = body.appendParagraph('Record ID: ' + recordId);
  idParagraph.setFontSize(8);
  idParagraph.setForegroundColor('#666666');
  doc.saveAndClose();

  const docFile = DriveApp.getFileById(doc.getId());
  const pdfBlob = docFile.getAs(MimeType.PDF).setName(fileName + '.pdf');
  const pdfFile = folder.createFile(pdfBlob);
  // Existing behaviour retained for compatibility with the form's PDF link.
  // The PDF contains financial/contact data; review link-sharing permissions.
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  docFile.setTrashed(true);

  return {
    fileId: pdfFile.getId(),
    url: 'https://drive.google.com/file/d/' + pdfFile.getId() + '/view'
  };
}

/** Normalizes a submitted list to exactly five strings. */
function normalizeFive_(values) {
  const source = Array.isArray(values) ? values : [];
  return Array.from({ length: 5 }, (_, index) => clean_(source[index]));
}

/** Formats an HTML date (YYYY-MM-DD) for the generated PDF. */
function formatDateForPdf_(value) {
  if (!value) return '';
  const parts = String(value).split('-');
  if (parts.length !== 3) return String(value);
  return parts[2] + '-' + parts[1] + '-' + parts[0];
}

/** Cleans incoming values. */
function clean_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

/** JSON response helper. */
function jsonResponse_(object) {
  return ContentService
    .createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Run manually only when you intend to set up/migrate the sheet. */
function setupGuestSpeakersSheet() {
  const sheet = getOrCreateSheet_();
  sheet.getParent().toast('Guest Speakers sheet setup completed.');
  return 'Guest Speakers sheet setup completed.';
}

/** Optional helper to trigger the Google Docs/Drive authorisation prompts. */
function authorizePdfAccess() {
  const doc = DocumentApp.create('PDF Authorization Test');
  const docId = doc.getId();
  DriveApp.getFileById(docId).setTrashed(true);
  return 'PDF authorization completed successfully.';
}
