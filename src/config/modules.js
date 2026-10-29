const S = (a) => ['select', a];

const NAV = [
  { mod: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', section: 'Main' },
  { mod: 'members', label: 'Membership', icon: 'Users', section: 'Main', items: [['Request', '/m/membership_requests'], ['Member List', '/members'], ['Member Type', '/m/member_types']] },
  { mod: 'treasury', label: 'Treasury', icon: 'Landmark', section: 'Main', items: [['Subscription', '/m/subscriptions'], ['Event Registration', '/m/event_registrations'], ['Event Sponsorship', '/m/event_sponsorships'], ['Annual Fees', '/m/annual_fees'], ['Renewal Notification', '/m/renewal_notifications'], ['Renewal Setting', '/m/renewal_settings']] },
  { mod: 'events', label: 'Events', icon: 'CalendarDays', section: 'Main', items: [['New', '/m/events?new=1'], ['List', '/m/events'], ['Notification Mail', '/m/event_mails'], ['Sponsorship Master', '/m/sponsorship_master'], ['Sponsorship', '/m/sponsorships'], ['Gallery', '/m/gallery'], ['Zone Details', '/m/zone_details'], ['Zone Stall', '/m/zone_stalls'], ['Zone Booking', '/m/zone_bookings']] },
  { mod: 'aboutus', label: 'About Us', icon: 'Building2', section: 'Main', items: [['Governing Body', '/m/governing_body'], ['Advisory', '/m/advisory'], ['Notifications', '/m/notifications']] },
  { mod: 'access', label: 'Access', href: '/access', icon: 'KeyRound', section: 'Other' },
  { mod: 'approvals', label: 'Approvals', href: '/approvals', icon: 'CircleCheck', section: 'Other' },
  { mod: 'reports', label: 'Reports', href: '/reports', icon: 'ChartColumn', section: 'Other' },
  { mod: 'settings', label: 'Settings', href: '/settings', icon: 'Settings', section: 'Other' },
];

const COLS = {
  membership_requests: { title: 'Membership Requests', mod: 'members', status: true, f: [['name', 'Applicant Name'], ['company', 'Company'], ['phone', 'Phone'], ['email', 'Email', 'email'], ['type', 'Member Type'], ['note', 'Note', 'textarea']] },
  member_types: { title: 'Member Types', mod: 'members', f: [['name', 'Type Name'], ['fee', 'Annual Fee (₹)', 'number'], ['description', 'Description', 'textarea']] },
  subscriptions: { title: 'Subscriptions', mod: 'treasury', f: [['member', 'Member'], ['plan', 'Plan'], ['amount', 'Amount (₹)', 'number'], ['from', 'From', 'date'], ['to', 'To', 'date'], ['state', 'Status', ...S(['Active', 'Expired', 'Cancelled'])]] },
  event_registrations: { title: 'Event Registrations', mod: 'treasury', f: [['event', 'Event'], ['member', 'Member'], ['seats', 'Seats', 'number'], ['amount', 'Amount (₹)', 'number'], ['state', 'Payment', ...S(['Pending', 'Paid'])]] },
  event_sponsorships: { title: 'Event Sponsorships (Treasury)', mod: 'treasury', f: [['event', 'Event'], ['sponsor', 'Sponsor'], ['package', 'Package'], ['amount', 'Amount (₹)', 'number'], ['state', 'Status', ...S(['Pledged', 'Received'])]] },
  annual_fees: { title: 'Annual Fees', mod: 'treasury', f: [['member', 'Member'], ['year', 'Year'], ['amount', 'Amount (₹)', 'number'], ['state', 'Status', ...S(['Due', 'Paid'])], ['paidOn', 'Paid On', 'date']] },
  renewal_notifications: { title: 'Renewal Notifications', mod: 'treasury', f: [['title', 'Title'], ['daysBefore', 'Days before expiry', 'number'], ['channel', 'Channel', ...S(['WhatsApp', 'Email', 'Both'])], ['message', 'Message', 'textarea']] },
  renewal_settings: { title: 'Renewal Settings', mod: 'treasury', f: [['memberType', 'Member Type'], ['graceDays', 'Grace period (days)', 'number'], ['autoRenew', 'Auto renew', ...S(['Yes', 'No'])], ['lateFee', 'Late fee (₹)', 'number']] },
  events: { title: 'Events', mod: 'events', f: [['title', 'Event Title'], ['date', 'Date', 'date'], ['time', 'Time'], ['venue', 'Venue'], ['fee', 'Entry Fee (₹)', 'number'], ['description', 'Description', 'textarea'], ['state', 'Status', ...S(['Draft', 'Published', 'Closed'])]] },
  event_mails: { title: 'Event Notification Mail', mod: 'events', f: [['event', 'Event'], ['subject', 'Subject'], ['body', 'Body', 'textarea'], ['sendOn', 'Send On', 'date']] },
  sponsorship_master: { title: 'Sponsorship Master', mod: 'events', f: [['package', 'Package Name'], ['amount', 'Amount (₹)', 'number'], ['benefits', 'Benefits', 'textarea']] },
  sponsorships: { title: 'Sponsorships', mod: 'events', f: [['event', 'Event'], ['sponsor', 'Sponsor'], ['package', 'Package'], ['amount', 'Amount (₹)', 'number'], ['logo', 'Logo URL']] },
  gallery: { title: 'Gallery', mod: 'events', f: [['event', 'Event'], ['title', 'Caption'], ['image', 'Image URL']] },
  zone_details: { title: 'Zone Details', mod: 'events', f: [['event', 'Event'], ['zone', 'Zone Name'], ['capacity', 'No. of Stalls', 'number'], ['rate', 'Rate per Stall (₹)', 'number']] },
  zone_stalls: { title: 'Zone Stalls', mod: 'events', f: [['zone', 'Zone'], ['stallNo', 'Stall No.'], ['size', 'Size'], ['state', 'Status', ...S(['Available', 'Booked'])]] },
  zone_bookings: { title: 'Zone Bookings', mod: 'events', f: [['zone', 'Zone'], ['stallNo', 'Stall No.'], ['member', 'Member'], ['amount', 'Amount (₹)', 'number'], ['state', 'Status', ...S(['Pending', 'Confirmed', 'Cancelled'])]] },
  governing_body: { title: 'Governing Body', mod: 'aboutus', f: [['name', 'Name'], ['position', 'Position'], ['phone', 'Phone'], ['email', 'Email', 'email'], ['photo', 'Photo URL'], ['order', 'Display Order', 'number']] },
  advisory: { title: 'Advisory', mod: 'aboutus', f: [['name', 'Name'], ['role', 'Role'], ['bio', 'About', 'textarea'], ['photo', 'Photo URL']] },
  notifications: { title: 'Notifications', mod: 'aboutus', f: [['title', 'Title'], ['message', 'Message', 'textarea'], ['audience', 'Audience', ...S(['All', 'Members', 'Admins'])], ['date', 'Date', 'date']] },
};

module.exports = {
  NAV,
  COLS,
};
