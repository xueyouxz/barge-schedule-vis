import { useEffect, useRef, useState } from 'react'

export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }

    const updateWidth = () => {
      setWidth(element.getBoundingClientRect().width)
    }

    updateWidth()

    const observer = new ResizeObserver(entries => {
      const nextWidth = entries[0]?.contentRect.width ?? element.getBoundingClientRect().width
      setWidth(nextWidth)
    })

    observer.observe(element)
    window.addEventListener('resize', updateWidth)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateWidth)
    }
  }, [])

  return { ref, width }
}
