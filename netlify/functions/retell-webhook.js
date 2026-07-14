// ============================================================
// FORGE — Webhook Retell AI
// Reçoit les notifications post-appel et envoie un email
// résumé formaté à l'artisan via Brevo.
//
// URL de déploiement :
//   https://forge-artisans.netlify.app/.netlify/functions/retell-webhook
//
// Variables d'environnement Netlify requises :
//   BREVO_API_KEY        → Clé API Brevo (brevo.com)
//   DEFAULT_ARTISAN_EMAIL → Email de secours si metadata absente
// ============================================================

exports.handler = async (event) => {
  // Sécurité : POST uniquement
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const payload = JSON.parse(event.body);
    const { event: eventType, call } = payload;

    // On traite call_ended OU call_analyzed (selon config Retell)
    if (eventType !== 'call_ended' && eventType !== 'call_analyzed') {
      return { statusCode: 200, body: 'Ignored' };
    }

    // --- Données de l'appel ---
    const artisanEmail  = call.metadata?.artisan_email  || process.env.DEFAULT_ARTISAN_EMAIL;
    const artisanNom    = call.metadata?.artisan_name   || 'Artisan';
    const artisanMetier = call.metadata?.artisan_metier || '';
    const numeroAppelant = formatPhone(call.from_number) || 'Inconnu';
    const dateAppel     = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
    const dureeSecondes = (call.end_timestamp && call.start_timestamp)
      ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
      : null;
    const transcript    = call.transcript || 'Transcription non disponible.';
    const resume        = call.call_analysis?.call_summary || null;

    if (!artisanEmail) {
      console.error('Aucun email artisan configuré.');
      return { statusCode: 200, body: 'No artisan email configured' };
    }

    // --- Construction de l'email HTML ---
    const emailHtml = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:24px 12px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

        <!-- En-tête FORGE -->
        <tr>
          <td style="background:#0A0E1A;padding:20px 28px;">
            <span style="color:#E8620A;font-size:22px;font-weight:bold;letter-spacing:2px;">FORGE</span>
            <span style="color:#7A8CA0;font-size:13px;margin-left:12px;">Assistant Vocal IA</span>
          </td>
        </tr>

        <!-- Titre -->
        <tr>
          <td style="padding:24px 28px 8px;">
            <h2 style="margin:0;color:#0A0E1A;font-size:18px;">📞 Nouveau message vocal reçu</h2>
            <p style="color:#7A8CA0;margin:6px 0 0;font-size:13px;">Un client a appelé pendant votre absence</p>
          </td>
        </tr>

        <!-- Infos appel -->
        <tr>
          <td style="padding:16px 28px;">
            <table width="100%" cellpadding="8" cellspacing="0" style="background:#f8f9fb;border-radius:8px;">
              <tr>
                <td style="color:#7A8CA0;font-size:13px;width:140px;">Reçu le</td>
                <td style="font-weight:bold;font-size:14px;color:#0A0E1A;">${dateAppel}</td>
              </tr>
              <tr style="border-top:1px solid #eee;">
                <td style="color:#7A8CA0;font-size:13px;padding-top:10px;">Numéro appelant</td>
                <td style="font-weight:bold;font-size:16px;color:#E8620A;padding-top:10px;">
                  <a href="tel:${call.from_number || ''}" style="color:#E8620A;text-decoration:none;">${numeroAppelant}</a>
                </td>
              </tr>
              ${dureeSecondes ? `
              <tr style="border-top:1px solid #eee;">
                <td style="color:#7A8CA0;font-size:13px;padding-top:10px;">Durée</td>
                <td style="font-size:14px;color:#0A0E1A;padding-top:10px;">${Math.floor(dureeSecondes/60)}min ${dureeSecondes%60}s</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>

        ${resume ? `
        <!-- Résumé IA -->
        <tr>
          <td style="padding:0 28px 16px;">
            <div style="background:#E8620A;border-radius:8px;padding:16px 20px;">
              <p style="margin:0 0 6px;color:white;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Résumé de l'appel</p>
              <p style="margin:0;color:white;font-size:14px;line-height:1.6;">${resume}</p>
            </div>
          </td>
        </tr>` : ''}

        <!-- Transcription -->
        <tr>
          <td style="padding:0 28px 24px;">
            <p style="margin:0 0 8px;color:#0A0E1A;font-size:13px;font-weight:bold;">Transcription complète</p>
            <div style="background:#f8f9fb;border-left:3px solid #E8620A;border-radius:0 6px 6px 0;padding:16px;font-size:13px;line-height:1.8;color:#333;white-space:pre-wrap;">${escapeHtml(transcript)}</div>
          </td>
        </tr>

        <!-- Pied de page -->
        <tr>
          <td style="background:#0A0E1A;padding:16px 28px;text-align:center;">
            <p style="margin:0;color:#7A8CA0;font-size:12px;">
              FORGE — <a href="https://forge-artisans.netlify.app" style="color:#E8620A;text-decoration:none;">forge-artisans.netlify.app</a>
              &nbsp;·&nbsp; pauline@forge-artisans.fr
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // --- Envoi via Brevo ---
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: 'Assistant FORGE', email: 'assistant@forge-artisans.fr' },
        to: [{ email: artisanEmail, name: artisanNom }],
        subject: `📞 Message vocal — ${numeroAppelant} — ${dateAppel}`,
        htmlContent: emailHtml,
      }),
    });

    if (!brevoRes.ok) {
      const errText = await brevoRes.text();
      throw new Error(`Brevo ${brevoRes.status}: ${errText}`);
    }

    console.log(`Email envoyé à ${artisanEmail} pour appel de ${numeroAppelant}`);
    return { statusCode: 200, body: 'OK' };

  } catch (err) {
    console.error('Erreur webhook Retell:', err.message);
    return { statusCode: 500, body: err.message };
  }
};

// --- Helpers ---

function formatPhone(raw) {
  if (!raw) return null;
  // Convertit +33612345678 → 06 12 34 56 78
  const cleaned = raw.replace(/\D/g, '');
  if (cleaned.startsWith('33') && cleaned.length === 11) {
    const local = '0' + cleaned.slice(2);
    return local.match(/.{1,2}/g).join(' ');
  }
  return raw;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
