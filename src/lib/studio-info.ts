/**
 * Informations légales de la structure émettrice des factures.
 *
 * Pour Thibault DE LEPINE (EI, micro-entreprise), franchise de TVA art. 293B CGI.
 * NB: le "DE" fait partie du nom de famille (particule), il ne se sépare pas.
 *
 * À déplacer dans une table `studio_settings` si on a un jour plusieurs
 * studios sur la même instance LUMEN.
 */
export const STUDIO_INFO = {
  legalName: "MONSIEUR DE LEPINE THIBAULT",
  legalForm: "EI", // entrepreneur individuel
  address: {
    line1: "Quartier la Chenaux",
    postalCode: "97224",
    city: "Ducos",
    country: "Martinique",
  },
  siren: "843 067 182",
  rcs: "84306718 Fort-de-France",
  rm: "843067182",
  iban: "FR76 1469 0000 0151 0003 9779 386",
  bic: "CMCIFRP1MON",
  vatNotice: "TVA non applicable, art. 293B du CGI.",
  defaultVatRate: 0, // %
  defaultPaymentTermsDays: 30,
  brandName: "LUMEN",
  brandTagline: "Studio de production audiovisuelle",
} as const;

export type StudioInfoSnapshot = typeof STUDIO_INFO;
