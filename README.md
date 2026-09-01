# Учёт оборудования

Веб-приложение для учёта оборудования у мастеров и на складах. Источник правды — это приложение. Сводный Excel генерируется автоматически и пишется на Диск Битрикс24. Существующий сайт на FirstVDS не затрагивается: новый стек живёт в отдельном каталоге, на своих портах и поддомене.

## Стек

- Фронт: Vue 3, Vue Router, Pinia, SCSS
- Бэк: NestJS, Prisma, PostgreSQL
- Интеграция: Bitrix24 OAuth / встраивание во вкладки, exceljs

## Локальный запуск

Нужны Node.js 22+ и Docker (только для Postgres).

```bash
docker compose up -d postgres
copy backend\.env.example backend\.env
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

В другом терминале:

```bash
cd frontend
npm install
npm run dev
```

Откройте http://localhost:5173. Первый локальный вход (ФИО) становится администратором. `DEV_AUTH=true` только для разработки.

## Роли по умолчанию

- Администратор — все права, в том числе настройка ролей
- Мастер — своё оборудование, создание, передача
- Кладовщик — весь парк, склады, создание, передача

Передача мгновенная. Серийные единицы — 1 шт. с уникальным заводским номером. Расходники можно передавать частично.

## Битрикс24 (облако)

Создайте локальное приложение на портале:

- Путь обработчика: `https://equipment.example.ru/api/bitrix/open`
- Путь установки: `https://equipment.example.ru/api/bitrix/install`
- Права: `user`, `disk`
- Встройка: пункт левого меню / страница приложения

В `.env` укажите `BITRIX_CLIENT_ID`, `BITRIX_CLIENT_SECRET`, `FRONTEND_URL=https://equipment.example.ru`, `DEV_AUTH=false`.

Excel `Учёт оборудования (авто).xlsx` перезаписывается на Диске приложения целиком. Ручные правки этого файла не предусмотрены. Выгрузка: кнопка в админке и авточерез ~1 минуту после изменений.

## FirstVDS рядом с текущим приложением

1. Поддомен `equipment.ваш-домен.ru` на IP сервера.
2. Каталог, например `/var/www/equipment` — **не** каталог старого сайта.
3. Скопируйте `.env.example` в `.env`, задайте `JWT_SECRET` и ключи Битрикс.
4. `docker compose up -d --build` — Postgres на **5433**, API на **3010**, фронт на **8080**. Старые порты не занимаются.
5. Добавьте отдельный Nginx server из `deploy/nginx.conf.example`, затем Let's Encrypt.

Конфликт со старым приложением возможен только если совпадут домен, порт или имя контейнера. Здесь порты 8080/3010/5433 и отдельный compose-проект.

## Полезные URL

- UI: `/mine`, `/fleet`, `/warehouses`, `/history`, `/admin/roles`, `/admin/users`
- API health: `/api/health`
