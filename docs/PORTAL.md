# Portal: poczekalnia i slot gry

Backend gry przyjmuje dane portalu przez `POST /api/sessions`. Portal wykonuje to żądanie po stronie swojego serwera, z nagłówkiem `Authorization: Bearer <PORTAL_ADMIN_KEY>` i `Content-Type: application/json`.

```json
{
  "playerId": "identyfikator-gracza-z-portalu",
  "gameId": "batyskaf",
  "endpoint": "http://157.158.83.183:8001/api/v1/data",
  "startsAt": "2026-11-20T10:00:00Z",
  "endsAt": "2026-11-20T10:15:00Z"
}
```

Daty są przykładem: portal podaje rzeczywisty przyszły slot w ISO 8601 ze strefą czasową (`Z` oznacza UTC). Oba terminy są wymagane razem; koniec musi być późniejszy od początku i aktualnego czasu. Endpoint musi dokładnie odpowiadać `ARM_ALICE_URL` lub `ARM_BOB_URL` z konfiguracji backendu. Zamiast endpointu można przekazać `arm: "alice"` albo `arm: "bob"`. Podanie obu pól wymaga ich zgodności. Adres odbiornika jest zapisywany w sesji; zmiana konfiguracji nie przekieruje po cichu istniejącego slotu.

Odpowiedź zawiera `token`, `expiresAt`, terminy slotu w milisekundach Unix oraz `launchPath`, np. `/waiting#session=…`. Portal otwiera `https://domena-backendu-gry` + `launchPath`. Strona `/waiting` i API muszą być serwowane przez ten sam backend lub reverse proxy. Sam statyczny hosting Sites nie uruchamia backendu Node/SQLite.

- Przed początkiem slotu gracz widzi poczekalnię z odliczaniem, bez możliwości rozpoczęcia gry.
- W chwili początku slotu gra automatycznie otwiera oazę. Dla slotów nie ma dodatkowego pięciosekundowego oczekiwania.
- Po końcu slotu pojawia się ekran „Dziękujemy za grę!”, wejście gracza i symulacja są zatrzymane. Obowiązuje to również w ustawieniach, sklepie i pauzie oraz po powrocie do karty.
- Odświeżenie strony ponownie pobiera terminy z backendu. Token pozostaje ważny godzinę po końcu slotu, aby można było odtworzyć ekran podziękowania. Nie przedłuża to gry.
- Bez terminów zachowany jest starszy tryb sesji z `ttlSeconds` (domyślnie 7200). Bez tokenu działa lokalna gra z pięciosekundowym menu i bez wysyłania do ramion.

Przeglądarka ustala zegar na podstawie `serverTime` z `GET /api/session` i monotonicznego zegara przeglądarki. Tym samym zegarem oznaczane są generowane decyzje. Backend niezależnie kontroluje aktualny czas i czas wygenerowania decyzji; poza slotem zwraca HTTP 403.

## Wysyłanie do ramienia

Backend wysyła `POST` na endpoint wybrany przez portal. Nagłówki: `X-Player-ID` z portalu, `X-Game-ID` z portalu, `X-API-Key` z konfiguracji odpowiedniego ramienia oraz `Content-Type: application/json`. JSON zawiera `bit`, `timestamp_generation` w UTC i `metadata` z identyfikatorem zdarzenia. Klucz nie trafia do linku ani do przeglądarki.

`ARM_API_KEY` zawiera jeden wspólny klucz dla Alice i Boba. Opcjonalne `ARM_ALICE_API_KEY` i `ARM_BOB_API_KEY` nadpisują go dla konkretnego ramienia; przy wspólnym kluczu pozostaw je puste. `PORTAL_ADMIN_KEY` jest osobnym kluczem uprawniającym portal do tworzenia sesji. W opisie protokołu `very-secret-api-key` jest wartością przykładową, nie potwierdzonym kluczem.

Przed początkiem i po końcu slotu nie rozpoczynamy wysyłania bitów. Zaległe rekordy backendu po końcu slotu otrzymują status `blocked` z przyczyną `Slot ended`; pozostają do audytu. Nie są wysyłane w czasie kolejnego slotu. Żądanie już wysłane przed granicą czasu może zostać obsłużone przez urządzenie później — precyzyjne odcięcie odbioru wymaga również kontroli po stronie ramienia.

## Lokalny test pełnej integracji

Skonfiguruj lokalny mock zgodnie z README (`ARM_ALICE_URL=http://127.0.0.1:8790/bit`, `ARM_ALICE_API_KEY=local-test-only`), uruchom `npm run mock-arm` i `npm run server` w osobnych terminalach. Następnie:

```powershell
$portalKey = Read-Host 'PORTAL_ADMIN_KEY'
$slot = @{
  playerId = 'gracz-testowy'
  gameId = 'batyskaf'
  endpoint = 'http://127.0.0.1:8790/bit'
  startsAt = [DateTime]::UtcNow.AddSeconds(30).ToString('o')
  endsAt = [DateTime]::UtcNow.AddMinutes(2).ToString('o')
} | ConvertTo-Json
$session = Invoke-RestMethod 'http://127.0.0.1:8787/api/sessions' `
  -Method Post -ContentType 'application/json' `
  -Headers @{ Authorization = "Bearer $portalKey" } -Body $slot
Start-Process "http://127.0.0.1:8787$($session.launchPath)"
```

Oczekuj poczekalni, automatycznego startu i zakończenia po wskazanym terminie. Odbiornik zapisuje tylko bity wygenerowane w aktywnym slocie. Klucze mocka służą wyłącznie lokalnemu testowi.
