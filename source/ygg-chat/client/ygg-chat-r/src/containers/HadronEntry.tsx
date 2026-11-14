import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import logo from '../assets/hadron/eyehadron.jpg'

/** Hadron has a local workspace identity; provider subscriptions connect later. */
export default function HadronEntry() {
  const { loading, signIn } = useAuth()
  const navigate = useNavigate()
  const started = useRef(false)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [opened, setOpened] = useState(false)
  const [logoReadyAt, setLogoReadyAt] = useState<number | null>(null)
  useEffect(() => {
    if (loading || started.current) return
    started.current = true
    void signIn({ email: '', password: '' }).then(() => setOpened(true))
      .catch(() => setError(true))
  }, [loading, signIn, navigate, attempt])
  useEffect(() => {
    if (!opened || logoReadyAt === null) return
    // Let the logo remain visible for four seconds while local startup proceeds.
    // A slower startup adds no second delay; leaving this screen cancels navigation.
    const timer = setTimeout(() => navigate('/homepage', { replace: true }), Math.max(0, 4000 - (performance.now() - logoReadyAt)))
    return () => clearTimeout(timer)
  }, [opened, logoReadyAt, navigate])
  return <main data-hadron-entry data-logo-ready-at={logoReadyAt ?? undefined} className='flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-white'>
    <section className='max-w-md text-center'>
      <img src={logo} alt='Hadron Harness logo' className='mx-auto mb-3 w-48' onLoad={() => setLogoReadyAt(performance.now())} onError={() => setLogoReadyAt(performance.now())} />
      <p data-hadron-tagline className='mb-5 text-lg font-medium tracking-wide text-cyan-200'>Where AI's Collide</p>
      <h1 className='text-2xl font-semibold'>The Hadron Harness</h1>
      <p role='status' className='mt-4 text-sm text-neutral-300'>{error ? 'The local workspace could not open.' : 'Opening your local workspace...'}</p>
      {error && <button type='button' className='mt-5 rounded-full border px-5 py-2' onClick={() => {
        started.current = false; setError(false); setAttempt(value => value + 1)
      }}>Try again</button>}
    </section>
  </main>
}
