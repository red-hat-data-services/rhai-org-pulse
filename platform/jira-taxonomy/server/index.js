/**
 * Jira Taxonomy platform extension — server routes.
 * Browse components sourced from the field-options store.
 *
 * Mounted as a module-views extension targeting team-tracker.
 * Routes are served at /api/modules/team-tracker/jira-components*.
 *
 * The Jira component sync itself lives in core's field-options-sync engine.
 * This extension provides a read endpoint that reshapes rich field-options
 * data into the browse-friendly format.
 */

var COMPONENT_OPTIONS_NAME = 'component';

module.exports = function registerJiraTaxonomyRoutes(router, context) {
  var storage = context.storage;
  var requireScope = context.requireScope;
  var readFromStorage = storage.readFromStorage;

  /**
   * Build the component browse response from the field-options store.
   * Reads the "component" option set and reshapes richValues into the
   * component array format expected by the taxonomy browse UI.
   */
  function buildComponentResponse() {
    var data = readFromStorage('team-data/field-options/' + COMPONENT_OPTIONS_NAME + '.json');
    if (!data || !data.values) {
      return { fetchedAt: null, project: null, components: [], source: null };
    }

    var richValues = data.richValues || {};
    var components = data.values.map(function(name) {
      var rich = richValues[name] || {};
      return {
        id: rich.id || '',
        name: name,
        description: rich.description || '',
        lead: rich.lead || null,
        assigneeType: rich.assigneeType || 'PROJECT_DEFAULT'
      };
    });

    return {
      fetchedAt: data.syncedAt || data.updatedAt || null,
      project: data.sourceProject || null,
      components: components,
      source: data.source || null
    };
  }

  // ─── GET /jira-components ───

  /**
   * @openapi
   * /api/modules/team-tracker/jira-components:
   *   get:
   *     tags: ['TT: Jira Taxonomy']
   *     summary: List Jira components for the taxonomy browser
   *     description: Returns components from the field-options store, enriched with descriptions and leads from Jira sync.
   *     responses:
   *       200:
   *         description: Component list
   */
  router.get('/jira-components', requireScope('team-tracker:read'), function(req, res) {
    try {
      var result = buildComponentResponse();
      res.json(result);
    } catch (err) {
      console.error('[jira-taxonomy] Error building component response:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
};
