// Regras de prompt compartilhadas entre Reimaginar e Sugerir.

/** Regra compartilhada pelo Reimaginar e pelo Sugerir: melhorar sem inventar. */
export const NO_INVENTED_FACTS = `NÃO INVENTE FATOS. Você pode melhorar a redação, o tom e o layout, mas tudo o que a página afirma precisa estar no rascunho ou no briefing.
- Proibido criar: serviços, produtos, preços, números, percentuais, horários, endereços, telefones, clientes, parceiros, marcas, depoimentos, prêmios, selos, categorias do negócio e diferenciais.
- Quando faltar conteúdo, use texto neutro e genérico (ex.: "Fale com a gente", "Conheça nosso cardápio") em vez de completar com detalhes.
- Exemplo ruim: rascunho "wifi, pra trabalhar" → "Wi-Fi de alta velocidade e tomadas em todas as mesas" (inventa velocidade e tomadas).
- Exemplo bom: rascunho "wifi, pra trabalhar" → "Wi-Fi para quem trabalha daqui".
- Exemplo ruim: selo "Cafeteria & Lounge" ou "Fornecemos café para empresas da região" sem isso no rascunho. Exemplo bom: manter só o nome da marca e o que o rascunho diz.`;
