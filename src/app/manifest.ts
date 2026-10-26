import type { MetadataRoute } from "next";

/**
 * O RepPlast como aplicativo instalado.
 *
 * É o que faz o "Instalar app" do Android e o "Adicionar à Tela de Início" do
 * iPhone criarem um ícone próprio que abre em tela cheia, sem a barra do
 * navegador — o representante abre o sistema na rua como abre o WhatsApp. É o
 * mesmo site, no mesmo endereço: toda atualização chega sem loja de app.
 *
 * Os ícones saem de `scripts/gerar-icones-app.mjs`. As cores são o `--papel`
 * do tema claro (`globals.css`): é o fundo da tela de abertura do Android.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RepPlast",
    short_name: "RepPlast",
    description: "Pedidos e comissões para representantes de embalagens plásticas",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fbfbfc",
    theme_color: "#fbfbfc",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/icone-mascaravel-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
