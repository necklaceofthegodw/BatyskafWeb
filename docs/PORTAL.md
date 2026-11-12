# Portal: poczekalnia i slot gry

Backend gry przyjmuje dane portalu przez `POST /api/sessions`. Portal wykonuje to żądanie po stronie swojego serwera, z nagłówkiem `Authorization: Bearer <PORTAL_ADMIN_KEY>` i `Content-Type: application/json`.

```json
{
  "playerId": "identyfikator-gracza-z-portalu",
  "armEndpoint": "http://157.158.83.183:8001/api/v1/data",
  "portalEndpoint": "https://portal.example/gry",
  "startAt": "2026-11-20T10:00:00Z",
  "endAt": "2026-11-20T10:15:00Z"
}
```

Body zawiera wyłącznie pięć wymaganych pól pokazanych powyżej. Daty są przykładem: portal podaje rzeczywisty slot w ISO 8601 ze strefą czasową (`Z` oznacza UTC). Slot musi trwać ponad 10 sekund i kończyć się w przyszłości. `armEndpoint` musi dokładnie odpowiadać `ARM_ALICE_URL` lub `ARM_BOB_URL`. `portalEndpoint` jest absolutnym adresem HTTP(S) bez danych logowania, używanym wyłącznie do przekierowania przeglądarki; backend nie wysyła pod niego danych ani wyników. Id gry jest stałe: `batyskaf`.

Odpowiedź zawiera `token`, `expiresAt`, terminy slotu w milisekundach Unix oraz `launchPath`, np. `/waiting#session=…`. Portal otwiera `https://domena-backendu-gry` + `launchPath`. Strona `/waiting` i API muszą być serwowane przez ten sam backend lub reverse proxy. Sam statyczny hosting Sites nie uruchamia backendu Node/SQLite.

- Przed początkiem slotu gracz widzi poczekalnię z odliczaniem, bez możliwości rozpoczęcia gry.
- W chwili początku slotu gra automatycznie otwiera oazę. Dla slotów nie ma dodatkowego pięciosekundowego oczekiwania.
- O `endAt - 10 sekund` gra zatrzymuje się i pokazuje podsumowanie: maksymalna głębokość, najwyższy osiągnięty poziom (1–5), wszystkie zdobyte pieniądze (łup i nagrody za poziomy). Zakupy nie zmniejszają sumy zdobytych pieniędzy. Obowiązuje to również w ustawieniach, sklepie i pauzie.
- O `endAt` następuje automatyczne przekierowanie do `portalEndpoint`. Powrót jest sprawdzany także niezależnym timerem i po powrocie do nieaktywnej karty. W iframe przekierowanie dotyczy ramki gry.
- Odświeżenie strony pobiera terminy z backendu. Statystyki są zachowywane w `sessionStorage` dla danej sesji, także po rozpoczęciu nowej kampanii. Jeśli magazyn przeglądarki jest niedostępny, pozostają w pamięci. Po ponownym otwarciu zakończonego slotu następuje powrót do portalu. Token pozostaje ważny godzinę po końcu slotu; nie przedłuża to gry.
- Bez tokenu działa lokalna gra z pięciosekundowym menu, bez slotu i bez wysyłania do ramion.

Przeglądarka ustala zegar na podstawie `serverTime` z `GET /api/session` i monotonicznego zegara przeglądarki. Tym samym zegarem oznaczane są generowane decyzje. Backend niezależnie kontroluje aktualny czas i czas wygenerowania decyzji; poza slotem zwraca HTTP 403.

## Wysyłanie do ramienia

Backend wysyła `POST` na `armEndpoint`. Nagłówki: `X-Player-ID` z portalu, `X-Game-ID: batyskaf`, `X-API-Key` z konfiguracji oraz `Content-Type: application/json`. JSON zawiera `bit`, `timestamp_generation` w UTC i `metadata` z identyfikatorem zdarzenia. Klucz nie trafia do linku ani do przeglądarki.

`ARM_API_KEY` zawiera jeden wspólny klucz dla Alice i Boba. Opcjonalne `ARM_ALICE_API_KEY` i `ARM_BOB_API_KEY` nadpisują go dla konkretnego ramienia; przy wspólnym kluczu pozostaw je puste. `PORTAL_ADMIN_KEY` jest osobnym kluczem uprawniającym portal do tworzenia sesji. W opisie protokołu `very-secret-api-key` jest wartością przykładową, nie potwierdzonym kluczem.

Backend przyjmuje i rozpoczyna wysyłanie bitów wyłącznie od `startAt` do `endAt - 10 sekund`. Zaległe rekordy po tej granicy otrzymują status `blocked` z przyczyną `Slot ended`; pozostają do audytu. Żądanie rozpoczęte przed granicą może zostać odebrane przez urządzenie później.

## Lokalny test pełnej integracji

Skonfiguruj lokalny mock zgodnie z README (`ARM_ALICE_URL=http://127.0.0.1:8790/bit`, `ARM_ALICE_API_KEY=local-test-only`), uruchom `npm run mock-arm` i `npm run server` w osobnych terminalach. Następnie:

```powershell
$portalKey = Read-Host 'PORTAL_ADMIN_KEY'
$slot = @{
  playerId = 'gracz-testowy'
  armEndpoint = 'http://127.0.0.1:8790/bit'
  portalEndpoint = 'http://127.0.0.1:8787/'
  startAt = [DateTime]::UtcNow.AddSeconds(30).ToString('o')
  endAt = [DateTime]::UtcNow.AddMinutes(2).ToString('o')
} | ConvertTo-Json
$session = Invoke-RestMethod 'http://127.0.0.1:8787/api/sessions' `
  -Method Post -ContentType 'application/json' `
  -Headers @{ Authorization = "Bearer $portalKey" } -Body $slot
Start-Process "http://127.0.0.1:8787$($session.launchPath)"
```

Oczekuj poczekalni, automatycznego startu, podsumowania 10 sekund przed końcem i powrotu o `endAt`. W tym lokalnym przykładzie adresem powrotnym jest strona główna gry; dla rzeczywistego portalu wpisz jego adres. Klucze mocka służą wyłącznie lokalnemu testowi.
