export default function OptimizedImage({
  src,
  alt,
  className,
  width,
  height,
  loading = 'lazy',
}) {
  if (!src) return null;

  // Генерируем AVIF/WebP пути
  const avifSrc = src.replace(/\.(jpg|jpeg|png)$/i, '.avif');
  const webpSrc = src.replace(/\.(jpg|jpeg|png)$/i, '.webp');

  return (
    <picture>
      <source srcSet={avifSrc} type="image/avif" />
      <source srcSet={webpSrc} type="image/webp" />
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        width={width}
        height={height}
        className={className}
      />
    </picture>
  );
}
