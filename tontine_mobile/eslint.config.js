// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // React Native n'est pas un navigateur : les apostrophes dans <Text> sont valides.
      'react/no-unescaped-entities': 'off',
    },
  },
]);
