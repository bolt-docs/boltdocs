export const translations = {
  en: {
    // Hero
    heroAvailable: 'Available now!',
    heroTitle: 'The modern',
    heroTitleHighlight: 'documentation engine',
    heroDescription:
      'Building documentation for your project has never been easier. Create beautiful, highly customizable, and extremely fast sites out of the box.',
    heroGetStarted: 'Get Started',
    heroReadApi: 'Read the API',

    // Integrations
    integrationsLabel: 'Integrations & Ecosystem',
    integrationsTitle: 'Engineered to Integrate with Industry Standards',

    // Features
    featuresTitle: 'Powerful Features',
    featuresDescription:
      'Everything you need to ship world-class technical documentation.',
    features: [
      {
        title: 'Instant Hot Reload',
        description:
          'Every save triggers an instant, surgical update — no full-page reload, no state loss. Your docs refresh faster than you can alt-tab.',
      },
      {
        title: 'Lightning Builds',
        description:
          'From cold start to deploy-ready HTML in under 200ms per page. Powered by Vite and aggressive caching at every layer.',
      },
      {
        title: 'Full SEO Control',
        description:
          'Automatic Open Graph images, sitemaps, structured data, and meta tags — no plugins, no extra config. Every page is SEO-ready from line one.',
      },
      {
        title: 'Built-in Search',
        description:
          'Typo-tolerant, instant search that works offline. FlexSearch powered out of the box — no Algolia key, no third-party service required.',
      },
      {
        title: 'Secure by Default',
        description:
          'Automated dependency auditing, hardened build pipelines, and CSP headers baked into every deployment. Security is not an afterthought.',
      },
    ],

    // Featured Resources
    featuredTitle: 'Featured resources & updates',
    featuredAll: 'All Resources',

    // CTA
    ctaTitle: 'Start building your docs',
    ctaTitleHighlight: 'in seconds',
    ctaDescription:
      'Create beautiful, performant documentation with zero config. Join thousands of developers already using Boltdocs.',
    ctaGetStarted: 'Get Started',

    // About
    aboutLabel: 'About the project',
    aboutMissionTitle: 'Our Mission',
    aboutMissionDescription:
      'Writing documentation is often treated as an afterthought because the tools to build it are either too complex, too slow, or visually unappealing by default. We created Boltdocs to provide a zero-configuration, edge-ready, and highly customizable engine that teams actually enjoy using.',
    aboutOpenSourceTitle: 'Open Source',
    aboutOpenSourceDescription:
      'Boltdocs is proudly open source under the MIT License. We believe the best tools are built collaboratively, and we welcome contributions from developers all around the world.',
    aboutDeveloperTitle: 'The Developer',
    aboutDeveloperDescription: 'Boltdocs is built and maintained by',
    aboutDeveloperName: 'Jesus Alcala',
    aboutDeveloperSuffix:
      '. Passionate about enhancing developer productivity, Jesus created Boltdocs to solve common documentation pain points and deliver a superior writing experience.',
    aboutFollowGithub: 'Follow @jesusalcaladev on GitHub',

    // Showcase
    showcaseTitle: 'Showcase',
    showcaseDescription:
      'Curated showcase of the libraries, tools, and packages that power the Boltdocs ecosystem.',
    showcaseVisitDocs: 'Visit Documentation',
    showcaseViewGithub: 'View on GitHub',
    showcaseCtaTitle: 'Want to contribute?',
    showcaseCtaDescription:
      'Have a suggestion for a new Showcase entry? Open an issue in the Boltdocs GitHub repository describing the package.',
    showcaseOpenIssue: 'Open an Issue',
    showcaseFeatures: {
      colorSystem: 'Color System',
      tablesAndBoxes: 'Tables & Boxes',
      spinners: 'Spinners',
      progressBars: 'Progress Bars',
      interactivePrompts: 'Interactive Prompts',
      stepsAndLists: 'Steps & Lists',
      keyframeAnimation: 'Keyframe Animation',
    },

    // Footer
    footerDocumentation: 'Documentation',
    footerContributing: 'Contributing',
    footerIssues: 'Issues',
    footerBlog: 'Blog',
    footerGitHub: 'GitHub',
    footerApiReference: 'API Reference',
    footerAbout: 'About Boltdocs',

    // Banner
    bannerNewVersion:
      'Boltdocs 3.3.0 is out — New Plugin API, performance boost, and more!',
    bannerReadPost: 'Read post',

    // Benchmark
    benchmarkTitle: 'Benchmark',
    benchmarkDescription:
      'How fast is Boltdocs? We benchmarked our native parser against standard JavaScript and WebAssembly implementations across thousands of MDX files.',
    benchmarkAvgSpeedup: 'Avg Speedup',
    benchmarkMaxSpeedup: 'Max Speedup',
    benchmarkFastestParse: 'Fastest Parse',
    benchmarkJsBaseline: 'JS Baseline',
    benchmarkMethodology: 'Methodology',
    benchmarkMethodologyP1:
      'Each benchmark generates synthetic MDX files with frontmatter, multiple heading levels, paragraphs with inline formatting, code blocks, and HTML markup.',
    benchmarkMethodologyP2:
      'Three parser implementations are tested: JavaScript (standard MDX pipeline), WebAssembly (compiled WASM module), and Native (Zig-compiled WASM with optimized parsing).',
    benchmarkMethodologyP3:
      'Each run clears both in-memory route caches and the filesystem persistence cache to ensure cold-parse measurements. The fastest of 3 runs is recorded.',
  },
  es: {
    // Hero
    heroAvailable: '¡Disponible ahora!',
    heroTitle: 'El moderno',
    heroTitleHighlight: 'motor de documentación',
    heroDescription:
      'Crear documentación para tu proyecto nunca ha sido tan fácil. Genera sitios hermosos, altamente personalizables y extremadamente rápidos desde el primer momento.',
    heroGetStarted: 'Comenzar',
    heroReadApi: 'Leer la API',

    // Integrations
    integrationsLabel: 'Integraciones y Ecosistema',
    integrationsTitle:
      'Diseñado para Integrarse con Estándares de la Industria',

    // Features
    featuresTitle: 'Funcionalidades Potentes',
    featuresDescription:
      'Todo lo que necesitas para crear documentación técnica de clase mundial.',
    features: [
      {
        title: 'Hot Reload Instantáneo',
        description:
          'Cada guardado activa una actualización instantánea y quirúrgica — sin recarga completa de página, sin pérdida de estado. Tus docs se refrescan más rápido de lo que puedes cambiar de pestaña.',
      },
      {
        title: 'Compilaciones Relámpago',
        description:
          'Desde inicio en frío hasta HTML listo para desplegar en menos de 200ms por página. Impulsado por Vite y caché agresivo en cada capa.',
      },
      {
        title: 'Control SEO Completo',
        description:
          'Imágenes Open Graph automáticas, sitemaps, datos estructurados y meta tags — sin plugins, sin configuración extra. Cada página está lista para SEO desde la primera línea.',
      },
      {
        title: 'Búsqueda Incorporada',
        description:
          'Búsqueda instantánea tolerante a errores que funciona offline. FlexSearch integrado de fábrica — sin clave de Algolia, sin servicio de terceros.',
      },
      {
        title: 'Seguro por Defecto',
        description:
          'Auditoría automatizada de dependencias, pipelines de compilación reforzados y headers CSP integrados en cada despliegue. La seguridad no es una ocurrencia tardía.',
      },
    ],

    // Featured Resources
    featuredTitle: 'Recursos y actualizaciones destacados',
    featuredAll: 'Todos los Recursos',

    // CTA
    ctaTitle: 'Empieza a construir tus docs',
    ctaTitleHighlight: 'en segundos',
    ctaDescription:
      'Crea documentación hermosa y performante sin configuración. Únete a miles de desarrolladores que ya usan Boltdocs.',
    ctaGetStarted: 'Comenzar',

    // About
    aboutLabel: 'Sobre el proyecto',
    aboutMissionTitle: 'Nuestra Misión',
    aboutMissionDescription:
      'Escribir documentación a menudo se trata como una ocurrencia tardía porque las herramientas para construirla son demasiado complejas, demasiado lentas o visualmente poco atractivas por defecto. Creamos Boltdocs para proporcionar un motor sin configuración, listo para edge y altamente personalizable que los equipos realmente disfrutan usando.',
    aboutOpenSourceTitle: 'Código Abierto',
    aboutOpenSourceDescription:
      'Boltdocs es orgullosamente código abierto bajo la Licencia MIT. Creemos que las mejores herramientas se construyen de forma colaborativa, y damos la bienvenida a contribuciones de desarrolladores de todo el mundo.',
    aboutDeveloperTitle: 'El Desarrollador',
    aboutDeveloperDescription: 'Boltdocs es construido y mantenido por',
    aboutDeveloperName: 'Jesus Alcala',
    aboutDeveloperSuffix:
      '. Apasionado por mejorar la productividad de los desarrolladores, Jesus creó Boltdocs para resolver puntos problemáticos comunes en documentación y ofrecer una experiencia de escritura superior.',
    aboutFollowGithub: 'Sigue a @jesusalcaladev en GitHub',

    // Showcase
    showcaseTitle: 'Showcase',
    showcaseDescription:
      'SHOWCASE curado de las bibliotecas, herramientas y paquetes que impulsan el ecosistema de Boltdocs.',
    showcaseVisitDocs: 'Visitar Documentación',
    showcaseViewGithub: 'Ver en GitHub',
    showcaseCtaTitle: '¿Quieres contribuir?',
    showcaseCtaDescription:
      '¿Tienes una sugerencia para una nueva entrada en el Showcase? Abre un issue en el repositorio de GitHub de Boltdocs describiendo el paquete.',
    showcaseOpenIssue: 'Abrir un Issue',
    showcaseFeatures: {
      colorSystem: 'Sistema de Colores',
      tablesAndBoxes: 'Tablas y Cajas',
      spinners: 'Spinners',
      progressBars: 'Barras de Progreso',
      interactivePrompts: 'Prompts Interactivos',
      stepsAndLists: 'Pasos y Listas',
      keyframeAnimation: 'Animación Keyframe',
    },

    // Footer
    footerDocumentation: 'Documentación',
    footerContributing: 'Contribuir',
    footerIssues: 'Issues',
    footerBlog: 'Blog',
    footerGitHub: 'GitHub',
    footerApiReference: 'Referencia API',
    footerAbout: 'Sobre Boltdocs',

    // Banner
    bannerNewVersion:
      '¡Boltdocs 3.3.0 ya está aquí — Nueva API de Plugins, mejora de rendimiento y más!',
    bannerReadPost: 'Leer publicación',

    // Benchmark
    benchmarkTitle: 'Benchmark',
    benchmarkDescription:
      '¿Qué tan rápido es Boltdocs? Evaluamos nuestro parser nativo contra implementaciones estándar de JavaScript y WebAssembly en miles de archivos MDX.',
    benchmarkAvgSpeedup: 'Mejora Promedio',
    benchmarkMaxSpeedup: 'Mejora Máxima',
    benchmarkFastestParse: 'Parseo Más Rápido',
    benchmarkJsBaseline: 'Línea Base JS',
    benchmarkMethodology: 'Metodología',
    benchmarkMethodologyP1:
      'Cada benchmark genera archivos MDX sintéticos con frontmatter, múltiples niveles de encabezados, párrafos con formato inline, bloques de código y marcado HTML.',
    benchmarkMethodologyP2:
      'Se prueban tres implementaciones de parser: JavaScript (pipeline MDX estándar), WebAssembly (módulo WASM compilado) y Nativo (WASM compilado con Zig y parsing optimizado).',
    benchmarkMethodologyP3:
      'Cada ejecución limpia tanto las cachés de rutas en memoria como la caché de persistencia del sistema de archivos para asegurar mediciones de parseo en frío. Se registra la más rápida de 3 ejecuciones.',
  },
} as const

export type TranslationKey = keyof typeof translations.en
