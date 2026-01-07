// ============================================
// SMS Templates
// ============================================

export const SMS_TEMPLATES = {
  /**
   * Sent when trial calls are exhausted
   */
  trialEnded: (params: { firstName?: string; paymentLink: string }) => {
    const greeting = params.firstName ? `${params.firstName}, merci` : "Merci";
    return `${greeting} d'avoir essayé MyCompanion ! 🎉

Vos 3 appels gratuits sont terminés. Pour continuer à recevoir votre appel quotidien :

${params.paymentLink}

À très vite !
— L'équipe MyCompanion`;
  },

  /**
   * Sent when subscription is activated
   */
  subscriptionActivated: (params: { firstName?: string }) => {
    const greeting = params.firstName ? `${params.firstName}, bienvenue` : "Bienvenue";
    return `${greeting} dans la famille MyCompanion ! 🎉

Votre abonnement est maintenant actif. Vous recevrez votre prochain appel à l'heure convenue.

Merci pour votre confiance !
— L'équipe MyCompanion`;
  },

  /**
   * Sent as a reminder if user hasn't answered calls
   */
  missedCallsReminder: (params: { firstName?: string; missedCount: number }) => {
    const greeting = params.firstName ? `${params.firstName}, ` : "";
    return `${greeting}Nous avons essayé de vous appeler ${params.missedCount} fois sans réponse.

Vos appels sont en pause. Répondez "OK" pour les reprendre.

— MyCompanion`;
  },

  /**
   * Generic notification
   */
  notification: (params: { message: string }) => params.message,
};

// ============================================
// Error Messages (French)
// ============================================

export const ERROR_MESSAGES = {
  invalidPhone: "Numéro de téléphone invalide",
  alreadyRegistered: "Ce numéro est déjà enregistré",
  internalError: "Une erreur est survenue",
  unauthorized: "Non autorisé",
  notFound: "Ressource introuvable",
  paymentRequired: "Paiement requis",
};

// ============================================
// Success Messages (French)
// ============================================

export const SUCCESS_MESSAGES = {
  callTriggered: "Vous allez recevoir un appel dans quelques instants.",
  subscriptionActivated: "Votre abonnement est maintenant actif.",
};
