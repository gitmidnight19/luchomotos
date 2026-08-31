// Configuracion plana de ESLint 9. Aqui vive SOLO el linting: `eslint-config-expo`
// aporta las reglas especificas de React Native que Biome no cubre, y por eso no se
// reemplaza. El formato lo lleva Biome (biome.json).
const expo = require('eslint-config-expo/flat');

module.exports = [
  ...expo,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'web-build/**', 'src/api/openapi.d.ts'],
  },
];
