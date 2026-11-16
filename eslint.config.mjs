import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    // Regras novas do React Compiler (eslint-plugin-react-hooks v6+).
    // O código herdado do curso ainda as viola; ficam como aviso
    // até serem refatoradas.
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
  { ignores: ["src/generated/**", ".next/**", "node_modules/**", "_backup_pre_upgrade/**"] },
];

export default config;
