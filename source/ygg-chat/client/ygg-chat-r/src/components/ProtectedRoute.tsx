import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  // Bypass authentication in local environment
  const isLocal = import.meta.env.VITE_ENVIRONMENT === 'local'

  if (isLocal) {
    return <>{children}</>
  }

  // isLocal is fixed at build time, so the hook order never changes between renders.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-gray-600 dark:text-gray-400'>Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to='/login' replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
