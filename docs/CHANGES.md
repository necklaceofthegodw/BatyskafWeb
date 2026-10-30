# 0.11.0 — urozmaicone tunele ze skrętami do 90°

- Sześć układów łączników: kolana 90°, esy, przesunięcia boczne, sekwencje lewo–prawo oraz łagodniejsze łuki. Pojedyncze skręty mają 30°, 45°, 60°, 75° lub 90°; odcinki proste oddzielają kolejne zakręty.
- Rozwidlenia mają trzy różne szerokości i kąty, zmieniające się między fragmentami i poziomami. Poszczególne układy są również odbijane w lewo/prawo.
- Zakręty powstają z dokładnych łuków kołowych o kontrolowanym promieniu, bez zawijania splajnu. Każdy fragment prowadzi dalej w dół; pozostają te same liczby poziomów i fragmentów.
- Walidacja: fizyczne ukończenie pięciu poziomów obiema odnogami, limit 90°, różnorodność kątów i bezpieczny promień krzywizny. Sprawdzenie 1641 odcinków osi rzeczywistych siatek w przeglądarce nie wykazało ścian przecinających trasę.

# 0.10.0 — łagodne zakręty i widoczne rakiety

- Rozwidlenia i łączniki mają szerokie, płynne łuki zamiast ciasnych zakrętów, które zawijały ściany do wnętrza tunelu. Wejście z powierzchni również ma większy promień.
- Geometria, kolizje i rozmieszczenie przeszkód korzystają z tych samych nowych tras. Zachowano pięć poziomów i liczby fragmentów 4/6/8/10/12; trasy są nieco dłuższe.
- Rakieta gracza korzysta z modelu pocisku potworów, jest nieco większa i startuje przed kadłubem z bocznej wyrzutni. Prędkość zmniejszona z 90 do 40 jednostek/s, czas lotu do 2,5 s. Celowanie uwzględnia położenie wyrzutni.
- Bez dodatkowych modeli i tekstur. Testy obejmują promienie zakrętów wszystkich poziomów, widoczny lot rakiety i fizyczne ukończenie kampanii obiema odnogami. Kontrola siatek w przeglądarce: 1291 odcinków osi tuneli bez ścian przecinających trasę.

# 0.9.0 — łagodniejsze spowolnienia i szybsze zagrożenia

- Gaz, czerwony meteor, trafienie wybuchem korala i przebicie przesłony zmniejszają aktualną prędkość o 50%. Napęd może ponownie rozpędzać pojazd; nie nakładamy długotrwałej kary do prędkości maksymalnej lub przyspieszenia.
- Gaz spowalnia jednokrotnie przy wejściu w obszar chmur. Pozostawanie w środku i nakładające się chmury nie powtarzają kary co klatkę.
- Potwory wykrywają z 80 zamiast 55 jednostek; początkowy czas reakcji skrócony z 1,8 do 0,3 s. Odstęp między strzałami jest o połowę krótszy na każdym poziomie.
- Czas życia pocisków obejmuje nowy zasięg. Limit pięciu aktywnych pocisków na potwora nie blokuje zwiększonej częstotliwości.
- Koral aktywuje się w zasięgu 80 jednostek, identycznym jak potwór, i wybucha po 3 zamiast 4,5 s. Animacja narastania jest zsynchronizowana z wybuchem.
- Zawiera większe modele wyborów i podpisy z poprawki 0.8.1.

# 0.8.1 — większe wybory w tunelach

- Modele modułów do wyboru powiększone o 35%.
- Większe podpisy umieszczone wyżej nad pierścieniami.

# 0.8.0 — prosty interfejs w stylu oryginału

- Menu zawiera tylko tytuł, wektorowy rysunek batyskafu, przycisk „Graj” w kształcie batyskafu oraz „Ustawienia” i „Jak grać”.
- Wskaźniki rozmieszczone przy krawędziach: pieniądze u góry po lewej, bateria i analogowy prędkościomierz na dole po lewej, pionowy głębokościomierz i mapa po prawej. Złote obramowania nawiązują do oryginalnego interfejsu.
- Usunięte ozdobne nagłówki, stopki i stała lista klawiszy. Sterowanie jest opisane w pomocy; celownik pojawia się podczas celowania.
- Sklep ma pięć prostych, niebieskich wierszy: nazwa, poziom ulepszenia, cena i wartość przed/po zakupie. Jedno zamknięcie przywraca grę.
- Okna zasłaniają wskaźniki i komunikaty rozgrywki. Układ dostosowuje się do mniejszych ekranów.
- Grafiki interfejsu są lekkimi SVG/CSS; brak nowych tekstur i dodatkowych kamer 3D.

