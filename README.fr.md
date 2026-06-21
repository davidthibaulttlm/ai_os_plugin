# AI OS — Extension VS Code fournissant l'Automatisation Kanban alimentée par l'IA

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-blue.svg)](https://code.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3%2B-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![CI](https://github.com/davidthibaulttlm/ai_os_plugin/actions/workflows/aislop.yml/badge.svg)](https://github.com/davidthibaulttlm/ai_os_plugin/actions/workflows/aislop.yml)
[![Coverage](https://img.shields.io/badge/Coverage-90%25-green)](./coverage)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196)](https://conventionalcommits.org)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)
[![Issues](https://img.shields.io/github/issues/davidthibaulttlm/ai_os_plugin)](https://github.com/davidthibaulttlm/ai_os_plugin/issues)
[![Stars](https://img.shields.io/github/stars/davidthibaulttlm/ai_os_plugin?style=flat)](https://github.com/davidthibaulttlm/ai_os_plugin)
[![Made in 🇨🇦 Québec](https://img.shields.io/badge/Made_in-🇨🇦_Québec-blue.svg)]()
[![Fait au Québec](https://img.shields.io/badge/Fait_au-Québec-0033A0?colorA=0033A0&colorB=FFFFFF)]()

Extension VS Code auto-hébergée qui se connecte à votre compte GitHub et automatise les flux de travail kanban sur les tableaux [GitHub Projects v2](https://docs.github.com/en/issues/planning-and-tracking-with-projects). Les agents IA travaillent automatiquement sur les problèmes entrant dans les colonnes `AI_SPEC` / `AI_CODE`.

> **⚠️ En cours de développement** : Ce projet est activement en développement. Les fonctionnalités peuvent ne pas fonctionner comme prévu et sont sujettes à changement. Utilisez à vos propres risques et signalez tout problème rencontré.

<img width="2561" height="1388" alt="image" src="https://github.com/user-attachments/assets/b4d0fe40-93e8-48af-beea-3aff8bcea7a0" />

## ✨ Fonctionnalités

- **Intégration GitHub Projects v2** — Connexion via le jeton `gh` CLI, pas de flux OAuth séparé
- **Tableau Kanban Interactif** — Glisser-déposer des cartes de problèmes entre 6 colonnes de flux de travail dans un webview React
- **Intégration Agent Claude Code** — Fonctionne avec Claude Code CLI, l'extension VS Code ou l'application Claude Code
- **Déclenchement Automatique au Déplacement** — Les problèmes entrant dans les colonnes `AI_SPEC` ou `AI_CODE` déclenchent automatiquement des agents
- **Pipeline Complet de Flux Git** — Travail de l'agent → commit → push → création de PR → la carte avance automatiquement à la colonne suivante
- **Gestion de Worktree de Référentiel** — Clone les référentiels du projet dans des worktrees git isolés pour un travail d'agent parallèle sécurisé
- **Priorisateur d'Agent** — Sélection intelligente des problèmes : bugs en premier, puis par priorité et ancienneté
- **Détection de Delta** — Détecte les changements de tableau provenant de sources externes (fusions PR, déplacements manuels) et réagit
- **Polling de Tableau en Temps Réel** — Polling GraphQL de 30s garde votre tableau synchronisé
- **Serveur MCP** — Expose l'état du tableau kanban comme outils MCP pour l'intégration d'agents IA
- **Panneau de Paramètres** — Configurez les colonnes de travail automatique, le répertoire des référentiels, la connexion Claude et les limites d'agents
- **Vue Arbre de Tableau** — Barre d'activité avec sélecteur de tableau, paramètres et actions rapides
- **Zéro Infrastructure** — Pas de base de données, pas de webhooks, pas de tunnels. Tout fonctionne dans VS Code

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Fenêtre VS Code                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Panneau Webview (React)               │  │
│  │  - Tableau kanban avec glisser-déposer            │  │
│  │  - Cartes de problèmes avec statut/priorité        │  │
│  │  - Indicateurs de progression des agents IA        │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │ IPC postMessage                │
│  ┌──────────────────────▼────────────────────────────┐  │
│  │           Hôte d'Extension (TypeScript)            │  │
│  │  - Commandes & Vues arbre                         │  │
│  │  - Routeur de messages (extension ↔ webview)      │  │
│  │  - Persistance d'état via vscode.Memento          │  │
│  │  - Lance les processus agents Claude Code          │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         │
         │ GraphQL (httpx async)
         ▼
   API GitHub Projects v2
```

## 📋 Colonnes Kanban

| # | Colonne | Description |
|---|--------|-------------|
| 1 | `BRAIN_DUMP` | Idées brutes, pas encore spécifiées |
| 2 | `AI_SPEC` | L'agent IA écrit la spécification |
| 3 | `HUMAN_SPEC_REVIEW` | L'humain révise la spécification |
| 4 | `AI_CODE` | L'agent IA code l'implémentation |
| 5 | `HUMAN_CODE_REVIEW` | L'humain révise le code |
| 6 | `PR_DONE` | Pull request fusionné, fonctionnalité complète |

Ces colonnes sont des **constants codées en dur** — pas configurables par l'utilisateur.

## 🚀 Démarrage Rapide

### Prérequis

```bash
# Node.js 18+
node --version

# gh CLI (GitHub CLI) — pour l'authentification
gh --version
gh auth login

# Claude Code CLI — obligatoire pour l'exécution des agents
claude --version

# VS Code
code --version

# vsce (pour le packaging/la publication)
npm install -g @vscode/vsce
```

### Optionnel : Intégration MCP

L'extension expose un **serveur MCP** que Claude peut connecter pour interroger l'état du tableau kanban. Vous pouvez l'utiliser avec :

- **Claude Code CLI** — Configurez le serveur MCP dans vos paramètres Claude
- **Extension VS Code Claude** — Connectez Claude au serveur MCP AI OS pour interroger les données du tableau directement depuis l'éditeur

L'intégration MCP est **optionnelle** — l'extension fonctionne seule sans elle.

### Configuration du Développement

```bash
# 1. Cloner et installer les dépendances
git clone https://github.com/davidthibaulttlm/ai_os_plugin.git
cd ai-os-plugin
npm install

# 2. Installer les dépendances du webview
cd webview-ui && npm install && cd ..

# 3. Démarrer le développement (3 terminaux)
# Terminal 1 : Mode watch de l'extension
npm run watch

# Terminal 2 : Serveur de développement du webview
npm run dev:webview

# Terminal 3 : Lancer VS Code avec l'extension chargée
code --extensionDevelopmentPath=$PWD
```

### Construction & Packaging

```bash
# Construire l'extension
npm run build

# Construire le webview
npm run build:webview

# Packager en VSIX
npm run package

# Publier sur le marketplace (nécessite une connexion vsce)
npm run publish
```

## ⚙️ Configuration

### Paramètres

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `aiOs.autoWorkColumns` | `["AI_SPEC", "AI_CODE"]` | Colonnes qui déclenchent le travail automatique |
| `aiOs.reposDir` | `~/ai-os-repos` | Répertoire pour les référentiels clonés |

## 📦 Stack Technologique

| Couche | Technologie |
|--------|-------------|
| Extension | API Extension VS Code + TypeScript |
| Frontend | React 18, Vite 5, Tailwind CSS v4, `@dnd-kit` |
| Style | Tailwind CSS v4 (config CSS-first via `@theme`) |
| HTTP | `httpx` (GraphQL async) |
| État | Memento VS Code (`context.globalState`) + mémoire |
| Tests | Vitest avec couverture V8 |
| Qualité | aislop (portes de qualité du code) |

## 🧪 Tests

```bash
# Exécuter tous les tests avec couverture
npm test

# Mode watch
npm run test:watch
```

## 🔑 Décisions Clés de Conception

1. **GraphQL uniquement pour Projects v2** — GitHub Projects v2 n'a pas d'API REST
2. **Async partout** — Client `httpx` async, handlers FastAPI async
3. **Détection de delta par diffing en mémoire** — Comparer chaque résultat de polling contre l'état dernier connu
4. **Template kanban fixe** — Pas configurable par l'utilisateur pour la cohérence
5. **Extension VS Code** — Élimine l'infrastructure webhook (pas de tunnels nécessaires)
6. **Pas de base de données** — L'état persiste via Memento VS Code et en mémoire uniquement

## 🗺️ Feuille de Route

### ✅ Complété

- [x] Intégration GitHub Projects v2 via GraphQL
- [x] Tableau kanban interactif avec glisser-déposer
- [x] Lancement d'agent Claude Code (CLI / extension / application)
- [x] Déclenchement automatique au déplacement de colonne (AI_SPEC / AI_CODE)
- [x] Gestion de worktree git pour travail d'agent isolé
- [x] Priorisateur d'agent (bugs en premier, puis priorité/ancienneté)
- [x] Détection de delta pour changements externes de tableau
- [x] Polling GraphQL de 30s pour synchronisation en temps réel
- [x] Serveur MCP pour interrogation d'état de tableau
- [x] Panneau de paramètres (colonnes auto-travail, répertoire repos, limites agents)
- [x] Vue arbre de tableau dans la barre d'activité
- [x] Authentification `gh` CLI

### 🚧 En Cours — MVP

- [ ] Finaliser le sandbox agent IA (isolation worktree, nettoyage en cas d'échec)
- [ ] Rétroactions de codage (l'agent écrit du code → stage → commit → push → crée PR → avance la carte)
- [ ] Streaming de sortie d'agent vers le webview en temps réel
- [ ] Récupération d'erreur quand l'agent échoue en milieu de tâche

### 📋 Planifié

- [ ] Support pour d'autres fournisseurs kanban (Jira, GitLab Issues, Linear)
- [ ] Support pour d'autres fournisseurs de référentiels (Bitbucket, GitLab, Gitea)
- [ ] Support pour d'autres fournisseurs CLI IA (Codex CLI, OpenCode CLI, CLIs de fournisseurs IA locaux)
- [ ] Templates de colonnes kanban personnalisés
- [ ] Support multi-tableau avec vue tableau de bord
- [ ] Historique et relecture des conversations d'agent
- [ ] Publication sur le marketplace VS Code

## 🤝 Contribution

1. Forkez le dépôt
2. Créez une branche fonctionnelle (`git checkout -b feature/super-fonctionnalite`)
3. Faites vos changements en suivant les règles dans [AGENTS.md](AGENTS.md)
4. Exécutez les tests (`npm test`) et assurez-vous d'une couverture de 90%+
5. Commitez vos changements (`git commit -m 'feat: ajouter super fonctionnalité'`)
6. Poussez vers la branche (`git push origin feature/super-fonctionnalite`)
7. Ouvrez une Pull Request

### Règles de Développement

- **Logger dans chaque fichier** — Chaque méthode/action doit logger en utilisant l'utilitaire `logger`
- **Un fichier de test par méthode** — Ne jamais regrouper plusieurs méthodes dans un fichier de test
- **90% de couverture de code** est obligatoire sur tous les fichiers nouveaux/modifiés
- **Portes de qualité aislop** s'exécutent à chaque édition via CI avec score 100/100

## 📄 Licence

Licence MIT — voir [LICENSE](LICENSE) pour les détails.

## 🔗 Liens

- [Problèmes GitHub](https://github.com/davidthibaulttlm/ai_os_plugin/issues)
- [Docs GitHub Projects v2](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
- [API Extension VS Code](https://code.visualstudio.com/api)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview)

## 🏠 Construit Localement, Construit Ouvert

Ce projet a été développé entièrement sur du matériel local — pas d'API cloud, pas de services propriétaires. L'assistant IA utilisé tout au long de ce projet fonctionne comme **Qwen3.6-27B** via **llama.cpp**, entièrement auto-hébergé et capable de fonctionner hors ligne.

Je crois fermement en **la gouvernance IA locale et autonome** : vos données restent sur votre machine, vos modèles s'exécutent selon vos termes, et vous gardez le contrôle total de votre environnement de développement.

Ce projet est un témoignage de la puissance de **l'IA open-source et open-weights**. Quand les outils sont transparents, auditable et communautaires, tout le monde gagne.

## 🙏 Remerciements

Ce projet n'existerait pas sans ces projets open-source incroyables :

- **[Unsloth](https://huggingface.co/unsloth/Qwen3.6-27B-MTP-GGUF)** — Pour le modèle Qwen3.6-27B-MTP GGUF et leur travail incroyable sur le fine-tuning efficace et l'optimisation de modèle
- **[llama.cpp](https://github.com/ggml-org/llama.cpp)** — Pour avoir rendu possible l'exécution de grands modèles de langage localement sur du matériel grand public avec une vitesse fulgurante
- **[Zoo Code](https://github.com/Zoo-Code-Org/Zoo-Code)** — Pour l'assistant de codage alimenté par IA qui a aidé à construire ce projet (fork de [Roo Code](https://github.com/RooCodeInc/Roo-Code))
- **[VS Code](https://github.com/microsoft/vscode/)** — Pour l'éditeur open-source incroyable et la plateforme d'extension sur laquelle ce projet est construit

Fait avec ❤️ et des poids ouverts.
