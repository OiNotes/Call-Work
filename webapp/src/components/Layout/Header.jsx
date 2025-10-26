export default function Header({ title }) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-40"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div
        className="glass-elevated border-b border-white/10 flex items-center justify-center px-4"
        style={{ height: '56px' }}
      >
        <h1 className="text-xl font-bold text-white text-center">{title}</h1>
      </div>
    </header>
  );
}
