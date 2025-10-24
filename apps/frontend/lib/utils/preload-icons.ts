export function preloadCriticalIcons() {
  if (typeof window === "undefined") return

  // Preload critical icons used in the initial render
  const criticalIcons = ["MessageSquare", "Plus", "Search", "Settings", "Send", "Wrench", "ChevronRight", "ChevronLeft"]

  // This helps the browser prioritize loading these icons
  criticalIcons.forEach((icon) => {
    const link = document.createElement("link")
    link.rel = "preload"
    link.as = "image"
    link.href = `/icons/${icon.toLowerCase()}.svg`
    document.head.appendChild(link)
  })
}
