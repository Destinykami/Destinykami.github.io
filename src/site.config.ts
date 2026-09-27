import type {
  FooterConfig,
  LinkConfig,
  ProfileConfig,
  PublicationConfig,
  SiteConfig,
} from "@/types"

export const SITE: SiteConfig = {
  title: "Chengshuo Zheng",
  description:
    "Research on ML systems: architecture, training efficiency, and resource-aware scheduling.",
  href: "https://destinykami.github.io",
  author: "Chengshuo Zheng",
  dir: "ltr",
  defaultPageImage: "/img/social-preview.png",
  defaultPostImage: "/img/social-preview.png",

  locale: {
    lang: "zh-CN",
    options: {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    },
  },

  // Table of contents depth shared by blog posts and project detail pages.
  tocMaxDepth: 3,

  blog: {
    featuredPostCount: 3,
    postsPerPage: 8,
    shareActions: ["x"],
  },

  home: {
    careerHighlightCount: 4,
    updateCount: 3,
    publicationCount: 3,
  },

  favicon: "/favicon.ico",
  prerender: true,
  npmCDN: "https://cdn.jsdelivr.net/npm",

  license: {
    label: "CC-BY-4.0",
    href: "https://creativecommons.org/licenses/by/4.0/",
  },
}

export const PROFILE: ProfileConfig = {
  name: SITE.title,
  tagline: "Master's student @ Peking University",
  email: "cszheng25@stu.pku.edu.cn",
  links: {
    github: "https://github.com/Destinykami",
  },
  highlightLinks: ["github"],
  linksPlacement: {
    header: ["email", "github"],
    about: false,
    footer: false,
  },
}

export const NAV_LINKS: LinkConfig[] = [
  { href: "/projects", label: "Projects" },
  { href: "/publications", label: "Publications" },
  { href: "/teaching", label: "Teaching" },
  { href: "/blog", label: "Blog" },
]

export const NAVIGATION: LinkConfig[] = NAV_LINKS.map(({ href, label }) => ({
  href,
  label,
}))

export const PUB_CONFIG: PublicationConfig = {
  maxFirstAuthors: 6,
  maxLastAuthors: 1,
  // Must match the author strings in src/content/publications/main.bib exactly.
  highlightAuthor: {
    firstName: "Chengshuo",
    lastName: "Zheng",
    aliases: ["C. Zheng"],
  },
  equalSymbols: {
    first: "*",
    second: "†",
    third: "‡",
    last: "§",
  },
}

export const FOOTER: FooterConfig = {
  credits: true,
  sourceCode: "https://github.com/Destinykami/Destinykami.github.io",
  sourceContent:
    "https://github.com/Destinykami/Destinykami.github.io/tree/main/src/content",
  footerLinks: [],
}

if (import.meta.env.DEV && typeof window === "undefined") {
  const {
    FooterConfigSchema,
    ProfileConfigSchema,
    PublicationConfigSchema,
    SiteConfigSchema,
  } = await import("@/schemas")
  SiteConfigSchema.parse(SITE)
  ProfileConfigSchema.parse(PROFILE)
  FooterConfigSchema.parse(FOOTER)
  PublicationConfigSchema.parse(PUB_CONFIG)
}
