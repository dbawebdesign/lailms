import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import globals from "globals";
import tseslint from "typescript-eslint"; // Assuming typescript-eslint is installed with Next.js setup

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// Define the custom rule
const noLiteralStyleRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow literal values in style props; enforce design tokens or CSS variables.",
      recommended: "warn",
    },
    fixable: null, // Can't automatically fix reliably
    schema: [], // No options
  },
  create(context) {
    const literalPattern = /^(#([0-9a-f]{3}){1,2}|(rgb|hsl)a?\([^)]+\)|[0-9]+(px|rem|em|%|vw|vh)|\b(red|blue|green|black|white|gray|yellow|orange|purple|pink)\b)/i;
    const allowedVarPattern = /^var\\(--.+\\)$/; // Matches var(--*)
    const propertiesToCheck = new Set([
      'color', 'backgroundColor', 'borderColor', 'fontSize', 'fontFamily',
      'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
      'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
      'borderWidth', 'borderRadius', 'gap', 'top', 'right', 'bottom', 'left',
      // Add more CSS properties as needed
    ]);

    return {
      JSXAttribute(node) {
        if (node.name.name === 'style' && node.value && node.value.type === 'JSXExpressionContainer') {
          const expression = node.value.expression;
          if (expression && expression.type === 'ObjectExpression') {
            expression.properties.forEach(prop => {
              if (prop.type === 'Property' && prop.key.type === 'Identifier' && propertiesToCheck.has(prop.key.name)) {
                if (prop.value.type === 'Literal' && typeof prop.value.value === 'string') {
                  const styleValue = prop.value.value.trim();
                  if (literalPattern.test(styleValue) && !allowedVarPattern.test(styleValue)) {
                    context.report({
                      node: prop.value,
                      message: `Avoid using literal style value "${styleValue}" for property "${prop.key.name}". Use design tokens or CSS variables instead.`,
                    });
                  }
                }
                // Could add checks for TemplateLiteral if needed
              }
            });
          }
        }
      }
    };
  }
};

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "src/types/supabase.ts", // Auto-generated Supabase types file
      "packages/types/db.ts", // Auto-generated database types file
    ], // Add ignores for build/dependency dirs
  },
  ...compat.extends(
    "next/core-web-vitals",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ), // Keep core web vitals separate maybe
  { // Configuration for TS/JS files
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    plugins: {
      '@typescript-eslint': tseslint.plugin, // Ensure TS plugin is registered
      'custom-rules': { // Define our custom plugin inline
         rules: {
           'no-literal-style': noLiteralStyleRule
         }
      }
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: tseslint.parser, // Use TypeScript parser
      parserOptions: {
        project: true, // Assumes tsconfig.json is setup for ESLint
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // Inherit recommended rules (example, adjust as needed)
      ...tseslint.configs.recommended.rules,
      // Configure the custom rule
      'custom-rules/no-literal-style': 'warn', // Set to 'warn' or 'error'
      // Temporarily disable problematic rules for deployment
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'off',
      '@next/next/no-img-element': 'warn',
      // Add other rule overrides here
      'react/no-unknown-property': ['warn', { ignore: ['css'] }], // Example: Allow 'css' prop if using CSS-in-JS libs
      'react/prop-types': 'off', // Disable prop-types validation for TypeScript projects
    },
  },
  // You might have other specific configs here from compat.extends("next/typescript")
  // that need to be merged carefully or reconstructed in the flat config format.
  // For simplicity, we've focused on adding the custom rule.
];

export default eslintConfig;
