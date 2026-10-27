// Se ejecuta en el pre-commit (ver .husky/pre-commit) solo sobre los archivos en staging.
// Bloquea el commit si ESLint encuentra errores en lo que se está por commitear.
export default {
  // Backend: toda regla en `error` bloquea; los warnings se muestran pero no frenan.
  'backend/**/*.ts': (archivos) => `npm --prefix backend exec -- eslint ${archivos.join(' ')}`,

  // Frontend: `main` arrastra errores de lint de antes de esta política (ver el comentario de ci.yml).
  // Las tres reglas nuevas de react-hooks que concentran esa deuda se bajan a warning solo en el hook,
  // así un commit no queda trabado por código que no tocaste. El resto de las reglas sigue bloqueando.
  'frontend/**/*.{ts,tsx}': (archivos) =>
    'pnpm --dir frontend exec eslint ' +
    '--rule "react-hooks/set-state-in-effect: warn" ' +
    '--rule "react-hooks/static-components: warn" ' +
    '--rule "react-hooks/immutability: warn" ' +
    archivos.join(' '),
}
