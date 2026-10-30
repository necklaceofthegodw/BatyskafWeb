# Batyskaf — gra 3D w przeglądarce

Samodzielna implementacja w TypeScript, Babylon.js i HTML/CSS. Obraz powstaje na komputerze gracza. Gra nie wymaga uruchomionego Unreala ani Pixel Streamingu.

## Publikacja publiczna

Skonfigurowany adres Sites: https://batyskaf-oaza.xiens2.chatgpt.site/ (dostępny po udanym wdrożeniu). Dostęp jest publiczny; gra działa bez logowania. Postęp obowiązuje tylko w bieżącej rozgrywce. Odświeżenie lub ponowne otwarcie gry rozpoczyna kampanię od zera. Zapisywane są wyłącznie preferencje i osobna kolejka decyzji do stołu. Hosting serwuje statyczną grę; połączenie z ramionami wymaga osobnej konfiguracji backendu portalu.

Tożsamość hostingu jest zapisana w `.openai/hosting.json`. `node tools/prepare-site.mjs` przygotowuje osobny katalog źródeł do publikacji w `.sites-checkout/batyskaf-public`, bez map Unreal, kluczy i lokalnych baz danych. Synchronizację źródeł, archiwizację i wdrożenie wykonuje narzędzie Sites.

## Uruchomienie

Wymagany Node.js 24. Sprawdzono na Windows, Node 24.14.1.

```powershell
cd "C:\Users\xiens\Documents\Unreal Projects\Batyskaf\WebGame"
npm ci
npm run build
npm run server
```

Otwórz **http://127.0.0.1:8787/**. Bez sesji portalowej gra działa lokalnie, przechowuje postęp tylko w pamięci bieżącej rozgrywki, a preferencje i historię decyzji w przeglądarce. Po zamknięciu serwera uruchom go ponownie ostatnim poleceniem. Nie otwieraj `index.html` przez `file://`.

Do pracy nad kodem: `npm run dev` → http://127.0.0.1:5173/. Zmiany są odświeżane automatycznie; `/api` jest przekazywane do backendu na 8787.

## Łatwiejsze sterowanie

Mysz ma ograniczoną prędkość obrotu i wygładzenie. A/D lub ←/→ skręcają, ↑/↓ kierują w pionie, W uruchamia napęd, S albo Spacja hamują. Pojazd szybciej podąża za kierunkiem patrzenia i ma spokojniejszą prędkość bazową. Tunele mają 20 m średnicy. W wersji 0.3 jasne panele ścian mają stałe oświetlenie, cztery świetlne pasy i pełną widoczność bez mgły oraz ciemnej winiety.

## Prosty interfejs

Wersja 0.8 ma menu z tytułem, ilustracją i przyciskiem w kształcie batyskafu. Wskaźniki z mosiężnymi obramowaniami znajdują się przy krawędziach ekranu. Sklep pokazuje cenę oraz wartość przed i po zakupie. Sterowanie jest dostępne w „Jak grać”, a ustawienia w menu i pauzie.

## Co można zrobić

Wersja 0.6 ma pięć skończonych poziomów: odpowiednio 4, 6, 8, 10 i 12 fragmentów. Rozwidlenie (niezależnie od wybranej odnogi) i następujący po nim tunel to dwa fragmenty. Po nich występuje dodatkowy fragment końcowy z wyjściem na powierzchnię. W oazie pojawia się podsumowanie i informacja o odblokowaniu kolejnego poziomu. Po piątym poziomie następuje zwycięstwo. Powrót ręczny lub po wyczerpaniu baterii nie zalicza poziomu; kolejne zanurzenie zaczyna od początku odblokowanego poziomu.

Wersja 0.4 zastępuje batyskaf, rybę ulepszeń i obiekty podwodne autorską kolekcją 30 modeli. Tunele mają powtarzalne ceramiczne panele i kontrastowe łączenia, dzięki którym widać kształt zakrętów oraz ruch pojazdu. Opis zmian: [CHANGES](docs/CHANGES.md).

