/**
 * Transactional email body templates.
 * Each builder returns { subject, text, html }.
 */

const BASE_WRAP = (inner) => `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 520px; margin: auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 14px; background-color: #ffffff;">
    <h2 style="color: #0B192C; text-align: center; margin: 0 0 4px;">BBC - Bengal Business Council</h2>
    <p style="color: #94a3b8; text-align: center; font-size: 11px; letter-spacing: 1px; margin: 0 0 20px; text-transform: uppercase;">by Credovation Solutions Pvt Ltd</p>
    ${inner}
    <p style="color: #94a3b8; font-size: 12px; margin-top: 28px; border-top: 1px solid #edf2f7; padding-top: 16px; text-align: center;">
      Bengal Business Council Secretariat &middot; Salt Lake Sector V, Kolkata
    </p>
  </div>
`;

/**
 * Confirmation sent after a member successfully resets their password.
 * @param {Object} opts
 * @param {string} [opts.firstName='Member']
 * @param {Date}   [opts.when=new Date()]
 */
const passwordChangedEmail = ({ firstName = 'Member', when = new Date() } = {}) => {
  const subject = 'Your BBC password was changed';

  const timestamp = when.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });

  const text =
    `Hello ${firstName},\n\n` +
    `This is a confirmation that the password for your Bengal Business Council account was changed on ${timestamp} (IST).\n\n` +
    `If you made this change, no further action is needed.\n` +
    `If you did NOT request this, contact the council secretariat immediately at hello@bengalbussinesscouncil.com.\n\n` +
    `— Bengal Business Council Secretariat`;

  const html = BASE_WRAP(`
    <h3 style="color: #0f172a; text-align: center; margin-top: 0;">Password Changed</h3>
    <p style="color: #475569; font-size: 15px;">Hello <strong>${firstName}</strong>,</p>
    <p style="color: #475569; font-size: 15px;">
      This is a confirmation that the password for your Bengal Business Council account was changed on
      <strong>${timestamp} (IST)</strong>.
    </p>
    <div style="background: #ecfdf5; border: 1px solid rgba(5,150,105,0.25); border-radius: 10px; padding: 12px 16px; margin: 20px 0;">
      <p style="color: #059669; font-size: 14px; margin: 0; font-weight: 600;">
        &#10003; If you made this change, no further action is needed.
      </p>
    </div>
    <p style="color: #b91c1c; font-size: 14px; font-weight: 500;">
      If you did <strong>not</strong> request this, contact the council secretariat immediately at
      <a href="mailto:hello@bengalbussinesscouncil.com" style="color: #b91c1c;">hello@bengalbussinesscouncil.com</a>.
    </p>
  `);

  return { subject, text, html };
};

/**
 * Sent to each admin when a member submits their profile for review.
 * @param {Object} opts
 * @param {string} [opts.adminName='Admin']
 * @param {string} opts.memberName
 * @param {string} [opts.memberEmail='']
 */
const profileSubmittedForReviewEmail = ({ adminName = 'Admin', memberName, memberEmail = '' } = {}) => {
  const subject = `Profile review requested — ${memberName}`;

  const text =
    `Hello ${adminName},\n\n` +
    `${memberName}${memberEmail ? ` (${memberEmail})` : ''} has completed their business profile and submitted it for review.\n\n` +
    `Open the Admin Console → Profile Reviews to approve, reject, or mark it under review.\n\n` +
    `— BBC - Bengal Business Council`;

  const html = BASE_WRAP(`
    <h3 style="color: #0f172a; text-align: center; margin-top: 0;">Profile Review Requested</h3>
    <p style="color: #475569; font-size: 15px;">Hello <strong>${adminName}</strong>,</p>
    <p style="color: #475569; font-size: 15px;">
      <strong>${memberName}</strong>${memberEmail ? ` (${memberEmail})` : ''} has completed their business
      profile and submitted it for review.
    </p>
    <div style="background: #eff6ff; border: 1px solid rgba(29,112,184,0.25); border-radius: 10px; padding: 12px 16px; margin: 20px 0;">
      <p style="color: #1d70b8; font-size: 14px; margin: 0; font-weight: 600;">
        Open the Admin Console &rarr; Profile Reviews to approve, reject, or mark it under review.
      </p>
    </div>
  `);

  return { subject, text, html };
};

/**
 * Sent to a member after an admin reviews their profile.
 * @param {Object} opts
 * @param {string} [opts.firstName='Member']
 * @param {'approved'|'rejected'|'under_review'} opts.status
 * @param {string} [opts.note='']
 */
const profileReviewedEmail = ({ firstName = 'Member', status, note = '' } = {}) => {
  const label =
    status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'placed under review';
  const subject = `Your BBC profile was ${label}`;

  const nextStep =
    status === 'approved'
      ? 'You now have full access to BBC - Bengal Business Council. Welcome aboard.'
      : status === 'rejected'
      ? 'Please update the flagged details and resubmit your profile for review.'
      : 'No action is needed from you right now — the secretariat is taking another look.';

  const text =
    `Hello ${firstName},\n\n` +
    `Your business profile has been ${label}.\n` +
    (note ? `\nReviewer note: ${note}\n` : '') +
    `\n${nextStep}\n\n— Bengal Business Council Secretariat`;

  const accent =
    status === 'approved' ? '#059669' : status === 'rejected' ? '#b91c1c' : '#d97706';

  const html = BASE_WRAP(`
    <h3 style="color: #0f172a; text-align: center; margin-top: 0;">Profile ${label.replace(/^\w/, (c) => c.toUpperCase())}</h3>
    <p style="color: #475569; font-size: 15px;">Hello <strong>${firstName}</strong>,</p>
    <p style="color: #475569; font-size: 15px;">Your business profile has been
      <strong style="color: ${accent};">${label}</strong>.</p>
    ${
      note
        ? `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin: 16px 0;">
             <p style="color: #475569; font-size: 13px; margin: 0;"><strong>Reviewer note:</strong> ${note}</p>
           </div>`
        : ''
    }
    <p style="color: #475569; font-size: 14px;">${nextStep}</p>
  `);

  return { subject, text, html };
};

module.exports = {
  passwordChangedEmail,
  profileSubmittedForReviewEmail,
  profileReviewedEmail,
};
