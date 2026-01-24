# 📊 Discord Bot - Licznik Wiadomości

Bot Discord w Node.js, który zlicza wiadomości użytkowników i wyświetla statystyki.

## 🚀 Funkcje

- **Automatyczne zliczanie** wszystkich wiadomości użytkowników
- **/stats** - sprawdź swoje statystyki
- **/leaderboard** - zobacz ranking top 10 użytkowników
- Baza danych SQLite (dane są przechowywane lokalnie)

## 📋 Wymagania

- Node.js 16 lub nowszy
- Konto Discord i utworzona aplikacja bota

## 🔧 Instalacja lokalna

1. Sklonuj lub pobierz pliki
2. Zainstaluj zależności:
```bash
npm install
```

3. Utwórz plik `.env` i dodaj swój token:
```
DISCORD_TOKEN=twoj_token_discord
```

4. Uruchom bota:
```bash
npm start
```

## 🚂 Wdrożenie na Railway

### Krok 1: Utwórz bota Discord

1. Wejdź na https://discord.com/developers/applications
2. Kliknij "New Application"
3. Nadaj nazwę i kliknij "Create"
4. Przejdź do zakładki "Bot"
5. Kliknij "Add Bot" → "Yes, do it!"
6. **Skopiuj token** (będzie potrzebny później)
7. Włącz wszystkie **Privileged Gateway Intents**:
   - ✅ Presence Intent
   - ✅ Server Members Intent
   - ✅ Message Content Intent

### Krok 2: Zaproś bota na serwer

1. Przejdź do zakładki "OAuth2" → "URL Generator"
2. Zaznacz:
   - **Scopes**: `bot`, `applications.commands`
   - **Bot Permissions**: 
     - Read Messages/View Channels
     - Send Messages
     - Embed Links
3. Skopiuj wygenerowany URL i otwórz w przeglądarce
4. Wybierz serwer i potwierdź

### Krok 3: Wdróż na Railway

1. Wejdź na https://railway.app
2. Zaloguj się przez GitHub
3. Kliknij "New Project" → "Deploy from GitHub repo"
4. Wybierz swoje repozytorium (musisz najpierw wrzucić kod na GitHub)
5. Po dodaniu projektu, kliknij na niego
6. Przejdź do zakładki "Variables"
7. Dodaj zmienną środowiskową:
   - **Key**: `DISCORD_TOKEN`
   - **Value**: Twój token z Discord Developer Portal
8. Railway automatycznie zbuduje i uruchomi bota

### Alternatywnie - Deploy bez GitHub:

1. Zainstaluj Railway CLI:
```bash
npm install -g @railway/cli
```

2. Zaloguj się:
```bash
railway login
```

3. Wdróż projekt:
```bash
railway init
railway up
```

4. Dodaj zmienną środowiskową przez CLI:
```bash
railway variables set DISCORD_TOKEN=twoj_token
```

## 📝 Komendy

| Komenda | Opis |
|---------|------|
| `/stats` | Wyświetla Twoje statystyki wiadomości |
| `/leaderboard` | Pokazuje top 10 użytkowników |

## 💾 Baza danych

Bot używa SQLite - plik `messages.db` jest tworzony automatycznie. 

**Uwaga**: Railway może resetować pliki przy każdym wdrożeniu. Dla trwałego przechowywania danych rozważ:
- Dodanie wolumenu w Railway (Settings → Volumes)
- Użycie PostgreSQL zamiast SQLite

## 🛠️ Rozwiązywanie problemów

**Bot się nie uruchamia:**
- Sprawdź czy token jest poprawny
- Upewnij się że włączyłeś Message Content Intent w ustawieniach bota

**Komendy nie działają:**
- Poczekaj kilka minut - Discord potrzebuje czasu na propagację komend
- Upewnij się że bot ma uprawnienia "Use Slash Commands"

**Baza danych się resetuje:**
- Na Railway dodaj persistent volume dla pliku messages.db
- Lub przejdź na PostgreSQL

## 📄 Licencja

ISC
