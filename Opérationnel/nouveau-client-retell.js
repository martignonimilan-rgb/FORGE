// ============================================================
// FORGE — Créer un agent Retell AI pour un nouveau client
// ============================================================
// Prérequis :
//   1. Node.js installé
//   2. Fichier .env dans ce dossier avec : RETELL_API_KEY=xxxx
//   3. Compte Retell avec solde disponible (retell.ai)
//
// Usage :
//   node nouveau-client-retell.js
// ============================================================

const fs   = require('fs');
const path = require('path');
const readline = require('readline');
const https = require('https');

// Charger .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, v] = line.split('=');
    if (k && v) process.env[k.trim()] = v.trim();
  });
}

const RETELL_KEY   = process.env.RETELL_API_KEY;
const WEBHOOK_URL  = 'https://forge-artisans.netlify.app/.netlify/functions/retell-webhook';

if (!RETELL_KEY) {
  console.error('\n❌  RETELL_API_KEY manquante dans .env');
  console.error('   Crée un fichier .env ici avec : RETELL_API_KEY=votre_clé\n');
  process.exit(1);
}

// ---- Helpers ----

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function retellRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.retellai.com',
      path: endpoint,
      method,
      headers: {
        'Authorization': `Bearer ${RETELL_KEY}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function buildPrompt(prenom, metier, ville, delai) {
  return `Tu es l'assistante virtuelle de ${prenom}, ${metier} à ${ville}.
${prenom} est actuellement en intervention et ne peut pas répondre au téléphone.

Ta mission est d'accueillir chaleureusement les clients qui appellent, de comprendre leur besoin, et de prendre leurs coordonnées pour que ${prenom} puisse les rappeler.

PREMIER MESSAGE : "Bonjour ! Vous avez bien joint ${prenom}, ${metier} à ${ville}. Il est actuellement en intervention. Je suis son assistante, je peux prendre votre message. Comment puis-je vous aider ?"

DÉROULÉ :
1. Écouter la demande
2. Demander le nom complet
3. Confirmer le numéro de téléphone (répéter pour valider)
4. Demander la commune
5. Évaluer l'urgence
6. Conclure : "${prenom} vous rappellera ${delai}. Bonne journée !"

RÈGLES :
- Français uniquement, ton chaleureux et professionnel
- Maximum 2-3 phrases par réponse
- Ne jamais donner de prix ni de devis
- Ne jamais prendre de rendez-vous
- Si on demande si tu es un robot : "Je suis l'assistante de ${prenom}, je ne suis pas habilitée à répondre à cela."`;
}

// ---- Programme principal ----

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   FORGE — Nouvel agent vocal Retell AI   ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Collecte des infos
  const prenom  = await ask(rl, '👤 Prénom de l\'artisan          : ');
  const metier  = await ask(rl, '🔧 Corps de métier               : ');
  const ville   = await ask(rl, '📍 Ville principale              : ');
  const email   = await ask(rl, '📧 Email de l\'artisan            : ');
  const delai   = await ask(rl, '⏱  Délai de rappel (ex: sous 24h): ');

  console.log('\n--- Récapitulatif ---');
  console.log(`  Artisan : ${prenom} — ${metier} à ${ville}`);
  console.log(`  Email   : ${email}`);
  console.log(`  Délai   : ${delai}`);

  const confirm = await ask(rl, '\nCréer l\'agent ? (oui/non) : ');
  if (!confirm.toLowerCase().startsWith('o')) {
    console.log('\nAnnulé.\n');
    rl.close();
    return;
  }

  // 1. Créer le LLM Retell
  console.log('\n⏳ Création du LLM...');
  const llmRes = await retellRequest('POST', '/create-retell-llm', {
    model: 'gpt-4o-mini',
    general_prompt: buildPrompt(prenom, metier, ville, delai),
    general_tools: [],
  });

  if (llmRes.status !== 201 && llmRes.status !== 200) {
    console.error('❌ Erreur création LLM:', llmRes.body);
    rl.close();
    return;
  }
  const llmId = llmRes.body.llm_id;
  console.log(`✅ LLM créé : ${llmId}`);

  // 2. Créer l'agent
  console.log('⏳ Création de l\'agent...');
  const agentRes = await retellRequest('POST', '/create-agent', {
    response_engine: { type: 'retell-llm', llm_id: llmId },
    agent_name: `FORGE — ${prenom} (${metier})`,
    voice_id: 'elevenlabs-charlotte-french',   // Voix française naturelle
    language: 'fr-FR',
    interruption_sensitivity: 0.6,
    enable_backchannel: true,
    webhook_url: WEBHOOK_URL,
    metadata: {
      artisan_name: prenom,
      artisan_email: email,
      artisan_metier: metier,
    },
  });

  if (agentRes.status !== 201 && agentRes.status !== 200) {
    console.error('❌ Erreur création agent:', agentRes.body);
    rl.close();
    return;
  }
  const agentId = agentRes.body.agent_id;
  console.log(`✅ Agent créé : ${agentId}`);

  // 3. Acheter un numéro de téléphone français
  console.log('⏳ Achat d\'un numéro français (+33)...');
  const phoneRes = await retellRequest('POST', '/create-phone-number', {
    area_code: '33',   // France
    inbound_agent_id: agentId,
  });

  let phoneNumber = null;
  if (phoneRes.status === 201 || phoneRes.status === 200) {
    phoneNumber = phoneRes.body.phone_number;
    console.log(`✅ Numéro attribué : ${phoneNumber}`);
  } else {
    console.warn('⚠️  Numéro non attribué automatiquement.');
    console.warn('   → Assigne manuellement un numéro dans le dashboard Retell.');
    console.warn('   → Agent ID à utiliser :', agentId);
  }

  // 4. Résumé final
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║            ✅  AGENT CRÉÉ !              ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Artisan  : ${(prenom + ' — ' + metier).padEnd(28)}║`);
  console.log(`║  Agent ID : ${agentId.slice(0, 28).padEnd(28)}║`);
  if (phoneNumber) {
    console.log(`║  Numéro   : ${phoneNumber.padEnd(28)}║`);
  }
  console.log('║  Webhook  : configuré automatiquement   ║');
  console.log('║  Email    : ' + email.slice(0, 28).padEnd(28) + '║');
  console.log('╚══════════════════════════════════════════╝');

  // Sauvegarder dans un fichier de suivi
  const logLine = `${new Date().toISOString()} | ${prenom} | ${metier} | ${ville} | ${email} | ${agentId} | ${phoneNumber || 'MANUEL'}\n`;
  const logFile = path.join(__dirname, 'retell-agents.log');
  fs.appendFileSync(logFile, logLine);
  console.log(`\n📄 Enregistré dans retell-agents.log`);

  rl.close();
}

main().catch(err => {
  console.error('\n❌ Erreur inattendue:', err.message);
  process.exit(1);
});
