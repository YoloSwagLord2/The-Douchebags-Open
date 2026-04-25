export type Language = 'en' | 'nl';

const translations = {
  en: {
    // Auth
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.login': 'Enter the clubhouse',
    'auth.loginHeader': 'LOCAL TOURNAMENT CONTROL',
    'auth.subtitle': 'Mobile-first scoring, live standings, secret side games, and a proper event-day control room.',

    // Player Management
    'players.createTitle': 'Create player',
    'players.create': 'Create player',
    'players.update': 'Update selected player',
    'players.roster': 'Roster',
    'players.existingPlayers': 'Existing players',
    'players.name': 'Name',
    'players.hcp': 'Handicap',
    'players.role': 'Role',
    'players.photoUpload': 'Upload photo for selected player',
    'players.active': 'Active',
    'players.player': 'Player',
    'players.admin': 'Admin',
    'players.newPassword': 'New password (leave blank to keep current)',

    // Validation Errors
    'validation.required': 'This field is required',
    'validation.invalidEmail': 'Invalid email address',
    'validation.passwordTooShort': 'Password must be at least 8 characters',
    'validation.emailInUse': 'Email is already in use',
    'validation.invalidCredentials': 'Invalid credentials',

    // Form Errors
    'error.failedToCreate': 'Failed to create player',
    'error.failedToUpdate': 'Failed to update player',
    'error.photoUploadFailed': 'Photo upload failed',
  },
  nl: {
    // Auth
    'auth.email': 'E-mailadres',
    'auth.password': 'Wachtwoord',
    'auth.login': 'Voer de clubhouse in',
    'auth.loginHeader': 'LOKAAL TOERNOOI BEHEER',
    'auth.subtitle': 'Mobiel scoren, live ranglijsten, geheime zijspelen en een correct evenementdagbeheercenter.',

    // Player Management
    'players.createTitle': 'Speler aanmaken',
    'players.create': 'Speler aanmaken',
    'players.update': 'Geselecteerde speler bijwerken',
    'players.roster': 'Speellijst',
    'players.existingPlayers': 'Bestaande spelers',
    'players.name': 'Naam',
    'players.hcp': 'Handicap',
    'players.role': 'Rol',
    'players.photoUpload': 'Foto uploaden voor geselecteerde speler',
    'players.active': 'Actief',
    'players.player': 'Speler',
    'players.admin': 'Beheerder',
    'players.newPassword': 'Nieuw wachtwoord (leeg laten om huidige te behouden)',

    // Validation Errors
    'validation.required': 'Dit veld is verplicht',
    'validation.invalidEmail': 'Ongeldig e-mailadres',
    'validation.passwordTooShort': 'Wachtwoord moet minstens 8 tekens zijn',
    'validation.emailInUse': 'E-mailadres is al in gebruik',
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
    // Fallback to English
    value = translations.en[key as keyof typeof translations.en];
  }

  return value || defaultValue || key;
}

export function parseErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Map common backend error messages to i18n keys
    if (message.includes('email') && message.includes('already')) {
      return t('validation.emailInUse');
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

    // Return original message if no match
    return error.message;
  }
  return t('error.failedToCreate');
}
