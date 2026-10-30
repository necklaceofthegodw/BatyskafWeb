# Walidacja wersji web 0.1.0

Data: 28.10.2026. Windows, Node.js 24.14.1. Pakiet produkcyjny zbudowany i uruchomiony lokalnie na porcie 8787.

## Testy logiki i komunikacji

`npm test`: **15 testów, wszystkie zaliczone**.

- Kolejność pięciu etapów i deterministyczne układy/spawny.
- Fizyczne przepłynięcie każdego etapu obiema drogami z podstawowym wyposażeniem: 10 przejść z normalną symulacją ruchu, energią, przeszkodami, strzałami i zbieraniem węgorzy. Test nie teleportuje pojazdu do końca i nie uzupełnia mu baterii ręcznie.
- Awans po ukończeniu, zwycięstwo po piątym etapie, brak awansu przy wyczerpaniu baterii; zachowanie pieniędzy i ulepszeń przy porażce.
- Poprawne ceny, brak zakupu bez środków i ponad maksimum; walidacja uszkodzonego zapisu.
- Zgodna symulacja przy renderowaniu 30, 60 i 144 FPS; zatrzymanie energii i strzelania w pauzie.
- Ograniczenia wnętrza rury i kopuły; jednokrotne zbieranie łupu, wybór jednej opcji bonusu i deduplikacja decyzji rozwidlenia.
- Autoryzacja sesji, brak sekretu ramienia w API przeglądarki, odrzucanie błędnych bitów i dat UTC.
- Trwała deduplikacja, ponowienie po 503 i restarcie SQLite, zachowanie czasu i treści; blokowanie 401 i administracyjne ponowienie.
- Rzeczywisty HTTP POST do lokalnego odbiornika z kompletem wymaganych nagłówków i właściwym JSON-em.

## Przeglądarki

Pełny scenariusz Playwright przeszedł w czterech konfiguracjach:

| Konfiguracja                               | Wynik     |
| ------------------------------------------ | --------- |
| Chromium dostarczany przez Playwright      | Zaliczone |
| Google Chrome zainstalowany na komputerze  | Zaliczone |
| Microsoft Edge zainstalowany na komputerze | Zaliczone |
| Firefox dostarczany przez Playwright       | Zaliczone |

Scenariusz obejmuje prawdziwy WebGL i wszystkie GLB, wejście do gry, zanurzenie, napęd, pauzę bez zużywania energii, zakup i odtworzenie ulepszenia po odświeżeniu, izolację kolejek sesji, osiem restartów bez wzrostu liczby siatek/materiałów/tekstur oraz renderowanie każdego etapu. Nie odnotowano błędów JavaScript ani żądań do zewnętrznych domen.

Chromium/Chrome/Edge używały SwiftShader dla powtarzalności. Firefox pracował w profilu testowym ze włączonym WebGL i renderowaniem programowym. Osobny test pakietu produkcyjnego w Chrome korzystał z rzeczywistej RTX 3060.

Powtórzenie macierzy na Windows:

```powershell
npx playwright install chromium firefox
$env:BATYSKAF_BROWSER_MATRIX='1'
npm run test:e2e
```

Wariant rozszerzony zakłada zainstalowane Chrome i Edge. Bez zmiennej działa podstawowy test Chromium. Safari i urządzenia dotykowe nie zostały zweryfikowane.

## Pakiet i wydajność

`npm run build`: TypeScript i Vite — sukces. `npm audit`: **0 zgłoszonych podatności** w sprawdzonych zależnościach.

- Cały katalog wydania: około **3,35 MB** nieskompresowanych plików, także z opcjonalnymi fragmentami shaderów silnika.
- Osiem modeli GLB: **209 540 bajtów** łącznie.
- Główny moduł po optymalizacji importów: około **1,06 MB**, około **253 KB** po gzip. Pełne pierwsze pobranie obejmuje też zależności, shadery, CSS i modele.
- Zasoby pobrane do gotowego menu produkcyjnego: około **2,36 MB**. Backend lokalny nie kompresował ich w tym pomiarze.
- Gotowe menu w świeżym kontekście przeglądarki: **1,38 s**, localhost; to nie pomiar przez internet.
- Kod produkcyjny nie udostępnia `window.__BATYSKAF_TEST__`.

GPU: Google Chrome 156.0.8078.49, NVIDIA GeForce RTX 3060, ANGLE/D3D11, 1440×900. Po 2,2 s stabilizacji każdego widoku:

| Widok         | Jakość    | FPS | Wywołania rysowania/klatkę | Aktywne trójkąty |
| ------------- | --------- | --: | -------------------------: | ---------------: |
| Oaza          | Wysoka    |  60 |                         63 |           46 999 |
| Oaza          | Oszczędna |  60 |                         54 |           46 999 |
| Etap 1, tunel | Wysoka    |  60 |                        117 |           54 896 |
| Etap 1, tunel | Oszczędna |  60 |                        111 |           54 896 |
| Etap 5, tunel | Wysoka    |  60 |                         68 |           31 893 |
| Etap 5, tunel | Oszczędna |  60 |                         62 |           31 893 |

To próbki wybranych widoków, z zatrzymaną symulacją i działającym rendererem/animacjami, a nie pomiar najgorszego przypadku podczas całej walki. Nie deklarujemy wyniku na nieprzetestowanym słabym laptopie. Budżety sceny zostały dotrzymane w tych próbkach.

Surowy wynik: [measurements.json](measurements.json). Odtworzenie: uruchom `npm run dev` i `npm run server`, następnie `npm run measure`. Pomiar wymaga lokalnego Chrome, sprawdza również produkcyjny start, zanurzenie i pauzę; zapisuje obrazy do `.local/`.

## Granice wydania

- Sprzęt sprawdzono przez lokalny odbiornik. Brak danych rzeczywistego portalu i IP/PORT ramion uniemożliwia test w sieci Politechniki; konfiguracja i API są gotowe.
- To nowa implementacja: zachowane dane kampanii, ekonomii i profile modułów; powierzchnie, oświetlenie, efekty i ruch są generowane/dostrojone dla web. Obraz i fizyka nie są identyczne z Unrealem.
- Kontynuacja przywraca oazę i odblokowany etap; odświeżenie nie odtwarza pozycji i pocisków w środku bieżącej próby.
- Niewysłane decyzje wygasłej sesji pozostają do eksportu. Nowa sesja nie przejmuje ich samoczynnie; wymagają obsługi operatora portalu.
- Dostarczenie „dokładnie raz” do ramienia wymaga deduplikacji `metadata.event_id` przez odbiornik.

Implementacja web nie edytowała istniejących map Unreal ani pozostałych zmian użytkownika.
