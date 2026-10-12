'use strict';

// The contact form's server side: check a message, then hand it to Resend, which
// emails it to the site owner. Used by the Cloudflare Worker (worker/index.mjs).

const { ChatError } = require('./chat.js');

const LIMITS = { name: 80, email: 200, message: 4000, minMessage: 10 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Header fields (subject, reply-to) must never carry a line break.
const oneLine = (value) => String(value).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();

// Returns the cleaned message, or `{ spam: true }` when the hidden trap field was
// filled in (only bots do that); throws a ChatError for anything a person got wrong.
const validateContact = (body) => {
  const text = (key) => (body && typeof body[key] === 'string' ? body[key] : '');
  if (text('website').trim()) return { spam: true };
  const name = oneLine(text('name'));
  const email = oneLine(text('email'));
  const message = text('message').replace(/\r\n?/g, '\n').trim();
  if (!name || name.length > LIMITS.name) throw new ChatError(400, 'INVALID_NAME', 'Please enter your name.');
  if (email.length > LIMITS.email || !EMAIL.test(email)) throw new ChatError(400, 'INVALID_EMAIL', 'Please enter a valid email address.');
  if (message.length < LIMITS.minMessage) throw new ChatError(400, 'INVALID_MESSAGE', 'Please write a slightly longer message.');
  if (message.length > LIMITS.message) throw new ChatError(413, 'TOO_LARGE', `Please keep the message under ${LIMITS.message} characters.`);
  return { name, email, message };
};

// Can the part after the @ receive mail at all? Asks public DNS (over HTTPS) for the
// domain's mail servers. This catches made-up domains and typos; it cannot tell
// whether a particular mailbox exists. If the lookup itself fails, the message is
// let through: a DNS hiccup must never block a real person.
const DNS = 'https://cloudflare-dns.com/dns-query';
const lookup = async (domain, type, fetchImpl, signal) => {
  const response = await fetchImpl(`${DNS}?name=${encodeURIComponent(domain)}&type=${type}`, { headers: { Accept: 'application/dns-json' }, signal });
  if (!response.ok) throw new Error('lookup failed');
  const body = await response.json();
  if (typeof body.Status !== 'number') throw new Error('lookup failed');
  return body;
};
const canReceiveMail = async ({ email, fetchImpl = fetch, signal }) => {
  const domain = String(email).slice(String(email).lastIndexOf('@') + 1).toLowerCase();
  try {
    const mx = await lookup(domain, 'MX', fetchImpl, signal);
    if (mx.Status === 3) return false; // the domain does not exist
    const servers = (mx.Answer || []).filter((record) => record.type === 15);
    // "0 ." is a domain's way of saying it accepts no mail.
    if (servers.length) return servers.some((record) => !/^\d+\s+\.$/.test(String(record.data).trim()));
    // No mail servers listed: mail may still be delivered to the domain's own address.
    const host = await lookup(domain, 'A', fetchImpl, signal);
    return (host.Answer || []).some((record) => record.type === 1);
  } catch {
    return true;
  }
};

// Plain text only, so nothing a visitor types can become markup in the inbox.
const sendContact = async ({ contact, apiKey, to, from, fetchImpl = fetch, signal }) => {
  if (!apiKey || !to) throw new ChatError(503, 'NOT_CONFIGURED', 'The contact form is not connected yet.');
  let response;
  try {
    response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: contact.email,
        subject: `Portfolio message from ${contact.name}`,
        text: `${contact.message}\n\n—\n${contact.name} <${contact.email}>\nSent from the portfolio contact form. Reply to this email to answer them.`,
      }),
      signal,
    });
  } catch {
    throw new ChatError(502, 'UPSTREAM_ERROR', 'The message could not be sent. Please email me instead.');
  }
  // Never return the mail provider's errors, the key, or request details to the visitor.
  if (!response.ok) {
    // For the owner's logs only (`npx wrangler tail`); the visitor gets the plain message.
    const detail = await response.text().catch(() => '');
    console.error(`Resend refused the message: ${response.status} ${detail.slice(0, 300)}`);
    throw new ChatError(502, 'UPSTREAM_ERROR', 'The message could not be sent. Please email me instead.');
  }
  return true;
};

module.exports = { LIMITS, validateContact, canReceiveMail, sendContact };
