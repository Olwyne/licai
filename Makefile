# Lǐcái — lancement exclusivement via Docker, en local (https://licai.localhost)

# Initialise .env et les certificats locaux (mkcert requis: brew install mkcert)
init:
	@test -f .env || (cp .env.example .env && sed -i '' "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$$(openssl rand -base64 32)|" .env && echo ".env créé")
	mkcert -cert-file orchestrator/certs/local-cert.pem -key-file orchestrator/certs/local-key.pem licai.localhost "*.licai.localhost" localhost 127.0.0.1 ::1

up:
	docker compose up -d --build

down:
	docker compose down

restart:
	docker compose restart web

mail:
	@open https://mail.licai.localhost

logs:
	docker compose logs -f --tail=100 web

web:
	docker compose exec web sh

seed:
	docker compose exec web npm run db:seed

migrate:
	docker compose exec web npm run db:migrate

test:
	docker compose exec web npm test

# Supprime aussi les volumes (node_modules, cache Next). Les données ./data sont conservées.
clean:
	docker compose down -v

# ── Production (voir docker-compose.prod.yaml) ───────────────────────────────
prod-up:
	docker compose -f docker-compose.prod.yaml up -d --build

prod-down:
	docker compose -f docker-compose.prod.yaml down

# Sauvegarde immédiate de la base (en plus de la sauvegarde quotidienne automatique)
backup:
	docker compose -f docker-compose.prod.yaml exec backup node scripts/backup.mjs

# Restauration : make restore FILE=/app/data/backups/licai-AAAAMMJJ-HHMMSS.db (arrête l'app pendant l'opération)
restore:
	docker compose -f docker-compose.prod.yaml stop web backup
	docker compose -f docker-compose.prod.yaml run --rm --no-deps backup node scripts/backup.mjs --restore $(FILE)
	docker compose -f docker-compose.prod.yaml start web backup
