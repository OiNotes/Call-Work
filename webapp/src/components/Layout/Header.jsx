export default function Header({ title }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40">
      <div className="glass-elevated border-b border-white/10" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center justify-center px-4 py-6 min-h-[64px]">
          <h1 className="text-2xl font-bold text-white text-center">{title}</h1>
        </div>
      </div>
    </header>
  );
}
