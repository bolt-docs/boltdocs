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
    heroStats: [
      { value: '5–6×', label: 'Faster parsing' },
      { value: '<200ms', label: 'Per-page rebuilds' },
      { value: 'Zig WASM', label: 'Native parser' },
      { value: '0 config', label: 'To get started' },
    ],
    integrationsTitle: 'Engineered to Integrate with Industry Standards',

    // Features
    featuresTitle: 'Powerful Features',
    featuresDescription:
      'Everything you need to ship world-class technical documentation.',

    // Featured Resources
    featuredTitle: 'Featured resources & updates',
    featuredAll: 'All Resources',

    // About
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
    showcaseVisitDocs: 'Visit Documentation',
    showcaseViewGithub: 'View on GitHub',
    showcaseCtaTitle: 'Want to contribute?',
    showcaseCtaDescription:
      'Have a suggestion for a new Showcase entry? Open an issue in the Boltdocs GitHub repository describing the package.',
    showcaseOpenIssue: 'Open an Issue',

    // Footer
    footerDocumentation: 'Documentation',
    footerContributing: 'Contributing',
    footerIssues: 'Issues',
    footerBlog: 'Blog',
    footerChangelog: 'Changelog',
    footerGitHub: 'GitHub',
    footerApiReference: 'API Reference',
    footerAbout: 'About Boltdocs',

    // Banner
    bannerNewVersion:
      'Boltdocs 3.3.0 is out — New Plugin API, performance boost, and more!',
    bannerReadPost: 'Read post',
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
    heroStats: [
      { value: '5–6×', label: 'Parseo más rápido' },
      { value: '<200ms', label: 'Builds por página' },
      { value: 'Zig WASM', label: 'Parser nativo' },
      { value: '0 config', label: 'Para empezar' },
    ],
    integrationsTitle:
      'Diseñado para Integrarse con Estándares de la Industria',

    // Features
    featuresTitle: 'Funcionalidades Potentes',
    featuresDescription:
      'Todo lo que necesitas para crear documentación técnica de clase mundial.',

    // Featured Resources
    featuredTitle: 'Recursos y actualizaciones destacados',
    featuredAll: 'Todos los Recursos',

    // About
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
    showcaseVisitDocs: 'Visitar Documentación',
    showcaseViewGithub: 'Ver en GitHub',
    showcaseCtaTitle: '¿Quieres contribuir?',
    showcaseCtaDescription:
      '¿Tienes una sugerencia para una nueva entrada en el Showcase? Abre un issue en el repositorio de GitHub de Boltdocs describiendo el paquete.',
    showcaseOpenIssue: 'Abrir un Issue',

    // Footer
    footerDocumentation: 'Documentación',
    footerContributing: 'Contribuir',
    footerIssues: 'Issues',
    footerBlog: 'Blog',
    footerChangelog: 'Changelog',
    footerGitHub: 'GitHub',
    footerApiReference: 'Referencia API',
    footerAbout: 'Sobre Boltdocs',

    // Banner
    bannerNewVersion:
      '¡Boltdocs 3.3.0 ya está aquí — Nueva API de Plugins, mejora de rendimiento y más!',
    bannerReadPost: 'Leer publicación',
  },
} as const

export type TranslationKey = keyof typeof translations.en