- Zwiedzić oazę pod fioletową kopułą; wpłynąć do wejścia albo użyć przycisku zanurzenia.
- Przejść pięć etapów: Płytkie kanały, Omszałe tunele, Korytarze koralowe, Głębokie ruiny, Rdzeń głębin.
- Wybierać drogę, zbierać łup sonarem, ładować baterię węgorzami, korzystać z bonusów.
- Przebijać przesłony prędkością albo rakietą; omijać gaz i meteory, uciekać przed koralami, walczyć z potworami i ich pociskami.
- Kupować cztery poziomy pięciu ulepszeń u ryby w oazie.
- Wracać po wyczerpaniu energii, zachowując pieniądze i ulepszenia; ukończyć kampanię.
- Zacząć nową kampanię po odświeżeniu, zmieniać jakość obrazu i pobrać historię decyzji z menu pauzy.
- Przy każdym zanurzeniu zaczynać pomiar głębokości od 0 m, względem punktu startu batyskafu.

| Sterowanie                   | Działanie                 |
| ---------------------------- | ------------------------- |
| Kliknięcie sceny             | Przechwycenie myszy       |
| Mysz                         | Kierunek batyskafu        |
| W                            | Napęd                     |
| Spacja                       | Hamowanie                 |
| Przytrzymanie / puszczenie F | Celowanie / strzał        |
| Kółko myszy                  | Odległość kamery          |
| Escape                       | Pauza, uwolnienie kursora |

Po wejściu do oazy kursor pozostaje dostępny dla przycisków. Podczas sterowania myszą przyciski oazy są również dostępne przez Escape. Wyjście z przechwycenia, zmiana karty i utrata fokusu wstrzymują grę.

## Integracja z portalem i stołem

Backend gry jest gotowym pośrednikiem. Backend portalu tworzy sesję z tożsamością gracza i ramieniem; przeglądarka dostaje wyłącznie token sesji. Adresy ramion i ich klucze znajdują się po stronie serwera.

1. Skopiuj `.env.example` do `.env`; uzupełnij `PORTAL_ADMIN_KEY`, adres i klucz odpowiedniego ramienia. `.env` jest ignorowany przez Git. Backend wczytuje go przy uruchomieniu.
2. Backend portalu wywołuje `POST /api/sessions`, z nagłówkiem `Authorization: Bearer <PORTAL_ADMIN_KEY>` i JSON-em:

```json
{ "playerId": "id-z-portalu", "gameId": "batyskaf", "arm": "alice", "ttlSeconds": 7200 }
```

3. Odpowiedź zawiera `token`, `expiresAt` i `launchFragment`. Portal otwiera adres gry z otrzymanym fragmentem, np. `https://domena-gry/#session=<token>`. Token jest usuwany z widocznego adresu po odczycie i zachowywany w `sessionStorage` do odświeżenia tej karty.
4. Gra wysyła decyzje do `/api/choices`; backend potwierdza zapis w SQLite, a następnie przesyła je do przypisanego ramienia.

```http
POST <ARM_ALICE_URL albo ARM_BOB_URL>
X-Game-ID: batyskaf
X-Player-ID: id-z-portalu
X-API-Key: klucz-z-konfiguracji-serwera
Content-Type: application/json
```

```json
{
  "bit": 1,
  "timestamp_generation": "2026-10-28T12:00:00.123Z",
  "metadata": {
    "event_id": "staly-identyfikator-zdarzenia",
    "session_id": "identyfikator-rozgrywki",
    "sequence": "1",
    "game_time": 12.4,
    "attempt": 1,
    "type": "fork",
    "option": "left",
    "level": 1
  }
}
```

Na rozwidleniu: lewo = 1, prawo = 0. Bonusy, przesłony, meteory, korale, potwory i trafienia/uniki pocisków również mają zdarzenia decyzji. Reguły Mastera pozostają po stronie stołu; gra nie czeka na jego gotowość.

`202` z backendu potwierdza trwały zapis decyzji, nie wykonanie eksperymentu. `GET /api/delivery` z tokenem gracza zwraca liczniki `pending`, `delivered`, `blocked`. Błędy sieci, 5xx, 408 i 429 są ponawiane; inne 4xx trafiają do `blocked`. Powtórzony identyfikator z tą samą treścią jest deduplikowany; zmieniona treść daje 409. Czas wygenerowania i identyfikator pozostają stałe przy ponawianiu.

