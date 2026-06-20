/**
 * @clipmanager/shared è consumato come sorgente TypeScript (vedi
 * package.json: "main": "src/index.ts", nessun passaggio di build a parte).
 * Next.js, di default, non transpila i pacchetti che importa da
 * node_modules (dove npm workspaces piazza @clipmanager/shared come symlink):
 * `transpilePackages` dice esplicitamente al suo bundler (SWC/Webpack) di
 * trattarlo come codice applicativo da compilare, non come dipendenza già
 * pronta. Senza questa riga il build fallirebbe sull'import di tipi/zod
 * schema condivisi nelle pagine che validano i form (vedi docs/03-tech-stack.md).
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  // Build di produzione "standalone": l'output (.next/standalone) contiene
  // un node_modules minimo e un server.js auto-contenuto, ideale per
  // un'immagine Docker leggera (vedi apps/web/Dockerfile).
  output: "standalone",
  transpilePackages: ["@clipmanager/shared"],
  // `packages/shared/src/index.ts` importa con estensione `.js` (convenzione
  // TypeScript NodeNext/ESM: l'estensione si riferisce all'output compilato,
  // anche se il file sorgente è `.ts`). `tsc` e `tsx` la risolvono in automatico,
  // ma il resolver di Webpack (usato da Next.js anche con SWC come transpiler)
  // cerca di default un file `.js` letterale e fallisce perché qui esiste solo
  // il `.ts`. `extensionAlias` gli dice di provare anche `.ts`/`.tsx` quando un
  // import termina in `.js`, prima di arrendersi (e mantiene il fallback `.js`
  // per i pacchetti di terze parti che hanno davvero quel file).
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
