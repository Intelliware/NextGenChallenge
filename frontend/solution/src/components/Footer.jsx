// Read once at load: calling Date during render is impure (lint rule react/purity)
const year = new Date().getFullYear()

// Site footer with the copyright year
export default function Footer() {
  return (
    <footer className="footer">
      <small>&copy; {year} Portfolio Dashboard</small>
    </footer>
  )
}
