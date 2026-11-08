# Моя Музыка: сборка приложения (Capacitor)

В этой папке всё готово. Приложение собирается в облаке GitHub, ставить Android Studio не нужно.

## Способ 1: облачная сборка (проще всего)
1. Зарегистрируйся на github.com и нажми «New repository». Название любое, например `moya-muzyka`.
2. В репозитории нажми «uploading an existing file» и перетащи ВСЁ содержимое этой папки,
   включая папки `www` и `.github`. Если `.github` не загрузилась, создай файл вручную:
   «Add file → Create new file», имя `.github/workflows/android.yml`, и вставь туда содержимое файла из архива.
3. Открой вкладку «Actions» → «Build APK» → «Run workflow». Подожди 5-10 минут.
4. Открой завершённый запуск, внизу в блоке «Artifacts» скачай `moya-muzyka-apk`.
   Внутри будет `app-debug.apk`. Отправь его на телефон и установи (разреши установку из неизвестных источников).

## Способ 2: на своём компьютере
1. Поставь Node.js 20, Android Studio (вместе с Android SDK) и Java 17.
2. В папке выполни:
   npm install
   npx cap add android
   npx cap sync android
   npx cap open android
3. В Android Studio: Build → Build APK(s).

## Как обновлять
Замени `www/index.html` новой версией плеера и запусти сборку снова (способ 1: «Run workflow»).

## Что уже настроено
- `CapacitorHttp` включён: запросы к YouTube, Яндексу и другим сайтам идут через нативную сеть телефона, без блокировки CORS.
