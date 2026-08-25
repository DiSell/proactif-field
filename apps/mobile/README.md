# apps/mobile

Emplacement réservé pour une future application mobile (Expo / React Native).

Ce dossier ne contient encore aucun code et n'est **pas** implémenté. Il n'a pas de
`package.json`, donc il n'est pas résolu par les workspaces npm du monorepo
(`"apps/*"` dans [package.json](../../package.json)) — sa présence ici ne casse rien,
elle documente simplement l'intention.

Quand ce projet démarrera, il prendra la même forme que les autres workspaces
(`apps/api`, `apps/web`) : un `package.json` propre avec son propre nom
`@proactif-field/mobile`, ce qui l'enregistrera alors automatiquement comme
workspace.
