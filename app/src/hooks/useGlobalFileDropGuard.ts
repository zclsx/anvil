import { useEffect, useRef } from 'react'

export function useGlobalFileDropGuard(onDropOutside?: () => void): void {
  const onDropOutsideRef = useRef(onDropOutside)
  onDropOutsideRef.current = onDropOutside

  useEffect(() => {
    function preventFileNavigation(event: DragEvent) {
      if (!Array.from(event.dataTransfer?.types ?? []).includes('Files')) return
      event.preventDefault()
      if (event.type === 'drop') {
        onDropOutsideRef.current?.()
      }
    }

    window.addEventListener('dragover', preventFileNavigation)
    window.addEventListener('drop', preventFileNavigation)
    return () => {
      window.removeEventListener('dragover', preventFileNavigation)
      window.removeEventListener('drop', preventFileNavigation)
    }
  }, [])
}
