// Configuracion plana de ESLint 9. `eslint-config-expo/flat` ya trae los
// plugins de TypeScript, React e imports con reglas afinadas para Expo;
// `eslint-config-prettier` apaga las que chocan con el formateador.
const expo = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

module.exports = [
  ...expo,
  prettier,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'web-build/**', 'src/api/openapi.d.ts'],
  },
];
