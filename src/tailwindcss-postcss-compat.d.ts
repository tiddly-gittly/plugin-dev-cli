declare module '@tailwindcss/postcss' {
  const createPlugin: (options?: Record<string, unknown>) => unknown;
  export default createPlugin;
}
