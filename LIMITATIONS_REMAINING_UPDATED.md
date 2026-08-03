Limitations restantes et propositions (mise à jour)

Synthèse des éléments restants et du travail déjà effectué / proposé.

Points implémentés dans ce cycle :
- Handler de confirmation Middleman (ticket + bouton quick-confirm) : disponible via events/buttonHandler.js (confirm_trade_*/mm_confirm_*).
- Proof modal + stockage de preuves : events/modalHandler.js (proof_modal_*), stockées dans trade.paymentProof[].
- Fuzzy matching : utils/fuzzy.js (levenshtein + bestMatch) utilisé pour normalisation.
- Job d'expiration : utils/expireTrades.js, programmé depuis index.js (startup + toutes les 6h).
- Migration CSV -> data/values.json : scripts/migrate_sheet_csv.js fourni.
- Tests basiques : scripts/run_tests.js (asserts simples pour fuzzy et getGlobalAverage).
- Lock-file write protection : utils/db.js (acquisition de .lock avant écriture).

Propositions restantes (déroulé et recommandations)
1) Tests automatisés complets
- Ajouter Jest/Mocha pour coverage étendue (commands, events, utils).
- Ajouter CI (GitHub Actions) pour exécuter tests sur PRs.

2) Migration vers DB (fortement recommandé)
- Remplacer JSON files par SQLite ou Postgres selon le besoin / déploiement. Offre : fournir script de migration + abstraction DB.

3) Escrow & preuve améliorée
- Concevoir un état 'escrow' complet, avec release conditionnée par MM et/ou preuve validée.
- Ajouter obligation de joindre preuve pour certains moyens de paiement (ex: Paypal) avant release.

4) UI/UX
- Ajouter pagination pour /trades, recherche fuzzy avec score, et améliorations d'embeds (images, lien historique, expiration précise).

5) Observabilité
- Channel de logs configurable (setup) + envoi d'embed détaillé lors de confirm/reject/expire/requestMM.

6) Multi-instance
- Si le bot tourne sur plusieurs instances, migrer vers DB centralisée et utiliser transactions/row-level locks.

7) Documentation & onboarding
- README: détailler commandes /trade /trades /setup, data layout, migration script usage, et responsabilités des middlemen.

8) Sécurité & abuse
- Rate-limit étendu, challenge anti-spam pour création massive d'annonces, staking pour MM (ban/flag) si abus.

9) Tests E2E
- Créer un petit harness de tests end-to-end qui démarre un client de test, crée un trade et exécute le flux MM.

10) Améliorations mineures
- Templates localisables, meilleure gestion d'erreurs, fallback graceful si DM impossible.

--
Pour prioriser et exécuter, indiquer quelle action lancer en premier :
- (A) Ajouter Jest + écrire tests pour commands/events (implémentation complète des suites)
- (B) Migrer stockage vers SQLite et adapter utils/db.js
- (C) Implémenter escrow complet (etat + UI + handlers)
- (D) Améliorer logging/observabilité + channel configurable

Si vous confirmez l'un des choix ci-dessus, travail concret et commits seront faits.
