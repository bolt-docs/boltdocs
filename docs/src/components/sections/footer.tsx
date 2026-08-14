import { useRef } from "react";
import { Link } from "boltdocs/primitives";
import { useScrollAnimation } from "../../hooks/useScrollAnimation";
import { useTranslations } from "../../i18n/index";

export const Footer = () => {
  const topRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const t = useTranslations();

  useScrollAnimation(topRef, "fade-up");
  useScrollAnimation(titleRef, "fade-up");

  return (
    <footer className="w-full bg-main/95 backdrop-blur-2xl text-body px-6 md:px-12 pt-20 pb-10 border-t border-subtle relative overflow-hidden">
      <div className="max-w-350 mx-auto w-full">
        {/* Top Section */}
        <div
          ref={topRef}
          className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20"
        >
          <span />
          <div className="grid grid-cols-2 gap-x-20 gap-y-3 text-sm font-medium">
            <div className="flex flex-col gap-3">
              <Link
                href="/docs/guides"
                className="hover:text-primary-500 transition-colors"
              >
                {t.footerDocumentation}
              </Link>
              <Link
                href="https://github.com/jesusalcaladev/boltdocs/blob/main/CONTRIBUTING.md"
                className="hover:text-primary-500 transition-colors"
              >
                {t.footerContributing}
              </Link>
              <Link
                href="https://github.com/jesusalcaladev/boltdocs/issues"
                className="hover:text-primary-500 transition-colors"
              >
                {t.footerIssues}
              </Link>
              <Link
                href="/docs/changelog"
                className="hover:text-primary-500 transition-colors"
              >
                {t.footerChangelog}
              </Link>
              <Link
                href="site:/blog"
                className="hover:text-primary-500 transition-colors"
              >
                {t.footerBlog}
              </Link>
              <Link
                href="site:/benchmark"
                className="hover:text-primary-500 transition-colors"
              >
                Benchmark
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="https://github.com/jesusalcaladev/boltdocs"
                className="hover:text-primary-500 transition-colors"
              >
                {t.footerGitHub}
              </Link>
              <Link
                href="/docs/api"
                className="hover:text-primary-500 transition-colors"
              >
                {t.footerApiReference}
              </Link>
            </div>
          </div>
        </div>

        {/* Giant Typography Section */}
        <div className="w-full flex justify-center items-center select-none overflow-hidden mb-12">
          <h1
            ref={titleRef}
            className="text-[15vw] leading-[0.8] font-black tracking-tighter text-body"
          >
            Boltdocs
          </h1>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6 pt-6 border-t border-body/10">
          <div className="text-xl font-bold tracking-tight">boltdocs.</div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium opacity-70">
            <Link
              href="site:/about"
              className="hover:text-primary-500 transition-colors"
            >
              {t.footerAbout}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
