/*
 * Admin Inbox backend patch for the live Google Apps Script project.
 *
 * This repository does not contain the existing Apps Script backend source,
 * so paste the functions below into the real Code.gs file in Apps Script.
 *
 * Also add these routes to the existing switch statements:
 *
 * doGet(e):
 *   case 'getContactMessages':
 *     result = getContactMessages();
 *     break;
 *
 * doPost(e):
 *   case 'markMessageRead':
 *     result = markMessageRead(data.row);
 *     break;
 *
 *   case 'replyToMessage':
 *     result = replyToMessage(data);
 *     break;
 *
 *   case 'deleteMessage':
 *     result = deleteMessage(data.row);
 *     break;
 *
 *   case 'updateNews':
 *     result = updateNews(data);
 *     break;
 */

// ============================================================================
// SECTION 12: ADMIN INBOX - CONTACT MESSAGES MANAGEMENT
// ============================================================================

/**
 * Returns all contact messages, newest first.
 * Each message includes the sheet row number for mark-read/reply/delete.
 */
function getContactMessages() {
  const sheet = getSheet(CONFIG.SHEETS.CONTACT_MESSAGES);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0].map(h => String(h).trim());

  const cols = {
    timestamp: findHeaderCol(headers, 'Timestamp', 'Date'),
    name:      findHeaderCol(headers, 'name', 'Full Name'),
    email:     findHeaderCol(headers, 'email', 'Email Address'),
    subject:   findHeaderCol(headers, 'subject', 'Subject'),
    message:   findHeaderCol(headers, 'message', 'Message'),
    read:      findHeaderCol(headers, 'read', 'Read', 'IsRead'),
    replied:   findHeaderCol(headers, 'replied', 'Replied', 'IsReplied')
  };

  const messages = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    let hasAnyValue = false;
    for (let k = 0; k < row.length; k++) {
      if (row[k] !== '' && row[k] !== null) {
        hasAnyValue = true;
        break;
      }
    }
    if (!hasAnyValue) continue;

    messages.push({
      row:       i + 1,
      timestamp: cols.timestamp >= 0 ? row[cols.timestamp] : '',
      name:      cols.name      >= 0 ? row[cols.name]      : '',
      email:     cols.email     >= 0 ? row[cols.email]     : '',
      subject:   cols.subject   >= 0 ? row[cols.subject]   : '',
      message:   cols.message   >= 0 ? row[cols.message]   : '',
      read:      cols.read      >= 0 ? String(row[cols.read]    || 'N').toUpperCase() : 'N',
      replied:   cols.replied   >= 0 ? String(row[cols.replied] || 'N').toUpperCase() : 'N'
    });
  }

  messages.sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tb - ta;
  });

  return messages;
}

/**
 * Marks a contact message as read.
 */
function markMessageRead(rowNumber) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.CONTACT_MESSAGES);
    if (!sheet) return { success: false, message: 'Sheet not found' };

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const readCol = findHeaderCol(headers, 'read', 'Read', 'IsRead') + 1;

    if (readCol > 0) {
      sheet.getRange(rowNumber, readCol).setValue('Y');
      return { success: true, message: 'Marked as read' };
    }
    return { success: false, message: 'Read column not found' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * Sends a reply email and marks the message as replied.
 */
function replyToMessage(data) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.CONTACT_MESSAGES);
    if (!sheet) return { success: false, message: 'Sheet not found' };

    if (!data.email || !data.replyBody) {
      return { success: false, message: 'Email and reply body required' };
    }

    const subject = `Re: ${data.subject || 'Your message to ' + CONFIG.CLUB_NAME}`;
    const body = `
${data.replyBody}

---
Best regards,
${CONFIG.CLUB_NAME} Team
${CONFIG.CONTACT_EMAIL}
${CONFIG.WEBSITE_URL}
    `.trim();

    MailApp.sendEmail({
      to: data.email,
      subject: subject,
      body: body
    });

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const readCol = findHeaderCol(headers, 'read', 'Read') + 1;
    const repliedCol = findHeaderCol(headers, 'replied', 'Replied') + 1;

    if (readCol > 0) sheet.getRange(data.row, readCol).setValue('Y');
    if (repliedCol > 0) sheet.getRange(data.row, repliedCol).setValue('Y');

    Logger.log('Reply sent to: ' + data.email);
    return { success: true, message: 'Reply sent successfully' };
  } catch (error) {
    Logger.log('Reply error: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

/**
 * Deletes a contact message row.
 */
function deleteMessage(rowNumber) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.CONTACT_MESSAGES);
    if (!sheet) return { success: false, message: 'Sheet not found' };

    sheet.deleteRow(rowNumber);
    return { success: true, message: 'Message deleted' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ============================================================================
// SECTION 13: ADMIN NEWS - EDIT EXISTING NEWS POSTS
// ============================================================================

/**
 * Updates an existing news post by sheet row number.
 * Expects News sheet columns: id | title | content | image_url | date | author
 */
function updateNews(data) {
  try {
    const rowNumber = Number(data.row);
    if (!rowNumber || rowNumber < 2) {
      return { success: false, message: 'Invalid row number' };
    }
    if (!data.title || !data.content) {
      return { success: false, message: 'Title and content are required' };
    }

    const sheet = getSheet(CONFIG.SHEETS.NEWS);
    if (!sheet) return { success: false, message: 'News sheet not found' };

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    const titleCol = findHeaderCol(headers, 'title') + 1;
    const contentCol = findHeaderCol(headers, 'content') + 1;
    const imageCol = findHeaderCol(headers, 'image_url', 'image', 'photo_url') + 1;
    const dateCol = findHeaderCol(headers, 'date') + 1;
    const authorCol = findHeaderCol(headers, 'author') + 1;

    if (titleCol > 0) sheet.getRange(rowNumber, titleCol).setValue(data.title);
    if (contentCol > 0) sheet.getRange(rowNumber, contentCol).setValue(data.content);
    if (imageCol > 0 && data.image_url !== undefined) {
      sheet.getRange(rowNumber, imageCol).setValue(data.image_url || '');
    }
    if (dateCol > 0 && data.date) sheet.getRange(rowNumber, dateCol).setValue(data.date);
    if (authorCol > 0 && data.author) sheet.getRange(rowNumber, authorCol).setValue(data.author);

    Logger.log('News updated: row ' + rowNumber);
    return { success: true, message: 'News updated successfully' };
  } catch (error) {
    Logger.log('Update news error: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}
