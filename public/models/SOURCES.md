# Pochodzenie zasobów

Wersja 0.4 zawiera 30 nowych, autorskich modeli kolekcji Marine Expedition, wykonanych dla tej gry. Nie pobierano modeli ani tekstur z zewnętrznych serwisów podczas działania gry.

- `submarine.glb`, `fish.glb`, wszystkie `marine-*.glb`: nowe modele zdefiniowane w `tools/build_marine_models.py`. Batyskaf, śruba, ryba mechanik, węgorz, potwór, koral, osiem skarbów, pięć modułów, dwa meteory, komin gazowy, rama bramy i ruchoma przesłona, cztery dekoracje oraz dwa pociski. To samodzielne pliki GLB z geometrią i kolorami wierzchołków, bez zewnętrznych tekstur. Regeneracja: `python tools/build_marine_models.py`.
- `SM_Tree_Round`, `SM_Tree_Lime`, `SM_Tree_Sage`: `ArtSource/LowPolyTrees/LowPolyTrees.blend`.
- `SM_Eco_Broadleaf`, `SM_Eco_FanPlant`, `SM_Eco_ShoreRock`: `ArtSource/EcoSanctuary/EcoSanctuary.blend`.

Powierzchnia wyspy, kopuła, tunele, efekty gazu, oznaczenia nawigacyjne, tekstura paneli tunelu i dźwięki są tworzone lokalnie przez kod wersji web. Nie użyto oprawy ani zasobów World of Warcraft. Sześć zachowanych modeli roślinności i skał oazy pochodzi z dotychczasowego projektu, jak wskazano powyżej.

`marine-manifest.json` podaje trójkąty i rozmiary nowego zestawu; `manifest.json` zawiera też zachowane modele oazy. Nowe modele korzystają ze wspólnego nieprzezroczystego materiału, a powtarzane obiekty z instancji geometrii. Skrypty `tools/export_unreal_assets.py`, `tools/convert_assets.py`, `tools/export_crossroads.py` i `tools/prepare_crossroads.py` dokumentują historyczną konwersję zasobów UE; nie służą do regenerowania kolekcji 0.4.

Prawa do oryginalnych zasobów pozostają takie jak w projekcie źródłowym. Konwersja formatu nie nadaje im nowej licencji.
