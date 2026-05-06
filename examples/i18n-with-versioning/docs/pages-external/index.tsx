import { Navbar } from 'boltdocs/client';
import { Footer } from '../../src/components/footer';
import { HomePage } from '../../src/pages/home'

/**
 * Custom external routes.
 * Maps paths to React components.
 */
export const pages = {
  '/': HomePage,
};

export const layout = ({ children }: { children: React.ReactNode }) => <div>
  <Navbar />
  <div className='w-[90%] mx-auto px-10'>
    {children}
    <Footer />
  </div>
</div>;