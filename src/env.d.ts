/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_MAPS_API_KEY: string;
  readonly PUBLIC_FIREBASE_CONFIG: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
