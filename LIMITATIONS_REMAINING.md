Limitations restantes et propositions (priorisées)

Ce fichier récapitule les points restants, améliorations recommandées et priorités (1 = haute priorité).

1) Implémenter l'UI et le handler de confirmation Middleman (Priorité 1)
- Ajouter un bouton/contrôle explicite dans le ticket ou sur l'annonce permettant au middleman de "Confirmer" le trade.
- Vérifier le rôle (config.middlemanRoleId) ou permission modérateur avant d'autoriser la confirmation.
- Actions attendues : marquer trade.status = 'completed', écrire completedBy/completedAt, notifier les deux parties en DM, enregistrer historique.

2) Tests automatisés (Priorité 2)
- Ajouter tests unitaires pour : utils/sheetValues.getGlobalAverage, normalisation d'items, lecture/écriture des trades, logique modale.
- Proposer Jest ou Mocha+Chai. Nécessite ajout de dev-deps et scripts npm.

3) Job d'expiration / nettoyage des trades (Priorité 2)
- Tâche périodique (cron, setInterval, ou job externe) marquant les offres inactives comme 'expired' après TTL configurable (ex : 7 jours) et notifiant l'auteur.

4) Améliorer la comparaison / matching des items (Priorité 3)
- Remplacer l'heuristique "startsWith/includes" par un fuzzy-match robuste (Levenshtein, Fuse.js) pour améliorer la normalisation des noms d'items.
- Option : proposer les suggestions d'items proches dans le modal/commande.

5) Migration & transformation des anciennes données (Priorité 3)
- Si une précédente source Google Sheet existe, fournir un script de migration pour convertir le format plat vers data/values.json (structure par guildId/_global).
- Garder l'historique dans values_history.json.

6) Passage à une persistance robuste pour multi-instance (Priorité 1)
- Actuellement : JSON locaux (pas safe pour plusieurs instances). Proposer migration vers SQLite/Postgres ou un simple dossier DB (niveau file-lock) pour éviter les races.

7) Escrow / étapes de paiement (Priorité 3)
- Ajouter un état d'"escrow" optionnel : preuve de paiement (capture/URL), étapes contrôlées (payer -> vérifier -> release).
- Permettre au middleman d'enregistrer la preuve et de clôturer après vérification.

8) Interface modération & historique (Priorité 3)
- Commandes /trades avancées : filtre par user/status/date, pagination, export CSV.
- Journalisation (log channel) détaillée pour les actions MM (qui a confirmé, qui a annulé, timestamps).

9) Notifications et configuration fine (Priorité 4)
- Permettre des notifications différenciées : new_trade, mm_requested, completed.
- Option par rôle / par salon pour différents types d'événements.

10) UI / embed et ergonomie (Priorité 4)
- Améliorer les embeds : images, liens directs vers l'historique du trade, time-to-expire calculé, meilleures descriptions.
- Ajouter option pour demander DM directement à l'annonce (DM option déjà présente—améliorer message template).

Notes opérationnelles et sécurité
- Les DMs peuvent échouer selon les paramètres de confidentialité des utilisateurs ; en cas d'échec il faut catcher l'erreur et informer l'utilisateur.
- Pour la production multi-node, migrer la persistance locale JSON vers une BDD.
- Les changements proposés peuvent nécessiter l'ajout de dépendances (ex : fuse.js, jest). Indiquer en amont si installation de packages est acceptable.

Prochaines étapes possibles (exécutables)
- Implémenter le bouton "Confirmer le trade" dans le ticket et son handler (je peux l'ajouter maintenant).
- Écrire le script d'expiration et un petit test unitaire pour getGlobalAverage.
- Fournir le script de migration Google Sheet -> data/values.json si vous avez encore l'export CSV.

Si vous validez, je peux commencer par :
- (1) ajouter le handler de confirmation MM (rapide)
- ou (2) ajouter les tests unitaires (demande ajout de dev-deps)
- ou (3) écrire le job d'expiration (script + instructions de déploiement)

Fin du document.
