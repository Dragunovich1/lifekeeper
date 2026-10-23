import { useEffect } from 'react'

/** Agrega la clase de actividad 900 ms después del último scroll. */
export function useScrollActivity() {
  useEffect(() => {
    const timers = new Map<Element, ReturnType<typeof setTimeout>>()
    const onScroll = (event: Event) => {
      const target = event.target === document ? document.documentElement : event.target
      if (!(target instanceof Element)) return
      target.classList.add('lk-scrollable', 'lk-scrolling')
      clearTimeout(timers.get(target))
      timers.set(
        target,
        setTimeout(() => {
          target.classList.remove('lk-scrolling')
          timers.delete(target)
        }, 900),
      )
    }
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => {
      document.removeEventListener('scroll', onScroll, true)
      timers.forEach((timer, element) => {
        clearTimeout(timer)
        element.classList.remove('lk-scrolling')
      })
    }
  }, [])
}
