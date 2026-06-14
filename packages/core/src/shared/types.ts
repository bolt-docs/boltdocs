import type { Plugin as VitePlugin } from "vite";
import type { ComponentType } from "react";

/**
 * Represents a single social link in the configuration.
 */
export interface BoltdocsSocialLink {
  icon: "discord" | "x" | "github" | "bluesky" | string;
  link: string;
}

/**
 * Configuration for the site footer.
 */
export interface BoltdocsFooterConfig {
  text?: string;
}

/**
 * Theme-specific configuration options.
 */
export interface BoltdocsThemeConfig {
  title?: string | Record<string, string>;
  description?: string | Record<string, string>;
  logo?:
    | string
    | {
        dark: string;
        light: string;
        alt?: string;
        width?: number;
        height?: number;
      };
  navbar?: Array<{
    label: string | Record<string, string>;
    href: BoltdocsRoutePathWithFallback;
    items?: Array<{
      label: string | Record<string, string>;
      href: BoltdocsRoutePathWithFallback;
    }>;
  }>;
  sidebar?: Record<
    string,
    Array<{ text: string; link: BoltdocsRoutePathWithFallback }>
  >;
  sidebarGroups?: Record<
    string,
    { title?: string | Record<string, string>; icon?: string }
  >;
  socialLinks?: BoltdocsSocialLink[];
  footer?: BoltdocsFooterConfig;
  editLink?: string;
  communityHelp?: string;
  version?: string;
  githubRepo?: string;
  favicon?: string;
  tabs?: Array<{
    id: string;
    text: string | Record<string, string>;
    icon?: string;
  }>;
  codeTheme?: ShikiTheme | { light: ShikiTheme; dark: ShikiTheme };
}

/**
 * List of supported syntax highlighting themes.
 */
export type ShikiTheme =
  | "github-dark"
  | "github-light"
  | "tokyo-night"
  | "dracula"
  | "nord"
  | "one-dark-pro"
  | "one-light";

/**
 * Configuration for the robots.txt file.
 */
export type BoltdocsRobotsConfig =
  | string
  | {
      rules?: Array<{
        userAgent: string;
        allow?: string | string[];
        disallow?: string | string[];
      }>;
      sitemaps?: string[];
    };

/**
 * Configuration for a specific locale.
 */
export interface BoltdocsLocaleConfig {
  label?: string;
  direction?: "ltr" | "rtl";
  htmlLang?: string;
  calendar?: string;
}

/**
 * Configuration for internationalization (i18n).
 */
export interface BoltdocsI18nConfig {
  defaultLocale: string;
  locales: string[] | Record<string, string>;
  localeConfigs?: Record<string, BoltdocsLocaleConfig>;
}

/**
 * Configuration for a specific documentation version.
 */
export interface BoltdocsVersionConfig {
  label: string;
  path: string;
}

/**
 * Configuration for documentation versioning.
 */
export interface BoltdocsVersionsConfig {
  defaultVersion: string;
  prefix?: string;
  versions: BoltdocsVersionConfig[];
}

/**
 * Shared badge value type used in frontmatter, RouteMeta, and ComponentRoute.
 */
export type BadgeValue = string | { text: string; expires?: string };

/**
 * Defines a Boltdocs plugin.
 *
 * Use the `createPlugin()` helper from the node API for full type safety and
 * access to lifecycle hooks.
 */
export interface BoltdocsPlugin {
  name: string;
  enforce?: "pre" | "post";
  version?: string;
  boltdocsVersion?: string;
  remarkPlugins?: unknown[];
  rehypePlugins?: unknown[];
  vitePlugins?: VitePlugin[];
  components?: Record<string, string>;
  /** Lifecycle hooks — use the `PluginLifecycleHooks` type from the node API. */
  hooks?: Record<string, (ctx: unknown) => Promise<void> | void>;
}

/**
 * Configuration for the collections (blog) feature.
 */
export interface BoltdocsCollectionsConfig {
  /** Number of posts per page in collection listing pages. Defaults to 10. */
  postsPerPage?: number;
  /** The name of the default collection used by BlogList when none is specified. */
  defaultCollection?: string;
  /** Date format string for rendering post dates (e.g., 'MMMM dd, yyyy'). */
  dateFormat?: string;
  /** Field to sort posts by. Defaults to 'date'. */
  sortBy?: "date" | "title" | "sidebarPosition";
}

export interface BoltdocsSecurityConfig {
  headers?: Record<string, string>;
  enableCSP?: boolean;
  customHeaders?: Record<string, string>;
}

/**
 * Configuration for SEO.
 */
