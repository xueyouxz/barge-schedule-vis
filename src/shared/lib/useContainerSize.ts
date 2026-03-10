import { useEffect, useRef, useState, type RefObject } from 'react'

type ContainerSize = {
  width: number
  height: number
}

type ElementWidthResult<T extends HTMLElement> = {
  ref: RefObject<T | null>
  width: number
}

export function useContainerSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect()
      setSize({
        width: Math.floor(rect.width),
        height: Math.floor(rect.height)
      })
    }

    updateSize()

    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (!entry) {
        updateSize()
        return
      }

      setSize({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height)
      })
    })

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [])

  return [ref, size] as const
}

export function useElementWidth<T extends HTMLElement>(): ElementWidthResult<T> {
  const [ref, size] = useContainerSize<T>()

  return {
    ref,
    width: size.width
  }
}
