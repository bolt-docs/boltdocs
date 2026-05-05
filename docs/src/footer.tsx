import { Link } from "boltdocs/client";

export const Footer = () => (
  <footer className="pt-24 px-6">
    <div className="flex flex-row md:flex-row justify-between items-center gap-8 pt-10 border-t border-white/5">
      <p className="text-on-surface-variant/40 text-xs">
        © {new Date().getFullYear()} Boltdocs Engine. Open source MIT.
      </p>
      <div className="flex flex-row gap-4">
        <Link to="https://github.com/bolt-docs/boltdocs/blob/main/CONTRIBUTING.md" className="text-body/70 text-sm">
          Contribute
        </Link>
        <Link to="https://github.com/bolt-docs/boltdocs/issues" className="text-body/70 text-sm">
          Issues
        </Link>
        <Link to="https://github.com/bolt-docs/boltdocs/" className="text-body/70 text-sm">
          Github
        </Link>
        <Link to="/roadmap" className="text-body/70 text-sm">
          Roadmap
        </Link>
      </div>
    </div>
  </footer>
)