export interface BoltdocsSeoConfig {
  metatags?: Record<string, string>;
  indexing?: "all" | "public";
  thumbnails?: {
    background?: string;
  };
}

/**
 * Configuration for Google Analytics 4 (GA4).
 */
export interface BoltdocsGA4Config {
  measurementId: string;
  debug?: boolean;
  anonymizeIp?: boolean;
  sendPageView?: boolean;
  cookieFlags?: string;
  autoTrack?: {
    pageViews?: boolean;
    downloads?: boolean;
    externalLinks?: boolean;
    search?: boolean;
  };
}

/**
 * Configuration for Google Tag Manager (GTM).
 */
export interface BoltdocsGTMConfig {
  tagId: string;
  dataLayerName?: string;
  preview?: string;
}

/**
 * Configuration for Algolia DocSearch.
 */
export interface BoltdocsAlgoliaConfig {
  appId: string;
  apiKey: string;
  indexName: string;
}

/**
 * Configuration for Giscus comments.
 */
export interface BoltdocsGiscusConfig {
  repo: string;
  repoId: string;
  category?: string;
  categoryId?: string;
  mapping?: "pathname" | "url" | "title" | "og:title" | "specific" | "number";
  strict?: "0" | "1" | boolean;
  reactionsEnabled?: "0" | "1" | boolean;
  emitMetadata?: "0" | "1" | boolean;
  inputPosition?: "top" | "bottom";
  theme?: string;
  darkTheme?: string;
  lang?: string;
  loading?: "lazy" | "eager";
}

/**
 * Configuration for custom feedback system using GitHub Discussions API.
 */
export interface BoltdocsCustomFeedbackConfig {
  enabled: boolean;
  owner: string;
  repo: string;
  categorySlug?: string;
  endpoint?: string;
}

export interface BoltdocsVercelConfig {
  analytics?: boolean;
  speedInsights?: boolean;
}

export interface BoltdocsIntegrationsConfig {
  analytics?: {
    ga4?: BoltdocsGA4Config;
    vercel?: BoltdocsVercelConfig;
    gtm?: BoltdocsGTMConfig;
  };
  search?: {
    algolia?: BoltdocsAlgoliaConfig;
  };
  feedback?: {
    giscus?: BoltdocsGiscusConfig;
    custom?: BoltdocsCustomFeedbackConfig;
  };
}

/**
 * The root configuration object for Boltdocs.
 */
export interface BoltdocsConfig {
  siteUrl?: string;
  docsDir?: string;
  base?: string;
  theme?: BoltdocsThemeConfig;
  i18n?: BoltdocsI18nConfig;
  versions?: BoltdocsVersionsConfig;
  plugins?: BoltdocsPlugin[];
  collections?: BoltdocsCollectionsConfig;
  robots?: BoltdocsRobotsConfig;
  security?: BoltdocsSecurityConfig;
  seo?: BoltdocsSeoConfig;
  integrations?: BoltdocsIntegrationsConfig;
  directoryMeta?: Record<string, unknown>;
  vite?: unknown;
}

/**
 * Global namespace for Boltdocs types that can be augmented by generated code.
 * This allows for strictly typed locales and versions based on the project configuration.
 */
declare global {
  namespace Boltdocs {
    interface Types {}

    /**
     * Marker interface augmented by generated code to provide strict route path typing.
     * When no types have been generated (e.g., before first dev server start),
     * keyof is never, and BoltdocsRoutePath falls back to string.
     */
    interface RoutePaths {}
  }
}

export type BoltdocsTypes = Boltdocs.Types;

export type BoltdocsRoutePath = keyof Boltdocs.RoutePaths;

export type BoltdocsRoutePathWithFallback = BoltdocsRoutePath extends never
  ? string
  : BoltdocsRoutePath;

export type BoltdocsLocale = Boltdocs.Types extends { Locale: infer L }
  ? L
  : string;
export type BoltdocsVersion = Boltdocs.Types extends { Version: infer V }
  ? V
  : string;

export type UnpackMdxComponents<T> = T extends { default: infer D } ? D : T;

export type TransformMdxComponents<T> = {
  [K in keyof T as K extends `Frontmatter_${string}` ? never : K]: T[K];
} & {
  Frontmatter: {
    [K in keyof T as K extends `Frontmatter_${infer Name}`
      ? Name
      : never]: T[K];
  };
};

export type BoltdocsMdxComponents = Boltdocs.Types extends {
  MdxComponents: infer M;
}
  ? TransformMdxComponents<UnpackMdxComponents<M>>
  : {
      [key: string]: ComponentType<any>;
      Frontmatter: Record<string, ComponentType<any>>;
    };
