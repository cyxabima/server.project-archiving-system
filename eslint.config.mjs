import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig, // Disables ESLint rules that conflict with Prettier
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      "prettier/prettier": "error", // Marks formatting issues as red-line errors
      "no-console": "warn",        // Good for long-term projects
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "src/models/**"], // Ignore generated files
  }
);
