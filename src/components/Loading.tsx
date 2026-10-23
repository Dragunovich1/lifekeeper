import type { ReactNode } from 'react'

interface LoadingProps {
  children?: ReactNode
  message?: string
}

export const Loading = ({ children, message = 'Cargando...' }: LoadingProps) => {
  return (
    <div className="loading-container">
      {children || (
        <>
          <div className="loading-spinner"></div>
          <p className="loading-message">{message}</p>
        </>
      )}
    </div>
  )
}