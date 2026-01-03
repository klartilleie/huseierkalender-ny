# Smart Hjem Calendar - Lokal Installasjon

## Forutsetninger

- Docker og Docker Compose installert
- Node.js 20+ (for utvikling uten Docker)

## Kjøre med Docker (Anbefalt)

### 1. Start applikasjonen

```bash
docker-compose up -d
```

Dette starter:
- PostgreSQL database på port 5432
- Applikasjonen på port 5000

### 2. Åpne i nettleser

Gå til: http://localhost:5000

### 3. Stopp applikasjonen

```bash
docker-compose down
```

## Kjøre uten Docker

### 1. Installer PostgreSQL

Last ned og installer PostgreSQL fra https://www.postgresql.org/download/

### 2. Opprett database

```bash
createdb smarthjem
psql smarthjem < database_backup.sql
```

### 3. Sett miljøvariabler

Opprett en `.env` fil:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smarthjem
SESSION_SECRET=din-hemmelige-nøkkel
NODE_ENV=development
ENABLE_BACKGROUND_TASKS=false
```

### 4. Installer avhengigheter

```bash
npm install
```

### 5. Start applikasjonen

```bash
npm run dev
```

## Innlogging

- **Brukernavn:** kundeservice@smarthjem.as
- **Passord:** admin2025

## Viktige filer

- `database_backup.sql` - Database backup
- `docker-compose.yml` - Docker konfigurasjon
- `Dockerfile` - Container build instruksjoner

## Miljøvariabler

| Variabel | Beskrivelse | Standard |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL tilkobling | - |
| SESSION_SECRET | Sesjonsnøkkel | calendar-app-session-secret |
| ENABLE_BACKGROUND_TASKS | Aktiver bakgrunnssynk | false |
| NODE_ENV | Miljø (development/production) | development |

## Kostnadsbesparende modus

Applikasjonen er konfigurert med `ENABLE_BACKGROUND_TASKS=false` for å spare ressurser.
Synkronisering skjer automatisk når brukere åpner kalenderen.

For å aktivere bakgrunnssynk, sett `ENABLE_BACKGROUND_TASKS=true`.