# 0.7.0 — rozgrywka bez zapisu postępu

- Odświeżenie lub ponowne otwarcie gry zaczyna nową kampanię: poziom 1, bez pieniędzy, ulepszeń, rekordu ani zwycięstwa.
- Stare zapisy postępu są pomijane i zastępowane samymi preferencjami. Kolejka komunikacji ze stołem pozostaje niezależna.
- Głębokość wynosi 0 m przy każdym zanurzeniu i jest mierzona względem jego punktu startu. Dotyczy wszystkich pięciu poziomów i ponownych prób.
- Awans, pieniądze i zakupy działają w bieżącej rozgrywce, również podczas wizyt w oazie.

# 0.6.0 — pięć poziomów z powrotem do oazy

- Poziomy mają dokładnie 4, 6, 8, 10 i 12 fragmentów. Rozwidlenie liczy się jako jeden fragment niezależnie od wybranej odnogi; kolejny tunel jako drugi.
- Każdy poziom ma dodatkowy, oznaczony fragment końcowy bez przeszkód. Dopiero dotarcie do jego wyjścia zalicza poziom.
- Po ukończeniu poziomu batyskaf wraca na powierzchnię. Podsumowanie pokazuje ukończony poziom i odblokowany kolejny; można od razu zanurkować lub pozostać w oazie.
- Ukończenie poziomu 5 wyświetla gratulacje i kończy kampanię. Nie powstaje szósty poziom. Stan zwycięstwa jest zachowywany po odświeżeniu.
- Ręczny i awaryjny powrót nie zaliczają poziomu. Pieniądze, ulepszenia i odblokowany poziom pozostają zapisane. Trasa w obrębie każdego poziomu nadal prowadzi w dół.
- HUD pokazuje numer fragmentu i wyróżnia fragment końcowy.

Walidacja: 23 testy logiki, w tym fizyczne przepłynięcie wszystkich poziomów obiema odnogami, dokładne liczby fragmentów, warunki ukończenia i trwałość postępu. Test przeglądarkowy sprawdza pięć powrotów na powierzchnię, komunikaty oraz zachowanie zwycięstwa po odświeżeniu.

# 0.5.0 — ciągła wyprawa w dół

- Usunięte podjazdy i cofanie przebiegu rur przy przeliczaniu źródłowych krzywych. Boczne zakręty zostają, ale wysokość osi tuneli nie rośnie w kierunku postępu.
- Koniec etapu prowadzi bezpośrednio do następnego tunelu na głębokości poprzedniego zakończenia. Automatyczny powrót do oazy po ukończeniu etapu został usunięty; piąty etap kończy wyprawę pod wodą.
- Przejście zachowuje zebrany łup, pieniądze i liczniki wyprawy. Energia jest uzupełniana przy wejściu do kolejnego etapu. Identyfikatory decyzji uwzględniają etap, aby te same lokalne oznaczenia rozwidleń nie powodowały duplikatów.
- Powrót do oazy jest możliwy z menu lub po wyczerpaniu baterii. Ponowne zanurzenie, również po wczytaniu zapisu, zaczyna się na głębokości odblokowanego etapu.
- Oznaczenie końca tunelu zmienione z „WYJŚCIE” na „DALEJ W GŁĄB”. Komunikat powrotu rozróżnia decyzję gracza i wyczerpanie energii.

Walidacja: 22 testy logiki, w tym przejazd wszystkich pięciu etapów obiema odnogami, kontrola wysokości każdego odcinka i zachowania zapisu. Trzy testy przeglądarkowe obejmują przejścia między wszystkimi etapami, działanie gry oraz jasność tuneli w 20 konfiguracjach.

# 0.4.0 — kolekcja Marine Expedition

