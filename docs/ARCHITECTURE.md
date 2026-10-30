# Budowa wersji web

## Moduły

- `src/game/core.ts`: symulacja 60 kroków/s, stany rozgrywki, ruch, kolizje, przeciwnicy, łup, ekonomia i decyzje. Nie zależy od DOM ani renderera.
- `src/game/layout.ts`: kampania i połączone trasy. `src/data/source.json` zachowuje kolejność modułów, tabele ekonomii i oryginalne punkty krzywych. `crossroads.json` zawiera ścieżki odczytane z rzeczywistych gniazd siedmiu Blueprintów.
- `src/render/world.ts`: Babylon.js/WebGL, lokalne GLB, oaza, wnętrza rur, kamera, światła, geometria przeszkód i ograniczony wizualny łańcuch łupu.
- `src/game/input.ts`: W, mysz, F, zoom; zerowanie klawiszy i pauza przy utracie fokusu.
- `src/ui/`: HTML/CSS, HUD, sonar trasy, menu, ustawienia, sklep i ekrany końcowe.
- `src/services/`: IndexedDB, komunikacja portalowa i lokalnie syntezowany dźwięk.
- `server/`: Fastify, krótkotrwałe sesje, SQLite/WAL, trwała kolejka i HTTP do jednego przypisanego ramienia.

## Przebieg

Menu → oaza → zanurzenie → kolejne pary rozwidlenie/krzywa → powrót → oaza. Ukończenie piątego etapu pokazuje zwycięstwo. Wyczerpanie baterii odnawia bieżący etap bez cofania zakupów i pieniędzy. Pauza zatrzymuje ruch, energię, pociski i efekty czasowe.

Wersja web używa wymiarów dostosowanych do przeglądarkowego modelu ruchu. Rozgałęzienia powstają z gniazd oryginalnych elementów, krzywe zachowują profil oryginalnych punktów. Łączenia i powierzchnie są generowane ponownie; nie są to identyczne siatki, shadery ani fizyka Unreala. Skala, prędkości i palety są świadomie dostrojone do nowej implementacji.

## Koszt sceny

Aktywna jest jedna kampania etapu, z widocznością najbliższych sektorów. Odległe korzenie dekoracji, przeciwnicy i siatki są wyłączane. Świat oazy jest wyłączany pod powierzchnią, a tunele podczas pobytu w oazie. Drzewa i rośliny korzystają z instancji i współdzielonych materiałów/geometrii. Dekoracje tuneli są scalane. Pociski i odłamki mają pule; wizualizacja liny pokazuje najwyżej 14 elementów bez ograniczania wartości faktycznie zebranego łupu.

Zmiana etapu i restart zwalniają siatki tuneli i tekstury podpisów. Materiały wspólne pozostają w pamięci. Tryb oszczędny obniża rozdzielczość renderowania i wyłącza cienie. Nie ma ciężkiego silnika fizyki, tekstur wielkiej rozdzielczości ani płatnych usług zewnętrznych.

## Zapis i decyzje

Zapis postępu i kolejka decyzji korzystają z IndexedDB. Postęp jest przypisany do gry/gracza, a kolejka do sesji backendu. Każda decyzja ma stabilny identyfikator i czas UTC nadany podczas generowania. Po ACK serwera lokalna pozycja jest oznaczana jako przyjęta, a serwer odpowiada za dalsze ponowienia.

Sekret administracyjny oraz klucze ramion nie występują w kliencie. Token sesji jest haszowany w SQLite. Sesja określa gracza, grę i jedno ramię. Backend nie przyjmuje dowolnego adresu ramienia od przeglądarki.

W produkcyjnej kompilacji nie ma `window.__BATYSKAF_TEST__`. Jest on dostępny wyłącznie w serwerze deweloperskim z `?diagnostics=1` do testów symulacji i renderera.
