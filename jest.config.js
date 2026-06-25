/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  // Apenas arquivos de teste em src/ — api/ e compilada pela Vercel, nao pelo jest.
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  // Herda as opcoes de compilacao do tsconfig principal.
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
  },
};