- 30 nowych autorskich modeli GLB: mosiężny batyskaf z turkusowym szkłem i osłoniętą śrubą, ryba mechanik, wszystkie typy przeszkód i stworów, osiem skarbów, pięć modułów ulepszeń, pociski i dekoracje etapów.
- Wspólny materiał i instancje powtarzanych modeli. Cała nowa kolekcja zajmuje około 1,4 MB bez kompresji; największy model ma 4576 trójkątów. Regeneracja bez Blendera: `python tools/build_marine_models.py`.
- Jasne ceramiczne panele tuneli, turkusowe łączenia, mosiężne mocowania i ciągłe pasy światła. Poprawione powtarzanie tekstury w obu osiach; detale są widoczne na całej długości rury. Jedna tekstura 512×512, bez dodatkowych lamp.
- Nowe sześcioczęściowe przesłony zachowują dotychczasowy cykl i kolizję. Kominy gazowe stoją na dnie, a chmura pozostaje w strefie zagrożenia.
- Wersjonowane adresy modeli zapobiegają używaniu starego kadłuba i ryby z pamięci podręcznej przeglądarki. Postęp i zasady rozgrywki pozostają zgodne.

Walidacja: test przeglądarkowy pełnego przepływu gry i test jasności w 20 konfiguracjach (pięć etapów × dwa kierunki × dwie jakości). Dodatkowo sprawdzono 36 załadowanych plików GLB, nieprzezroczystość nowych modeli, sześć zamkniętych/otwartych segmentów bramy oraz brak błędów JavaScript. Pomiar lokalny Chrome, 1440×900, RTX 3060: w pięciu nieruchomych widokach tuneli mediana około 16,7 ms/klatkę i 42–52 wywołania rysowania. To próbka ze sprzętu testowego, nie gwarancja dla innych urządzeń.

# 0.3.0 — równomiernie oświetlone tunele

- Nowy model oświetlenia: jasne, teksturowane ściany z wbudowanym światłem i łagodnym cieniowaniem wierzchołków. Widoczność nie zależy od reflektora ani kierunku patrzenia.
- Brak mgły, dynamicznych cieni i ciemnej winiety w tunelach. Cztery ciągłe pasy światła są częścią tekstury, bez dodatkowych lamp i siatek.
- Równomierne światło dla pojazdu i przeszkód. Nowe oświetlenie działa również w jakości oszczędnej.
- Test pikseli sprawdza wszystkie pięć etapów, oba kierunki patrzenia i obie jakości, po wyłączeniu wszystkich lamp sceny.

# 0.2.0 — łatwiejsze prowadzenie i widoczne tunele

- Czułość myszy zmniejszona o około 57%, z wygładzaniem i limitem prędkości obrotu. Duży pojedynczy skok kursora nie obraca całego widoku. Pion ma dodatkowo łagodniejszą reakcję.
- A/D i ←/→ skręcają, ↑/↓ sterują w pionie. S i Spacja hamują. W i F zachowują dotychczasowe działanie.
- Mniejsza prędkość bazowa i szybsza zmiana kierunku prędkości ograniczają poślizg na zakrętach. Kolizja ze ścianą nie odbija pojazdu w przeciwną stronę.
- Średnica tuneli zwiększona z 14 do 20 m. Łuki rozwidleń mają więcej miejsca; kamery nie trzeba trzymać tak daleko za pojazdem.
- Naprawione zapadanie punktów krzywej na odcinkach źródłowych biegnących wzdłuż osi Y. Kolejność punktów i modułów pozostaje zachowana, lecz krzywe mają łagodniejszy profil dla wersji web.
- Jaśniejsze materiały i światło otoczenia, szeroki reflektor oraz znacznie rzadsza mgła. Obwódki tuneli pomagają odczytać trasę bez dodawania kolejnych dynamicznych świateł.
- Zamknięte przesłony i ich kolizje dostosowane do większej średnicy. Nie da się ich po prostu ominąć przy ścianie.
- Zapisy i kupione ulepszenia pozostają zgodne z dotychczasową wersją. Zmiana bazowej czułości dotyczy również wcześniej zapisanych ustawień.

Walidacja: 19 testów logiki, w tym 10 pełnych przejść etapów z normalnym ograniczeniem tempa skrętu i hamowaniem. Osobne testy obejmują łagodny obrót, gwałtowny skok myszy, zatrzymanie oczekującego obrotu po pauzie, usuwanie bocznego poślizgu i szczelność przesłony przy ścianie. Test przeglądarkowy sprawdza również nowe klawisze oraz jednoczesne użycie kilku klawiszy tego samego działania.
