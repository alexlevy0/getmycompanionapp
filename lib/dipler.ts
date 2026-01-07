interface TriggerCallParams {
  phone: string;
  customerId: string;
  isFirstCall: boolean;
}

export async function triggerDiplerCall(params: TriggerCallParams): Promise<void> {
  const { phone, customerId, isFirstCall } = params;

  const response = await fetch("https://api.dipler.io/v1/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DIPLER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_id: process.env.DIPLER_AGENT_ID,
      phone_number: phone,
      webhook_url: `${process.env.API_BASE_URL}/api/webhook/dipler`,
      metadata: {
        customer_id: customerId,
        is_first_call: isFirstCall,
      },
      // Instructions spéciales pour le premier appel
      ...(isFirstCall && {
        context: `C'est le premier appel avec cet utilisateur. 
                  Présente-toi chaleureusement, explique le service, 
                  et demande ses préférences d'horaire pour les prochains appels.
                  Demande aussi son prénom.`,
      }),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Dipler API error: ${error}`);
  }
}
