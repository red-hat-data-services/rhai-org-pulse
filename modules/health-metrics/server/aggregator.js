function aggregateEvents(events, month) {
  const pages = {};

  for (const event of events) {
    const pageId = event.page;
    if (!pages[pageId]) {
      pages[pageId] = {
        views: 0,
        uniqueUsers: 0,
        byUserType: {},
        byPermissionTier: {},
        _emails: new Set(),
      };
    }
    const p = pages[pageId];
    p.views++;
    p._emails.add(event.email);

    const ut = event.userType || 'unknown';
    p.byUserType[ut] = (p.byUserType[ut] || 0) + 1;

    const pt = event.permissionTier || 'user';
    p.byPermissionTier[pt] = (p.byPermissionTier[pt] || 0) + 1;
  }

  for (const p of Object.values(pages)) {
    p.uniqueUsers = p._emails.size;
    delete p._emails;
  }

  return {
    month,
    generatedAt: new Date().toISOString(),
    pages,
  };
}

function mergeDailyBreakdown(events) {
  const days = {};
  for (const event of events) {
    const day = event.ts.slice(0, 10);
    if (!days[day]) {
      days[day] = { views: 0, _emails: new Set() };
    }
    days[day].views++;
    days[day]._emails.add(event.email);
  }
  const result = {};
  for (const [day, data] of Object.entries(days)) {
    result[day] = { views: data.views, uniqueUsers: data._emails.size };
  }
  return result;
}

module.exports = { aggregateEvents, mergeDailyBreakdown };
