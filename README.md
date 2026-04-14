# Нейрограф людей

Интерактивная sci-fi система анализа людей и связей с безопасным backend-слоем.

## Что уже реализовано

- force-directed граф (drag, zoom, pan)
- неоновые узлы и импульсы по связям
- CRUD людей и связей
- поиск, фильтр по тегам, карточка человека
- экспорт/импорт JSON
- режим просмотра + вход администратора
- API и авторизация только на сервере

## Безопасность

- секреты Supabase и JWT хранятся только в серверном `.env`
- фронтенд не содержит service-role ключей и паролей
- авторизация и проверка прав выполняются только в `server/index.ts`
- запись/удаление доступны только с валидным JWT

## Стек

- Frontend: React + TypeScript + Vite
- Backend: Express + JWT + Supabase (server-side)
- Store/UI: Zustand, Framer Motion, react-force-graph-2d

## Запуск

1. `npm install`
2. скопировать `.env.example` в `.env` и заполнить переменные
3. `npm run dev`

`npm run dev` запускает сразу frontend и backend.

## Переменные окружения (сервер)

- `PORT` — порт API (по умолчанию 8787)
- `SUPABASE_URL` — URL проекта Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — service role ключ Supabase
- `ADMIN_PASSWORD` — пароль администратора
- `JWT_SECRET` — секрет подписи JWT

## SQL схема и RLS для Supabase

1. Выполнить SQL из файла `supabase/schema.sql`.
2. В этой схеме:
   - включен RLS на обеих таблицах;
   - клиентам разрешен только `select`;
   - `insert/update/delete` с клиентской стороны запрещены.
