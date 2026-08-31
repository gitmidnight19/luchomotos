/** Configuracion de Babel. `babel-preset-expo` ya incluye el plugin de
 *  react-native-worklets que necesita Reanimated (dependencia de expo-router). */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { reanimated: true }]],
  };
};
