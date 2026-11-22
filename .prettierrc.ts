import type { Config } from 'prettier';

const config: Config = {
  // Core formatting
  printWidth: 90,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',

  // Other
  quoteProps: 'consistent',
  bracketSameLine: false,
  singleAttributePerLine: true,
  htmlWhitespaceSensitivity: 'css',
  proseWrap: 'always',
  embeddedLanguageFormatting: 'auto',

  // Plugins
  plugins: [
    // "prettier-plugin-jsdoc",
  ],

  overrides: [
    {
      files: ['*.yaml', '*.yml'],
      options: {
        tabWidth: 2,
      },
    },
    {
      files: ['*.json', '*.jsonc'],
      options: {
        tabWidth: 2,
      },
    },
  ],
};

export default config;
