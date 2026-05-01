export type Language = 'en' | 'nl';

const translations = {
  en: {
    // Auth
    'auth.email': 'Email',
    'auth.username': 'Username',
    'auth.usernamePlaceholder': 'Enter your username',
    'auth.password': 'Password',
    'auth.login': 'Enter the clubhouse',
    'auth.loginHeader': 'LOCAL TOURNAMENT CONTROL',
    'auth.subtitle': 'Mobile-first scoring, live standings, secret side games, and a proper event-day control room.',

    // App shell
    'app.eyebrow': 'The Douchebags Open',
    'app.title': 'Tournament Control',
    'app.signOut': 'Sign out',
    'app.loading': 'Loading your tournament deck…',
    'theme.light': 'Light',
    'theme.dark': 'Dark',

    // Navigation
    'nav.players': 'Players',
    'nav.courses': 'Courses',
    'nav.events': 'Events',
    'nav.board': 'Board',
    'nav.rules': 'Rules',
    'nav.inbox': 'Inbox',
    'nav.scores': 'Score',
    'nav.bonuses': 'Bonuses',
    'nav.achievements': 'Achievements',
    'nav.notifications': 'Notifications',
    'nav.appearance': 'Theme',

    // Player Management
    'players.eyebrow': 'Player setup',
    'players.createTitle': 'Create player',
    'players.create': 'Create player',
    'players.update': 'Update selected player',
    'players.rosterEyebrow': 'Roster',
    'players.existingPlayers': 'Existing players',
    'players.name': 'Name',
    'players.username': 'Username',
    'players.hcp': 'Handicap',
    'players.role': 'Role',
    'players.photoUpload': 'Upload photo for selected player',
    'players.active': 'Active',
    'players.player': 'Player',
    'players.admin': 'Admin',
    'players.newPassword': 'New password (leave blank to keep current)',

    // Courses
    'courses.eyebrow': 'Course architect',
    'courses.createTitle': 'Create course',
    'courses.save': 'Save course',
    'courses.update': 'Update course',
    'courses.updated': 'Course updated',
    'courses.libraryEyebrow': 'Library',
    'courses.libraryTitle': 'Configured courses',
    'courses.editingEyebrow': 'Editing',
    'courses.hole': 'Hole',
    'courses.name': 'Course name',
    'courses.slope': 'Slope rating',
    'courses.rating': 'Course rating',
    'courses.holePar': 'Par',
    'courses.holeStrokeIndex': 'Stroke index',
    'courses.holeDistance': 'Distance (m)',
    'courses.holeCount': 'Course length',
    'courses.nineHoles': '9 holes',
    'courses.eighteenHoles': '18 holes',
    'courses.holeImageNone': 'No image yet',
    'courses.holeImageUpload': 'Upload image',
    'courses.holeImageReplace': 'Replace image',
    'courses.holeImageRemove': 'Remove',
    'courses.holeImageSaveFirst': 'Save the course first to upload images',

    // Appearance
    'appearance.eyebrow': 'Appearance',
    'appearance.title': 'Background images',

    // Tournaments / Events
    'tournaments.eyebrow': 'Event desk',
    'tournaments.workingEyebrow': 'Working event',
    'tournaments.createTitle': 'Create tournament',
    'tournaments.create': 'Create event',
    'tournaments.name': 'Event name',
    'tournaments.date': 'Date',
    'tournaments.rosterEyebrow': 'Roster',
    'tournaments.rosterTitle': 'Assign players',
    'tournaments.saveRoster': 'Save roster',
    'tournaments.rosterSaved': 'Roster saved',

    // Rounds
    'rounds.eyebrow': 'Round factory',
    'rounds.controlEyebrow': 'Control',
    'rounds.createTitle': 'Create round',
    'rounds.create': 'Create round',
    'rounds.title': 'Rounds',
    'rounds.selectTournament': 'Tournament',
    'rounds.selectCourse': 'Course',
    'rounds.round': 'Round',
    'rounds.lock': 'Lock round',
    'rounds.locked': 'Locked',

    // Score entry
    'score.eyebrow': 'Score entry',
    'score.noActiveRound': 'No active round',
    'score.enterScores': 'Enter your scores',
    'score.hole': 'Hole',
    'score.par': 'Par',
    'score.si': 'SI',
    'score.gross': 'Gross',
    'score.official': 'Official',
    'score.bonus': 'Bonus',
    'score.adj': 'Adj.',
    'score.previous': 'Previous',
    'score.next': 'Next',
    'score.saveAndContinue': 'Save and continue',
    'score.loading': 'Loading hole data…',

    // Leaderboard
    'leaderboard.currentLeader': 'Current leader',
    'leaderboard.currentNumber1': 'Current number one',
    'leaderboard.scoreboard': 'Scoreboard',
    'leaderboard.scoreboardPerRound': 'Scoreboard — Stableford points per round',
    'leaderboard.tournamentLeaderboard': 'Tournament leaderboard',
    'leaderboard.player': 'Player',
    'leaderboard.total': 'Total',
    'leaderboard.loading': 'Loading scoreboard…',
    'leaderboard.official': 'Official',
    'leaderboard.bonus': 'Bonus',
    'leaderboard.net': 'Net',
    'leaderboard.gross': 'Gross',

    // Bonuses
    'bonuses.eyebrow': 'Secret wins',
    'bonuses.title': 'Unlocked bonus rules',

    // Achievements
    'achievements.eyebrow': 'Exceptional moments',
    'achievements.title': 'Achievement history',

    // Bonus rules
    'bonusRules.eyebrow': 'Hidden side games',
    'bonusRules.createTitle': 'Create bonus rule',
    'bonusRules.save': 'Save bonus rule',
    'bonusRules.scopeRound': 'Round scoped',
    'bonusRules.scopeTournament': 'Tournament scoped',
    'bonusRules.selectScope': 'Select scope',
    'bonusRules.animConfetti': 'Confetti',
    'bonusRules.animFireworks': 'Fireworks',
    'bonusRules.animSpotlight': 'Spotlight',
    'bonusRules.animChaos': 'Chaos',

    // Achievement rules
    'achievementRules.eyebrow': 'Exceptional events',
    'achievementRules.createTitle': 'Create achievement rule',
    'achievementRules.save': 'Save achievement rule',
    'achievementRules.scopeRound': 'Round scoped',
    'achievementRules.scopeTournament': 'Tournament scoped',
    'achievementRules.selectScope': 'Select scope',
    'achievementRules.iconStar': 'Star',
    'achievementRules.iconAce': 'Ace',
    'achievementRules.iconFlame': 'Flame',
    'achievementRules.iconTrophy': 'Trophy',

    // Notifications
    'notifications.eyebrow': 'Message centre',
    'notifications.title': 'Push notification',
    'notifications.centreEyebrow': 'Notification centre',
    'notifications.centreTitle': 'Messages and event alerts',
    'notifications.priorityLow': 'Low',
    'notifications.priorityNormal': 'Normal',
    'notifications.priorityHigh': 'High',
    'notifications.targetAll': 'All users',
    'notifications.targetIndividual': 'One player',
    'notifications.targetRound': 'Round roster',
    'notifications.targetTournament': 'Tournament roster',
    'notifications.selectPlayer': 'Select player',

    // Validation Errors
    'validation.required': 'This field is required',
    'validation.invalidEmail': 'Invalid email address',
    'validation.passwordTooShort': 'Password must be at least 8 characters',
    'validation.emailInUse': 'Email is already in use',
    'validation.usernameInUse': 'Username is already taken',
    'validation.invalidCredentials': 'Invalid credentials',

    // Form Errors
    'error.failedToCreate': 'Failed to create player',
    'error.failedToUpdate': 'Failed to update player',
    'error.photoUploadFailed': 'Photo upload failed',
  },
  nl: {
    // Auth
    'auth.email': 'E-mailadres',
    'auth.username': 'Gebruikersnaam',
    'auth.usernamePlaceholder': 'Voer je gebruikersnaam in',
    'auth.password': 'Wachtwoord',
    'auth.login': 'Login',
    'auth.loginHeader': 'LOKAAL TOERNOOI BEHEER',
    'auth.subtitle': 'Alles wat je nodig hebt voor The Douchebags Open!',

    // App shell
    'app.eyebrow': 'The Douchebags Open',
    'app.title': 'Toernooi Beheer',
    'app.signOut': 'Uitloggen',
    'app.loading': 'Toernooioverzicht laden…',
    'theme.light': 'Licht',
    'theme.dark': 'Donker',

    // Navigation
    'nav.players': 'Spelers',
    'nav.courses': 'Banen',
    'nav.events': 'Events',
    'nav.board': 'Bord',
    'nav.rules': 'Regels',
    'nav.inbox': 'Inbox',
    'nav.scores': 'Score',
    'nav.bonuses': 'Bonussen',
    'nav.achievements': 'Prestaties',
    'nav.notifications': 'Meldingen',
    'nav.appearance': 'Thema',

    // Player Management
    'players.eyebrow': 'Speler beheer',
    'players.createTitle': 'Speler aanmaken',
    'players.create': 'Speler aanmaken',
    'players.update': 'Geselecteerde speler bijwerken',
    'players.rosterEyebrow': 'Speellijst',
    'players.existingPlayers': 'Bestaande spelers',
    'players.name': 'Naam',
    'players.username': 'Gebruikersnaam',
    'players.hcp': 'Handicap',
    'players.role': 'Rol',
    'players.photoUpload': 'Foto uploaden voor geselecteerde speler',
    'players.active': 'Actief',
    'players.player': 'Speler',
    'players.admin': 'Beheerder',
    'players.newPassword': 'Nieuw wachtwoord (leeg laten om huidige te behouden)',

    // Courses
    'courses.eyebrow': 'Baanarchitect',
    'courses.createTitle': 'Baan aanmaken',
    'courses.save': 'Baan opslaan',
    'courses.update': 'Baan bijwerken',
    'courses.updated': 'Baan bijgewerkt',
    'courses.libraryEyebrow': 'Bibliotheek',
    'courses.libraryTitle': 'Geconfigureerde banen',
    'courses.editingEyebrow': 'Bewerken',
    'courses.hole': 'Hole',
    'courses.name': 'Baannaam',
    'courses.slope': 'Slope rating',
    'courses.rating': 'Course rating',
    'courses.holePar': 'Par',
    'courses.holeStrokeIndex': 'Slagindex',
    'courses.holeDistance': 'Afstand (m)',
    'courses.holeCount': 'Aantal holes',
    'courses.nineHoles': '9 holes',
    'courses.eighteenHoles': '18 holes',
    'courses.holeImageNone': 'Nog geen afbeelding',
    'courses.holeImageUpload': 'Afbeelding uploaden',
    'courses.holeImageReplace': 'Afbeelding vervangen',
    'courses.holeImageRemove': 'Verwijderen',
    'courses.holeImageSaveFirst': 'Sla de baan eerst op om afbeeldingen te uploaden',

    // Appearance
    'appearance.eyebrow': 'Vormgeving',
    'appearance.title': 'Achtergrondafbeeldingen',

    // Tournaments / Events
    'tournaments.eyebrow': 'Event beheer',
    'tournaments.workingEyebrow': 'Huidig event',
    'tournaments.createTitle': 'Toernooi aanmaken',
    'tournaments.create': 'Event aanmaken',
    'tournaments.name': 'Evenementnaam',
    'tournaments.date': 'Datum',
    'tournaments.rosterEyebrow': 'Speellijst',
    'tournaments.rosterTitle': 'Spelers toewijzen',
    'tournaments.saveRoster': 'Speellijst opslaan',
    'tournaments.rosterSaved': 'Speellijst opgeslagen',

    // Rounds
    'rounds.eyebrow': 'Ronde beheer',
    'rounds.controlEyebrow': 'Beheer',
    'rounds.createTitle': 'Ronde aanmaken',
    'rounds.create': 'Ronde aanmaken',
    'rounds.title': 'Rondes',
    'rounds.selectTournament': 'Toernooi',
    'rounds.selectCourse': 'Baan',
    'rounds.round': 'Ronde',
    'rounds.lock': 'Ronde vergrendelen',
    'rounds.locked': 'Vergrendeld',

    // Score entry
    'score.eyebrow': 'Score invoer',
    'score.noActiveRound': 'Geen actieve ronde',
    'score.enterScores': 'Voer je scores in',
    'score.hole': 'Hole',
    'score.par': 'Par',
    'score.si': 'SI',
    'score.gross': 'Bruto',
    'score.official': 'Officieel',
    'score.bonus': 'Bonus',
    'score.adj': 'Aangepast',
    'score.previous': 'Vorige',
    'score.next': 'Volgende',
    'score.saveAndContinue': 'Opslaan en doorgaan',
    'score.loading': 'Holegegevens laden…',

    // Leaderboard
    'leaderboard.currentLeader': 'Huidige leider',
    'leaderboard.currentNumber1': 'Huidig nummer één',
    'leaderboard.scoreboard': 'Scorebord',
    'leaderboard.scoreboardPerRound': 'Scorebord — Stableford punten per ronde',
    'leaderboard.tournamentLeaderboard': 'Toernooi ranglijst',
    'leaderboard.player': 'Speler',
    'leaderboard.total': 'Totaal',
    'leaderboard.loading': 'Scorebord laden…',
    'leaderboard.official': 'Officieel',
    'leaderboard.bonus': 'Bonus',
    'leaderboard.net': 'Netto',
    'leaderboard.gross': 'Bruto',

    // Bonuses
    'bonuses.eyebrow': 'Gewonnen bonuspunten',
    'bonuses.title': 'Ontgrendelde bonusregels',

    // Achievements
    'achievements.eyebrow': 'Uitzonderlijke momenten',
    'achievements.title': 'Prestatiegeschiedenis',

    // Bonus rules
    'bonusRules.eyebrow': 'Geheime zijspelen',
    'bonusRules.createTitle': 'Bonusregel aanmaken',
    'bonusRules.save': 'Bonusregel opslaan',
    'bonusRules.scopeRound': 'Ronde bereik',
    'bonusRules.scopeTournament': 'Toernooi bereik',
    'bonusRules.selectScope': 'Bereik selecteren',
    'bonusRules.animConfetti': 'Confetti',
    'bonusRules.animFireworks': 'Vuurwerk',
    'bonusRules.animSpotlight': 'Spotlight',
    'bonusRules.animChaos': 'Chaos',

    // Achievement rules
    'achievementRules.eyebrow': 'Uitzonderlijke events',
    'achievementRules.createTitle': 'Prestatieregel aanmaken',
    'achievementRules.save': 'Prestatieregel opslaan',
    'achievementRules.scopeRound': 'Ronde bereik',
    'achievementRules.scopeTournament': 'Toernooi bereik',
    'achievementRules.selectScope': 'Bereik selecteren',
    'achievementRules.iconStar': 'Ster',
    'achievementRules.iconAce': 'Aas',
    'achievementRules.iconFlame': 'Vlam',
    'achievementRules.iconTrophy': 'Trofee',

    // Notifications
    'notifications.eyebrow': 'Berichtencentrum',
    'notifications.title': 'Pushmelding',
    'notifications.centreEyebrow': 'Meldingscentrum',
    'notifications.centreTitle': 'Berichten en evenementwaarschuwingen',
    'notifications.priorityLow': 'Laag',
    'notifications.priorityNormal': 'Normaal',
    'notifications.priorityHigh': 'Hoog',
    'notifications.targetAll': 'Alle gebruikers',
    'notifications.targetIndividual': 'Één speler',
    'notifications.targetRound': 'Ronde speellijst',
    'notifications.targetTournament': 'Toernooi speellijst',
    'notifications.selectPlayer': 'Speler selecteren',

    // Validation Errors
    'validation.required': 'Dit veld is verplicht',
    'validation.invalidEmail': 'Ongeldig e-mailadres',
    'validation.passwordTooShort': 'Wachtwoord moet minstens 8 tekens zijn',
    'validation.emailInUse': 'E-mailadres is al in gebruik',
    'validation.usernameInUse': 'Gebruikersnaam is al bezet',
    'validation.invalidCredentials': 'Ongeldige inloggegevens',

    // Form Errors
    'error.failedToCreate': 'Kan speler niet aanmaken',
    'error.failedToUpdate': 'Kan speler niet bijwerken',
    'error.photoUploadFailed': 'Fotoupload mislukt',
  },
};

let currentLanguage: Language = 'nl';

export function setLanguage(lang: Language) {
  currentLanguage = lang;
  localStorage.setItem('language', lang);
}

export function getLanguage(): Language {
  const saved = localStorage.getItem('language') as Language | null;
  return saved || 'nl';
}

export function initLanguage() {
  const lang = getLanguage();
  currentLanguage = lang;
  return lang;
}

export function t(key: string, defaultValue?: string): string {
  const langTranslations = translations[currentLanguage] as Record<string, string>;
  let value = langTranslations[key];

  if (!value) {
    value = translations.en[key as keyof typeof translations.en];
  }

  return value || defaultValue || key;
}

export function parseErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('email') && message.includes('already')) {
      return t('validation.emailInUse');
    }
    if (message.includes('username') && message.includes('already')) {
      return t('validation.usernameInUse');
    }
    if (message.includes('email')) {
      return t('validation.invalidEmail');
    }
    if (message.includes('password')) {
      return t('validation.passwordTooShort');
    }
    if (message.includes('credentials')) {
      return t('validation.invalidCredentials');
    }
    if (message.includes('required')) {
      return t('validation.required');
    }

    return error.message;
  }
  return t('error.failedToCreate');
}
