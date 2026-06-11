import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UserDetailsExportPayload } from './user-details.model';

function asText(value: unknown): string {
  if (value == null || value === '') {
    return '—';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '—';
}

function formatDate(value: string | undefined | null): string {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString();
}

export function exportUserDetailsPdf(payload: UserDetailsExportPayload): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  let y = margin;
  const pageWidth = doc.internal.pageSize.getWidth();

  const addTitle = (text: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(text, margin, y);
    y += 22;
  };

  const addLine = (label: string, value: unknown) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(asText(value), pageWidth - margin * 2 - 120);
    doc.text(lines, margin + 120, y);
    y += Math.max(14, lines.length * 12);
  };

  const addTable = (title: string, head: string[], rows: string[][]) => {
    if (y > doc.internal.pageSize.getHeight() - 80) {
      doc.addPage();
      y = margin;
    }
    addTitle(title);
    autoTable(doc, {
      startY: y,
      head: [head],
      body: rows.length ? rows : [['No records', '—', '—', '—']],
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [85, 110, 230] },
    });
    y = (doc as any).lastAutoTable.finalY + 18;
  };

  const profile = payload.profile;
  const stats = profile.profileStats;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('GoHappyGo — User Data Export', margin, y);
  y += 24;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
  y += 24;

  addTitle('Profile');
  addLine('Full name', profile.fullName);
  addLine('Email', profile.email);
  addLine('Phone', profile.phone);
  addLine('Bio', profile.bio);
  addLine('Member since', formatDate(profile.createdAt));
  addLine('Account status', payload.accountStatus);
  addLine('Email verified', profile.isEmailVerified ? 'Yes' : 'No');
  addLine('Phone verified', profile.isPhoneVerified ? 'Yes' : 'No');
  addLine('Identity verified', profile.isVerified ? 'Yes' : 'No');
  addLine('Stripe status', profile.stripeAccountStatus);
  addLine('Stripe balance', profile.stripeAvailableBalance);
  addLine('Stripe country', profile.stripeCountryCode);
  y += 8;

  addTitle('Activity summary');
  addLine('Demands', stats.demandsCount);
  addLine('Travels', stats.travelsCount);
  addLine('Requests completed', stats.requestsCompletedCount);
  addLine('Requests negotiating', stats.requestsNegotiatingCount);
  addLine('Requests accepted', stats.requestsAcceptedCount);
  addLine('Requests cancelled', stats.requestsCancelledCount);
  addLine('Requests rejected', stats.requestsRejectedCount);
  addLine('Reviews given', stats.reviewsGivenCount);
  addLine('Reviews received', stats.reviewsReceivedCount);
  addLine('Transactions completed', stats.transactionsCompletedCount);
  addLine('Bookmarked demands', stats.bookMarkDemandCount);
  addLine('Bookmarked travels', stats.bookMarkTravelCount);
  y += 8;

  addTable(
    'Demands',
    ['ID', 'Route', 'Status', 'Created'],
    payload.demands.map((d) => [
      asText(d.id),
      `${d.departureAirport?.iataCode ?? '—'} → ${d.arrivalAirport?.iataCode ?? '—'}`,
      asText(d.status),
      formatDate(d.createdAt),
    ]),
  );

  addTable(
    'Travels',
    ['ID', 'Route', 'Status', 'Departure'],
    payload.travels.map((t) => [
      asText(t.id),
      `${t.departureAirport?.iataCode ?? '—'} → ${t.arrivalAirport?.iataCode ?? '—'}`,
      asText(t.status),
      formatDate(t.departureDatetime),
    ]),
  );

  addTable(
    'Requests',
    ['ID', 'Type', 'Status', 'Created'],
    payload.requests.map((r) => [
      asText(r.id),
      asText(r.requestType),
      asText(r.currentStatus?.status),
      formatDate(r.createdAt),
    ]),
  );

  addTable(
    'Transactions',
    ['ID', 'Role', 'Amount', 'Status'],
    payload.transactions.map((t) => [
      asText(t.id),
      t.role,
      `${asText(t.convertedAmount ?? t.amount)} ${asText(t.currencyCode)}`,
      asText(t.status),
    ]),
  );

  addTable(
    'Reviews given',
    ['ID', 'Rating', 'Comment', 'Date'],
    payload.reviewsGiven.map((r) => [
      asText(r.id),
      asText(r.rating),
      asText(r.comment?.substring(0, 80)),
      formatDate(r.createdAt),
    ]),
  );

  addTable(
    'Reviews received',
    ['ID', 'Rating', 'Comment', 'Date'],
    payload.reviewsReceived.map((r) => [
      asText(r.id),
      asText(r.rating),
      asText(r.comment?.substring(0, 80)),
      formatDate(r.createdAt),
    ]),
  );

  addTable(
    'Support requests',
    ['ID', 'Category', 'Status', 'Created'],
    payload.supportTickets.map((s) => [
      asText(s.id),
      asText(s.category),
      asText(s.status),
      formatDate(s.createdAt),
    ]),
  );

  const safeName = asText(profile.fullName).replace(/[^\w\-]+/g, '_').substring(0, 40) || 'user';
  doc.save(`gohappygo-user-${profile.id}-${safeName}.pdf`);
}
