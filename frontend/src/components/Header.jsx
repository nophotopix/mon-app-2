import { Link } from "react-router-dom";

export const Header = () => {
  return (
    <header
      data-testid="site-header"
      className="sticky top-0 z-40 backdrop-blur-2xl bg-[#050505]/70 border-b border-white/10"
    >
      <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-5 flex items-center justify-between">
        <Link
          to="/"
          data-testid="logo-link"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <img
            src="https://customer-assets.emergentagent.com/job_image-select-pay/artifacts/oep52icz_nophotopix.jpg"
            alt="No.Photo.Pix"
            className="h-10 w-10 sm:h-11 sm:w-11 object-cover rounded-sm"
          />
          <span className="sr-only">No.Photo.Pix</span>
        </Link>
        <nav className="flex items-center gap-8">
          <a
            href="#gallery"
            data-testid="nav-gallery"
            className="text-eyebrow text-white/70 hover:text-white transition-colors hidden sm:inline-block"
          >
            Galerie
          </a>
          <a
            href="#how"
            data-testid="nav-how"
            className="text-eyebrow text-white/70 hover:text-white transition-colors hidden sm:inline-block"
          >
            Comment ça marche
          </a>
          <a
            href="#about"
            data-testid="nav-about"
            className="text-eyebrow text-white/70 hover:text-white transition-colors hidden md:inline-block"
          >
            Contact
          </a>
          <Link
            to="/admin"
            data-testid="nav-admin"
            className="text-eyebrow text-white/40 hover:text-white/80 transition-colors"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
};
