# Cranium Digital — Regras do projeto

## Logomarca
- **A ÚNICA logomarca autorizada é o cérebro roxo** localizado em `assets/cranium-brain.png`.
- O componente `Logo` (em `components/Brand.jsx`) já aplica o tint roxo (`#A78BFA` / `#7C3AED`) via CSS mask sobre esse PNG — sempre use `<Logo />` ou `<Brand />` para renderizar a marca.
- **NUNCA** usar a variante do "alvo roxo concêntrico" (círculos concêntricos com cruz/pontos). Essa logo foi descontinuada e o arquivo `assets/symbol-neural.svg` foi removido. Se for criar uma nova tela/seção, não recriar esse símbolo nem em SVG inline.
- O padrão de fundo `NeuralBG` (pontos + linhas conectadas) NÃO é logo — é apenas decoração de background e pode continuar sendo usado.
