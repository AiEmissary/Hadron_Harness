import { useNavigate } from 'react-router-dom'
import logo from '../assets/hadron/eyehadron.jpg'

/** Local profile placeholder; provider accounts are managed in the Agents workspace. */
export default function HadronProfile() {
  const navigate = useNavigate()
  return <main aria-label='Hadron profile' className='hadron-profile h-full overflow-y-auto bg-[#edf0f8] p-6 text-slate-800 dark:bg-[#111625] dark:text-slate-100'>
    <section className='mx-auto max-w-4xl'>
      <header className='mb-8 flex flex-wrap items-center justify-between gap-4'>
        <h1 className='text-3xl font-semibold'>Profile</h1>
        <button type='button' className='px-4 py-2 text-sm' onClick={() => navigate('/homepage')}>Back to workspace</button>
      </header>
      <div className='rounded-2xl border border-violet-200 bg-white/80 p-6 dark:border-slate-600 dark:bg-slate-800'>
        <img src={logo} alt='Hadron Harness logo' className='mb-5 w-32 rounded-xl' />
        <h2 className='text-xl font-semibold'>Your Hadron profile</h2>
        <p className='mt-3 text-sm text-slate-500 dark:text-slate-300'>Profile details will be available here.</p>
      </div>
    </section>
  </main>
}
