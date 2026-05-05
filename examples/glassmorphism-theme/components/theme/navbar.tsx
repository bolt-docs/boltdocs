import React, { Suspense } from 'react'
import { 
  PrimitiveNavbar as Navbar,
  SearchDialog,
  useNavbar,
  useTheme,
  useRoutes,
  cn
} from 'boltdocs/client'

export const CustomNavbar = () => {
  const { links, title, logo, logoProps, social, theme: themeMode } = useNavbar()
  const { routes } = useRoutes()
  const { setTheme } = useTheme()

  return (
    <Navbar className="boltdocs-navbar">
      <Navbar.Content>
        <Navbar.Left>
          {logo && (
            <Navbar.Logo 
              src={logo} 
              alt={logoProps?.alt || title} 
              width={logoProps?.width || 24}
              height={logoProps?.height || 24}
            />
          )}
          <Navbar.Title href="/">
            {title}
          </Navbar.Title>
        </Navbar.Left>

        <Navbar.Center>
           <Suspense fallback={<div className="h-9 w-64 animate-pulse rounded-full bg-white/5" />}>
             <SearchDialog routes={routes || []} />
           </Suspense>
        </Navbar.Center>

        <Navbar.Right>
          <Navbar.Links className="hidden lg:flex">
            {links.map((link: any) => (
              <Navbar.Link 
                key={link.href} 
                {...link} 
                className={cn(
                  "transition-all duration-300",
                  link.active ? "text-primary-400" : "text-white/40 hover:text-white"
                )}
              />
            ))}
          </Navbar.Links>

          <div className="hidden lg:block">
            <Navbar.Split className="bg-white/10" />
          </div>

          <div className="hidden md:block">
            <Navbar.Theme 
              theme={themeMode as any} 
              onThemeChange={(isSelected) => setTheme(isSelected ? 'dark' : 'light')} 
              className="hover:bg-white/5"
            />
          </div>

          <div className="hidden md:flex items-center gap-1">
            {social.map((s: any) => (
              <Navbar.Socials 
                key={s.link}
                icon={s.icon}
                link={s.link}
                className="hover:bg-white/5"
              />
            ))}
          </div>
          
          <Navbar.More className="hover:bg-white/5" />
        </Navbar.Right>
      </Navbar.Content>
    </Navbar>
  )
}