Po poprawieniu konfiguracji i restarcie backendu administrator może ponowić zablokowane rekordy przez `POST /api/admin/retry-blocked`, autoryzację administracyjną i JSON `{"arm":"alice"}`. Zmiana adresu ramienia blokuje poprzednią kolejkę do takiej świadomej operacji.

Postęp jest odrębny dla gry/gracza, kolejka przeglądarki — dla konkretnej sesji portalowej. Nowa sesja Boba nie wyśle zaległości Alicji. Niewysłane zdarzenia starej, wygasłej sesji pozostają w historii do eksportu i wymagają obsługi przez administratora; nie przypisujemy ich samodzielnie nowej sesji. Przy braku trwałego magazynu przeglądarka pokazuje komunikat; pamięć awaryjna nie przetrwa zamknięcia strony.

Pełne dostarczenie „dokładnie raz” do ramienia wymaga obsługi `metadata.event_id` przez odbiornik. Po utracie odpowiedzi HTTP może wystąpić ponowienie mimo odebrania wcześniejszego żądania.

## Lokalny test komunikacji bez stołu

W dodatkowym terminalu: `npm run mock-arm`. Odbiornik nasłuchuje wyłącznie na `127.0.0.1:8790/bit` i zapisuje `.local/mock-arm.jsonl`. Domyślny klucz testowy to `local-test-only`.

W konfiguracji backendu ustaw `ARM_ALICE_URL=http://127.0.0.1:8790/bit`, `ARM_ALICE_API_KEY=local-test-only` i własny `PORTAL_ADMIN_KEY`. Uruchom backend ponownie, a następnie w PowerShell:

```powershell
$portalKey = Read-Host 'PORTAL_ADMIN_KEY'
$launch = Invoke-RestMethod http://127.0.0.1:8787/api/sessions -Method Post `
  -Headers @{ Authorization = "Bearer $portalKey" } -ContentType application/json `
  -Body '{"playerId":"test-player","gameId":"batyskaf","arm":"alice"}'
"http://127.0.0.1:8787/$($launch.launchFragment)"
```

Otwórz otrzymany link i wykonaj wybór w grze. W terminalu odbiornika pojawi się odebrany bit. Klucza testowego nie używaj dla prawdziwego ramienia.

## Wdrożenie

`dist/` zawiera statyczny frontend. Backend (`npm run server`) może serwować go razem z API; w produkcji umieść tę usługę za serwerem HTTPS i nadzorem procesu. Dane `.local/portal.sqlite` wraz z plikami WAL muszą mieć trwały wolumin. Kopię SQLite wykonuj jego mechanizmem backupu albo po poprawnym zatrzymaniu procesu.

Portal osadzający grę w iframe musi dopuścić przechwycenie kursora i pełny ekran, np. `allow="fullscreen"`; jeśli używa `sandbox`, potrzebne są również `allow-scripts allow-same-origin allow-pointer-lock allow-downloads`. W pierwszej konfiguracji najprościej otwierać grę jako osobną stronę. API i gra powinny mieć wspólne pochodzenie; nie ma ogólnego CORS dla obcych domen.

Nie ma jeszcze podłączonej rzeczywistej sesji portalu Politechniki ani adresów sprzętu. Gotowy kontrakt i odbiornik lokalny pozwalają wykonać tę integrację po dostarczeniu konfiguracji.

## Testy i źródła

```powershell
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Zobacz [architekturę](docs/ARCHITECTURE.md), [wyniki walidacji](docs/VALIDATION.md) i [pochodzenie modeli](public/models/SOURCES.md). Zatwierdzony plan oraz audyt gry Unreal znajdują się w `../Docs/WebRewrite/`.

Runtime JSON i GLB są dołączone. Zwykłe uruchomienie i budowanie nie wymagają eksportera, Blendera, Unreala ani dostępu do katalogu `Saved`.
