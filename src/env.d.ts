// Stylesheets are bundled by esbuild as side-effect imports.
declare module '*.css';

// SVG files are bundled as their markup.
declare module '*.svg' {
  const markup: string;
  export default markup;
}
