// Configuration Babel du projet.
//
// Le plugin react-native-reanimated/plugin doit rester en DERNIER : il transforme
// les worklets ("use worklet") en code UI thread. On désactive expérimentalement le
// React Compiler (app.json -> experiments.reactCompiler = false) afin d'éviter tout
// conflit d'ordre de plugins avec Reanimated. Le preset Expo gère le reste.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["react-native-reanimated/plugin"],
  };
};
