/**
 * ESLint rule: no-cross-module-imports
 *
 * Prevents modules from importing, fetching, or navigating to other modules
 * directly. Cross-module data access should go through @shared services or
 * cross-module events.
 *
 * Catches:
 * 1. Direct require()/import from another module's directory
 * 2. String literals containing /api/modules/<other-slug>/ or /modules/<other-slug>/
 *    (cross-module API calls — apiRequest() strips the /api prefix)
 * 3. String/template literals containing #/<other-slug>/ (cross-module hash routes)
 *
 * Handles both <script> and <template> sections of Vue SFCs by traversing
 * the template body AST from vue-eslint-parser.
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow cross-module imports and API references',
    },
    messages: {
      noDirectImport:
        'Do not import directly from module "{{target}}". Use @shared instead.',
      noCrossModuleApi:
        'Cross-module API reference to "{{target}}". Use shared services or cross-module events.',
      noCrossModuleRoute:
        'Cross-module route to "{{target}}". Use useModuleLink() with a module-installed guard.',
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    const moduleMatch = filename.match(/modules\/([^/]+)\//)
    if (!moduleMatch) return {}
    const currentSlug = moduleMatch[1]

    // Known module slugs — prevents false positives on non-module hash paths
    const KNOWN_SLUGS = new Set([
      'ai-impact',
      'releases',
      'team-tracker',
      'system-health',
      'product-builds',
      'upstream-pulse',
    ])

    function checkImportSource(node, source) {
      if (!source || typeof source !== 'string') return
      const otherModule =
        source.match(/modules\/([^/]+)/) ||
        source.match(/^@modules\/([^/]+)/)
      if (otherModule && otherModule[1] !== currentSlug) {
        context.report({
          node,
          messageId: 'noDirectImport',
          data: { target: otherModule[1] },
        })
      }
    }

    function checkStringValue(node, val) {
      if (typeof val !== 'string') return

      // /api/modules/<other-slug> or /modules/<other-slug> (apiRequest strips /api)
      const apiMatch = val.match(/\/modules\/([^/]+)/)
      if (apiMatch && apiMatch[1] !== currentSlug && KNOWN_SLUGS.has(apiMatch[1])) {
        context.report({
          node,
          messageId: 'noCrossModuleApi',
          data: { target: apiMatch[1] },
        })
      }

      // #/<other-slug>/ — only flag known module slugs
      const hashMatch = val.match(/#\/([^/?]+)/)
      if (
        hashMatch &&
        hashMatch[1] !== currentSlug &&
        KNOWN_SLUGS.has(hashMatch[1])
      ) {
        context.report({
          node,
          messageId: 'noCrossModuleRoute',
          data: { target: hashMatch[1] },
        })
      }
    }

    /** Recursively walk an AST node to find string literals and template literals */
    function walkForStrings(node) {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) {
        for (const child of node) walkForStrings(child)
        return
      }
      if (!node.type) return

      if (node.type === 'Literal' && typeof node.value === 'string') {
        checkStringValue(node, node.value)
      } else if (node.type === 'TemplateLiteral') {
        for (const quasi of node.quasis) {
          checkStringValue(node, quasi.value.cooked)
        }
      }

      // Recurse into child properties (skip parent to avoid cycles)
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === 'tokens' || key === 'comments') continue
        walkForStrings(node[key])
      }
    }

    return {
      ImportDeclaration(node) {
        checkImportSource(node, node.source.value)
      },
      CallExpression(node) {
        if (
          node.callee.name === 'require' &&
          node.arguments[0]?.type === 'Literal'
        ) {
          checkImportSource(node, node.arguments[0].value)
        }
      },
      // Script-section string literals
      Literal(node) {
        if (node.parent?.type === 'CallExpression' && node.parent.callee?.name === 'require' && node.parent.arguments[0] === node) return
        if (node.parent?.type === 'ImportDeclaration' && node.parent.source === node) return
        checkStringValue(node, node.value)
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          checkStringValue(node, quasi.value.cooked)
        }
      },
      // Walk Vue template body for string literals in expressions
      'Program:exit'() {
        const sourceCode = context.sourceCode || context.getSourceCode()
        const templateBody = sourceCode.ast.templateBody
        if (!templateBody) return

        // Find all VExpressionContainer nodes in the template
        function walkTemplate(node) {
          if (!node || typeof node !== 'object') return
          if (Array.isArray(node)) {
            for (const child of node) walkTemplate(child)
            return
          }
          if (!node.type) return

          if (node.type === 'VExpressionContainer' && node.expression) {
            walkForStrings(node.expression)
          }

          // Walk children/attributes
          if (node.children) walkTemplate(node.children)
          if (node.startTag) {
            if (node.startTag.attributes) walkTemplate(node.startTag.attributes)
          }
          if (node.value) walkTemplate(node.value)
        }

        walkTemplate(templateBody)
      },
    }
  },
}
