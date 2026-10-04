const year = new Date().getFullYear()

export default function Footer() {
  return (
    <footer className="footer">
      <small>&copy; {year} Portfolio Dashboard</small>
    </footer>
  )
}
