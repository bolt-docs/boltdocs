import React, { createContext, useContext } from 'react'

export const OutletContext = createContext<React.ReactNode>(null)

export const Outlet: React.FC = () => {
  const content = useContext(OutletContext)
  return <>{content}</>
}
