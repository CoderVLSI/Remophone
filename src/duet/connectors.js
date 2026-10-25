// Services Claude Duet is meant to work with. `status: "soon"` means the app has no
// working integration for it yet; nothing here connects to a real account.
export const CONNECTORS = [
  { group: "Google", id: "gmail", name: "Gmail", blurb: "Morning brief and follow-ups from your inbox", status: "soon" },
  { group: "Google", id: "googlecalendar", name: "Google Calendar", blurb: "Today's schedule and meeting prep", status: "soon" },
  { group: "Google", id: "googledrive", name: "Google Drive", blurb: "Find and attach your files", status: "soon" },
  { group: "Work", id: "slack", name: "Slack", blurb: "Post updates and read channels", status: "soon" },
  { group: "Work", id: "hubspot", name: "HubSpot", blurb: "Contacts and deals", status: "soon" },
  { group: "Work", id: "calendly", name: "Calendly", blurb: "Scheduling links and bookings", status: "soon" },
  { group: "Work", id: "docusign", name: "Docusign", blurb: "Documents for signature, always with your approval", status: "soon" },
  { group: "Money", id: "quickbooks", name: "QuickBooks", blurb: "Invoices and expenses", status: "soon" },
  { group: "Money", id: "stripe", name: "Stripe", blurb: "Payments and balances", status: "soon" },
  { group: "Money", id: "shopify", name: "Shopify", blurb: "Orders and Shop Pay checkout", status: "soon" },
];

export const GEMINI_KEY_URL = "https://aistudio.google.com/apikey";
