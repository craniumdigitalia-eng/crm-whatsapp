'use client';

/* ============================================================
   BrandBackgroundVideo
   Video cinematografico de fundo (feito no Magnific), reaproveitado do
   portal do corretor. Fica atras do conteudo do login/recuperacao, com
   um escurecimento (scrim) por cima para manter texto e card legiveis.
   autoPlay + muted + playsInline garantem o autoplay nos navegadores.
   ============================================================ */
export default function BrandBackgroundVideo({
  src = '/brand/login-cinematic.mp4',
}: {
  src?: string;
}) {
  return (
    <div className="login-video" aria-hidden="true">
      <video
        className="login-video__el"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      >
        <source src={src} type="video/mp4" />
      </video>
      <div className="login-video__scrim" />
    </div>
  );
}
