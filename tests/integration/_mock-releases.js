const fs = require('fs');
const path = require('path');

module.exports = async function mockReleasesRoutes(page) {
  try {
    const featureFixture = fs.readFileSync(
      path.resolve(__dirname, 'fixtures', 'releases-features.json'),
      'utf8'
    );
    const cveFixture = fs.readFileSync(
      path.resolve(__dirname, 'fixtures', 'cve-action-report.json'),
      'utf8'
    );
    const cveData = JSON.parse(cveFixture);

    // Mock CVE action report endpoints (must come BEFORE generic releases route)
    // Use regex patterns for both page.route (navigation) and request context
    await page.route(/\/api\/modules\/releases\/cve-sustaining\/action-report\/components/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(cveData.components)
      });
    });

    await page.route(/\/api\/modules\/releases\/cve-sustaining\/action-report/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(cveData.report)
      });
    });

    // Mock releases API endpoints (for AI Planner)
    await page.route(/\/api\/modules\/releases\/planning/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: featureFixture
      });
    });

    // Allow other requests to pass through
    await page.route('**', route => route.continue());
  } catch (error) {
    console.warn('Failed to setup mock releases routes:', error.message);
    // Continue anyway - tests may still work with live API
  }
};
